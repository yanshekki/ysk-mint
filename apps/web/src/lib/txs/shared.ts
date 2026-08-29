import { TOKEN_CATALOG } from "../tokenRegistry.ts";
import { cacheGet, cacheHash, cacheKey, POLICIES } from "../defi/cache.ts";
import { outboundFetch } from "../outbound.ts";
import type { AddrKind } from "../addrKind.ts";
import {
  addFlow,
  chainMeta,
  fmtAmt,
  isZeroAddr,
  protocolName,
  txExplorer,
  type TxRow,
} from "../txIndex.ts";

export const PAGE = 40;

export type AddrIn = { kind: AddrKind; value: string };

export function oursSet(addrs: AddrIn[]) {
  return new Set(addrs.map((a) => a.value.toLowerCase()));
}

export function tokenMeta(chainId: number, address?: string, symbol?: string, decimals?: number, icon?: string) {
  const hit = TOKEN_CATALOG.find(
    (t) => t.chainId === chainId && ((address && t.address?.toLowerCase() === address.toLowerCase()) || (!address && t.native)),
  );
  return {
    symbol: hit?.symbol || symbol || "TOKEN",
    icon: icon || hit?.icon || chainMeta(chainId).icon,
    decimals: hit?.decimals ?? decimals ?? 18,
  };
}

export async function httpJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    return await cacheGet(
      { key: cacheKey("http.tx", 0, cacheHash(url + (typeof init?.body === "string" ? init.body : ""))), policy: POLICIES.account },
      async () => {
        const ctrl = new AbortController();
        const t = window.setTimeout(() => ctrl.abort(), 18000);
        try {
          const res = await outboundFetch(url, { ...init, signal: ctrl.signal });
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

export type BsParty = {
  hash?: string;
  name?: string;
  ens_domain_name?: string;
  is_contract?: boolean;
  is_scam?: boolean;
  reputation?: string;
};
export type BsTok = {
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
export type BsTx = {
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

export function tsOf(iso?: string, unix?: string | number) {
  if (iso) {
    const n = Date.parse(iso);
    if (Number.isFinite(n)) return Math.floor(n / 1000);
  }
  const u = Number(unix);
  return Number.isFinite(u) && u > 0 ? u : 0;
}

export function nsToSec(ns?: string | number) {
  const s = String(ns ?? "");
  if (!s) return 0;
  if (s.length > 12) return Number(s.slice(0, 10)) || 0;
  const n = Number(s);
  return Number.isFinite(n) && n > 1e12 ? Math.floor(n / 1e9) : n || 0;
}

export function partyName(p?: BsParty) {
  return p?.name || p?.ens_domain_name || undefined;
}

export function protocolOf(chainId: number, ours: Set<string>, from?: string, to?: string, fromParty?: BsParty, toParty?: BsParty) {
  const f = (from || "").toLowerCase();
  const taddr = (to || "").toLowerCase();
  const other = ours.has(f) && taddr && !ours.has(taddr) ? to : ours.has(taddr) && f && !ours.has(f) ? from : to;
  const named = protocolName(chainId, other) || protocolName(chainId, to) || protocolName(chainId, from);
  if (named) return named;
  const party = (other || "").toLowerCase() === taddr ? toParty : fromParty;
  if (party?.is_contract && !ours.has((party.hash || "").toLowerCase())) return partyName(party);
  return undefined;
}

export function peerOf(ours: Set<string>, from?: string, to?: string) {
  const f = (from || "").toLowerCase();
  const t = (to || "").toLowerCase();
  if (f && ours.has(f) && t && !ours.has(t) && !isZeroAddr(t)) return t;
  if (t && ours.has(t) && f && !ours.has(f) && !isZeroAddr(f)) return f;
  if (t && !ours.has(t) && !isZeroAddr(t)) return t;
  if (f && !ours.has(f)) return f;
  return t || f;
}

export function isFail(status?: string, result?: string) {
  const s = (status || "").toLowerCase();
  const r = (result || "").toLowerCase();
  return s === "error" || s === "failed" || r === "error" || r === "reverted" || r === "fail";
}

export function applyToken(row: TxRow, t: BsTok, addr: string, ours: Set<string>, chainId: number) {
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

export function emptyRow(chainId: number, hash: string, addr: string, ts: number, method: string): TxRow {
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
