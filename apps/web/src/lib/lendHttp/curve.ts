import { alreadyPct, CURVE_LEND_CHAIN, fracPct, getJson, num, row } from "./shared.ts";
import type { LendMarketRow } from "../lendMarkets.ts";

type CurveVault = {
  id?: string;
  address?: string;
  blockchainId?: string;
  usdTotal?: number;
  rates?: { lendApyPcent?: number; borrowApyPcent?: number };
  totalSupplied?: { usdTotal?: number };
  borrowed?: { usdTotal?: number };
  assets?: { borrowed?: { symbol?: string; address?: string } };
};

let curveVaultCache: Promise<CurveVault[] | null> | null = null;

export async function curveVaults(): Promise<CurveVault[]> {
  if (!curveVaultCache) {
    curveVaultCache = getJson<{ data?: { lendingVaultData?: CurveVault[] } }>(
      "https://api.curve.finance/v1/getLendingVaults/all",
    ).then((j) => j?.data?.lendingVaultData ?? []);
  }
  return (await curveVaultCache) ?? [];
}

export async function curveLend(chainId: number): Promise<LendMarketRow[]> {
  const chain = CURVE_LEND_CHAIN[chainId];
  if (!chain) return [];
  const list = (await curveVaults()).filter((v) => v.blockchainId === chain);
  return list
    .map((v) => {
      const sup = num(v.totalSupplied?.usdTotal ?? v.usdTotal);
      const bor = num(v.borrowed?.usdTotal);
      const symbol = v.assets?.borrowed?.symbol || "crvUSD";
      return row({
        protocol: "Curve",
        chainId,
        symbol,
        token: v.assets?.borrowed?.address || v.address || symbol,
        market: v.address || v.id || symbol,
        supplyApy: alreadyPct(v.rates?.lendApyPcent),
        borrowApy: alreadyPct(v.rates?.borrowApyPcent),
        supplyUsd: sup,
        borrowUsd: bor,
      });
    })
    .sort((a, b) => (b.supplyUsd ?? 0) - (a.supplyUsd ?? 0))
    .slice(0, 40);
}

export async function lista(): Promise<LendMarketRow[]> {
  const json = await getJson<{
    data?: { list?: Array<{ address?: string; asset?: string; assetSymbol?: string; apy?: string; depositsUsd?: string; utilization?: string }> };
  }>("https://api.lista.org/api/moolah/vault/list?page=1&pageSize=50&chain=bsc");
  return (json?.data?.list ?? []).map((v) => {
    const usd = num(v.depositsUsd);
    const util = num(v.utilization);
    return row({
      protocol: "Lista",
      chainId: 56,
      symbol: v.assetSymbol || "TKN",
      token: v.asset || v.address || "TKN",
      market: v.address || v.asset || "TKN",
      supplyApy: fracPct(v.apy),
      borrowApy: null,
      supplyUsd: usd,
      borrowUsd: usd != null && util != null && util >= 0 && util <= 1 ? usd * util : null,
    });
  });
}
