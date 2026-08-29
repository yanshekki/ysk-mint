import { fracPct, getJson, row } from "./shared.ts";
import type { LendMarketRow } from "../lendMarkets.ts";

export async function justlend(): Promise<LendMarketRow[]> {
  const json = await getJson<{
    data?: {
      tokenList?: Array<{
        address?: string;
        underlyingSymbol?: string;
        underlyingAddress?: string;
        underlyingDecimal?: number;
        underlyingPriceInTrx?: string;
        supplyRate?: string;
        borrowRate?: string;
        cash?: string;
        totalBorrows?: string;
      }>;
    };
  }>("https://openapi.just.network/lend/jtoken");
  const list = json?.data?.tokenList ?? [];
  const usdt = list.find((t) => t.underlyingSymbol === "USDT");
  const trxPerUsdt = Number(usdt?.underlyingPriceInTrx);
  const trxUsd = Number.isFinite(trxPerUsdt) && trxPerUsdt > 0 ? 1 / trxPerUsdt : null;
  return list.map((t) => {
    const symbol = t.underlyingSymbol || "TKN";
    const pxTrx = Number(t.underlyingPriceInTrx);
    const px = trxUsd && Number.isFinite(pxTrx) ? pxTrx * trxUsd : /usd/i.test(symbol) ? 1 : null;
    const cash = Number(t.cash || "0");
    const bor = Number(t.totalBorrows || "0");
    return row({
      protocol: "JustLend",
      chainId: 728126428,
      symbol,
      token: t.underlyingAddress || t.address || symbol,
      market: t.address || symbol,
      supplyApy: fracPct(t.supplyRate),
      borrowApy: fracPct(t.borrowRate),
      supplyUsd: px != null && Number.isFinite(cash + bor) ? (cash + bor) * px : null,
      borrowUsd: px != null && Number.isFinite(bor) ? bor * px : null,
    });
  });
}
