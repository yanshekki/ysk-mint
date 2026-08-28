import { useEffect, useMemo, useState } from "react";
import { TOKEN_CATALOG, cardanoByUnit, solByMint } from "./tokenRegistry.ts";
import { cacheGet, cacheHash, cacheKey, POLICIES } from "./defi/cache.ts";
import { koiosPost } from "./koios.ts";
import { trackLive, useLiveStatus } from "./liveStatus.ts";
import type { AddrKind } from "./addrKind.ts";
import {
  BS_TX,
  SCAN_TX,
  addFlow,
  chainMeta,
  classifyTx,
  fmtAmt,
  isZeroAddr,
  mergeTxRows,
  methodLabel,
  nativeDecimals,
  protocolName,
  retouch,
  txExplorer,
  type TxFlow,
  type TxKind,
  type TxRow,
} from "./txIndex.ts";
import { applyTags } from "./addrLabels.ts";

const PAGE = 40;
const SOL_RPCS = [
  "https://solana.leorpc.com/?api_key=FREE",
  "https://solana-rpc.publicnode.com",
  "https://api.mainnet-beta.solana.com",
];

type AddrIn = { kind: AddrKind; value: string };

function oursSet(addrs: AddrIn[]) {
  return new Set(addrs.map((a) => a.value.toLowerCase()));
}

function tokenMeta(chainId: number, address?: string, symbol?: string, decimals?: number, icon?: string) {
  const hit = TOKEN_CATALOG.find(
    (t) => t.chainId === chainId && ((address && t.address?.toLowerCase() === address.toLowerCase()) || (!address && t.native)),
  );
  return {
    symbol: hit?.symbol || symbol || "TOKEN",
    icon: icon || hit?.icon || chainMeta(chainId).icon,
    decimals: hit?.decimals ?? decimals ?? 18,
  };
}

async function httpJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    return await cacheGet(
      { key: cacheKey("http.tx", 0, cacheHash(url + (typeof init?.body === "string" ? init.body : ""))), policy: POLICIES.account },
      async () => {
        const ctrl = new AbortController();
        const t = window.setTimeout(() => ctrl.abort(), 18000);
        try {
          const res = await fetch(url, { ...init, signal: ctrl.signal });
          if (!res.ok) throw new Error(String(res.status));
          return (await res.json()) as T;
        } finally {
          window.clearTimeout(t);
        }
      },
    );
  } catch {
    return null;
  }
}

type BsParty = {
  hash?: string;
  name?: string;
  ens_domain_name?: string;
  is_contract?: boolean;
  is_scam?: boolean;
  reputation?: string;
};
type BsTok = {
  transaction_hash?: string;
  tx_hash?: string;
  timestamp?: string;
  method?: string | null;
  type?: string;
  token?: {
    address_hash?: string;
    symbol?: string;
    name?: string;
    decimals?: string;
    type?: string;
    reputation?: string;
    icon_url?: string;
  };
  total?: { value?: string; decimals?: string; token_id?: string };
  from?: BsParty;
  to?: BsParty;
  token_type?: string;
};
type BsTx = {
  hash?: string;
  timestamp?: string;
  method?: string | null;
  status?: string;
  result?: string;
  value?: string;
  fee?: { value?: string };
  from?: BsParty;
  to?: BsParty;
  transaction_types?: string[];
  token_transfers?: BsTok[];
  decoded_input?: { method_call?: string };
};

function tsOf(iso?: string, unix?: string | number) {
  if (iso) {
    const n = Date.parse(iso);
    if (Number.isFinite(n)) return Math.floor(n / 1000);
  }
  const u = Number(unix);
  return Number.isFinite(u) && u > 0 ? u : 0;
}

function nsToSec(ns?: string | number) {
  const s = String(ns ?? "");
  if (!s) return 0;
  if (s.length > 12) return Number(s.slice(0, 10)) || 0;
  const n = Number(s);
  return Number.isFinite(n) && n > 1e12 ? Math.floor(n / 1e9) : n || 0;
}

