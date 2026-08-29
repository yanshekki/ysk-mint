import type { Quote } from "../defiQuotes.ts";
import type { LendCard } from "../lendingExtra.ts";
import type { ProtocolLine } from "../defiPositions.ts";
import { NAVI_RESERVES, NAVI_STORAGE_USERS, RAY, card, coinDecimals, coinSymbol, fieldsOf, getJson, line, suiRpc, type Json } from "./shared.ts";

type NaviPool = {
  id?: number;
  coinType?: string;
  token?: { symbol?: string; decimals?: number; price?: number };
  oracle?: { price?: string; decimal?: number };
};

export async function readNavi(user: string): Promise<LendCard | null> {
  if (!user) return null;
  const info = await suiRpc("suix_getDynamicFieldObject", [NAVI_STORAGE_USERS, { type: "address", value: user }]);
  if (!info) return null;
  const uf = fieldsOf(info);
  const collaterals = ((uf.collaterals as unknown[]) ?? []).map(Number);
  const loans = ((uf.loans as unknown[]) ?? []).map(Number);
  const ids = [...new Set([...collaterals, ...loans])].filter((n) => Number.isFinite(n));
  if (!ids.length) return null;
  const pools = (await getJson<{ data?: NaviPool[] }>("https://open-api.naviprotocol.io/api/navi/pools"))?.data ?? [];
  const byId = new Map(pools.map((p) => [Number(p.id), p]));
  const lines: ProtocolLine[] = [];
  await Promise.all(
    ids.map(async (id) => {
      try {
        const reserve = await suiRpc("suix_getDynamicFieldObject", [NAVI_RESERVES, { type: "u8", value: id }]);
        const rf = fieldsOf(reserve);
        const coinType = String(rf.coin_type || byId.get(id)?.coinType || "");
        const supplyIdx = BigInt(String(rf.current_supply_index || "0"));
        const borrowIdx = BigInt(String(rf.current_borrow_index || "0"));
        const supplyTable = ((rf.supply_balance as Json)?.fields as Json | undefined)?.user_state as Json | undefined;
        const borrowTable = ((rf.borrow_balance as Json)?.fields as Json | undefined)?.user_state as Json | undefined;
        const supplyTid = ((supplyTable?.fields as Json | undefined)?.id as Json | undefined)?.id as string | undefined;
        const borrowTid = ((borrowTable?.fields as Json | undefined)?.id as Json | undefined)?.id as string | undefined;
        const scaledOf = async (table: string | undefined) => {
          if (!table) return 0n;
          const row = await suiRpc("suix_getDynamicFieldObject", [table, { type: "address", value: user }]);
          if (!row) return 0n;
          const f = fieldsOf(row);
          const v = f.value ?? f;
          try {
            return BigInt(String(v ?? "0"));
          } catch {
            return 0n;
          }
        };
        const sScaled = collaterals.includes(id) ? await scaledOf(supplyTid) : 0n;
        const bScaled = loans.includes(id) ? await scaledOf(borrowTid) : 0n;
        const supply = supplyIdx && sScaled ? (sScaled * supplyIdx) / RAY : 0n;
        const borrow = borrowIdx && bScaled ? (bScaled * borrowIdx) / RAY : 0n;
        const pool = byId.get(id);
        const decimals = pool?.token?.decimals ?? pool?.oracle?.decimal ?? coinDecimals(coinType);
        const symbol = pool?.token?.symbol || coinSymbol(coinType) || `A${id}`;
        const px = Number(pool?.oracle?.price ?? pool?.token?.price);
        const q: Quote | null = Number.isFinite(px) && px > 0 ? { usdc: px, source: "agg" } : null;
        const mint = coinType.startsWith("0x") ? coinType : `0x${coinType}`;
        if (supply > 0n) lines.push(line("navi", 784, "SUI", symbol, supply, decimals, "supply", mint, q));
        if (borrow > 0n) lines.push(line("navi", 784, "SUI", symbol, borrow, decimals, "borrow", mint, q));
      } catch {
        /* reserve miss */
      }
    }),
  );
  return card("NAVI", 784, "SUI", lines);
}
