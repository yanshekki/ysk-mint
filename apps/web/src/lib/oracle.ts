import { type Address, type PublicClient } from "viem";
import { SEED_PAIRS, isStable, type SeedToken } from "./dexVenues.ts";
import { readVenuesForPair, weightedPrice, type VenuePool } from "./dexPools.ts";
import { canonAddr } from "./pairKey.ts";
import { quoteEvmToken, quoteSolMints, type Quote } from "./defiQuotes.ts";
import { DEX, isUsdStableAddress, usdStables } from "./defiAddresses.ts";
import { quoteNearToken } from "./nearDex.ts";
import { quoteAdaToken } from "./adaDex.ts";

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

function uniqueUsdQuotes(chainId: number): SeedToken[] {
  const out: SeedToken[] = [];
  const seen = new Set<string>();
  const push = (t: { address: `0x${string}`; symbol: string; decimals: number; icon?: string }) => {
    const a = t.address.toLowerCase();
    if (seen.has(a)) return;
    seen.add(a);
    out.push({ address: t.address, symbol: t.symbol, decimals: t.decimals, icon: t.icon ?? "" });
  };
  for (const p of SEED_PAIRS) {
    if (p.chainId !== chainId) continue;
    if (isStable(p.a.symbol)) push(p.a);
    if (isStable(p.b.symbol)) push(p.b);
  }
  const d = DEX[chainId];
  if (d) {
    for (const s of usdStables(d)) {
      push({ address: s.address, symbol: s.symbol, decimals: s.decimals });
    }
  }
  return out;
}

export async function oracleTokenUsdc(
  client: PublicClient | undefined,
  chainId: number,
  token: Address | string | undefined,
  decimals: number,
  native?: boolean,
): Promise<Quote | null> {
  if (chainId === 397) return quoteNearToken(token, native);
  if (chainId === 1815) return quoteAdaToken(token, native);
  if (!client) return null;
  const d = DEX[chainId];
  const seeds = SEED_PAIRS.filter((p) => p.chainId === chainId);
  const wrapped = d?.wrapped ?? seeds[0]?.a.address;
  const addr = (native ? wrapped : token)?.toLowerCase();
  if (!addr) return quoteEvmToken(client, chainId, token as Address | undefined, decimals, native);
  if (d && isUsdStableAddress(d, addr)) return { usdc: 1, source: "stable" };

  const asToken = seeds.flatMap((p) => [p.a, p.b]).find((t) => t.address.toLowerCase() === addr);
  if (asToken && isStable(asToken.symbol)) return { usdc: 1, source: "stable" };

  const quotes = uniqueUsdQuotes(chainId).filter((q) => q.address.toLowerCase() !== addr);
  const allVenues: VenuePool[] = [];
  await Promise.all(
    quotes.map(async (q) => {
      const venues = await readVenuesForPair(
        client,
        chainId,
        canonAddr(addr),
        q.address,
        asToken?.decimals ?? decimals,
        q.decimals,
      ).catch(() => [] as VenuePool[]);
      allVenues.push(...venues);
    }),
  );
  if (allVenues.length) {
    const price = weightedPrice(allVenues);
    if (price != null) return { usdc: price, source: "v3" };
  }
  return quoteEvmToken(client, chainId, token as Address | undefined, decimals, native);
}

export { quoteSolMints };