function partyName(p?: BsParty) {
  return p?.name || p?.ens_domain_name || undefined;
}

function protocolOf(chainId: number, ours: Set<string>, from?: string, to?: string, fromParty?: BsParty, toParty?: BsParty) {
  const f = (from || "").toLowerCase();
  const taddr = (to || "").toLowerCase();
  const other = ours.has(f) && taddr && !ours.has(taddr) ? to : ours.has(taddr) && f && !ours.has(f) ? from : to;
  const named = protocolName(chainId, other) || protocolName(chainId, to) || protocolName(chainId, from);
  if (named) return named;
  const party = (other || "").toLowerCase() === taddr ? toParty : fromParty;
  if (party?.is_contract && !ours.has((party.hash || "").toLowerCase())) return partyName(party);
  return undefined;
}

function peerOf(ours: Set<string>, from?: string, to?: string) {
  const f = (from || "").toLowerCase();
  const t = (to || "").toLowerCase();
  if (f && ours.has(f) && t && !ours.has(t) && !isZeroAddr(t)) return t;
  if (t && ours.has(t) && f && !ours.has(f) && !isZeroAddr(f)) return f;
  if (t && !ours.has(t) && !isZeroAddr(t)) return t;
  if (f && !ours.has(f)) return f;
  return t || f;
}

function isFail(status?: string, result?: string) {
  const s = (status || "").toLowerCase();
  const r = (result || "").toLowerCase();
  return s === "error" || s === "failed" || r === "error" || r === "reverted" || r === "fail";
}

function applyToken(row: TxRow, t: BsTok, addr: string, ours: Set<string>, chainId: number) {
  const from = t.from?.hash || "";
  const to = t.to?.hash || "";
  const a = addr.toLowerCase();
  const dir: "in" | "out" | null = to.toLowerCase() === a ? "in" : from.toLowerCase() === a ? "out" : null;
  if (!dir) return;
  const dec = Number(t.total?.decimals ?? t.token?.decimals ?? 18) || 18;
  const tok = tokenMeta(chainId, t.token?.address_hash, t.token?.symbol, dec, t.token?.icon_url || undefined);
  const nft = (t.token?.type || t.token_type || t.type || "").includes("721") || (t.token?.type || t.token_type || t.type || "").includes("1155");
  const tokenId = t.total?.token_id;
  const amt = nft
    ? tokenId
      ? `#${tokenId}`
      : fmtAmt(t.total?.value || "0", 0) === "0"
        ? "NFT"
        : fmtAmt(t.total?.value || "0", 0)
    : fmtAmt(t.total?.value || "0", dec);
  addFlow(row.flows, {
    symbol: tok.symbol,
    icon: tok.icon,
    amount: amt,
    dir,
    token: t.token?.address_hash,
    nft,
    counter: isZeroAddr(dir === "in" ? from : to) ? undefined : dir === "in" ? from : to,
  });
  if (nft) row.nft = true;
  if (t.token?.reputation === "scam" || t.from?.is_scam || t.to?.is_scam) row.risk = true;
  if (!row.peer || isZeroAddr(row.peer)) row.peer = peerOf(ours, from, to);
  if (!row.protocol) row.protocol = protocolOf(chainId, ours, from, to, t.from, t.to);
}

function emptyRow(chainId: number, hash: string, addr: string, ts: number, method: string): TxRow {
  return {
    id: `${chainId}:${hash}`,
    chainId,
    hash,
    ts,
    method,
    kind: "call",
    from: "",
    to: "",
    peer: "",
    peerLabel: "",
    ours: addr,
    flows: [],
    explorer: txExplorer(chainId, hash),
  };
}

