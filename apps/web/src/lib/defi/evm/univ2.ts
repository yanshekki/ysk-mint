import { formatUnits, type Address } from "viem";
import { DEX, usdStables } from "../../defiAddresses.ts";
import { asAddr, canonAddr } from "../../pairKey.ts";
import type { Venue } from "../../dexVenues.ts";
import { forChunks } from "../cache.ts";
import type { DefiProtocol, PoolRef, TokenRef, VenueQuote } from "../types.ts";
import { v2FactoryAbi, v2PairAbi } from "./abis.ts";
import { callMany } from "./client.ts";
import { enumVenueMarkets } from "./enumPairs.ts";
import { ZERO } from "./math.ts";

let _v2Dbg = 0;

export function makeV2(venue: Venue): DefiProtocol {
  return {
    id: venue.id,
    name: venue.name,
    chainId: venue.chainId,
    caps: ["markets", "quote", "lp"],
    async discover(ctx, tokenA, tokenB) {
      const client = ctx.evm;
      if (!client) return [];
      try {
        const pair = await client.readContract({
          address: asAddr(venue.factory),
          abi: v2FactoryAbi,
          functionName: "getPair",
          args: [asAddr(tokenA.address), asAddr(tokenB.address)],
        });
        if (!pair || pair === ZERO) return [];
        return [
          {
            protocolId: venue.id,
            chainId: venue.chainId,
            pool: pair,
            tokenA: tokenA.address,
            tokenB: tokenB.address,
            feeLabel: "0.30%",
          },
        ];
      } catch {
        return [];
      }
    },
    async discoverMany(ctx, pairs) {
      const client = ctx.evm;
      if (!client || !pairs.length) return [];
      const hits: Array<{ a: TokenRef; b: TokenRef; refs: PoolRef[] }> = [];
      await forChunks(pairs, 80, async (chunk) => {
        try {
          const res = await callMany(
            client,
            chunk.map((p) => ({
              address: venue.factory,
              abi: v2FactoryAbi,
              functionName: "getPair",
              args: [p.a.address as Address, p.b.address as Address],
            })),
          );
          res.forEach((r, i) => {
            if (r.status !== "success") return;
            const pool = r.result as Address;
            if (!pool || pool === ZERO) return;
            const p = chunk[i];
            hits.push({
              a: p.a,
              b: p.b,
              refs: [
                {
                  protocolId: venue.id,
                  chainId: venue.chainId,
                  pool,
                  tokenA: p.a.address,
                  tokenB: p.b.address,
                  feeLabel: "0.30%",
                },
              ],
            });
          });
        } catch {
          /* batch miss */
        }
      });
      return hits;
    },
    async readPool(ctx, ref, tokenA, tokenB) {
      return readV2Pool(ctx, venue, ref, tokenA, tokenB, "v2");
    },
    async markets(ctx) {
      return enumVenueMarkets(ctx, venue, "v2");
    },
  };
}

export async function readV2Pool(
  ctx: { evm?: import("viem").PublicClient },
  venue: Venue,
  ref: PoolRef,
  tokenA: TokenRef,
  tokenB: TokenRef,
  kind: VenueQuote["kind"],
): Promise<VenueQuote | null> {
  const client = ctx.evm;
  if (!client) return null;
  try {
    const pool = asAddr(ref.pool);
    const [reserves, token0] = await Promise.all([
      client.readContract({ address: pool, abi: v2PairAbi, functionName: "getReserves" }),
      client.readContract({ address: pool, abi: v2PairAbi, functionName: "token0" }),
    ]);
    const aIs0 = canonAddr(token0) === canonAddr(tokenA.address);
    const r0 = Number(formatUnits(reserves[0], aIs0 ? tokenA.decimals : tokenB.decimals));
    const r1 = Number(formatUnits(reserves[1], aIs0 ? tokenB.decimals : tokenA.decimals));
    const reserveA = aIs0 ? r0 : r1;
    const reserveB = aIs0 ? r1 : r0;
    // #region agent log
    {
      const d = DEX[venue.chainId];
      const want = (addr: string, used: number) =>
        d
          ? (usdStables(d).find((s) => s.address.toLowerCase() === addr.toLowerCase())?.decimals ??
            (d.wrapped.toLowerCase() === addr.toLowerCase() ? 18 : used))
          : used;
      const wantA = want(String(tokenA.address), tokenA.decimals);
      const wantB = want(String(tokenB.address), tokenB.decimals);
      if (_v2Dbg < 8 && (wantA !== tokenA.decimals || wantB !== tokenB.decimals || /usd/i.test(`${tokenA.symbol}${tokenB.symbol}`))) {
        _v2Dbg += 1;
        fetch("http://127.0.0.1:7877/ingest/5e2e6afe-2618-4b13-996a-8c6b0be88e05", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "05e1c5" },
          body: JSON.stringify({
            sessionId: "05e1c5",
            runId: "pre-fix",
            hypothesisId: "B",
            location: "univ2.ts:readV2Pool",
            message: "v2-decimals",
            data: {
              chainId: venue.chainId,
              venue: venue.name,
              usedA: tokenA.decimals,
              usedB: tokenB.decimals,
              wantA,
              wantB,
              mismatch: wantA !== tokenA.decimals || wantB !== tokenB.decimals,
              reserveA,
              reserveB,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      }
    }
    // #endregion
    if (!reserveA || !reserveB) return null;
    const priceAinB = reserveB / reserveA;
    if (!Number.isFinite(priceAinB) || priceAinB <= 0) return null;
    return {
      protocolId: venue.id,
      protocolName: venue.name,
      chainId: venue.chainId,
      pool: ref.pool,
      feeLabel: ref.feeLabel,
      priceAinB,
      reserveA,
      reserveB,
      tvlQuote: reserveA * priceAinB + reserveB,
      kind,
    };
  } catch {
    return null;
  }
}
