import {
  fetchRefTopPools,
  isNearPricedLeg,
  isNearStable,
  isRefSauce,
  loadNearMarkets,
  nearDecimals,
  nearToken,
  nearUsdFromLegs,
  N_WRAP,
  quoteNearToken,
  REF_VENUE,
  wrapUsdFromRefPools,
} from "../../nearDex.ts";
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
  const hit = catalog.get(id);
  if (hit) return hit;
  const raw = id.split(".")[0] || id.slice(0, 6);
  const symbol = raw.length <= 8 && !/^[0-9a-f]{8,}$/i.test(raw) ? raw.toUpperCase() : raw.slice(0, 8);
  return { symbol, icon: "/tokens/near.png" };
}

function humanPriced(id: string, raw: string | undefined) {
  if (!isNearStable(id) && !isNearPricedLeg(id)) return 0;
  const n = Number(raw ?? 0) / 10 ** nearDecimals(id);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function indexerSymbol(p: { token_symbols?: string[] }, i: number, id: string, catalog: Map<string, { decimals: number; symbol: string; icon: string }>) {
  const fromApi = String(p.token_symbols?.[i] ?? "").trim();
  if (fromApi && !/^[0-9a-f]{12,}$/i.test(fromApi)) return fromApi;
  return metaOf(id, catalog).symbol;
}

async function marketsFromIndexer(): Promise<MarketRow[] | null> {
  try {
    const json = await fetchRefTopPools();
    if (!json.length) return null;
    const tokens = catalogTopOn(397, 500);
    const catalog = new Map(tokens.map((t) => [t.address.toLowerCase(), { decimals: t.decimals, symbol: t.symbol ?? t.address, icon: t.icon ?? "/tokens/near.png" }]));
    const wrapUsd = wrapUsdFromRefPools(json);
    const byPair = new Map<string, MarketRow>();
    const ingest = (p: (typeof json)[number], sauce: boolean) => {
      if (isRefSauce(p.pool_kind) !== sauce) return;
      const ids = (p.token_account_ids ?? []).map((x) => x.toLowerCase());
      if (ids.length !== 2) return;
      const amts = p.amounts ?? [];
      const tvl = nearUsdFromLegs(
        { address: ids[0], amount: humanPriced(ids[0], amts[0]) },
        { address: ids[1], amount: humanPriced(ids[1], amts[1]) },
        wrapUsd,
      );
      if (!Number.isFinite(tvl) || tvl < 10) return;
      const stableIdx = ids.findIndex((id) => isNearStable(id));
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
      if (sauce && byPair.has(id)) return;
      const knownA = Boolean(nearToken(a) || catalog.get(a));
      const knownB = Boolean(nearToken(b) || catalog.get(b));
      const decA = decOf(a, catalog);
      const decB = decOf(b, catalog);
      const amtA = knownA ? Number(p.amounts?.[iA] ?? 0) / 10 ** decA : 0;
      const amtB = knownB ? Number(p.amounts?.[iB] ?? 0) / 10 ** decB : 0;
      const price = amtA > 0 && amtB > 0 ? amtB / amtA : 0;
      const venue = {
        protocolId: REF_VENUE.id,
        protocolName: REF_VENUE.name,
        chainId: 397,
        pool: `${isRefSauce(p.pool_kind) ? "sauce" : "ref"}:${p.id}`,
        feeLabel: p.total_fee != null ? `${(Number(p.total_fee) / 100).toFixed(2)}%` : "0.30%",
        priceAinB: price,
        reserveA: amtA,
        reserveB: amtB,
        tvlQuote: tvl,
        kind: "ref" as const,
      };
      const prev = byPair.get(id);
      if (prev) {
        if (prev.venues.some((v) => v.pool === venue.pool)) return;
        prev.venues.push(venue);
        prev.depth = prev.venues.reduce((s, v) => s + (v.tvlQuote || 0), 0);
        const w = prev.venues.reduce((s, v) => s + (v.tvlQuote || 0) * v.priceAinB, 0);
        prev.price = prev.depth > 0 ? w / prev.depth : prev.price;
        return;
      }
      const ma = metaOf(a, catalog);
      const mb = metaOf(b, catalog);
      const symbolA = indexerSymbol(p, iA, a, catalog);
      const symbolB = indexerSymbol(p, iB, b, catalog);
      const usd = isNearStable(b) && price ? price : isNearStable(a) && price ? 1 / price : null;
      byPair.set(id, {
        pairId: id,
        chainId: 397,
        chainShort: "NEAR",
        symbolA,
        symbolB,
        iconA: ma.icon,
        iconB: mb.icon,
        tokenA: a,
        tokenB: b,
        venues: [venue],
        price: usd,
        depth: tvl,
        venueNames: [REF_VENUE.name],
      });
    };
    for (const p of json) ingest(p, false);
    for (const p of json) ingest(p, true);
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