async function fetchBlockscout(chainId: number, addr: string, ours: Set<string>): Promise<TxRow[]> {
  const base = BS_TX[chainId];
  if (!base) return [];
  const a = addr.toLowerCase();
  const [txj, tokj] = await Promise.all([
    httpJson<{ items?: BsTx[] }>(`${base}/api/v2/addresses/${addr}/transactions`),
    httpJson<{ items?: BsTok[] }>(`${base}/api/v2/addresses/${addr}/token-transfers`),
  ]);
  if (txj == null && tokj == null) throw new Error(`blockscout ${chainId}`);
  const by = new Map<string, TxRow>();
  const meta = chainMeta(chainId);
  for (const t of txj?.items ?? []) {
    if (!t.hash) continue;
    const from = t.from?.hash || "";
    const to = t.to?.hash || "";
    let val = 0n;
    try {
      val = BigInt(t.value || "0");
    } catch {
      val = 0n;
    }
    const nativeIn = val > 0n && to.toLowerCase() === a;
    const nativeOut = val > 0n && from.toLowerCase() === a;
    const fail = isFail(t.status, t.result);
    const flows: TxFlow[] = [];
    if (nativeIn || nativeOut) {
      addFlow(flows, {
        symbol: meta.native,
        icon: meta.icon,
        amount: fmtAmt(val, meta.decimals),
        dir: nativeIn ? "in" : "out",
        counter: nativeIn ? from : to,
      });
    }
    const proto = protocolOf(chainId, ours, from, to, t.from, t.to);
    const method = methodLabel(t.decoded_input?.method_call || t.method, nativeIn ? "receive" : nativeOut ? "send" : "call");
    const row = emptyRow(chainId, t.hash, addr, tsOf(t.timestamp), method);
    row.from = from;
    row.to = to;
    row.fromLabel = partyName(t.from);
    row.toLabel = partyName(t.to);
    row.peer = peerOf(ours, from, to);
    row.peerLabel = proto || "";
    row.protocol = proto;
    row.flows = flows;
    row.gas = t.fee?.value ? `${fmtAmt(t.fee.value, meta.decimals)} ${meta.native}` : undefined;
    row.fail = fail;
    row.risk = Boolean(t.to?.is_scam || t.from?.is_scam || t.to?.reputation === "scam" || t.from?.reputation === "scam");
    row.kind = classifyTx({ fail, method, types: t.transaction_types, nativeIn, nativeOut, tokenIn: 0, tokenOut: 0 });
    for (const x of t.token_transfers ?? []) applyToken(row, x, addr, ours, chainId);
    by.set(t.hash.toLowerCase(), row);
  }
  for (const t of tokj?.items ?? []) {
    const hash = t.transaction_hash || t.tx_hash;
    if (!hash) continue;
    const from = t.from?.hash || "";
    const to = t.to?.hash || "";
    let prev = by.get(hash.toLowerCase());
    if (!prev) {
      const mint = isZeroAddr(from) || (t.type || "").includes("mint");
      prev = emptyRow(chainId, hash, addr, tsOf(t.timestamp), mint ? "mint" : methodLabel(t.method, "transfer"));
      prev.from = from;
      prev.to = to;
      prev.fromLabel = partyName(t.from);
      prev.toLabel = partyName(t.to);
      prev.peer = peerOf(ours, from, to);
      prev.protocol = protocolOf(chainId, ours, from, to, t.from, t.to);
      prev.peerLabel = prev.protocol || "";
      by.set(hash.toLowerCase(), prev);
    }
    applyToken(prev, t, addr, ours, chainId);
  }
  return [...by.values()].map((r) => applyTags(retouch(r)));
}

type ScanTx = {
  hash?: string;
  timeStamp?: string;
  from?: string;
  to?: string;
  value?: string;
  gasUsed?: string;
  gasPrice?: string;
  txreceipt_status?: string;
  functionName?: string;
  methodId?: string;
  contractAddress?: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
  tokenName?: string;
};

