import type { Quote } from "../defiQuotes.ts";
import type { LendCard } from "../lendingExtra.ts";
import type { ProtocolLine } from "../defiPositions.ts";
import { card, fromHuman, getJson, line } from "./shared.ts";

export async function readJustLend(user: string): Promise<LendCard | null> {
  if (!user) return null;
  const [acct, markets, v2] = await Promise.all([
    getJson<{
      code?: number;
      data?: { list?: Array<{ health?: string; tokens?: Array<{ address?: string; underlyingSymbol?: string; supplyBalanceUnderlying?: string; borrowBalanceUnderlying?: string }> }> };
    }>(`https://openapi.just.network/lend/account?addresses=${user}`),
    getJson<{ data?: { tokenList?: Array<{ address?: string; underlyingSymbol?: string; underlyingDecimal?: number; underlyingPriceInTrx?: string }> } }>(
      "https://openapi.just.network/lend/jtoken",
    ),
    getJson<{
      code?: number;
      data?: {
        totalSupplyUsd?: string;
        totalBorrowUsd?: string;
        totalCollateralUsd?: string;
        vaults?: Array<{ vaultAddress?: string; supplyUsd?: string }>;
        markets?: Array<{ marketId?: string; collateralUsd?: string; borrowUsd?: string }>;
      };
    }>(`https://openapi.just.network/v2/index/position?address=${user}`),
  ]);
  const lines: ProtocolLine[] = [];
  const meta = new Map((markets?.data?.tokenList ?? []).map((t) => [t.address, t]));
  const usdt = (markets?.data?.tokenList ?? []).find((t) => t.underlyingSymbol === "USDT");
  const trxPerUsdt = Number(usdt?.underlyingPriceInTrx);
  const trxUsd = Number.isFinite(trxPerUsdt) && trxPerUsdt > 0 ? 1 / trxPerUsdt : null;
  const row = acct?.data?.list?.[0];
  const health = row?.health && Number(row.health) > 0 ? Number(row.health).toFixed(2) : "—";
  for (const t of row?.tokens ?? []) {
    const sup = Number(t.supplyBalanceUnderlying || "0");
    const bor = Number(t.borrowBalanceUnderlying || "0");
    if (sup <= 0 && bor <= 0) continue;
    const m = meta.get(t.address);
    const decimals = m?.underlyingDecimal ?? 6;
    const symbol = t.underlyingSymbol || "TKN";
    const pxTrx = Number(m?.underlyingPriceInTrx);
    const usd = trxUsd && Number.isFinite(pxTrx) ? pxTrx * trxUsd : symbol.includes("USD") ? 1 : null;
    const q: Quote | null = usd && usd > 0 ? { usdc: usd, source: "agg" } : null;
    if (sup > 0) {
      const { raw } = fromHuman(String(sup), decimals);
      lines.push(line("justlend", 728126428, "TRX", symbol, raw, decimals, "supply", t.address || symbol, q, sup));
    }
    if (bor > 0) {
      const { raw } = fromHuman(String(bor), decimals);
      lines.push(line("justlend", 728126428, "TRX", symbol, raw, decimals, "borrow", t.address || symbol, q, bor));
    }
  }
  const usdQ: Quote = { usdc: 1, source: "agg" };
  for (const vault of v2?.data?.vaults ?? []) {
    const n = Number(vault.supplyUsd || "0");
    if (n <= 0) continue;
    lines.push(line("justlend", 728126428, "TRX", "V2 vault", fromHuman(String(n), 6).raw, 6, "supply", vault.vaultAddress || "v2", usdQ, n));
  }
  for (const mkt of v2?.data?.markets ?? []) {
    const col = Number(mkt.collateralUsd || "0");
    const bor = Number(mkt.borrowUsd || "0");
    if (col > 0) lines.push(line("justlend", 728126428, "TRX", "V2 collateral", fromHuman(String(col), 6).raw, 6, "supply", mkt.marketId || "v2", usdQ, col));
    if (bor > 0) lines.push(line("justlend", 728126428, "TRX", "V2 borrow", fromHuman(String(bor), 6).raw, 6, "borrow", mkt.marketId || "v2", usdQ, bor));
  }
  return card("JustLend", 728126428, "TRX", lines, health);
}
