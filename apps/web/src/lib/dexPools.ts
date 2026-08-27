import { type PublicClient } from "viem";
import type { Venue } from "./dexVenues.ts";
import { pairId, type Addr } from "./pairKey.ts";
import { aeroFactoryAbi, erc20BalAbi, v2FactoryAbi, v2PairAbi, v3FactoryAbi, v3PoolAbi } from "./defi/evm/abis.ts";
import { consensusPairPrice, readPairVenues } from "./defi/quote.ts";
import type { VenueQuote } from "./defi/types.ts";

export { aeroFactoryAbi, erc20BalAbi, v2FactoryAbi, v2PairAbi, v3FactoryAbi, v3PoolAbi };

export type VenuePool = {
  venue: Venue;
  pool: string;
  feeLabel: string;
  priceAinB: number;
  tvlQuote: number;
  reserveA: number;
  reserveB: number;
};

export function venueQuotesToPools(quotes: VenueQuote[]): VenuePool[] {
  return quotes.map(toVenuePool);
}

function toVenuePool(q: VenueQuote): VenuePool {
  const kind = q.kind === "aero" ? "aero" : q.kind === "v3" ? "v3" : "v2";
  return {
    venue: {
      id: q.protocolId,
      name: q.protocolName,
      chainId: q.chainId,
      kind,
      factory: "0x0000000000000000000000000000000000000000",
    },
    pool: q.pool,
    feeLabel: q.feeLabel,
    priceAinB: q.priceAinB,
    tvlQuote: q.tvlQuote,
    reserveA: q.reserveA,
    reserveB: q.reserveB,
  };
}

export async function readVenuesForPair(
  client: PublicClient,
  chainId: number,
  tokenA: Addr,
  tokenB: Addr,
  decA: number,
  decB: number,
): Promise<VenuePool[]> {
  const quotes = await readPairVenues(client, chainId, tokenA, tokenB, decA, decB);
  return venueQuotesToPools(quotes);
}

export function weightedPrice(venues: VenuePool[]) {
  return consensusPairPrice(
    venues.map((v) => ({
      protocolId: v.venue.id,
      protocolName: v.venue.name,
      chainId: v.venue.chainId,
      pool: v.pool,
      feeLabel: v.feeLabel,
      priceAinB: v.priceAinB,
      reserveA: v.reserveA,
      reserveB: v.reserveB,
      tvlQuote: v.tvlQuote,
      kind: v.venue.kind === "aero" ? "aero" : v.venue.kind === "v3" ? "v3" : "v2",
    })),
  );
}

export function pairIdentity(chainId: number, a: Addr, b: Addr) {
  return pairId(chainId, a, b);
}