function scanList(j: { status?: string; message?: string; result?: ScanTx[] | string } | null): ScanTx[] | "fail" {
  if (!j) return "fail";
  const r = j.result;
  if (Array.isArray(r)) return r;
  const msg = `${j.message || ""} ${typeof r === "string" ? r : ""}`.toLowerCase();
  if (msg.includes("no transaction") || msg.includes("no record") || j.status === "1") return [];
  if (typeof r === "string" && r) return "fail";
  if (j.status === "0" && msg.includes("notok")) return "fail";
  return [];
}

async function fetchScan(chainId: number, addr: string, ours: Set<string>): Promise<TxRow[]> {
  const apis = SCAN_TX[chainId];
  if (!apis) return [];
  const a = addr.toLowerCase();
  const q = `module=account&address=${addr}&page=1&offset=${PAGE}&sort=desc&startblock=0&endblock=99999999`;
  const pull = async (action: string) => {
    for (const api of apis) {
      const j = await httpJson<{ status?: string; message?: string; result?: ScanTx[] | string }>(`${api}?${q}&action=${action}`);
      const list = scanList(j);
      if (list !== "fail") return list;
    }
    return "fail" as const;
  };
  const [txs, toks] = await Promise.all([pull("txlist"), pull("tokentx")]);
  if (txs === "fail" && toks === "fail") throw new Error(`scan ${chainId}`);
  const by = new Map<string, TxRow>();
    const meta = chainMeta(chainId);
    for (const t of txs === "fail" ? [] : txs) {
      if (!t.hash) continue;
      let val = 0n;
      try {
        val = BigInt(t.value || "0");
      } catch {
        val = 0n;
      }
      const nativeIn = val > 0n && (t.to || "").toLowerCase() === a;
      const nativeOut = val > 0n && (t.from || "").toLowerCase() === a;
      const fail = t.txreceipt_status === "0";
      const method = methodLabel(t.functionName || t.methodId, nativeIn ? "receive" : nativeOut ? "send" : "call");
      const peer = peerOf(ours, t.from, t.to);
      const proto = protocolOf(chainId, ours, t.from, t.to);
      let gas: string | undefined;
      try {
        if (t.gasUsed && t.gasPrice) gas = `${fmtAmt(BigInt(t.gasUsed) * BigInt(t.gasPrice), meta.decimals)} ${meta.native}`;
      } catch {
        gas = undefined;
      }
      const flows: TxFlow[] = [];
      if (nativeIn || nativeOut) {
        addFlow(flows, {
          symbol: meta.native,
          icon: meta.icon,
          amount: fmtAmt(val, meta.decimals),
          dir: nativeIn ? "in" : "out",
          counter: nativeIn ? t.from : t.to,
        });
      }
      const row = emptyRow(chainId, t.hash, addr, tsOf(undefined, t.timeStamp), method);
      row.from = t.from || "";
      row.to = t.to || "";
      row.peer = peer;
      row.peerLabel = proto || "";
      row.protocol = proto;
      row.flows = flows;
      row.gas = gas;
      row.fail = fail;
      row.kind = classifyTx({ fail, method, nativeIn, nativeOut, tokenIn: 0, tokenOut: 0 });
      by.set(t.hash.toLowerCase(), row);
    }
    for (const t of toks === "fail" ? [] : toks) {
      if (!t.hash) continue;
      const dec = Number(t.tokenDecimal || 18) || 18;
      const tok = tokenMeta(chainId, t.contractAddress, t.tokenSymbol, dec);
      const dir: "in" | "out" | null = (t.to || "").toLowerCase() === a ? "in" : (t.from || "").toLowerCase() === a ? "out" : null;
      if (!dir) continue;
      const flow: TxFlow = {
        symbol: tok.symbol,
        icon: tok.icon,
        amount: fmtAmt(t.value || "0", dec),
        dir,
        token: t.contractAddress,
        counter: dir === "in" ? t.from : t.to,
      };
      const prev = by.get(t.hash.toLowerCase());
      if (prev) addFlow(prev.flows, flow);
      else {
        const peer = peerOf(ours, t.from, t.to);
        const row = emptyRow(chainId, t.hash, addr, tsOf(undefined, t.timeStamp), methodLabel(t.functionName, "transfer"));
        row.from = t.from || "";
        row.to = t.to || "";
        row.peer = peer;
        row.protocol = protocolOf(chainId, ours, t.from, t.to);
        row.peerLabel = row.protocol || "";
        row.flows = [flow];
        by.set(t.hash.toLowerCase(), row);
      }
    }
  return [...by.values()].map((r) => applyTags(retouch(r)));
}

