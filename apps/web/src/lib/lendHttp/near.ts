import { fracPct, getJson, num, row } from "./shared.ts";
import type { LendMarketRow } from "../lendMarkets.ts";

export async function burrow(): Promise<LendMarketRow[]> {
  const json = await getJson<{ data?: Array<{ symbol?: string; token?: string; supply_apy?: string; borrow_apy?: string; total_supplied_price?: string; total_burrow_price?: string }> }>(
    "https://api.burrow.finance/list_token_data",
  );
  return (json?.data ?? []).map((r) =>
    row({
      protocol: "Burrow",
      chainId: 397,
      symbol: r.symbol || "TKN",
      token: r.token || r.symbol || "TKN",
      market: r.token || r.symbol || "TKN",
      supplyApy: fracPct(r.supply_apy),
      borrowApy: fracPct(r.borrow_apy),
      supplyUsd: num(r.total_supplied_price),
      borrowUsd: num(r.total_burrow_price),
    }),
  );
}
