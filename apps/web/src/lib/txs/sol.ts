import { solByMint } from "../tokenRegistry.ts";
import { rpcJsonRpc } from "../rpcPool.ts";
import { addFlow, fmtAmt, retouch, type TxRow } from "../txIndex.ts";
import { applyTags } from "../addrLabels.ts";
import { emptyRow } from "./shared.ts";

export async function fetchSol(addr: string): Promise<TxRow[]> {
  type SolTx = {
    meta?: {
      preBalances?: number[];
      postBalances?: number[];
      fee?: number;
      preTokenBalances?: Array<{ mint?: string; owner?: string; uiTokenAmount?: { amount?: string; decimals?: number } }>;
      postTokenBalances?: Array<{ mint?: string; owner?: string; uiTokenAmount?: { amount?: string; decimals?: number } }>;
    };
    transaction?: { message?: { accountKeys?: Array<string | { pubkey?: string }> } };
  };
  const list = await rpcJsonRpc<Array<{ signature?: string; blockTime?: number; err?: unknown }>>(101, "getSignaturesForAddress", [
    addr,
    { limit: 30 },
  ]).catch(() => null);
  if (!list) throw new Error("sol");
  const rows: TxRow[] = [];
  for (const s of list) {
    if (!s.signature) continue;
    const row = emptyRow(101, s.signature, addr, s.blockTime ?? 0, s.err ? "fail" : "tx");
    row.fail = Boolean(s.err);
    row.kind = s.err ? "fail" : "call";
    rows.push(row);
  }
  const pack = await Promise.all(
    rows.slice(0, 16).map(async (r) => {
      const j = await rpcJsonRpc<SolTx>(101, "getTransaction", [
        r.hash,
        { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
      ]).catch(() => null);
      return { r, j };
    }),
  );
  for (const { r, j } of pack) {
    const keys = (j?.transaction?.message?.accountKeys ?? []).map((k) => (typeof k === "string" ? k : k.pubkey || ""));
    r.from = keys[0] || addr;
    r.to = keys.find((k) => k && k !== addr) || keys[1] || "";
    r.peer = r.to && r.to !== addr ? r.to : keys.find((k) => k && k !== addr) || "";
    const i = keys.findIndex((k) => k === addr);
    const pre = j?.meta?.preBalances?.[i] ?? 0;
    const post = j?.meta?.postBalances?.[i] ?? 0;
    const fee = i === 0 ? (j?.meta?.fee ?? 0) : 0;
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
    for (const b of j?.meta?.preTokenBalances ?? []) {
      if (b.owner !== addr || !b.mint) continue;
      preTok.set(b.mint, BigInt(b.uiTokenAmount?.amount || "0"));
    }
    for (const b of j?.meta?.postTokenBalances ?? []) {
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
    if (j?.meta?.fee) r.gas = `${fmtAmt(BigInt(j.meta.fee), 9)} SOL`;
    applyTags(retouch(r));
  }
  return rows;
}