async function fetchSol(addr: string): Promise<TxRow[]> {
  const body = (method: string, params: unknown[]) => ({ jsonrpc: "2.0", id: 1, method, params });
  let lastFail = false;
  for (const url of SOL_RPCS) {
    const sigs = await httpJson<{ result?: Array<{ signature?: string; blockTime?: number; err?: unknown }> }>(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body("getSignaturesForAddress", [addr, { limit: 30 }])),
    });
    if (!sigs) {
      lastFail = true;
      continue;
    }
    const list = sigs.result ?? [];
    const rows: TxRow[] = [];
    for (const s of list) {
      if (!s.signature) continue;
      const row = emptyRow(101, s.signature, addr, s.blockTime ?? 0, s.err ? "fail" : "tx");
      row.fail = Boolean(s.err);
      row.kind = s.err ? "fail" : "call";
      rows.push(row);
    }
    const pack = await Promise.all(
      rows.slice(0, 16).map((r) =>
        httpJson<{
          result?: {
            meta?: {
              preBalances?: number[];
              postBalances?: number[];
              fee?: number;
              preTokenBalances?: Array<{ mint?: string; owner?: string; uiTokenAmount?: { amount?: string; decimals?: number } }>;
              postTokenBalances?: Array<{ mint?: string; owner?: string; uiTokenAmount?: { amount?: string; decimals?: number } }>;
            };
            transaction?: { message?: { accountKeys?: Array<string | { pubkey?: string }> } };
          };
        }>(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body("getTransaction", [r.hash, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }])),
        }).then((j) => ({ r, j })),
      ),
    );
    for (const { r, j } of pack) {
      const keys = (j?.result?.transaction?.message?.accountKeys ?? []).map((k) => (typeof k === "string" ? k : k.pubkey || ""));
      r.from = keys[0] || addr;
      r.to = keys.find((k) => k && k !== addr) || keys[1] || "";
      r.peer = r.to && r.to !== addr ? r.to : keys.find((k) => k && k !== addr) || "";
      const i = keys.findIndex((k) => k === addr);
      const pre = j?.result?.meta?.preBalances?.[i] ?? 0;
      const post = j?.result?.meta?.postBalances?.[i] ?? 0;
      const fee = i === 0 ? (j?.result?.meta?.fee ?? 0) : 0;
      const delta = post - pre + (i === 0 ? fee : 0);
      if (delta) {
        addFlow(r.flows, {
          symbol: "SOL",
          icon: "/tokens/sol.png",
          amount: fmtAmt(BigInt(Math.abs(delta)), 9),
          dir: delta > 0 ? "in" : "out",
          counter: r.peer,
        });
        r.method = delta > 0 ? "receive" : "send";
      }
      const preTok = new Map<string, bigint>();
      const postTok = new Map<string, bigint>();
      for (const b of j?.result?.meta?.preTokenBalances ?? []) {
        if (b.owner !== addr || !b.mint) continue;
        preTok.set(b.mint, BigInt(b.uiTokenAmount?.amount || "0"));
      }
      for (const b of j?.result?.meta?.postTokenBalances ?? []) {
        if (b.owner !== addr || !b.mint) continue;
        postTok.set(b.mint, BigInt(b.uiTokenAmount?.amount || "0"));
        const dec = b.uiTokenAmount?.decimals ?? solByMint(b.mint)?.decimals ?? 9;
        const d = (postTok.get(b.mint) ?? 0n) - (preTok.get(b.mint) ?? 0n);
        if (!d) continue;
        const hit = solByMint(b.mint);
        addFlow(r.flows, {
          symbol: hit?.symbol || "TOKEN",
          icon: hit?.icon || "/tokens/sol.png",
          amount: fmtAmt(d < 0n ? -d : d, dec),
          dir: d > 0n ? "in" : "out",
          token: b.mint,
          counter: r.peer,
        });
      }
      if (j?.result?.meta?.fee) r.gas = `${fmtAmt(BigInt(j.result.meta.fee), 9)} SOL`;
      applyTags(retouch(r));
    }
    return rows;
  }
  if (lastFail) throw new Error("sol");
  return [];
}

