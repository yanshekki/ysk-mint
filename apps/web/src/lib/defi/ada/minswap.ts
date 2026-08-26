import { A_USDM, isAdaStable, loadAdaMarkets, quoteAdaToken } from "../../adaDex.ts";
import type { VenuePool } from "../../dexPools.ts";
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
    const seeded = await loadAdaMarkets();
    const rows: MarketRow[] = seeded.map((r) => ({ ...r, venues: r.venues.map(asQuote) }));
    const seen = new Set(rows.map((r) => r.tokenA.toLowerCase()));
    const tokens = catalogTopOn(1815);
    await Promise.all(
      tokens.map(async (t) => {
        if (seen.has(t.address.toLowerCase()) || isAdaStable(t.address)) return;
        const q = await quoteAdaToken(t.native ? "lovelace" : t.address, t.native).catch(() => null);
        if (!q) return;
        const b = t.native || t.address === "lovelace" ? A_USDM : A_USDM;
        rows.push({
          pairId: `1815:${t.address}-${b.address}`,
          chainId: 1815,
          chainShort: "ADA",
          symbolA: t.symbol ?? "ADA",
          symbolB: b.symbol,
          iconA: t.icon ?? "/tokens/ada.png",
          iconB: b.icon,
          tokenA: t.address,
          tokenB: b.address,
          venues: [
            {
              protocolId: "minswap-1815",
              protocolName: "Minswap",
              chainId: 1815,
              pool: "minswap-agg",
              feeLabel: "agg",
              priceAinB: q.usdc,
              reserveA: 0,
              reserveB: 0,
              tvlQuote: 0,
              kind: "minswap",
            },
          ],
          price: q.usdc,
          depth: 0,
          venueNames: ["Minswap"],
        });
      }),
    );
    return rows;
  },
};
