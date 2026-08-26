import type { Address } from "viem";
import type { Venue } from "../../dexVenues.ts";
import { forChunks } from "../cache.ts";
import type { DefiProtocol, PoolRef, TokenRef } from "../types.ts";
import { aeroFactoryAbi } from "./abis.ts";
import { ZERO } from "./math.ts";
import { readV2Pool } from "./univ2.ts";

export function makeAero(venue: Venue): DefiProtocol {
  const fn = venue.poolFn ?? "getPool";
  return {
    id: venue.id,
    name: venue.name,
    chainId: venue.chainId,
    caps: ["markets", "quote", "lp"],
    async discover(ctx, tokenA, tokenB) {
      const client = ctx.evm;
      if (!client) return [];
      try {
        const [vol, st] = await Promise.all([
          client.readContract({
            address: venue.factory,
            abi: aeroFactoryAbi,
            functionName: fn,
            args: [tokenA.address as Address, tokenB.address as Address, false],
          }),
          client.readContract({
            address: venue.factory,
            abi: aeroFactoryAbi,
            functionName: fn,
            args: [tokenA.address as Address, tokenB.address as Address, true],
          }),
        ]);
        const out = [];
        if (vol && vol !== ZERO) {
          out.push({
            protocolId: venue.id,
            chainId: venue.chainId,
            pool: vol,
            tokenA: tokenA.address,
            tokenB: tokenB.address,
            feeLabel: "0.30%",
            extra: { stable: false },
          });
        }
        if (st && st !== ZERO) {
          out.push({
            protocolId: venue.id,
            chainId: venue.chainId,
            pool: st,
            tokenA: tokenA.address,
            tokenB: tokenB.address,
            feeLabel: "0.05%",
            extra: { stable: true },
          });
        }
        return out;
      } catch {
        return [];
      }
    },
    async discoverMany(ctx, pairs) {
      const client = ctx.evm;
      if (!client || !pairs.length) return [];
      const hits: Array<{ a: TokenRef; b: TokenRef; refs: PoolRef[] }> = [];
      await forChunks(pairs, 40, async (chunk) => {
        try {
          const contracts = chunk.flatMap((p) => [
            {
              address: venue.factory,
              abi: aeroFactoryAbi,
              functionName: fn,
              args: [p.a.address as Address, p.b.address as Address, false] as const,
            },
            {
              address: venue.factory,
              abi: aeroFactoryAbi,
              functionName: fn,
              args: [p.a.address as Address, p.b.address as Address, true] as const,
            },
          ]);
          const res = await client.multicall({ contracts, allowFailure: true });
          chunk.forEach((p, i) => {
            const refs: PoolRef[] = [];
            const vol = res[i * 2];
            const st = res[i * 2 + 1];
            if (vol.status === "success" && vol.result && vol.result !== ZERO) {
              refs.push({
                protocolId: venue.id,
                chainId: venue.chainId,
                pool: vol.result,
                tokenA: p.a.address,
                tokenB: p.b.address,
                feeLabel: "0.30%",
                extra: { stable: false },
              });
            }
            if (st.status === "success" && st.result && st.result !== ZERO) {
              refs.push({
                protocolId: venue.id,
                chainId: venue.chainId,
                pool: st.result,
                tokenA: p.a.address,
                tokenB: p.b.address,
                feeLabel: "0.05%",
                extra: { stable: true },
              });
            }
            if (refs.length) hits.push({ a: p.a, b: p.b, refs });
          });
        } catch {
          /* batch miss */
        }
      });
      return hits;
    },
    async readPool(ctx, ref, tokenA, tokenB) {
      return readV2Pool(ctx, venue, ref, tokenA, tokenB, "aero");
    },
  };
}
