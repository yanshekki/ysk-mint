import type { Address } from "viem";
import type { Venue } from "../../dexVenues.ts";
import type { DefiProtocol } from "../types.ts";
import { aeroFactoryAbi } from "./abis.ts";
import { ZERO } from "./math.ts";
import { readV2Pool } from "./univ2.ts";

export function makeAero(venue: Venue): DefiProtocol {
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
            functionName: "getPool",
            args: [tokenA.address as Address, tokenB.address as Address, false],
          }),
          client.readContract({
            address: venue.factory,
            abi: aeroFactoryAbi,
            functionName: "getPool",
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
    async readPool(ctx, ref, tokenA, tokenB) {
      return readV2Pool(ctx, venue, ref, tokenA, tokenB, "aero");
    },
  };
}
