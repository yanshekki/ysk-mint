import { cacheGet, cacheKey, POLICIES } from "../cache.ts";
import { loadNearMarkets, N_USDC, N_USDT, N_WRAP, quoteNearToken, REF_VENUE } from "../../nearDex.ts";
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

type RefTop = {
  id: string | number;
  token_account_ids?: string[];
  amounts?: string[];
  token_symbols?: string[];
  total_fee?: number;
  tvl?: string | number;
  pool_kind?: string;
};

function decOf(id: string, catalog: Map<string, { decimals: number; symbol: string; icon: string }>) {
  if (id === N_WRAP.address) return 24;
  if (id === N_USDT.address || id === N_USDC.address) return 6;
  return catalog.get(id)?.decimals ?? 18;
}

function metaOf(id: string, catalog: Map<string, { decimals: number; symbol: string; icon: string }>) {
  if (id === N_WRAP.address) return { symbol: "NEAR", icon: "/tokens/near.png" };
  if (id === N_USDT.address) return { symbol: "USDT", icon: "/tokens/usdt.png" };
  if (id === N_USDC.address) return { symbol: "USDC", icon: "/tokens/usdc.png" };
  return catalog.get(id) ?? { symbol: id.slice(0, 6), icon: "/tokens/near.png" };
}

function isStable(id: string) {
  return id === N_USDT.address || id === N_USDC.address;
}

async function marketsFromIndexer(): Promise<MarketRow[] | null> {
  try {
    const json = await cacheGet(
      {
        key: cacheKey("http.ref", 397, "list-top-pools"),
        policy: { ...POLICIES.catalog, keep: (rows: RefTop[] | null) => Boolean(rows?.length) },
      },
      async () => {
        const res = await fetch("https://api.ref.finance/list-top-pools");
        if (!res.ok) return null;
        const data = (await res.json()) as RefTop[];
        return Array.isArray(data) && data.length ? data : null;
      },
    );
    if (!json) return null;
    if (!Array.isArray(json) || !json.length) return null;
    const tokens = catalogTopOn(397, 500);
    const catalog = new Map(tokens.map((t) => [t.address.toLowerCase(), { decimals: t.decimals, symbol: t.symbol ?? t.address, icon: t.icon ?? "/tokens/near.png" }]));
    const rows: MarketRow[] = [];
    const seen = new Set<string>();
    for (const p of json) {
      const ids = (p.token_account_ids ?? []).map((x) => x.toLowerCase());
      if (ids.length !== 2) continue;
      const tvl = Number(p.tvl);
      if (!Number.isFinite(tvl) || tvl <= 0) continue;
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
      if (seen.has(id)) continue;
      seen.add(id);
      const decA = decOf(a, catalog);
      const decB = decOf(b, catalog);
      const amtA = Number(p.amounts?.[iA] ?? 0) / 10 ** decA;
      const amtB = Number(p.amounts?.[iB] ?? 0) / 10 ** decB;
      const price = amtA > 0 && amtB > 0 ? amtB / amtA : null;
      const ma = metaOf(a, catalog);
      const mb = metaOf(b, catalog);
      const usd = isStable(b) && price ? price : isStable(a) && price ? 1 / price : null;
      rows.push({
        pairId: id,
        chainId: 397,
        chainShort: "NEAR",
        symbolA: ma.symbol,
        symbolB: mb.symbol,
        iconA: ma.icon,
        iconB: mb.icon,
        tokenA: a,
        tokenB: b,
        venues: [
          {
            protocolId: REF_VENUE.id,
            protocolName: REF_VENUE.name,
            chainId: 397,
            pool: `ref:${p.id}`,
            feeLabel: p.total_fee != null ? `${(Number(p.total_fee) / 100).toFixed(2)}%` : "0.30%",
            priceAinB: price ?? 0,
            reserveA: amtA,
            reserveB: amtB,
            tvlQuote: tvl,
            kind: "ref",
          },
        ],
        price: usd,
        depth: tvl,
        venueNames: [REF_VENUE.name],
      });
    }
    return rows;
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