type AdaAsset = { policy_id?: string; asset_name?: string; quantity?: string; decimals?: number; fingerprint?: string };
type AdaEnd = { payment_addr?: { bech32?: string }; stake_addr?: string; value?: string; asset_list?: AdaAsset[] };

async function fetchAda(addr: string): Promise<TxRow[]> {
  const stake = addr.startsWith("stake");
  const list = (
    stake
      ? await koiosPost("account_txs", { _stake_address: addr }).catch(() => null)
      : await koiosPost("address_txs", { _addresses: [addr] }).catch(() => null)
  ) as Array<{ tx_hash?: string; block_time?: number }> | null;
  if (list == null) throw new Error("koios txs");
  const hashes = (Array.isArray(list) ? list : []).map((x) => x.tx_hash).filter(Boolean).slice(0, 25) as string[];
  if (!hashes.length) return [];
  const info = (await koiosPost("tx_info", { _tx_hashes: hashes }).catch(() => null)) as Array<{
    tx_hash?: string;
    tx_timestamp?: number;
    block_time?: number;
    fee?: string;
    inputs?: AdaEnd[];
    outputs?: AdaEnd[];
  }> | null;
  if (info == null) throw new Error("koios info");
  const ours = addr.toLowerCase();
  const mine = (x?: AdaEnd) => {
    const pay = (x?.payment_addr?.bech32 || "").toLowerCase();
    const st = (x?.stake_addr || "").toLowerCase();
    return pay === ours || st === ours || (stake && st === ours);
  };
  const rows: TxRow[] = [];
  for (const t of Array.isArray(info) ? info : []) {
    if (!t.tx_hash) continue;
    let ada = 0n;
    const units = new Map<string, bigint>();
    let peer = "";
    let from = "";
    let to = "";
    for (const i of t.inputs ?? []) {
      const who = i.payment_addr?.bech32 || i.stake_addr || "";
      if (mine(i)) {
        ada -= BigInt(i.value || "0");
        for (const a of i.asset_list ?? []) {
          const unit = `${a.policy_id || ""}${a.asset_name || ""}`;
          units.set(unit, (units.get(unit) ?? 0n) - BigInt(a.quantity || "0"));
        }
        if (!from) from = who;
      } else if (!peer) {
        peer = who;
        if (!from) from = who;
      }
    }
    for (const o of t.outputs ?? []) {
      const who = o.payment_addr?.bech32 || o.stake_addr || "";
      if (mine(o)) {
        ada += BigInt(o.value || "0");
        for (const a of o.asset_list ?? []) {
          const unit = `${a.policy_id || ""}${a.asset_name || ""}`;
          units.set(unit, (units.get(unit) ?? 0n) + BigInt(a.quantity || "0"));
        }
        if (!to) to = who;
      } else if (!peer) {
        peer = who;
        if (!to) to = who;
      }
    }
    const flows: TxFlow[] = [];
    if (ada !== 0n) {
      addFlow(flows, {
        symbol: "ADA",
        icon: "/tokens/ada.png",
        amount: fmtAmt(ada < 0n ? -ada : ada, 6),
        dir: ada > 0n ? "in" : "out",
        counter: peer,
      });
    }
    for (const [unit, qty] of units) {
      if (!qty) continue;
      const hit = cardanoByUnit(unit);
      addFlow(flows, {
        symbol: hit?.symbol || unit.slice(0, 8).toUpperCase(),
        icon: hit?.icon || "/tokens/ada.png",
        amount: fmtAmt(qty < 0n ? -qty : qty, hit?.decimals ?? 0),
        dir: qty > 0n ? "in" : "out",
        token: unit,
        counter: peer,
      });
    }
    const row = emptyRow(1815, t.tx_hash, addr, t.block_time || t.tx_timestamp || 0, ada > 0n ? "receive" : ada < 0n ? "send" : "tx");
    row.from = from;
    row.to = to;
    row.peer = peer;
    row.flows = flows;
    if (t.fee) row.gas = `${fmtAmt(t.fee, 6)} ADA`;
    rows.push(applyTags(retouch(row)));
  }
  return rows;
}

