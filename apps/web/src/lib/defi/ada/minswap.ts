import { loadAdaMarkets, quoteAdaToken } from "../../adaDex.ts";
import type { VenuePool } from "../../dexPools.ts";
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
    kind: "minswap",
  };
}

export const minswapProtocol: DefiProtocol = {
  id: "minswap-1815",
  name: "Minswap",
  chainId: 1815,
  caps: ["markets", "quote"],
  async quoteUsd(_ctx, token) {
    return quoteAdaToken(token.native ? "lovelace" : token.address, token.native);
  },
  async markets(): Promise<MarketRow[]> {
    const rows = await loadAdaMarkets();
    return rows.map((r) => ({ ...r, venues: r.venues.map(asQuote) }));
  },
};
