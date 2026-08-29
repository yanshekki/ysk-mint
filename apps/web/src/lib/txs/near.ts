import { addFlow, fmtAmt, nativeDecimals, retouch, type TxKind, type TxRow } from "../txIndex.ts";
import { applyTags } from "../addrLabels.ts";
import { emptyRow, httpJson, nsToSec } from "./shared.ts";

export async function fetchNear(addr: string): Promise<TxRow[]> {
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