async function fetchNear(addr: string): Promise<TxRow[]> {
  const json = await httpJson<{
    txns?: Array<{
      transaction_hash?: string;
      block_timestamp?: string;
      predecessor_account_id?: string;
      receiver_account_id?: string;
      signer_account_id?: string;
      actions?: Array<{ action?: string; method?: string; deposit?: number }>;
      outcomes?: { status?: boolean };
    }>;
  }>(`https://api.nearblocks.io/v1/account/${encodeURIComponent(addr)}/txns?page=1&per_page=30`);
  if (!json) throw new Error("nearblocks");
  const rows: TxRow[] = [];
  const seen = new Set<string>();
  for (const t of json.txns ?? []) {
    if (!t.transaction_hash || seen.has(t.transaction_hash)) continue;
    seen.add(t.transaction_hash);
    const from = t.predecessor_account_id || t.signer_account_id || "";
    const to = t.receiver_account_id || "";
    const act = t.actions?.[0];
    const method = act?.method || act?.action || "tx";
    const kind: TxKind = from === addr && to !== addr ? "out" : to === addr && from !== addr ? "in" : "call";
    const fail = t.outcomes?.status === false;
    const row = emptyRow(397, t.transaction_hash, addr, nsToSec(t.block_timestamp), method);
    row.from = from;
    row.to = to;
    row.peer = kind === "in" ? from : to;
    row.kind = fail ? "fail" : kind;
    row.fail = fail;
    const deposit = Number(act?.deposit || 0);
    if (Number.isFinite(deposit) && deposit > 0) {
      addFlow(row.flows, {
        symbol: "NEAR",
        icon: "/tokens/near.png",
        amount: fmtAmt(BigInt(Math.trunc(deposit)), nativeDecimals(397)),
        dir: from === addr ? "out" : "in",
        counter: from === addr ? to : from,
      });
    }
    rows.push(applyTags(retouch(row)));
  }
  return rows;
}

