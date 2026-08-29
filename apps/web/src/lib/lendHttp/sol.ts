import { alreadyPct, bpsPct, fracPct, getJson, num, row } from "./shared.ts";
import type { LendMarketRow } from "../lendMarkets.ts";

export async function saveLend(): Promise<LendMarketRow[]> {
  const markets = await getJson<
    Array<{
      isPrimary?: boolean;
      hidden?: boolean;
      reserves?: Array<{ address?: string; liquidityToken?: { symbol?: string; mint?: string; decimals?: number } }>;
    }>
  >("https://api.solend.fi/v1/markets/configs?scope=all");
  const primary = (markets ?? []).find((m) => m.isPrimary && !m.hidden) ?? (markets ?? []).find((m) => !m.hidden);
  const meta = (primary?.reserves ?? []).filter((r) => r.address).slice(0, 40);
  if (!meta.length) return [];
  const ids = meta.map((r) => r.address as string);
  const byAddr = new Map(meta.map((r) => [r.address as string, r]));
  const stats = await getJson<{
    results?: Array<{
      reserve?: {
        liquidity?: { availableAmount?: string; borrowedAmountWads?: string; marketPrice?: string; mintDecimals?: number; mintPubkey?: string };
      };
      rates?: { supplyInterest?: string; borrowInterest?: string };
    }>;
  }>(`https://api.solend.fi/v1/reserves?ids=${ids.join(",")}`);
  const out: LendMarketRow[] = [];
  for (const item of stats?.results ?? []) {
    const liq = item.reserve?.liquidity;
    const mint = liq?.mintPubkey;
    if (!liq || !mint) continue;
    const cfg = [...byAddr.values()].find((r) => r.liquidityToken?.mint === mint || r.address === mint);
    const symbol = cfg?.liquidityToken?.symbol || "TKN";
    const dec = Number(liq.mintDecimals ?? cfg?.liquidityToken?.decimals ?? 9) || 9;
    const cash = Number(liq.availableAmount || 0) / 10 ** dec;
    const wad = Number(liq.borrowedAmountWads || 0);
    const borrowed = Number.isFinite(wad) ? wad / 1e18 / 10 ** dec : 0;
    const px = Number(liq.marketPrice || 0) / 1e18;
    const price = Number.isFinite(px) && px > 0 && px < 1e7 ? px : /usd|dai/i.test(symbol) ? 1 : null;
    const market = cfg?.address || mint;
    out.push(
      row({
        protocol: "Save",
        chainId: 101,
        symbol,
        token: mint,
        market,
        supplyApy: alreadyPct(item.rates?.supplyInterest),
        borrowApy: alreadyPct(item.rates?.borrowInterest),
        supplyUsd: price != null && Number.isFinite(cash + borrowed) ? (cash + borrowed) * price : null,
        borrowUsd: price != null && Number.isFinite(borrowed) ? borrowed * price : null,
      }),
    );
  }
  return out;
}

export async function kamino(): Promise<LendMarketRow[]> {
  const markets = await getJson<Array<{ lendingMarket?: string; isPrimary?: boolean; isCurated?: boolean }>>("https://api.kamino.finance/v2/kamino-market");
  const ids = [...(markets ?? [])]
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || Number(b.isCurated) - Number(a.isCurated))
    .map((m) => m.lendingMarket)
    .filter(Boolean)
    .slice(0, 4) as string[];
  const out: LendMarketRow[] = [];
  for (const id of ids) {
    const rows = await getJson<
      Array<{
        liquidityToken?: string;
        liquidityTokenMint?: string;
        supplyApy?: string;
        borrowApy?: string;
        totalSupplyUsd?: string;
        totalBorrowUsd?: string;
      }>
    >(`https://api.kamino.finance/kamino-market/${id}/reserves/metrics`);
    for (const r of (rows ?? []).slice(0, 40)) {
      const symbol = r.liquidityToken || "TKN";
      const token = r.liquidityTokenMint || symbol;
      out.push(
        row({
          protocol: "Kamino",
          chainId: 101,
          symbol,
          token,
          market: token,
          supplyApy: fracPct(r.supplyApy),
          borrowApy: fracPct(r.borrowApy),
          supplyUsd: num(r.totalSupplyUsd),
          borrowUsd: num(r.totalBorrowUsd),
        }),
      );
    }
  }
  return out;
}

export async function jupiterLend(): Promise<LendMarketRow[]> {
  const rows = await getJson<
    Array<{
      address?: string;
      uiSymbol?: string;
      symbol?: string;
      decimals?: number;
      supplyRate?: string | number;
      totalAssets?: string;
      asset?: { address?: string; symbol?: string; decimals?: number; price?: string };
    }>
  >("https://lite-api.jup.ag/lend/v1/earn/tokens");
  return (rows ?? []).map((r) => {
    const asset = r.asset;
    const symbol = asset?.symbol || r.uiSymbol || r.symbol || "TKN";
    const token = asset?.address || r.address || symbol;
    const dec = asset?.decimals ?? r.decimals ?? 6;
    const assets = Number(r.totalAssets || "0") / 10 ** dec;
    const px = num(asset?.price) ?? ( /usd/i.test(symbol) ? 1 : null);
    return row({
      protocol: "Jupiter Lend",
      chainId: 101,
      symbol,
      token,
      market: r.address || token,
      supplyApy: bpsPct(r.supplyRate),
      borrowApy: null,
      supplyUsd: px != null && Number.isFinite(assets) ? assets * px : null,
      borrowUsd: null,
    });
  });
}
