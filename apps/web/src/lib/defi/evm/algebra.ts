import { formatUnits, type Address } from "viem";
import { canonAddr, type Addr } from "../../pairKey.ts";
import { forChunks } from "../cache.ts";
import type { DefiProtocol, PoolRef, TokenRef, VenueQuote } from "../types.ts";
import { erc20BalAbi } from "./abis.ts";
import { ZERO, priceFromSqrtPriceX96 } from "./math.ts";

type AlgebraVenue = {
  id: string;
  name: string;
  chainId: number;
  factory: Addr;
};

const factoryAbi = [
  {
    type: "function",
    name: "poolByPair",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
    ],
    outputs: [{ type: "address" }],
  },
] as const;

const poolMetaAbi = [
  { type: "function", name: "liquidity", stateMutability: "view", inputs: [], outputs: [{ type: "uint128" }] },
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

/** QuickSwap Algebra V1 / V1.9 */
const stateQsAbi = [
  {
    type: "function",
    name: "globalState",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { type: "uint160" },
      { type: "int24" },
      { type: "uint16" },
      { type: "uint16" },
      { type: "uint8" },
      { type: "uint8" },
      { type: "bool" },
    ],
  },
] as const;

/** Camelot Algebra V1.9 directional */
const stateDirAbi = [
  {
    type: "function",
    name: "globalState",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { type: "uint160" },
      { type: "int24" },
      { type: "int24" },
      { type: "uint16" },
      { type: "uint16" },
      { type: "uint8" },
      { type: "bool" },
    ],
  },
] as const;

function feeLabelOf(fee: number | undefined) {
  if (fee == null || fee <= 0) return "dyn";
  return `${fee / 10000}%`;
}

async function readSqrt(
  client: NonNullable<import("viem").PublicClient>,
  pool: Address,
): Promise<{ price: bigint; fee?: number }> {
  try {
    const g = await client.readContract({ address: pool, abi: stateQsAbi, functionName: "globalState" });
    return { price: g[0], fee: Number(g[2]) };
  } catch {
    const g = await client.readContract({ address: pool, abi: stateDirAbi, functionName: "globalState" });
    return { price: g[0], fee: Number(g[3]) };
  }
}

export function makeAlgebra(venue: AlgebraVenue): DefiProtocol {
  return {
    id: venue.id,
    name: venue.name,
    chainId: venue.chainId,
    caps: ["markets", "quote", "lp"],
    async discover(ctx, tokenA, tokenB) {
      const client = ctx.evm;
      if (!client) return [];
      try {
        const pool = await client.readContract({
          address: venue.factory,
          abi: factoryAbi,
          functionName: "poolByPair",
          args: [tokenA.address as Address, tokenB.address as Address],
        });
        if (!pool || pool === ZERO) return [];
        return [
          {
            protocolId: venue.id,
            chainId: venue.chainId,
            pool,
            tokenA: tokenA.address,
            tokenB: tokenB.address,
            feeLabel: "dyn",
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
          const res = await client.multicall({
            contracts: chunk.map((p) => ({
              address: venue.factory,
              abi: factoryAbi,
              functionName: "poolByPair" as const,
              args: [p.a.address as Address, p.b.address as Address],
            })),
            allowFailure: true,
          });
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
                  feeLabel: "dyn",
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
      const client = ctx.evm;
      if (!client) return null;
      const pool = ref.pool as Address;
      try {
        const [state, liq, token0, balA, balB] = await Promise.all([
          readSqrt(client, pool),
          client.readContract({ address: pool, abi: poolMetaAbi, functionName: "liquidity" }),
          client.readContract({ address: pool, abi: poolMetaAbi, functionName: "token0" }),
          client.readContract({ address: tokenA.address as Address, abi: erc20BalAbi, functionName: "balanceOf", args: [pool] }),
          client.readContract({ address: tokenB.address as Address, abi: erc20BalAbi, functionName: "balanceOf", args: [pool] }),
        ]);
        if (liq === 0n || state.price === 0n) return null;
        const aIs0 = canonAddr(token0) === canonAddr(tokenA.address);
        const price = priceFromSqrtPriceX96(state.price, aIs0, tokenA.decimals, tokenB.decimals);
        if (price == null) return null;
        const reserveA = Number(formatUnits(balA, tokenA.decimals));
        const reserveB = Number(formatUnits(balB, tokenB.decimals));
        if (!Number.isFinite(reserveA) || !Number.isFinite(reserveB)) return null;
        if (reserveA <= 0 && reserveB <= 0) return null;
        return {
          protocolId: venue.id,
          protocolName: venue.name,
          chainId: venue.chainId,
          pool: ref.pool,
          feeLabel: feeLabelOf(state.fee),
          priceAinB: price,
          reserveA,
          reserveB,
          tvlQuote: reserveB > 0 ? reserveB * 2 : reserveA * price * 2,
          kind: "v3",
        } satisfies VenueQuote;
      } catch {
        return null;
      }
    },
  };
}

/** Official Algebra factories: QuickSwap V3 Polygon, Camelot V3 Arbitrum. */
export const ALGEBRA_VENUES: AlgebraVenue[] = [
  {
    id: "quick-v3-137",
    name: "QuickSwap Algebra",
    chainId: 137,
    factory: "0x411b0fAcC3489691f28ad58c47006AF5E3Ab3A28",
  },
  {
    id: "camelot-v3-42161",
    name: "Camelot V3",
    chainId: 42161,
    factory: "0x1a3c9B1d2F0529D97f2afC5136Cc23e58F1FD35B",
  },
  {
    id: "thena-cl-56",
    name: "Thena Fusion",
    chainId: 56,
    factory: "0x306F06C147f064A010530292A1EB6737c3e378e4",
  },
];