export async function enrichTx(row: TxRow): Promise<TxRow> {
  const base = BS_TX[row.chainId];
  if (!base) return row;
  const j = await httpJson<BsTx & { token_transfers?: BsTok[] }>(`${base}/api/v2/transactions/${row.hash}`);
  if (!j) return row;
  const next: TxRow = { ...row, flows: [...row.flows] };
  if (j.method || j.decoded_input?.method_call) next.method = methodLabel(j.decoded_input?.method_call || j.method, next.method);
  if (j.from?.hash) {
    next.from = j.from.hash;
    next.fromLabel = partyName(j.from) || next.fromLabel;
  }
  if (j.to?.hash) {
    next.to = j.to.hash;
    next.toLabel = partyName(j.to) || next.toLabel;
  }
  if (isFail(j.status, j.result)) {
    next.fail = true;
    next.kind = "fail";
  }
  if (j.to?.is_scam || j.from?.is_scam) next.risk = true;
  const proto = protocolOf(row.chainId, new Set([row.ours.toLowerCase()]), next.from, next.to, j.from, j.to);
  if (proto) {
    next.protocol = proto;
    next.peerLabel = proto;
  }
  const ours = new Set([row.ours.toLowerCase()]);
  for (const t of j.token_transfers ?? []) applyToken(next, t, row.ours, ours, row.chainId);
  const internals = await httpJson<{ items?: Array<{ from?: BsParty; to?: BsParty; value?: string; success?: boolean }> }>(
    `${base}/api/v2/transactions/${row.hash}/internal-transactions`,
  );
  const meta = chainMeta(row.chainId);
  const a = row.ours.toLowerCase();
  for (const it of internals?.items ?? []) {
    let val = 0n;
    try {
      val = BigInt(it.value || "0");
    } catch {
      val = 0n;
    }
    if (!val) continue;
    const from = it.from?.hash || "";
    const to = it.to?.hash || "";
    const dir: "in" | "out" | null = to.toLowerCase() === a ? "in" : from.toLowerCase() === a ? "out" : null;
    if (!dir) continue;
    addFlow(next.flows, {
      symbol: meta.native,
      icon: meta.icon,
      amount: fmtAmt(val, meta.decimals),
      dir,
      counter: dir === "in" ? from : to,
    });
    if (dir === "in" && to && !next.peer) next.peer = from;
    if (dir === "out" && from && !isZeroAddr(to)) next.peer = next.peer || to;
  }
  if (!next.peer) next.peer = peerOf(ours, next.from, next.to);
  return applyTags(retouch(next));
}

export function useAddressTxs(addrs: AddrIn[]) {
  const key = addrs.map((a) => `${a.kind}:${a.value}`).join("|");
  const [rows, setRows] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const list = useMemo(() => addrs, [key]);

  useEffect(() => {
    if (!list.length) {
      setRows([]);
      setLoading(false);
      setFailed(false);
      return;
    }
    let cancelled = false;
    setRows([]);
    setLoading(true);
    setFailed(false);
    const jobs: Array<{ id: string; chainId: number; run: () => Promise<TxRow[]> }> = [];
    const ours = oursSet(list);
    const prefer = [1, 43114, 8453, 42161, 56, 137, 10, 480, 101, 1815, 397];
    const rank = (id: number) => {
      const i = prefer.indexOf(id);
      return i === -1 ? 50 + id : i;
    };
    for (const a of list) {
      if (a.kind === "evm") {
        for (const id of Object.keys(BS_TX).map(Number)) {
          jobs.push({ id: `txs:${id}:${a.value}`, chainId: id, run: () => fetchBlockscout(id, a.value, ours) });
        }
        for (const id of Object.keys(SCAN_TX).map(Number)) {
          jobs.push({ id: `txs:${id}:${a.value}`, chainId: id, run: () => fetchScan(id, a.value, ours) });
        }
      } else if (a.kind === "solana") jobs.push({ id: `txs:101:${a.value}`, chainId: 101, run: () => fetchSol(a.value) });
      else if (a.kind === "cardano") jobs.push({ id: `txs:1815:${a.value}`, chainId: 1815, run: () => fetchAda(a.value) });
      else if (a.kind === "near") jobs.push({ id: `txs:397:${a.value}`, chainId: 397, run: () => fetchNear(a.value) });
    }
    jobs.sort((a, b) => rank(a.chainId) - rank(b.chainId));
    void (async () => {
      let ok = false;
      let i = 0;
      const worker = async () => {
        while (i < jobs.length && !cancelled) {
          const j = jobs[i++];
          if (!j) break;
          try {
            await trackLive(j.id, j.chainId, "txs", async () => {
              const part = await j.run();
              if (!cancelled && part.length) setRows((prev) => mergeTxRows(prev, part));
              return part;
            });
            ok = true;
          } catch {
            /* live dock records fail */
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(6, jobs.length) }, () => worker()));
      if (cancelled) return;
      setFailed(jobs.length > 0 && !ok);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      useLiveStatus.getState().clear("txs:");
    };
  }, [key]);

  return { rows, loading, failed };
}
