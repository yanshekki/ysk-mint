import { formatUnits, type Address, type PublicClient } from "viem";
import { forChunks } from "../cache.ts";
import type { DefiProtocol, PoolRef, TokenRef, VenueQuote } from "../types.ts";

const VAULT = "0xBA12222222228d8Ba445958a75a0704d566BF2C8" as Address;

const vaultAbi = [
  {
    type: "function",
    name: "getPoolTokens",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [
      { name: "tokens", type: "address[]" },
      { name: "balances", type: "uint256[]" },
      { name: "lastChangeBlock", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "getPool",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [
      { name: "pool", type: "address" },
      { name: "specialization", type: "uint8" },
    ],
  },
] as const;

const poolIdAbi = [
  { type: "function", name: "getPoolId", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32" }] },
] as const;

const weightsAbi = [
  {
    type: "function",
    name: "getNormalizedWeights",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256[]" }],
  },
] as const;

const erc20DecAbi = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const;

/** Official core pools + well-known 2-token majors. Mix of poolId (66) and BPT address (42). */
const SEEDS: Record<number, string[]> = {
  1: [
    "0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8000200000000000000000019",
    "0xa6f548df93de924d73be7d23d90ac83461265a0c000200000000000000000004",
    "0x32296969ef14eb0c6d29669c550d4a0449130230000200000000000000000080",
    "0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014",
    "0x06df3b2abb98f0f89e99c74ce2c413094e748210000000000000000000000063",
    "0x85b2b559bc2d21104c4defdd6efca8a20343361d",
    "0x1ea5870f7c037930ce1d5d8d9317c670e89e13e3",
  ],
  42161: [
    "0x64541216bafffeec8ea535bb71fbc927831d0595000100000000000000000002",
    "0x32df62dc3aed2cd6224193052ce665dc181658410002000000000000000003bd",
    "0x5418a64e0cdb20548acb394f5d00a089baf02161",
    "0xc072880e1bc0bcddc99db882c7f3e7a839281cf4",
    "0x19b001e6bc2d89154c18e2216eec5c8c6047b6d8",
  ],
  10: [
    "0x7ca75bdea9dede97f8b13c6641b768650cb837820002000000000000000000d5",
    "0x870c0af8a1af0b58b4b0bd31ce4fe72864ae45be",
  ],
  8453: [
    "0x007bb7a4bfc214df06474e39142288e99540f2b3000200000000000000000191",
    "0x7ab124ec4029316c2a42f713828ddf2a192b36db",
    "0xb7b8b3afc010169779c5c2385ec0eb0477fe3347",
  ],
  137: ["0x0297e37f1873d2dab4487aa67cd56b58e2f278750002000000000000000000fd"],
  100: [
    "0x8dd4df4ce580b9644437f3375e54f1ab0980822800020000000000000000009c",
    "0xaa56989be5e6267fc579919576948db3e1f108070002000000000000000000ca",
  ],
};

type Resolved = { poolId: `0x${string}`; pool: Address; tokens: Address[]; balances: bigint[] };

const resolved = new Map<number, Promise<Resolved[]>>();

function same(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

async function resolveSeeds(client: PublicClient, chainId: number): Promise<Resolved[]> {
  const hit = resolved.get(chainId);
  if (hit) return hit;
  const job = (async () => {
    const seeds = SEEDS[chainId] ?? [];
    const out: Resolved[] = [];
    await forChunks(seeds, 8, async (chunk) => {
      await Promise.all(
        chunk.map(async (raw) => {
          try {
            let poolId = raw.toLowerCase() as `0x${string}`;
            if (raw.length === 42) {
              poolId = (await client.readContract({
                address: raw as Address,
                abi: poolIdAbi,
                functionName: "getPoolId",
              })) as `0x${string}`;
            }
            const [tokens, balances] = await client.readContract({
              address: VAULT,
              abi: vaultAbi,
              functionName: "getPoolTokens",
              args: [poolId],
            });
            const poolInfo = await client.readContract({
              address: VAULT,
              abi: vaultAbi,
              functionName: "getPool",
              args: [poolId],
            });
            out.push({ poolId, pool: poolInfo[0], tokens: [...tokens], balances: [...balances] });
          } catch {
            /* skip dead seed */
          }
        }),
      );
    });
    return out;
  })();
  resolved.set(chainId, job);
  return job;
}

function match(row: Resolved, tokenA: string, tokenB: string) {
  const ia = row.tokens.findIndex((t) => same(t, tokenA));
  const ib = row.tokens.findIndex((t) => same(t, tokenB));
  return ia >= 0 && ib >= 0 ? { ia, ib } : null;
}

export function makeBalancer(chainId: number): DefiProtocol {
  const beets = chainId === 10 || chainId === 146;
  const name = beets ? "Beets" : "Balancer";
  const id = `balancer-${chainId}`;
  return {
    id,
    name,
    chainId,
    caps: ["markets", "quote", "lp"],
    async discover(ctx, tokenA, tokenB) {
      const client = ctx.evm;
      if (!client) return [];
      const rows = await resolveSeeds(client, chainId).catch(() => []);
      return rows.flatMap((row) => {
        const m = match(row, tokenA.address, tokenB.address);
        if (!m) return [];
        return [
          {
            protocolId: id,
            chainId,
            pool: row.pool,
            tokenA: tokenA.address,
            tokenB: tokenB.address,
            feeLabel: "weighted",
            extra: { poolId: row.poolId },
          },
        ];
      });
    },
    async discoverMany(ctx, pairs) {
      const client = ctx.evm;
      if (!client || !pairs.length) return [];
      const rows = await resolveSeeds(client, chainId).catch(() => []);
      const hits: Array<{ a: TokenRef; b: TokenRef; refs: PoolRef[] }> = [];
      for (const p of pairs) {
        const refs: PoolRef[] = [];
        for (const row of rows) {
          if (!match(row, p.a.address, p.b.address)) continue;
          refs.push({
            protocolId: id,
            chainId,
            pool: row.pool,
            tokenA: p.a.address,
            tokenB: p.b.address,
            feeLabel: "weighted",
            extra: { poolId: row.poolId },
          });
        }
        if (refs.length) hits.push({ a: p.a, b: p.b, refs });
      }
      return hits;
    },
    async readPool(ctx, ref, tokenA, tokenB) {
      const client = ctx.evm;
      if (!client) return null;
      const poolId = (ref.extra?.poolId as string | undefined) as `0x${string}` | undefined;
      if (!poolId) return null;
      try {
        const [tokens, balances] = await client.readContract({
          address: VAULT,
          abi: vaultAbi,
          functionName: "getPoolTokens",
          args: [poolId],
        });
        const ia = tokens.findIndex((t) => same(t, tokenA.address));
        const ib = tokens.findIndex((t) => same(t, tokenB.address));
        if (ia < 0 || ib < 0) return null;
        const [decA, decB, weights] = await Promise.all([
          client.readContract({ address: tokens[ia]!, abi: erc20DecAbi, functionName: "decimals" }).catch(() => tokenA.decimals),
          client.readContract({ address: tokens[ib]!, abi: erc20DecAbi, functionName: "decimals" }).catch(() => tokenB.decimals),
          client.readContract({ address: ref.pool as Address, abi: weightsAbi, functionName: "getNormalizedWeights" }).catch(() => null),
        ]);
        const reserveA = Number(formatUnits(balances[ia] ?? 0n, Number(decA)));
        const reserveB = Number(formatUnits(balances[ib] ?? 0n, Number(decB)));
        if (!reserveA || !reserveB) return null;
        let priceAinB = reserveB / reserveA;
        if (weights && weights.length > Math.max(ia, ib)) {
          const wA = Number(formatUnits(weights[ia]!, 18));
          const wB = Number(formatUnits(weights[ib]!, 18));
          if (wA > 0 && wB > 0) priceAinB = (reserveB / wB) / (reserveA / wA);
        }
        if (!Number.isFinite(priceAinB) || priceAinB <= 0) return null;
        return {
          protocolId: id,
          protocolName: name,
          chainId,
          pool: ref.pool,
          feeLabel: ref.feeLabel,
          priceAinB,
          reserveA,
          reserveB,
          tvlQuote: reserveB + reserveA * priceAinB,
          kind: "balancer",
        } satisfies VenueQuote;
      } catch {
        return null;
      }
    },
  };
}

export const BALANCER_CHAINS = [1, 10, 137, 8453, 42161, 100];
