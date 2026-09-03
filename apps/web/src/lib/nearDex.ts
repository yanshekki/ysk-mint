import { cacheGet, cacheKey, POLICIES } from "./defi/cache.ts";
import { nearView } from "./nearRpc.ts";
import type { Quote } from "./defiQuotes.ts";
import type { VenuePool } from "./dexPools.ts";
import type { Venue } from "./dexVenues.ts";
import { pairId } from "./pairKey.ts";
import { outboundFetch } from "./outbound.ts";

export type NativeMarket = {
  pairId: string;
  chainId: number;
  chainShort: string;
  symbolA: string;
  symbolB: string;
  iconA: string;
  iconB: string;
  tokenA: string;
  tokenB: string;
  venues: VenuePool[];
  price: number | null;
  depth: number;
  venueNames: string[];
};

export const REF_EXCHANGE = "v2.ref-finance.near";
export const BURROW = "contract.main.burrow.near";
export const LINEAR = "linear-protocol.near";
export const META_POOL = "meta-pool.near";

export type NearTok = { address: string; symbol: string; decimals: number; icon: string };

const I = (s: string) => `/tokens/${s}.png`;

export const N_WRAP: NearTok = { address: "wrap.near", symbol: "NEAR", decimals: 24, icon: I("near") };
export const N_USDT: NearTok = { address: "usdt.tether-token.near", symbol: "USDT", decimals: 6, icon: I("usdt") };
export const N_USDC: NearTok = {
  address: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
  symbol: "USDC",
  decimals: 6,
  icon: I("usdc"),
};
export const N_REF: NearTok = { address: "token.v2.ref-finance.near", symbol: "REF", decimals: 18, icon: I("near") };
export const N_STNEAR: NearTok = { address: "meta-pool.near", symbol: "stNEAR", decimals: 24, icon: I("near") };
export const N_LINEAR: NearTok = { address: "linear-protocol.near", symbol: "LINEAR", decimals: 24, icon: I("near") };
export const N_USDCE: NearTok = {
  address: "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near",
  symbol: "USDC.e",
  decimals: 6,
  icon: I("usdc"),
};
export const N_USDTE: NearTok = {
  address: "dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near",
  symbol: "USDT.e",
  decimals: 6,
  icon: I("usdt"),
};
export const N_DAIE: NearTok = {
  address: "6b175474e89094c44da98b954eedeac495271d0f.factory.bridge.near",
  symbol: "DAI.e",
  decimals: 18,
  icon: I("dai"),
};

const STABLES = new Set([N_USDT.address, N_USDC.address, N_USDCE.address, N_USDTE.address, N_DAIE.address]);

export const NEAR_LST = new Set([N_STNEAR.address, N_LINEAR.address]);

export type NearPoolSeed = { poolId: number; a: NearTok; b: NearTok };

export const NEAR_POOLS: NearPoolSeed[] = [
  { poolId: 4512, a: N_WRAP, b: N_USDC },
  { poolId: 6063, a: N_WRAP, b: N_USDT },
  { poolId: 79, a: N_REF, b: N_WRAP },
];

/** Rhea Sauce / Degen pools. Do not mix into classic AMM quotes (e.g. stopped 5515). */
export function isRefSauce(kind?: string) {
  return (kind || "").toUpperCase() === "DEGEN_SWAP";
}

export type RefTopPool = {
  id: string | number;
  token_account_ids?: string[];
  amounts?: string[];
  token_symbols?: string[];
  total_fee?: number;
  tvl?: string | number;
  pool_kind?: string;
};

export async function fetchRefTopPools(): Promise<RefTopPool[]> {
  const rows = await cacheGet(
    {
      key: cacheKey("http.ref", 397, "list-top-pools"),
      policy: { ...POLICIES.catalog, keep: (v: RefTopPool[] | null) => Boolean(v?.length) },
    },
    async () => {
      const res = await outboundFetch("https://api.ref.finance/list-top-pools");
      if (!res.ok) return null;
      const data = (await res.json()) as RefTopPool[];
      return Array.isArray(data) && data.length ? data : null;
    },
  );
  return rows ?? [];
}

