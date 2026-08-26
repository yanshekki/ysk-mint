import { formatUnits, type Address, type PublicClient } from "viem";
import { DEX, SOL_NATIVE_MINT, V3_FEES, type Addr } from "./defiAddresses.ts";

const ZERO = "0x0000000000000000000000000000000000000000";
const Q192 = 2n ** 192n;

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

export type Quote = { usdc: number; source: "v3" | "v2" | "jup" | "stable" };

function priceFromSqrt(sqrtPriceX96: bigint, token0IsBase: boolean, baseDecimals: number, quoteDecimals: number) {
  if (sqrtPriceX96 === 0n) return null;
  const raw = sqrtPriceX96 * sqrtPriceX96;
  const scale = 10n ** BigInt(18 + quoteDecimals - baseDecimals);
  const num = token0IsBase ? raw * scale : Q192 * scale;
  const den = token0IsBase ? Q192 : raw;
  if (den === 0n) return null;
  const n = Number(num) / Number(den) / 1e18;
  return Number.isFinite(n) && n > 0 ? n : null;
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
    const price = priceFromSqrt(sqrt, token0IsBase, tokenDecimals, otherDecimals);
    if (price == null) continue;
    if (!best || liq > best.liq) best = { liq, price };
  }
  return best?.price ?? null;
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
  return Number.isFinite(n) && n > 0 ? n : null;
}

const wethUsdcCache = new Map<number, Promise<number | null>>();

async function wrappedUsdc(client: PublicClient, chainId: number) {
  const hit = wethUsdcCache.get(chainId);
  if (hit) return hit;
  const job = (async () => {
    const d = DEX[chainId];
    if (!d) return null;
    if (d.v3Factory) {
      const v3 = await v3Spot(client, d.v3Factory, d.wrapped, d.usdc, d.usdcDecimals, 18).catch(() => null);
      if (v3) return v3;
    }
    if (d.v2Factory) {
      return v2Spot(client, d.v2Factory, d.wrapped, d.usdc, d.usdcDecimals, 18).catch(() => null);
    }
    return null;
  })();
  wethUsdcCache.set(chainId, job);
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
  if (addr === d.usdc.toLowerCase()) return { usdc: 1, source: "stable" };

  if (d.v3Factory) {
    const direct = await v3Spot(client, d.v3Factory, addr, d.usdc, d.usdcDecimals, decimals).catch(() => null);
    if (direct) return { usdc: direct, source: "v3" };
    if (addr !== d.wrapped.toLowerCase()) {
      const vsWeth = await v3Spot(client, d.v3Factory, addr, d.wrapped, 18, decimals).catch(() => null);
      const weth = await wrappedUsdc(client, chainId);
      if (vsWeth && weth) return { usdc: vsWeth * weth, source: "v3" };
    }
  }
  if (d.v2Factory) {
    const direct = await v2Spot(client, d.v2Factory, addr, d.usdc, d.usdcDecimals, decimals).catch(() => null);
    if (direct) return { usdc: direct, source: "v2" };
    if (addr !== d.wrapped.toLowerCase()) {
      const vsWeth = await v2Spot(client, d.v2Factory, addr, d.wrapped, 18, decimals).catch(() => null);
      const weth = await wrappedUsdc(client, chainId);
      if (vsWeth && weth) return { usdc: vsWeth * weth, source: "v2" };
    }
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
