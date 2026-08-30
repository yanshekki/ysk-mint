import { formatUnits, type Address } from "viem";
import { asAddr, canonAddr } from "../../pairKey.ts";
import type { Venue } from "../../dexVenues.ts";
import { forChunks } from "../cache.ts";
import type { DefiProtocol, PoolRef, TokenRef, VenueQuote } from "../types.ts";
import { erc20BalAbi, v3FactoryAbi, v3PoolAbi, v3TickFactoryAbi } from "./abis.ts";
import { callMany } from "./client.ts";
import { ZERO, priceFromSqrtPriceX96 } from "./math.ts";

function v3Key(venue: Venue) {
  const tick = venue.poolArg === "tick";
  return {
    tick,
    fees: venue.fees ?? (tick ? [1, 10, 50, 100, 200] : [500, 3000]),
    abi: tick ? v3TickFactoryAbi : v3FactoryAbi,
    label: (n: number) => (tick ? `t${n}` : `${n / 10000}%`),
  };
}

export function makeV3(venue: Venue): DefiProtocol {
  const { fees, abi, label } = v3Key(venue);
  return {
    id: venue.id,
    name: venue.name,
    chainId: venue.chainId,
    caps: ["markets", "quote", "lp"],
    async discover(ctx, tokenA, tokenB) {
      const client = ctx.evm;
      if (!client) return [];
      try {
        const res = await callMany(
          client,
          fees.map((fee) => ({
            address: venue.factory,
            abi,
            functionName: "getPool",
            args: [tokenA.address as Address, tokenB.address as Address, fee],
          })),
        );
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
              feeLabel: label(fees[i]),
              extra: { fee: fees[i] },
            },
          ];
        });
      } catch {
        return [];
      }
    },
    async discoverMany(ctx, pairs) {
      const client = ctx.evm;
      if (!client || !pairs.length) return [];
      type Job = { a: TokenRef; b: TokenRef; fee: number };
      const jobs: Job[] = pairs.flatMap((p) => fees.map((fee) => ({ a: p.a, b: p.b, fee })));
      const grouped = new Map<string, { a: TokenRef; b: TokenRef; refs: PoolRef[] }>();
      await forChunks(jobs, 80, async (chunk) => {
        try {
          const res = await callMany(
            client,
            chunk.map((j) => ({
              address: venue.factory,
              abi,
              functionName: "getPool",
              args: [j.a.address as Address, j.b.address as Address, j.fee],
            })),
          );
          res.forEach((r, i) => {
            if (r.status !== "success") return;
            const pool = r.result as Address;
            if (!pool || pool === ZERO) return;
            const j = chunk[i];
            const key = `${j.a.address.toLowerCase()}:${j.b.address.toLowerCase()}`;
            const row = grouped.get(key) ?? { a: j.a, b: j.b, refs: [] };
            row.refs.push({
              protocolId: venue.id,
              chainId: venue.chainId,
              pool,
              tokenA: j.a.address,
              tokenB: j.b.address,
              feeLabel: label(j.fee),
              extra: { fee: j.fee },
            });
            grouped.set(key, row);
          });
        } catch {
          /* batch miss */
        }
      });
      return [...grouped.values()];
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
  const pool = asAddr(poolAddr);
  try {
    const [slot, liq, token0, balA, balB] = await Promise.all([
      client.readContract({ address: pool, abi: v3PoolAbi, functionName: "slot0" }),
      client.readContract({ address: pool, abi: v3PoolAbi, functionName: "liquidity" }),
      client.readContract({ address: pool, abi: v3PoolAbi, functionName: "token0" }),
      client.readContract({ address: asAddr(tokenA.address), abi: erc20BalAbi, functionName: "balanceOf", args: [pool] }),
      client.readContract({ address: asAddr(tokenB.address), abi: erc20BalAbi, functionName: "balanceOf", args: [pool] }),
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
      // UI balances; price is A-in-B from sqrtPriceX96; tvlQuote is quote-token units until wrap/stable conversion.
      tvlQuote: reserveA > 0 && price > 0 ? reserveA * price + Math.max(reserveB, 0) : Math.max(reserveB, 0) * 2,
      kind: "v3",
    };
  } catch {
    return null;
  }
}
