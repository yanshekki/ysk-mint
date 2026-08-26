import { formatUnits, type Address, type PublicClient } from "viem";
import { DEX, SOL_NATIVE_MINT, V3_FEES, isUsdStableAddress, usdStables, type Addr } from "./defiAddresses.ts";

const ZERO = "0x0000000000000000000000000000000000000000";
/** 2^96 is exact in IEEE-754. */
const Q96 = 2 ** 96;

const v3FactoryAbi = [
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

const v3PoolAbi = [
  { type: "function", name: "slot0", stateMutability: "view", inputs: [], outputs: [{ type: "uint160" }, { type: "int24" }, { type: "uint16" }, { type: "uint16" }, { type: "uint16" }, { type: "uint8" }, { type: "bool" }] },
  { type: "function", name: "liquidity", stateMutability: "view", inputs: [], outputs: [{ type: "uint128" }] },
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

const v2FactoryAbi = [
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

const v2PairAbi = [
  {
    type: "function",
    name: "getReserves",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint112" }, { type: "uint112" }, { type: "uint32" }],
  },
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

export type Quote = { usdc: number; source: "v3" | "v2" | "jup" | "stable" | "ref" | "minswap" };

type Spot = { price: number; depth: number };

/** Human quote-per-base from Uniswap V3 sqrtPriceX96. Uses float √P/2^96, not bigint √P². */
export function priceFromSqrtPriceX96(
  sqrtPriceX96: bigint,
  token0IsBase: boolean,
  baseDecimals: number,
  quoteDecimals: number,
) {
  if (sqrtPriceX96 === 0n) return null;
  const ratio = Number(sqrtPriceX96) / Q96;
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  const dec0 = token0IsBase ? baseDecimals : quoteDecimals;
  const dec1 = token0IsBase ? quoteDecimals : baseDecimals;
  const t1PerT0 = ratio * ratio * 10 ** (dec0 - dec1);
  if (!Number.isFinite(t1PerT0) || t1PerT0 <= 0) return null;
  const price = token0IsBase ? t1PerT0 : 1 / t1PerT0;
  return Number.isFinite(price) && price > 0 ? price : null;
}

async function v3Spot(client: PublicClient, factory: Addr, token: Addr, other: Addr, otherDecimals: number, tokenDecimals: number) {
  const pools = await client.multicall({
    contracts: V3_FEES.map((fee) => ({
      address: factory,
      abi: v3FactoryAbi,
      functionName: "getPool" as const,
      args: [token, other, fee],
    })),
    allowFailure: true,
  });
  const addrs = pools
    .map((r) => (r.status === "success" ? (r.result as Addr) : ZERO))
    .filter((a) => a && a !== ZERO);
  if (!addrs.length) return null;
  const slots = await client.multicall({
    contracts: addrs.flatMap((pool) => [
      { address: pool, abi: v3PoolAbi, functionName: "slot0" as const },
      { address: pool, abi: v3PoolAbi, functionName: "liquidity" as const },
      { address: pool, abi: v3PoolAbi, functionName: "token0" as const },
    ]),
    allowFailure: true,
  });
  let best: { liq: bigint; price: number } | null = null;
  for (let i = 0; i < addrs.length; i++) {
    const s = slots[i * 3];
    const l = slots[i * 3 + 1];
    const t = slots[i * 3 + 2];
    if (s.status !== "success" || l.status !== "success" || t.status !== "success") continue;
    const sqrt = (s.result as readonly [bigint, ...unknown[]])[0];
    const liq = l.result as bigint;
    if (liq === 0n) continue;
    const token0 = (t.result as string).toLowerCase();
    const token0IsBase = token0 === token.toLowerCase();
    const price = priceFromSqrtPriceX96(sqrt, token0IsBase, tokenDecimals, otherDecimals);
    if (price == null) continue;
    if (!best || liq > best.liq) best = { liq, price };
  }
  if (!best) return null;
  return { price: best.price, depth: Number(best.liq) };
}

async function v2Spot(client: PublicClient, factory: Addr, token: Addr, other: Addr, otherDecimals: number, tokenDecimals: number) {
  const pair = await client.readContract({
    address: factory,
    abi: v2FactoryAbi,
    functionName: "getPair",
    args: [token, other],
  });
  if (!pair || pair === ZERO) return null;
  const [reserves, token0] = await Promise.all([
    client.readContract({ address: pair, abi: v2PairAbi, functionName: "getReserves" }),
    client.readContract({ address: pair, abi: v2PairAbi, functionName: "token0" }),
  ]);
  const r0 = reserves[0];
  const r1 = reserves[1];
  if (r0 === 0n || r1 === 0n) return null;
  const tokenIs0 = token0.toLowerCase() === token.toLowerCase();
  const reserveToken = tokenIs0 ? r0 : r1;
  const reserveOther = tokenIs0 ? r1 : r0;
  const a = Number(formatUnits(reserveOther, otherDecimals));
  const b = Number(formatUnits(reserveToken, tokenDecimals));
  if (!b) return null;
  const n = a / b;
  if (!Number.isFinite(n) || n <= 0) return null;
  return { price: n, depth: a };
}

function pickSpot(spots: Array<Spot | null>): Spot | null {
  let best: Spot | null = null;
  for (const s of spots) {
    if (!s) continue;
    if (!best || s.depth > best.depth) best = s;
  }
  return best;
}

async function spotVsStables(
  client: PublicClient,
  chainId: number,
  token: Addr,
  decimals: number,
  kind: "v3" | "v2",
): Promise<Spot | null> {
  const d = DEX[chainId];
  if (!d) return null;
  const factory = kind === "v3" ? d.v3Factory : d.v2Factory;
  if (!factory) return null;
  const stables = usdStables(d).filter((s) => s.address.toLowerCase() !== token);
  const spots = await Promise.all(
    stables.map((s) =>
      kind === "v3"
        ? v3Spot(client, factory, token, s.address, s.decimals, decimals).catch(() => null)
        : v2Spot(client, factory, token, s.address, s.decimals, decimals).catch(() => null),
    ),
  );
  return pickSpot(spots);
}

const wrappedUsdCache = new Map<number, Promise<number | null>>();

async function wrappedUsd(client: PublicClient, chainId: number) {
  const hit = wrappedUsdCache.get(chainId);
  if (hit) return hit;
  const job = (async () => {
    const v3 = await spotVsStables(client, chainId, DEX[chainId]!.wrapped, 18, "v3");
    if (v3) return v3.price;
    const v2 = await spotVsStables(client, chainId, DEX[chainId]!.wrapped, 18, "v2");
    return v2?.price ?? null;
  })();
  wrappedUsdCache.set(chainId, job);
  return job;
}

export async function quoteEvmToken(
  client: PublicClient,
  chainId: number,
  token: Address | undefined,
  decimals: number,
  native?: boolean,
): Promise<Quote | null> {
  const d = DEX[chainId];
  if (!d) return null;
  const addr = (native ? d.wrapped : token)?.toLowerCase() as Addr | undefined;
  if (!addr) return null;
  if (isUsdStableAddress(d, addr)) return { usdc: 1, source: "stable" };

  const v3 = await spotVsStables(client, chainId, addr, decimals, "v3");
  if (v3) return { usdc: v3.price, source: "v3" };

  if (addr !== d.wrapped.toLowerCase() && d.v3Factory) {
    const vsWeth = await v3Spot(client, d.v3Factory, addr, d.wrapped, 18, decimals).catch(() => null);
    const weth = await wrappedUsd(client, chainId);
    if (vsWeth && weth) return { usdc: vsWeth.price * weth, source: "v3" };
  }

  const v2 = await spotVsStables(client, chainId, addr, decimals, "v2");
  if (v2) return { usdc: v2.price, source: "v2" };

  if (addr !== d.wrapped.toLowerCase() && d.v2Factory) {
    const vsWeth = await v2Spot(client, d.v2Factory, addr, d.wrapped, 18, decimals).catch(() => null);
    const weth = await wrappedUsd(client, chainId);
    if (vsWeth && weth) return { usdc: vsWeth.price * weth, source: "v2" };
  }
  return null;
}

export async function quoteEvmMany(
  client: PublicClient,
  items: Array<{ id: string; chainId: number; token?: string; decimals: number; native?: boolean }>,
) {
  const out = new Map<string, Quote>();
  const unique = new Map<string, (typeof items)[number]>();
  for (const it of items) {
    const key = `${it.chainId}:${(it.native ? "native" : it.token || "").toLowerCase()}`;
    if (!unique.has(key)) unique.set(key, it);
  }
  await Promise.all(
    [...unique.entries()].map(async ([key, it]) => {
      const q = await quoteEvmToken(client, it.chainId, it.token as Address | undefined, it.decimals, it.native).catch(() => null);
      if (q) out.set(key, q);
    }),
  );
  return out;
}

export async function quoteSolMints(mints: string[]) {
  const ids = [...new Set(mints.filter(Boolean))];
  if (!ids.length) return new Map<string, Quote>();
  const out = new Map<string, Quote>();
  try {
    const res = await fetch(`https://lite-api.jup.ag/price/v2?ids=${ids.join(",")}`);
    if (!res.ok) return out;
    const json = (await res.json()) as { data?: Record<string, { price?: string | number } | null> };
    for (const [mint, row] of Object.entries(json.data ?? {})) {
      const n = Number(row?.price);
      if (Number.isFinite(n) && n > 0) out.set(mint, { usdc: n, source: "jup" });
    }
  } catch {
    /* keep empty */
  }
  return out;
}

export function quoteKey(chainId: number, token?: string, native?: boolean) {
  return `${chainId}:${(native ? "native" : token || "").toLowerCase()}`;
}

export function solQuoteKey(mint?: string, native?: boolean) {
  return native ? SOL_NATIVE_MINT : mint || "";
}

export function fmtUsdc(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 0.01) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export function fmtCompact(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${sign}${abs >= 1e12 ? (abs / 1e12).toFixed(2) + "T" : (abs / 1e9).toFixed(2) + "B"}`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1000) return `${sign}${abs.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (abs >= 1) return `${sign}${abs.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
  if (abs === 0) return "0";
  return `${sign}${abs.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
}
