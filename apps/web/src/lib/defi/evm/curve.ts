import { formatUnits, type Address, type PublicClient } from "viem";
import { forChunks } from "../cache.ts";
import type { DefiProtocol, PoolRef, TokenRef, VenueQuote } from "../types.ts";
import { callMany } from "./client.ts";
import { ZERO } from "./math.ts";

const PROVIDER = "0x5ffe7FB82894076ECB99A30D6A32e969e6e35E98" as Address;
const META_ID = 7n;
const ZERO_ADDR = ZERO as Address;

const FALLBACK_META: Record<number, Address> = {
  1: "0xF98B45FA17DE75FB1aD0e7aFD971b0ca00e379fC",
  42161: "0x13526206545e2DC7CcfBaF28dC88F440ce7AD3e0",
};

const providerAbi = [
  {
    type: "function",
    name: "get_address",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
] as const;

const find2Abi = [
  {
    type: "function",
    name: "find_pool_for_coins",
    stateMutability: "view",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
    ],
    outputs: [{ type: "address" }],
  },
] as const;

const findIAbi = [
  {
    type: "function",
    name: "find_pool_for_coins",
    stateMutability: "view",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "i", type: "uint256" },
    ],
    outputs: [{ type: "address" }],
  },
] as const;

const metaReadAbi = [
  {
    type: "function",
    name: "get_n_coins",
    stateMutability: "view",
    inputs: [{ name: "pool", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "get_coins",
    stateMutability: "view",
    inputs: [{ name: "pool", type: "address" }],
    outputs: [{ type: "address[8]" }],
  },
  {
    type: "function",
    name: "get_balances",
    stateMutability: "view",
    inputs: [{ name: "pool", type: "address" }],
    outputs: [{ type: "uint256[8]" }],
  },
  {
    type: "function",
    name: "get_decimals",
    stateMutability: "view",
    inputs: [{ name: "pool", type: "address" }],
    outputs: [{ type: "uint256[8]" }],
  },
  {
    type: "function",
    name: "get_lp_token",
    stateMutability: "view",
    inputs: [{ name: "pool", type: "address" }],
    outputs: [{ type: "address" }],
  },
] as const;

const metaCache = new Map<number, Address | null>();

async function metaRegistry(client: PublicClient, chainId: number): Promise<Address | null> {
  if (metaCache.has(chainId)) return metaCache.get(chainId) ?? null;
  let addr: Address | null = null;
  try {
    const got = await client.readContract({ address: PROVIDER, abi: providerAbi, functionName: "get_address", args: [META_ID] });
    if (got && got !== ZERO_ADDR) addr = got;
  } catch {
    /* fallback */
  }
  if (!addr) addr = FALLBACK_META[chainId] ?? null;
  metaCache.set(chainId, addr);
  return addr;
}

function same(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

async function findPools(client: PublicClient, meta: Address, tokenA: Address, tokenB: Address): Promise<Address[]> {
  const out: Address[] = [];
  const seen = new Set<string>();
  const push = (p: Address | undefined) => {
    if (!p || p === ZERO_ADDR) return;
    const k = p.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(p);
  };
  try {
    push(
      await client.readContract({
        address: meta,
        abi: find2Abi,
        functionName: "find_pool_for_coins",
        args: [tokenA, tokenB],
      }),
    );
  } catch {
    /* try indexed */
  }
  const extra = await callMany(
    client,
    [1n, 2n, 3n].map((i) => ({
      address: meta,
      abi: findIAbi,
      functionName: "find_pool_for_coins",
      args: [tokenA, tokenB, i],
    })),
  );
  for (const r of extra) {
    if (r.status === "success") push(r.result as Address);
  }
  return out;
}

export function makeCurve(chainId: number): DefiProtocol {
  return {
    id: `curve-${chainId}`,
    name: "Curve",
    chainId,
    caps: ["markets", "quote", "lp"],
    async discover(ctx, tokenA, tokenB) {
      const client = ctx.evm;
      if (!client) return [];
      const meta = await metaRegistry(client, chainId);
      if (!meta) return [];
      try {
        const pools = await findPools(client, meta, tokenA.address as Address, tokenB.address as Address);
        return pools.map((pool) => ({
          protocolId: `curve-${chainId}`,
          chainId,
          pool,
          tokenA: tokenA.address,
          tokenB: tokenB.address,
          feeLabel: "stable",
        }));
      } catch {
        return [];
      }
    },
    async discoverMany(ctx, pairs) {
      const client = ctx.evm;
      if (!client || !pairs.length) return [];
      const meta = await metaRegistry(client, chainId);
      if (!meta) return [];
      const hits: Array<{ a: TokenRef; b: TokenRef; refs: PoolRef[] }> = [];
      await forChunks(pairs, 20, async (chunk) => {
        await Promise.all(
          chunk.map(async (p) => {
            try {
              const pools = await findPools(client, meta, p.a.address as Address, p.b.address as Address);
              if (!pools.length) return;
              hits.push({
                a: p.a,
                b: p.b,
                refs: pools.map((pool) => ({
                  protocolId: `curve-${chainId}`,
                  chainId,
                  pool,
                  tokenA: p.a.address,
                  tokenB: p.b.address,
                  feeLabel: "stable",
                })),
              });
            } catch {
              /* miss */
            }
          }),
        );
      });
      return hits;
    },
    async readPool(ctx, ref, tokenA, tokenB) {
      const client = ctx.evm;
      if (!client) return null;
      const meta = await metaRegistry(client, chainId);
      if (!meta) return null;
      try {
        const pool = ref.pool as Address;
        const [coins, bals, decs] = await Promise.all([
          client.readContract({ address: meta, abi: metaReadAbi, functionName: "get_coins", args: [pool] }),
          client.readContract({ address: meta, abi: metaReadAbi, functionName: "get_balances", args: [pool] }),
          client.readContract({ address: meta, abi: metaReadAbi, functionName: "get_decimals", args: [pool] }),
        ]);
        const list = coins as readonly Address[];
        const ia = list.findIndex((c) => same(c, tokenA.address));
        const ib = list.findIndex((c) => same(c, tokenB.address));
        if (ia < 0 || ib < 0) return null;
        const decA = Number(decs[ia] || tokenA.decimals);
        const decB = Number(decs[ib] || tokenB.decimals);
        const reserveA = Number(formatUnits(bals[ia] ?? 0n, decA));
        const reserveB = Number(formatUnits(bals[ib] ?? 0n, decB));
        if (!reserveA || !reserveB) return null;
        const priceAinB = reserveB / reserveA;
        if (!Number.isFinite(priceAinB) || priceAinB <= 0) return null;
        return {
          protocolId: `curve-${chainId}`,
          protocolName: "Curve",
          chainId,
          pool: ref.pool,
          feeLabel: ref.feeLabel,
          priceAinB,
          reserveA,
          reserveB,
          tvlQuote: reserveB + reserveA * priceAinB,
          kind: "curve",
        } satisfies VenueQuote;
      } catch {
        return null;
      }
    },
  };
}

export const CURVE_CHAINS = [1, 10, 137, 8453, 42161, 100, 43114, 56];
