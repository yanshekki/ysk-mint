import { fetchRefTopPools, loadNearMarkets, nearDecimals, nearToken, N_USDC, N_USDT, N_WRAP, quoteNearToken, REF_VENUE } from "../../nearDex.ts";
import type { VenuePool } from "../../dexPools.ts";
import { pairId } from "../../pairKey.ts";
import { catalogTopOn } from "../universe.ts";
import type { DefiProtocol, MarketRow, VenueQuote } from "../types.ts";

function asQuote(v: VenuePool): VenueQuote {
  return {
    protocolId: v.venue.id,
    protocolName: v.venue.name,
    chainId: v.venue.chainId,
    pool: v.pool,
    feeLabel: v.feeLabel,
    priceAinB: v.priceAinB,
    reserveA: v.reserveA,
    reserveB: v.reserveB,
    tvlQuote: v.tvlQuote,
    kind: "ref",
  };
}

function decOf(id: string, catalog: Map<string, { decimals: number; symbol: string; icon: string }>) {
  const known = nearToken(id);
  if (known) return known.decimals;
  return catalog.get(id)?.decimals ?? nearDecimals(id);
}

function metaOf(id: string, catalog: Map<string, { decimals: number; symbol: string; icon: string }>) {
  const known = nearToken(id);
  if (known) return { symbol: known.symbol, icon: known.icon };
  return catalog.get(id) ?? { symbol: id.split(".")[0] || id.slice(0, 6), icon: "/tokens/near.png" };
}

function isStable(id: string) {
  return id === N_USDT.address || id === N_USDC.address;
}

async function marketsFromIndexer(): Promise<MarketRow[] | null> {
  try {
    const json = await fetchRefTopPools();
    if (!json.length) return null;
    const tokens = catalogTopOn(397, 500);
    const catalog = new Map(tokens.map((t) => [t.address.toLowerCase(), { decimals: t.decimals, symbol: t.symbol ?? t.address, icon: t.icon ?? "/tokens/near.png" }]));
    const byPair = new Map<string, MarketRow>();
    for (const p of json) {
      const ids = (p.token_account_ids ?? []).map((x) => x.toLowerCase());
      if (ids.length !== 2) continue;
      const tvl = Number(p.tvl);
      if (!Number.isFinite(tvl) || tvl < 10) continue;
      const stableIdx = ids.findIndex((id) => isStable(id));
      const wrapIdx = ids.findIndex((id) => id === N_WRAP.address);
      let iA = 0;
      let iB = 1;
      if (stableIdx >= 0) {
        iB = stableIdx;
        iA = 1 - stableIdx;
      } else if (wrapIdx >= 0) {
        iB = wrapIdx;
        iA = 1 - wrapIdx;
      }
      const a = ids[iA];
      const b = ids[iB];
      const id = pairId(397, a, b);
      const decA = decOf(a, catalog);
      const decB = decOf(b, catalog);
      const amtA = Number(p.amounts?.[iA] ?? 0) / 10 ** decA;
      const amtB = Number(p.amounts?.[iB] ?? 0) / 10 ** decB;
      const price = amtA > 0 && amtB > 0 ? amtB / amtA : 0;
      const venue = {
        protocolId: REF_VENUE.id,
        protocolName: REF_VENUE.name,
        chainId: 397,
        pool: `ref:${p.id}`,
        feeLabel: p.total_fee != null ? `${(Number(p.total_fee) / 100).toFixed(2)}%` : "0.30%",
        priceAinB: price,
        reserveA: amtA,
        reserveB: amtB,
        tvlQuote: tvl,
        kind: "ref" as const,
      };
      const prev = byPair.get(id);
      if (prev) {
        if (prev.venues.some((v) => v.pool === venue.pool)) continue;
        prev.venues.push(venue);
        prev.depth = prev.venues.reduce((s, v) => s + (v.tvlQuote || 0), 0);
        const w = prev.venues.reduce((s, v) => s + (v.tvlQuote || 0) * v.priceAinB, 0);
        prev.price = prev.depth > 0 ? w / prev.depth : prev.price;
        continue;
      }
      const ma = metaOf(a, catalog);
      const mb = metaOf(b, catalog);
      const usd = isStable(b) && price ? price : isStable(a) && price ? 1 / price : null;
      byPair.set(id, {
        pairId: id,
        chainId: 397,
        chainShort: "NEAR",
        symbolA: ma.symbol,
        symbolB: mb.symbol,
        iconA: ma.icon,
        iconB: mb.icon,
        tokenA: a,
        tokenB: b,
        venues: [venue],
        price: usd,
        depth: tvl,
        venueNames: [REF_VENUE.name],
      });
    }
    return [...byPair.values()];
  } catch {
    return null;
  }
}

export const nearRefProtocol: DefiProtocol = {
  id: REF_VENUE.id,
  name: REF_VENUE.name,
  chainId: 397,
  caps: ["markets", "quote"],
  async quoteUsd(_ctx, token) {
    return quoteNearToken(token.native ? undefined : token.address, token.native);
  },
  async markets(): Promise<MarketRow[]> {
    const indexed = await marketsFromIndexer();
    if (indexed?.length) return indexed;
    const rows = await loadNearMarkets();
    return rows.map((r) => ({ ...r, venues: r.venues.map(asQuote) }));
  },
};
