import { cardanoByUnit } from "../tokenRegistry.ts";
import { koiosPost } from "../koios.ts";
import { addFlow, fmtAmt, retouch, type TxFlow, type TxRow } from "../txIndex.ts";
import { applyTags } from "../addrLabels.ts";
import { emptyRow } from "./shared.ts";

type AdaAsset = { policy_id?: string; asset_name?: string; quantity?: string; decimals?: number; fingerprint?: string };
type AdaEnd = { payment_addr?: { bech32?: string }; stake_addr?: string; value?: string; asset_list?: AdaAsset[] };

export async function fetchAda(addr: string): Promise<TxRow[]> {
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
