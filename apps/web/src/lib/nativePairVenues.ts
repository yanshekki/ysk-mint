import { adaVenuesForPair } from "./adaDex.ts";
import { cacheKey, cacheLastGood } from "./defi/cache.ts";
import { marketsCacheKey } from "./defi/markets.ts";
import { ensureProtocols } from "./defi/protocols.ts";
import { protocolsOn } from "./defi/registry.ts";
import type { MarketRow, VenueQuote } from "./defi/types.ts";
import { venueQuotesToPools, type VenuePool } from "./dexPools.ts";
import { nearVenuesForPair } from "./nearDex.ts";
import { pairId } from "./pairKey.ts";

const NATIVE = new Set([101, 397, 1815, 784, 607, 637]);

function marketKey(chainId: number) {
  return NATIVE.has(chainId) ? cacheKey("markets", chainId, "n5") : marketsCacheKey(chainId);
}

function rowForPair(rows: MarketRow[] | undefined, chainId: number, a: string, b: string) {
  if (!rows?.length) return undefined;
  const id = pairId(chainId, a, b);
  const xa = a.toLowerCase();
  const xb = b.toLowerCase();
  return rows.find((r) => {
    if (r.pairId === id) return true;
    const ta = r.tokenA.toLowerCase();
    const tb = r.tokenB.toLowerCase();
    return (ta === xa && tb === xb) || (ta === xb && tb === xa);
  });
}

/** Same quotes the markets list already loaded for this pair (EVM or native cache). */
export function cachedMarketPairQuotes(chainId: number, tokenA: string, tokenB: string): VenueQuote[] {
  const row = rowForPair(cacheLastGood<MarketRow[]>(marketKey(chainId)), chainId, tokenA, tokenB);
  return row?.venues?.length ? (row.venues as VenueQuote[]) : [];
}

export function cachedNativePairVenues(chainId: number, tokenA: string, tokenB: string): VenuePool[] {
  const quotes = cachedMarketPairQuotes(chainId, tokenA, tokenB);
  return quotes.length ? venueQuotesToPools(quotes) : [];
}

export async function nativePairVenues(chainId: number, vm: string | undefined, tokenA: string, tokenB: string, decA = 6, decB = 6): Promise<VenuePool[]> {
  if (vm === "near") return nearVenuesForPair(tokenA, tokenB);
  if (vm === "cardano") return adaVenuesForPair(tokenA, tokenB, decA, decB);
  const cached = cachedNativePairVenues(chainId, tokenA, tokenB);
  if (cached.length) return cached;
  if (!NATIVE.has(chainId)) return [];
  ensureProtocols();
  const parts = await Promise.all(protocolsOn(chainId).map((p) => (p.markets ? p.markets({}).catch(() => []) : Promise.resolve([]))));
  const row = rowForPair(parts.flat() as MarketRow[], chainId, tokenA, tokenB);
  return row ? venueQuotesToPools(row.venues as VenueQuote[]) : [];
}
