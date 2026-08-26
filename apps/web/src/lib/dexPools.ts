import { formatUnits, type PublicClient } from "viem";
import { venuesOn, type Venue } from "./dexVenues.ts";
import { canonAddr, pairId, type Addr } from "./pairKey.ts";

const ZERO = "0x0000000000000000000000000000000000000000";
const Q192 = 2n ** 192n;

export const v2FactoryAbi = [
  {
    type: "function",
    name: "getPair",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
    ],
    outputs: [{ type: "address" }],
  },
] as const;

export const aeroFactoryAbi = [
  {
    type: "function",
    name: "getPool",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "stable", type: "bool" },
    ],
    outputs: [{ type: "address" }],
  },
] as const;

export const v3FactoryAbi = [
  {
    type: "function",
    name: "getPool",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "fee", type: "uint24" },
    ],
    outputs: [{ type: "address" }],
  },
] as const;

export const v2PairAbi = [
  {
    type: "function",
    name: "getReserves",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint112" }, { type: "uint112" }, { type: "uint32" }],
  },
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

export const v3PoolAbi = [
  {
    type: "function",
    name: "slot0",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint160" }, { type: "int24" }, { type: "uint16" }, { type: "uint16" }, { type: "uint16" }, { type: "uint8" }, { type: "bool" }],
  },
  { type: "function", name: "liquidity", stateMutability: "view", inputs: [], outputs: [{ type: "uint128" }] },
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

export const erc20BalAbi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

export type VenuePool = {
  venue: Venue;
  pool: Addr;
  feeLabel: string;
  priceAinB: number;
  tvlQuote: number;
  reserveA: number;
  reserveB: number;
};

function v3Price(sqrt: bigint, token0IsA: boolean, decA: number, decB: number) {
  if (sqrt === 0n) return null;
  const raw = sqrt * sqrt;
  const scale = 10n ** BigInt(18 + decB - decA);
  const num = token0IsA ? raw * scale : Q192 * scale;
  const den = token0IsA ? Q192 : raw;
  if (den === 0n) return null;
  const n = Number(num) / Number(den) / 1e18;
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function readV2(
  client: PublicClient,
  venue: Venue,
  tokenA: Addr,
  decA: number,
  decB: number,
  pool: Addr,
  feeLabel: string,
): Promise<VenuePool | null> {
  try {
    const [reserves, token0] = await Promise.all([
      client.readContract({ address: pool, abi: v2PairAbi, functionName: "getReserves" }),
      client.readContract({ address: pool, abi: v2PairAbi, functionName: "token0" }),
    ]);
    const t0 = canonAddr(token0);
    const aIs0 = t0 === tokenA;
    const r0 = Number(formatUnits(reserves[0], aIs0 ? decA : decB));
    const r1 = Number(formatUnits(reserves[1], aIs0 ? decB : decA));
    const reserveA = aIs0 ? r0 : r1;
    const reserveB = aIs0 ? r1 : r0;
    if (!reserveA || !reserveB) return null;
    const priceAinB = reserveB / reserveA;
    return { venue, pool, feeLabel, priceAinB, tvlQuote: reserveB * 2, reserveA, reserveB };
  } catch {
    return null;
  }
}

async function resolveV2Pool(client: PublicClient, venue: Venue, a: Addr, b: Addr) {
  const pair = await client.readContract({
    address: venue.factory,
    abi: v2FactoryAbi,
    functionName: "getPair",
    args: [a, b],
  });
  return pair && pair !== ZERO ? (pair as Addr) : undefined;
}

async function resolveAeroPools(client: PublicClient, venue: Venue, a: Addr, b: Addr) {
  const [vol, st] = await Promise.all([
    client.readContract({ address: venue.factory, abi: aeroFactoryAbi, functionName: "getPool", args: [a, b, false] }),
    client.readContract({ address: venue.factory, abi: aeroFactoryAbi, functionName: "getPool", args: [a, b, true] }),
  ]);
  const out: Array<{ pool: Addr; label: string }> = [];
  if (vol && vol !== ZERO) out.push({ pool: vol as Addr, label: "0.30%" });
  if (st && st !== ZERO) out.push({ pool: st as Addr, label: "0.05%" });
  return out;
}

async function resolveV3Pools(client: PublicClient, venue: Venue, a: Addr, b: Addr) {
  const fees = venue.fees ?? [500, 3000];
  const res = await client.multicall({
    contracts: fees.map((fee) => ({
      address: venue.factory,
      abi: v3FactoryAbi,
      functionName: "getPool" as const,
      args: [a, b, fee],
    })),
    allowFailure: true,
  });
  return res.flatMap((r, i) => {
    if (r.status !== "success") return [];
    const pool = r.result as Addr;
    if (!pool || pool === ZERO) return [];
    return [{ pool, fee: fees[i] }];
  });
}

async function readV3(
  client: PublicClient,
  venue: Venue,
  tokenA: Addr,
  decA: number,
  decB: number,
  pool: Addr,
  fee: number,
): Promise<VenuePool | null> {
  try {
    const [slot, liq, token0] = await Promise.all([
      client.readContract({ address: pool, abi: v3PoolAbi, functionName: "slot0" }),
      client.readContract({ address: pool, abi: v3PoolAbi, functionName: "liquidity" }),
      client.readContract({ address: pool, abi: v3PoolAbi, functionName: "token0" }),
    ]);
    if (liq === 0n) return null;
    const aIs0 = canonAddr(token0) === tokenA;
    const price = v3Price(slot[0], aIs0, decA, decB);
    if (!price) return null;
    const depth = Number(liq) / 1e9;
    return {
      venue,
      pool,
      feeLabel: `${fee / 10000}%`,
      priceAinB: price,
      tvlQuote: depth,
      reserveA: 0,
      reserveB: 0,
    };
  } catch {
    return null;
  }
}

export async function readVenuesForPair(
  client: PublicClient,
  chainId: number,
  tokenA: Addr,
  tokenB: Addr,
  decA: number,
  decB: number,
): Promise<VenuePool[]> {
  const a = canonAddr(tokenA);
  const b = canonAddr(tokenB);
  const found: VenuePool[] = [];
  for (const venue of venuesOn(chainId)) {
    try {
      if (venue.kind === "v2") {
        const pool = await resolveV2Pool(client, venue, a, b);
        if (!pool) continue;
        const row = await readV2(client, venue, a, decA, decB, pool, "0.30%");
        if (row) found.push(row);
      } else if (venue.kind === "aero") {
        const pools = await resolveAeroPools(client, venue, a, b);
        for (const p of pools) {
          const row = await readV2(client, venue, a, decA, decB, p.pool, p.label);
          if (row) found.push(row);
        }
      } else {
        const pools = await resolveV3Pools(client, venue, a, b);
        for (const p of pools) {
          const row = await readV3(client, venue, a, decA, decB, p.pool, p.fee);
          if (row) found.push(row);
        }
      }
    } catch {
      /* venue miss */
    }
  }
  return found;
}

export function weightedPrice(venues: VenuePool[]) {
  let num = 0;
  let den = 0;
  for (const v of venues) {
    const w = Math.max(v.tvlQuote, 0);
    if (!w || !v.priceAinB) continue;
    num += v.priceAinB * w;
    den += w;
  }
  if (!den) return venues[0]?.priceAinB ?? null;
  return num / den;
}

export function pairIdentity(chainId: number, a: Addr, b: Addr) {
  return pairId(chainId, a, b);
}
