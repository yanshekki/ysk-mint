import {
  BS_TX,
  SCAN_TX,
  addFlow,
  chainMeta,
  classifyTx,
  fmtAmt,
  isZeroAddr,
  methodLabel,
  retouch,
  type TxFlow,
  type TxRow,
} from "../txIndex.ts";
import { applyTags } from "../addrLabels.ts";
import { applyToken, emptyRow, httpJson, isFail, PAGE, partyName, peerOf, protocolOf, tokenMeta, tsOf, type BsTok, type BsTx } from "./shared.ts";

export async function fetchBlockscout(chainId: number, addr: string, ours: Set<string>): Promise<TxRow[]> {
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

export async function fetchScan(chainId: number, addr: string, ours: Set<string>): Promise<TxRow[]> {
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
