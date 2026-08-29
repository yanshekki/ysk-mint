import { formatUnits } from "viem";
import type { Quote } from "../defiQuotes.ts";
import type { LendCard } from "../lendingExtra.ts";
import type { ProtocolLine } from "../defiPositions.ts";
import { SUILEND_CAPS, card, coinDecimals, coinSymbol, fieldsOf, fmtHuman, fromHuman, line, parseDecimal, suiRpc, typeName, type Json } from "./shared.ts";

export async function readSuilend(user: string): Promise<LendCard | null> {
  if (!user) return null;
  const caps: string[] = [];
  for (const typ of SUILEND_CAPS) {
    let cursor: string | null = null;
    for (let i = 0; i < 4; i++) {
      const page = (await suiRpc("suix_getOwnedObjects", [
        user,
        { filter: { StructType: typ }, options: { showContent: true, showType: true }, cursor, limit: 50 },
      ])) as { data?: Array<{ data?: Json }>; nextCursor?: string | null; hasNextPage?: boolean } | null;
      for (const row of page?.data ?? []) {
        const f = fieldsOf(row.data ?? row);
        const oid = String(f.obligation_id ?? f.obligationId ?? "");
        if (oid && oid !== "0x0") caps.push(oid);
      }
      if (!page?.hasNextPage) break;
      cursor = page.nextCursor ?? null;
      if (!cursor) break;
    }
  }
  const lines: ProtocolLine[] = [];
  let health = "—";
  await Promise.all(
    [...new Set(caps)].slice(0, 8).map(async (oid) => {
      const obj = await suiRpc("sui_getObject", [oid, { showContent: true }]);
      const f = fieldsOf(obj);
      const deposits = (f.deposits as Array<{ fields?: Json; type?: string }> | undefined) ?? [];
      const borrows = (f.borrows as Array<{ fields?: Json; type?: string }> | undefined) ?? [];
      const depUsd = parseDecimal(f.deposited_value_usd);
      const borUsd = parseDecimal(f.weighted_borrowed_value_usd) ?? parseDecimal(f.unweighted_borrowed_value_usd);
      const unhealthy = parseDecimal(f.unhealthy_borrow_value_usd);
      if (borUsd && unhealthy && borUsd > 0) health = (unhealthy / borUsd).toFixed(2);
      else if (depUsd && borUsd && borUsd > 0) health = (depUsd / borUsd).toFixed(2);
      const add = (rows: Array<{ fields?: Json }>, side: "supply" | "borrow") => {
        for (const r of rows) {
          const rf = r.fields ?? (r as Json);
          const coin = typeName(rf.coin_type);
          const symbol = coinSymbol(coin) || "TKN";
          const usd = parseDecimal(rf.market_value);
          const ctoken = BigInt(String(rf.deposited_ctoken_amount ?? "0"));
          const borrowed = parseDecimal(rf.borrowed_amount);
          const decimals = coinDecimals(coin);
          let n = 0;
          let raw = 0n;
          if (side === "supply") {
            raw = ctoken;
            n = Number(formatUnits(ctoken, decimals));
          } else {
            n = borrowed ?? 0;
            raw = fromHuman(String(n), decimals).raw;
          }
          if ((n <= 0 && raw === 0n) || (usd != null && usd <= 0 && raw === 0n && n <= 0)) continue;
          const q: Quote | null = usd != null && n > 0 ? { usdc: usd / n, source: "agg" } : usd != null && usd > 0 ? { usdc: 1, source: "agg" } : null;
          const row = line("suilend", 784, "SUI", symbol, raw || 1n, decimals, side, coin, q, n || usd || 0);
          if (usd != null && usd > 0) row.valueUsdc = side === "borrow" ? -usd : usd;
          if (n > 0) row.amount = fmtHuman(n);
          lines.push(row);
        }
      };
      add(deposits, "supply");
      add(borrows, "borrow");
    }),
  );
  return card("Suilend", 784, "SUI", lines, health);
}
