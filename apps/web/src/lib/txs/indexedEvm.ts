import { applyTags } from "../addrLabels.ts";
import { fetchIndexedTransfers } from "../evmIndex.ts";
import {
  addFlow,
  chainMeta,
  classifyTx,
  fmtAmt,
  methodLabel,
  retouch,
  type TxFlow,
  type TxRow,
} from "../txIndex.ts";
import { emptyRow, peerOf, protocolOf, tokenMeta } from "./shared.ts";

export async function fetchIndexedEvm(chainId: number, addr: string, ours: Set<string>): Promise<TxRow[]> {
  const parts = await fetchIndexedTransfers(chainId, addr);
  const a = addr.toLowerCase();
  const meta = chainMeta(chainId);
  const by = new Map<string, TxRow>();
  for (const t of parts) {
    const hash = t.hash;
    if (!hash) continue;
    const from = t.from || "";
    const to = t.to || "";
    let row = by.get(hash.toLowerCase());
    if (!row) {
      const nativeIn = !t.contract && t.value > 0n && to.toLowerCase() === a;
      const nativeOut = !t.contract && t.value > 0n && from.toLowerCase() === a;
      const method = methodLabel(undefined, nativeIn ? "receive" : nativeOut ? "send" : t.contract ? "transfer" : "call");
      row = emptyRow(chainId, hash, addr, t.ts, method);
      row.from = from;
      row.to = to;
      row.peer = peerOf(ours, from, to);
      row.protocol = protocolOf(chainId, ours, from, to);
      row.peerLabel = row.protocol || "";
      row.fail = t.fail;
      if (t.gasUsed != null && t.gasPrice != null) {
        try {
          row.gas = `${fmtAmt(t.gasUsed * t.gasPrice, meta.decimals)} ${meta.native}`;
        } catch {
          row.gas = undefined;
        }
      }
      by.set(hash.toLowerCase(), row);
    }
    if (t.contract) {
      const tok = tokenMeta(chainId, t.contract, t.asset, t.decimals);
      const dir: "in" | "out" | null = to.toLowerCase() === a ? "in" : from.toLowerCase() === a ? "out" : null;
      if (!dir) continue;
      const flow: TxFlow = {
        symbol: tok.symbol,
        icon: tok.icon,
        amount: fmtAmt(t.value, tok.decimals),
        dir,
        token: t.contract,
        counter: dir === "in" ? from : to,
      };
      addFlow(row.flows, flow);
    } else if (t.value > 0n) {
      const nativeIn = to.toLowerCase() === a;
      const nativeOut = from.toLowerCase() === a;
      if (nativeIn || nativeOut) {
        addFlow(row.flows, {
          symbol: meta.native,
          icon: meta.icon,
          amount: fmtAmt(t.value, meta.decimals),
          dir: nativeIn ? "in" : "out",
          counter: nativeIn ? from : to,
        });
      }
    }
  }
  return [...by.values()].map((r) => {
    const tokenIn = r.flows.filter((f) => f.dir === "in" && f.token).length;
    const tokenOut = r.flows.filter((f) => f.dir === "out" && f.token).length;
    const nativeIn = r.flows.some((f) => f.dir === "in" && !f.token);
    const nativeOut = r.flows.some((f) => f.dir === "out" && !f.token);
    r.kind = classifyTx({ fail: r.fail, method: r.method, nativeIn, nativeOut, tokenIn, tokenOut });
    return applyTags(retouch(r));
  });
}
