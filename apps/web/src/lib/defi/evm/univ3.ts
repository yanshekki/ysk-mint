import { formatUnits, type Address } from "viem";
import { canonAddr } from "../../pairKey.ts";
import type { Venue } from "../../dexVenues.ts";
import type { DefiProtocol, TokenRef, VenueQuote } from "../types.ts";
import { erc20BalAbi, v3FactoryAbi, v3PoolAbi } from "./abis.ts";
import { ZERO, priceFromSqrtPriceX96 } from "./math.ts";

export function makeV3(venue: Venue): DefiProtocol {
  const fees = venue.fees ?? [500, 3000];
  return {
    id: venue.id,
    name: venue.name,
    chainId: venue.chainId,
    caps: ["markets", "quote", "lp"],
    async discover(ctx, tokenA, tokenB) {
      const client = ctx.evm;
      if (!client) return [];
      try {
        const res = await client.multicall({
          contracts: fees.map((fee) => ({
            address: venue.factory,
            abi: v3FactoryAbi,
            functionName: "getPool" as const,
            args: [tokenA.address as Address, tokenB.address as Address, fee],
          })),
          allowFailure: true,
        });
        return res.flatMap((r, i) => {
          if (r.status !== "success") return [];
          const pool = r.result as Address;
          if (!pool || pool === ZERO) return [];
          return [
            {
              protocolId: venue.id,
              chainId: venue.chainId,
              pool,
              tokenA: tokenA.address,
              tokenB: tokenB.address,
              feeLabel: `${fees[i] / 10000}%`,
              extra: { fee: fees[i] },
            },
          ];
        });
      } catch {
        return [];
      }
    },
    async readPool(ctx, ref, tokenA, tokenB) {
      return readV3Pool(ctx, venue, ref.pool, tokenA, tokenB, ref.feeLabel);
    },
  };
}

async function readV3Pool(
  ctx: { evm?: import("viem").PublicClient },
  venue: Venue,
  poolAddr: string,
  tokenA: TokenRef,
  tokenB: TokenRef,
  feeLabel: string,
): Promise<VenueQuote | null> {
  const client = ctx.evm;
  if (!client) return null;
  const pool = poolAddr as Address;
  try {
    const [slot, liq, token0, balA, balB] = await Promise.all([
      client.readContract({ address: pool, abi: v3PoolAbi, functionName: "slot0" }),
      client.readContract({ address: pool, abi: v3PoolAbi, functionName: "liquidity" }),
      client.readContract({ address: pool, abi: v3PoolAbi, functionName: "token0" }),
      client.readContract({ address: tokenA.address as Address, abi: erc20BalAbi, functionName: "balanceOf", args: [pool] }),
      client.readContract({ address: tokenB.address as Address, abi: erc20BalAbi, functionName: "balanceOf", args: [pool] }),
    ]);
    if (liq === 0n) return null;
    const aIs0 = canonAddr(token0) === canonAddr(tokenA.address);
    const price = priceFromSqrtPriceX96(slot[0], aIs0, tokenA.decimals, tokenB.decimals);
    if (price == null) return null;
    const reserveA = Number(formatUnits(balA, tokenA.decimals));
    const reserveB = Number(formatUnits(balB, tokenB.decimals));
    if (!Number.isFinite(reserveA) || !Number.isFinite(reserveB)) return null;
    if (reserveA <= 0 && reserveB <= 0) return null;
    return {
      protocolId: venue.id,
      protocolName: venue.name,
      chainId: venue.chainId,
      pool: poolAddr,
      feeLabel,
      priceAinB: price,
      reserveA,
      reserveB,
      tvlQuote: reserveB > 0 ? reserveB * 2 : reserveA * price * 2,
      kind: "v3",
    };
  } catch {
    return null;
  }
}
