import { type Address, type PublicClient } from "viem";
import { SEED_PAIRS, isStable } from "./dexVenues.ts";
import { readVenuesForPair, weightedPrice, type VenuePool } from "./dexPools.ts";
import { canonAddr } from "./pairKey.ts";
import { quoteEvmToken, quoteSolMints, type Quote } from "./defiQuotes.ts";

export type Oracle = {
  usdc: number;
  venues: VenuePool[];
};

export async function oraclePair(
  client: PublicClient,
  chainId: number,
  tokenA: Address,
  tokenB: Address,
  decA: number,
  decB: number,
): Promise<Oracle | null> {
  const venues = await readVenuesForPair(client, chainId, tokenA, tokenB, decA, decB);
  if (!venues.length) return null;
  const price = weightedPrice(venues);
  if (price == null) return null;
  return { usdc: price, venues };
}

export async function oracleTokenUsdc(
  client: PublicClient,
  chainId: number,
  token: Address | undefined,
  decimals: number,
  native?: boolean,
): Promise<Quote | null> {
  const seeds = SEED_PAIRS.filter((p) => p.chainId === chainId);
  const wrapped = seeds[0]?.a;
  const addr = (native ? wrapped?.address : token)?.toLowerCase();
  if (!addr) return quoteEvmToken(client, chainId, token, decimals, native);
  const asToken = seeds.flatMap((p) => [p.a, p.b]).find((t) => t.address.toLowerCase() === addr);
  if (asToken && isStable(asToken.symbol)) return { usdc: 1, source: "stable" };
  const quoteTok = seeds.find((p) => isStable(p.b.symbol))?.b;
  if (quoteTok && asToken) {
    const o = await oraclePair(client, chainId, canonAddr(addr), quoteTok.address, asToken.decimals, quoteTok.decimals).catch(() => null);
    if (o) return { usdc: o.usdc, source: "v3" };
  }
  return quoteEvmToken(client, chainId, token, decimals, native);
}

export { quoteSolMints };