type RefPool = {
  pool_kind?: string;
  token_account_ids: string[];
  amounts: string[];
  total_fee?: number;
  shares_total_supply: string;
};

export const REF_VENUE: Venue = {
  id: "rhea-ref-397",
  name: "Rhea",
  chainId: 397,
  kind: "v2",
  factory: "0x0000000000000000000000000000000000000000",
};

function human(raw: string, decimals: number) {
  const n = Number(raw) / 10 ** decimals;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function nearToken(id: string): NearTok | undefined {
  const all = [N_WRAP, N_USDT, N_USDC, N_USDCE, N_USDTE, N_DAIE, N_REF, N_STNEAR, N_LINEAR];
  return all.find((t) => t.address.toLowerCase() === id.toLowerCase());
}

export function nearDecimals(id: string) {
  const hit = nearToken(id);
  if (hit) return hit.decimals;
  const x = id.toLowerCase();
  if (x === "wrap.near" || x === LINEAR || x === META_POOL) return 24;
  if (x === N_USDT.address || x === N_USDC.address || x === N_USDCE.address || x === N_USDTE.address) return 6;
  if (x.startsWith("dac17f958d2ee523a2206206994597c13d831ec7") || x.startsWith("a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")) return 6;
  return 18;
}

function tokenMeta(id: string): NearTok {
  const hit = nearToken(id);
  if (hit) return hit;
  const parts = id.split(".");
  const raw = parts[0] || id.slice(0, 6);
  const symbol = raw.length <= 8 && !/^[0-9a-f]{8,}$/i.test(raw) ? raw.toUpperCase() : raw.slice(0, 8);
  return { address: id, symbol, decimals: nearDecimals(id), icon: I("near") };
}

export function isNearStable(id?: string) {
  return Boolean(id && STABLES.has(id.toLowerCase()));
}

export function isNearPricedLeg(id?: string) {
  const x = (id || "").toLowerCase();
  return x === N_WRAP.address || NEAR_LST.has(x);
}

/** USD depth from stables and wrap/LST only. Unknown memes (ELON/INEAR) stay 0 — never trust indexer TVL. */
export function nearUsdFromLegs(
  a: { address: string; amount: number },
  b: { address: string; amount: number },
  wrapUsd: number | null,
): number {
  const priced: number[] = [];
  for (const x of [a, b]) {
    const id = x.address.toLowerCase();
    const amt = Number.isFinite(x.amount) && x.amount > 0 ? x.amount : 0;
    if (!amt) continue;
    if (isNearStable(id)) priced.push(amt);
    else if (isNearPricedLeg(id) && wrapUsd && wrapUsd > 0) priced.push(amt * wrapUsd);
  }
  if (!priced.length) return 0;
  const sum = priced.reduce((n, v) => n + v, 0);
  return priced.length === 2 ? sum : sum * 2;
}

export function wrapUsdFromRefPools(pools: RefTopPool[]): number | null {
  let bestUsd = 0;
  let px = 0;
  for (const p of pools) {
    const ids = (p.token_account_ids ?? []).map((x) => x.toLowerCase());
    const amts = p.amounts ?? [];
    if (ids.length !== 2) continue;
    const wi = ids.indexOf(N_WRAP.address);
    const si = ids.findIndex((id) => isNearStable(id));
    if (wi < 0 || si < 0) continue;
    const wrap = human(amts[wi], 24);
    const usd = human(amts[si], nearDecimals(ids[si]));
    if (!(wrap > 0) || !(usd > 0) || usd <= bestUsd) continue;
    bestUsd = usd;
    px = usd / wrap;
  }
  return px > 0 ? px : null;
}

export async function nearFtMeta(id: string): Promise<NearTok> {
  const known = nearToken(id);
  if (known) return { ...known, address: id };
  const fallback = tokenMeta(id);
  try {
    return await cacheGet(
      {
        key: cacheKey("meta.near2", 397, id.toLowerCase()),
        policy: { ...POLICIES.meta, keep: (m: NearTok) => Boolean(m.symbol) && m.decimals >= 0 },
      },
      async () => {
        const meta = await nearView<{ symbol?: string; decimals?: number }>(id, "ft_metadata", {});
        const decimals = Number(meta?.decimals);
        const symbol = String(meta?.symbol || "").trim();
        if (!Number.isFinite(decimals) || decimals < 0 || decimals > 24) throw new Error("decimals");
        return {
          address: id,
          symbol: symbol && !/^[0-9a-f]{12,}$/i.test(symbol) ? symbol : fallback.symbol,
          decimals,
          icon: fallback.icon,
        };
      },
    );
  } catch {
    return fallback;
  }
}

export async function readRefPool(poolId: number): Promise<RefPool | null> {
  try {
    const p = await nearView<RefPool>(REF_EXCHANGE, "get_pool", { pool_id: poolId });
    if (!p?.token_account_ids?.length || !p.amounts?.length) return null;
    if (p.shares_total_supply === "0") return null;
    return p;
  } catch {
    return null;
  }
}

function venueFromPool(seed: NearPoolSeed, pool: RefPool, wrapUsd?: number | null): VenuePool | null {
  const ids = pool.token_account_ids.map((x) => x.toLowerCase());
  const iA = ids.indexOf(seed.a.address.toLowerCase());
  const iB = ids.indexOf(seed.b.address.toLowerCase());
  if (iA < 0 || iB < 0) return null;
  const reserveA = human(pool.amounts[iA], seed.a.decimals);
  const reserveB = human(pool.amounts[iB], seed.b.decimals);
  if (!reserveA || !reserveB) return null;
  const priceAinB = reserveB / reserveA;
  // USD only from stables / wrap.NEAR legs — never indexer TVL or meme reserves.
  const tvlQuote = nearUsdFromLegs(
    { address: seed.a.address, amount: reserveA },
    { address: seed.b.address, amount: reserveB },
    wrapUsd ?? null,
  );
  return {
    venue: REF_VENUE,
    pool: `${isRefSauce(pool.pool_kind) ? "sauce" : "ref"}:${seed.poolId}`,
    feeLabel: pool.total_fee != null ? `${(pool.total_fee / 100).toFixed(2)}%` : "0.30%",
    priceAinB,
    tvlQuote,
    reserveA,
    reserveB,
  };
}

export async function nearVenuesForPair(tokenA: string, tokenB: string): Promise<VenuePool[]> {
  const a = tokenA.toLowerCase();
  const b = tokenB.toLowerCase();
  const classic = new Set<number>();
  const sauce = new Set<number>();
  try {
    const top = await fetchRefTopPools();
    for (const p of top) {
      const n = Number(p.id);
      const tids = (p.token_account_ids ?? []).map((x) => x.toLowerCase());
      if (tids.length !== 2) continue;
      if (!(tids.includes(a) && tids.includes(b))) continue;
      if (!Number.isFinite(n)) continue;
      if (isRefSauce(p.pool_kind)) sauce.add(n);
      else classic.add(n);
    }
  } catch {
    /* indexer optional */
  }
  const ids = classic.size ? classic : sauce;
  if (!ids.size) {
    for (const p of NEAR_POOLS) {
      const x = p.a.address.toLowerCase();
      const y = p.b.address.toLowerCase();
      if ((x === a && y === b) || (x === b && y === a)) ids.add(p.poolId);
    }
  }
  const [wantA, wantB, wrapUsd] = await Promise.all([nearFtMeta(a), nearFtMeta(b), nearWrapUsd()]);
  const fetched: { poolId: number; pool: RefPool }[] = [];
  await Promise.all(
    [...ids].map(async (poolId) => {
      const pool = await readRefPool(poolId);
      if (pool) fetched.push({ poolId, pool });
    }),
  );
  const live = fetched.filter((x) => !isRefSauce(x.pool.pool_kind));
  const use = live.length ? live : fetched;
  const out: VenuePool[] = [];
  for (const { poolId, pool } of use) {
    const row = venueFromPool({ poolId, a: wantA, b: wantB }, pool, wrapUsd);
    if (row) out.push(row);
  }
  return out;
}

export async function loadNearMarkets(): Promise<NativeMarket[]> {
  const rows: NativeMarket[] = [];
  await Promise.all(
    NEAR_POOLS.map(async (s) => {
      const pool = await readRefPool(s.poolId);
      if (!pool) return;
      const v = venueFromPool(s, pool);
      if (!v) return;
      rows.push({
        pairId: pairId(397, s.a.address, s.b.address),
        chainId: 397,
        chainShort: "NEAR",
        symbolA: s.a.symbol,
        symbolB: s.b.symbol,
        iconA: s.a.icon,
        iconB: s.b.icon,
        tokenA: s.a.address,
        tokenB: s.b.address,
        venues: [v],
        price: v.priceAinB,
        depth: v.tvlQuote,
        venueNames: [REF_VENUE.name],
      });
    }),
  );
  return rows;
}

let wrapUsdJob: Promise<number | null> | null = null;

export function resetNearWrapUsd() {
  wrapUsdJob = null;
}

export async function nearWrapUsd(): Promise<number | null> {
  if (!wrapUsdJob) {
    wrapUsdJob = (async () => {
      for (const id of [4512, 6063]) {
        const seed = NEAR_POOLS.find((p) => p.poolId === id);
        if (!seed) continue;
        const pool = await readRefPool(id);
        if (!pool) continue;
        const v = venueFromPool(seed, pool);
        if (v && isNearStable(seed.b.address)) return v.priceAinB;
      }
      return null;
    })();
  }
  return wrapUsdJob;
}

export async function quoteNearToken(token?: string, native?: boolean): Promise<Quote | null> {
  const id = (native ? N_WRAP.address : token)?.toLowerCase();
  if (!id) return null;
  if (isNearStable(id)) return { usdc: 1, source: "stable" };
  if (id === N_WRAP.address) {
    const n = await nearWrapUsd();
    return n ? { usdc: n, source: "ref" } : null;
  }
  const wrap = await nearWrapUsd();
  const seed = NEAR_POOLS.find((p) => p.a.address.toLowerCase() === id || p.b.address.toLowerCase() === id);
  if (seed) {
    const pool = await readRefPool(seed.poolId);
    if (pool) {
      const asA = seed.a.address.toLowerCase() === id;
      const v = venueFromPool(asA ? seed : { ...seed, a: seed.b, b: seed.a }, pool);
      if (v) {
        if (isNearStable(asA ? seed.b.address : seed.a.address)) return { usdc: v.priceAinB, source: "ref" };
        if ((asA ? seed.b.address : seed.a.address).toLowerCase() === N_WRAP.address && wrap) {
          return { usdc: v.priceAinB * wrap, source: "ref" };
        }
      }
    }
  }
  if ((id === N_LINEAR.address || id === N_STNEAR.address) && wrap) {
    const rate = id === N_LINEAR.address ? await linearPerNear() : await stNearPerNear();
    if (rate) return { usdc: rate * wrap, source: "ref" };
  }
  return wrap && id === N_WRAP.address ? { usdc: wrap, source: "ref" } : null;
}

async function linearPerNear() {
  for (const method of ["ft_price", "get_virtual_price", "get_price"]) {
    try {
      const raw = await nearView<string | number>(LINEAR, method, {});
      const n = Number(raw) / 1e24;
      if (Number.isFinite(n) && n > 0) return n;
    } catch {
      /* next */
    }
  }
  return null;
}

async function stNearPerNear() {
  for (const method of ["get_st_near_price", "get_near_price", "ft_price"]) {
    try {
      const raw = await nearView<string | number>(META_POOL, method, {});
      const n = Number(raw) / 1e24;
      if (Number.isFinite(n) && n > 0) return n;
    } catch {
      /* next */
    }
  }
  return null;
}

export async function nearPoolShares(poolId: number, account: string): Promise<bigint> {
  try {
    const raw = await nearView<string>(REF_EXCHANGE, "get_pool_shares", { pool_id: poolId, account_id: account });
    return BigInt(raw || "0");
  } catch {
    return 0n;
  }
}

export type NearLpHit = {
  pairId: string;
  chainId: 397;
  symbolA: string;
  symbolB: string;
  tokenA: string;
  tokenB: string;
  iconA: string;
  iconB: string;
  venueNames: string[];
  venueCount: number;
  valueHint: string;
};

export async function nearMyLp(account: string): Promise<NearLpHit[]> {
  const out: NearLpHit[] = [];
  await Promise.all(
    [...NEAR_POOLS, { poolId: 5515, a: N_WRAP, b: N_USDC }].map(async (s) => {
      const shares = await nearPoolShares(s.poolId, account);
      if (shares === 0n) return;
      const pool = await readRefPool(s.poolId);
      if (!pool) return;
      const v = venueFromPool(s, pool);
      const supply = BigInt(pool.shares_total_supply || "0");
      let value = "—";
      if (v && supply > 0n) {
        const frac = Number(shares) / Number(supply);
        if (Number.isFinite(frac) && frac > 0) {
          const usd = v.tvlQuote ? (v.tvlQuote * frac) / 2 : 0;
          if (usd > 0) value = String(usd);
        }
      }
      out.push({
        pairId: pairId(397, s.a.address, s.b.address),
        chainId: 397,
        symbolA: s.a.symbol,
        symbolB: s.b.symbol,
        tokenA: s.a.address,
        tokenB: s.b.address,
        iconA: s.a.icon,
        iconB: s.b.icon,
        venueNames: [REF_VENUE.name],
        venueCount: 1,
        valueHint: value,
      });
    }),
  );
  return out;
}

type BurrowAsset = { token_id?: string; balance?: string; shares?: string };

export async function readBurrow(account: string) {
  try {
    const row = await nearView<{
      supplied?: BurrowAsset[];
      collateral?: BurrowAsset[];
      borrowed?: BurrowAsset[];
    } | null>(BURROW, "get_account", { account_id: account });
    if (!row) return null;
    const wrap = await nearWrapUsd();
    const lines: Array<{
      id: string;
      chainId: number;
      chain: string;
      symbol: string;
      name: string;
      icon: string;
      amount: string;
      raw: bigint;
      contract?: string;
      side: "supply" | "borrow";
      quote: Quote | null;
      valueUsdc: number | null;
    }> = [];
    const add = async (list: BurrowAsset[] | undefined, side: "supply" | "borrow") => {
      for (const a of list ?? []) {
        const id = a.token_id;
        if (!id) continue;
        const raw = BigInt(a.balance || "0");
        if (raw === 0n) continue;
        const meta = tokenMeta(id);
        const n = human(raw.toString(), meta.decimals);
        const q = await quoteNearToken(id, false);
        lines.push({
          id: `burrow-${side}-${id}`,
          chainId: 397,
          chain: "NEAR",
          symbol: meta.symbol,
          name: meta.symbol,
          icon: meta.icon,
          amount: n.toLocaleString(undefined, { maximumFractionDigits: n >= 1 ? 4 : 6 }),
          raw,
          contract: id,
          side,
          quote: q,
          valueUsdc: q ? n * q.usdc : wrap && id === N_WRAP.address ? n * wrap : null,
        });
      }
    };
    await add([...(row.supplied ?? []), ...(row.collateral ?? [])], "supply");
    await add(row.borrowed, "borrow");
    if (!lines.length) return null;
    return { chainId: 397, chain: "NEAR", health: "—", lines, aTokens: new Set<string>() };
  } catch {
    return null;
  }
}
