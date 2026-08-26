import { formatUnits, type Address } from "viem";
import { canonAddr, type Addr } from "../../pairKey.ts";
import { forChunks } from "../cache.ts";
import type { DefiProtocol, PoolRef, TokenRef, VenueQuote } from "../types.ts";
import { ZERO } from "./math.ts";

type SyncVenue = {
  id: string;
  name: string;
  chainId: number;
  factory: Addr;
};

const factoryAbi = [
  {
    type: "function",
    name: "getPool",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
    ],
    outputs: [{ type: "address" }],
  },
] as const;

const poolAbi = [
  {
    type: "function",
    name: "getReserves",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }, { type: "uint256" }],
  },
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

export function makeSync(venue: SyncVenue): DefiProtocol {
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
          functionName: "getPool",
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
          const res = await client.multicall({
            contracts: chunk.map((p) => ({
              address: venue.factory,
              abi: factoryAbi,
              functionName: "getPool" as const,
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
    async readPool(ctx, ref, tokenA, tokenB): Promise<VenueQuote | null> {
      const client = ctx.evm;
      if (!client) return null;
      try {
        const pool = ref.pool as Address;
        const [reserves, token0] = await Promise.all([
          client.readContract({ address: pool, abi: poolAbi, functionName: "getReserves" }),
          client.readContract({ address: pool, abi: poolAbi, functionName: "token0" }),
        ]);
        const aIs0 = canonAddr(token0) === canonAddr(tokenA.address);
        const r0 = Number(formatUnits(reserves[0], aIs0 ? tokenA.decimals : tokenB.decimals));
        const r1 = Number(formatUnits(reserves[1], aIs0 ? tokenB.decimals : tokenA.decimals));
        const reserveA = aIs0 ? r0 : r1;
        const reserveB = aIs0 ? r1 : r0;
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
          tvlQuote: reserveB * 2,
          kind: "v2",
        };
      } catch {
        return null;
      }
    },
  };
}

/** Classic factory getPool(tokenA,tokenB); pool getReserves is (uint,uint) vault-backed. */
export const SYNCSWAP_VENUES: SyncVenue[] = [
  {
    id: "sync-classic-324",
    name: "SyncSwap",
    chainId: 324,
    factory: "0xf2DAd89f2788a8CD54625C60b55cD3d2D0ACa7Cb",
  },
  {
    id: "sync-classic-59144",
    name: "SyncSwap",
    chainId: 59144,
    factory: "0x37BAc764494c8db4e54BDE72f6965beA9fa0AC2d",
  },
];
