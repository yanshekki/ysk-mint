import { loadNearMarkets, quoteNearToken } from "../../nearDex.ts";
import type { DefiProtocol, MarketRow, VenueQuote } from "../types.ts";
import type { VenuePool } from "../../dexPools.ts";

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

export const nearRefProtocol: DefiProtocol = {
  id: "rhea-ref-397",
  name: "Rhea / Ref",
  chainId: 397,
  caps: ["markets", "quote"],
  async quoteUsd(_ctx, token) {
    return quoteNearToken(token.native ? undefined : token.address, token.native);
  },
  async markets(): Promise<MarketRow[]> {
    const rows = await loadNearMarkets();
    return rows.map((r) => ({ ...r, venues: r.venues.map(asQuote) }));
  },
};
