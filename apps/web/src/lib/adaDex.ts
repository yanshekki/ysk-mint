import { cacheGet, cacheHash, cacheKey, POLICIES } from "./defi/cache.ts";
import type { Quote } from "./defiQuotes.ts";
import type { VenuePool } from "./dexPools.ts";
import type { Venue } from "./dexVenues.ts";
import { pairId } from "./pairKey.ts";
import { outboundFetch } from "./outbound.ts";
import type { NativeMarket } from "./nearDex.ts";

const AGG = "https://agg-api.minswap.org/aggregator";
const MARKET = "https://api-mainnet-prod.minswap.org";

export type AdaTok = { address: string; symbol: string; decimals: number; icon: string };

const I = (s: string) => `/tokens/${s}.png`;

export const A_ADA: AdaTok = { address: "lovelace", symbol: "ADA", decimals: 6, icon: I("ada") };
export const A_USDM: AdaTok = {
  address: "c48cbb3d5e57ed56e276bc45f99ab39abe94e6cd7ac39fb402da47ad0014df105553444d",
  symbol: "USDM",
  decimals: 6,
  icon: I("usdc"),
};
export const A_USDA: AdaTok = {
  address: "fe7c786ab321f41c654ef6c1af7b3250a613c24e4213e0425a7ae45655534441",
  symbol: "USDA",
  decimals: 6,
  icon: I("usdc"),
};
export const A_IUSD: AdaTok = {
  address: "f66d78b4a3cb3d37afa0ec36461e51ecbde00f26c8f0a68f94b698806941555344",
  symbol: "iUSD",
  decimals: 6,
  icon: I("usdc"),
};
export const A_MIN: AdaTok = {
  address: "29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c64d494e",
  symbol: "MIN",
  decimals: 6,
  icon: I("ada"),
};
export const A_SNEK: AdaTok = {
  address: "279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b",
  symbol: "SNEK",
  decimals: 0,
  icon: I("ada"),
};

const STABLES = new Set([A_USDM.address, A_USDA.address, A_IUSD.address]);

export const ADA_SEEDS: Array<{ a: AdaTok; b: AdaTok }> = [
  { a: A_ADA, b: A_USDM },
  { a: A_ADA, b: A_USDA },
  { a: A_ADA, b: A_MIN },
  { a: A_ADA, b: A_SNEK },
  { a: A_USDM, b: A_USDA },
];

const PROTOCOLS = ["MinswapV2", "Minswap", "MinswapStable", "Splash", "WingRidersV2", "SundaeSwapV3"] as const;

type Estimate = {
  amount_in: string;
  amount_out: string;
  paths?: Array<Array<{ protocol?: string; pool_id?: string; lp_token?: string; amount_in?: string; amount_out?: string }>>;
};

async function aggGet<T>(path: string): Promise<T> {
  return cacheGet(
    {
      key: cacheKey("http.minswap", 1815, "get", path.replace(/[^a-z0-9]+/gi, "_").slice(0, 80)),
      policy: { ...POLICIES.catalog, keep: (v: T) => v != null },
    },
    async () => {
      const res = await outboundFetch(`${AGG}${path}`);
      if (!res.ok) throw new Error(`minswap ${path}`);
      return (await res.json()) as T;
    },
  );
}

async function aggPost<T>(path: string, body: unknown): Promise<T> {
  return cacheGet(
    {
      key: cacheKey("http.minswap", 1815, "post", path.replace(/[^a-z0-9]+/gi, "_").slice(0, 40), cacheHash(body)),
      policy: { ...POLICIES.quote, keep: (v: T) => v != null },
    },
    async () => {
      const res = await outboundFetch(`${AGG}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`minswap ${path}`);
      return (await res.json()) as T;
    },
  );
}

export function isAdaStable(id?: string) {
  if (!id) return false;
  const x = id.toLowerCase();
  return STABLES.has(x) || x === A_USDM.address || x === A_USDA.address || x === A_IUSD.address;
}

function venueNamed(protocol: string): Venue {
  const name =
    protocol.startsWith("Minswap") ? "Minswap" : protocol.startsWith("Wing") ? "WingRiders" : protocol.startsWith("Sundae") ? "SundaeSwap" : protocol.replace(/V\d+$/, "");
  return {
    id: `ada-${protocol}`,
    name,
    chainId: 1815,
    kind: "v2",
    factory: "0x0000000000000000000000000000000000000000",
  };
}

async function estimate(tokenIn: string, tokenOut: string, amount: string, protocol?: string): Promise<Estimate | null> {
  try {
    return await aggPost<Estimate>("/estimate", {
      amount,
      token_in: tokenIn,
      token_out: tokenOut,
      slippage: 1,
      allow_multi_hops: false,
      amount_in_decimal: false,
      ...(protocol ? { include_protocols: [protocol] } : {}),
    });
  } catch {
    return null;
  }
}

function priceFromEstimate(est: Estimate, decIn: number, decOut: number) {
  const ain = Number(est.amount_in) / 10 ** decIn;
  const aout = Number(est.amount_out) / 10 ** decOut;
  if (!ain || !aout) return null;
  const n = aout / ain;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function venuesFromEstimate(est: Estimate, price: number): VenuePool[] {
  const hops = (est.paths ?? []).flat();
  const seen = new Set<string>();
  const out: VenuePool[] = [];
  for (const h of hops) {
    const proto = h.protocol || "Minswap";
    const key = `${proto}:${h.pool_id || h.lp_token || proto}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      venue: venueNamed(proto),
      pool: h.pool_id || h.lp_token || proto,
      feeLabel: proto,
      priceAinB: price,
      tvlQuote: 0,
      reserveA: 0,
      reserveB: 0,
    });
  }
  if (!out.length) {
    out.push({
      venue: venueNamed("Minswap"),
      pool: "minswap-agg",
      feeLabel: "agg",
      priceAinB: price,
      tvlQuote: 0,
      reserveA: 0,
      reserveB: 0,
    });
  }
  return out;
}

export async function adaVenuesForPair(tokenA: string, tokenB: string, decA = 6, decB = 6): Promise<VenuePool[]> {
  const found: VenuePool[] = [];
  await Promise.all(
    PROTOCOLS.map(async (p) => {
      const est = await estimate(tokenA, tokenB, String(10 ** decA), p);
      if (!est) return;
      const price = priceFromEstimate(est, decA, decB);
      if (price == null) return;
      found.push(...venuesFromEstimate(est, price));
    }),
  );
  if (found.length) return found;
  const est = await estimate(tokenA, tokenB, String(10 ** decA));
  if (!est) return [];
  const price = priceFromEstimate(est, decA, decB);
  return price == null ? [] : venuesFromEstimate(est, price);
}

export async function loadAdaMarkets(): Promise<NativeMarket[]> {
  const listed = await loadAdaMarketsFromMetrics().catch(() => [] as NativeMarket[]);
  if (listed.length) return listed;
  return loadAdaMarketsFromEstimate();
}

type AdaAsset = {
  currency_symbol?: string;
  token_name?: string;
  metadata?: { ticker?: string; decimals?: number; name?: string };
};

type AdaPoolMetric = {
  lp_asset?: AdaAsset;
  type?: string;
  asset_a?: AdaAsset;
  asset_b?: AdaAsset;
  liquidity_a?: number;
  liquidity_b?: number;
  liquidity_currency?: number;
  trading_fee_tier?: number[];
};

function adaUnit(asset?: AdaAsset) {
  if (!asset) return "";
  const cs = (asset.currency_symbol || "").toLowerCase();
  const tn = (asset.token_name || "").toLowerCase();
  if (!cs && !tn) return "lovelace";
  return `${cs}${tn}`;
}

function adaSym(asset?: AdaAsset, fallback = "TKN") {
  const t = String(asset?.metadata?.ticker || asset?.metadata?.name || "").trim();
  return t || fallback;
}

function adaIconOf(symbol: string) {
  const s = symbol.toLowerCase();
  if (s.includes("usd") || s === "dai") return I("usdc");
  if (s.includes("btc")) return I("wbtc");
  return I("ada");
}

async function fetchAdaPoolMetrics(): Promise<AdaPoolMetric[]> {
  return cacheGet(
    {
      key: cacheKey("http.minswap", 1815, "pools.metrics3"),
      policy: { ...POLICIES.catalog, keep: (rows: AdaPoolMetric[]) => rows.length > 0 },
    },
    async () => {
      const out: AdaPoolMetric[] = [];
      let searchAfter: unknown[] | undefined;
      for (let page = 0; page < 4 && out.length < 120; page++) {
        const res = await outboundFetch(`${MARKET}/v1/pools/metrics`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sort_field: "liquidity",
            sort_direction: "desc",
            limit: 50,
            currency: "usd",
            protocols: ["Minswap", "MinswapV2", "MinswapStable"],
            ...(searchAfter ? { search_after: searchAfter } : {}),
          }),
        });
        if (!res.ok) break;
        const json = (await res.json()) as { pool_metrics?: AdaPoolMetric[]; search_after?: unknown[] };
        const list = json.pool_metrics ?? [];
        out.push(...list);
        searchAfter = json.search_after;
        if (!list.length || !searchAfter) break;
      }
      return out;
    },
  );
}

async function loadAdaMarketsFromMetrics(): Promise<NativeMarket[]> {
  const pools = await fetchAdaPoolMetrics();
  const byPair = new Map<string, NativeMarket>();
  for (const p of pools) {
    const a0 = adaUnit(p.asset_a);
    const b0 = adaUnit(p.asset_b);
    if (!a0 || !b0 || a0 === b0) continue;
    const tvl = Number(p.liquidity_currency);
    if (!(tvl >= 1000)) continue;
    let tokenA = a0;
    let tokenB = b0;
    let symbolA = adaSym(p.asset_a);
    let symbolB = adaSym(p.asset_b);
    let reserveA = Number(p.liquidity_a) || 0;
    let reserveB = Number(p.liquidity_b) || 0;
    let price = reserveA > 0 && reserveB > 0 ? reserveB / reserveA : 0;
    if (isAdaStable(tokenA) && !isAdaStable(tokenB)) {
      [tokenA, tokenB] = [tokenB, tokenA];
      [symbolA, symbolB] = [symbolB, symbolA];
      [reserveA, reserveB] = [reserveB, reserveA];
      price = price ? 1 / price : 0;
    }
    const lp = p.lp_asset;
    const pool = lp?.currency_symbol && lp.token_name ? `${lp.currency_symbol}.${lp.token_name}` : `${p.type || "minswap"}:${a0}:${b0}`;
    const feeN = Array.isArray(p.trading_fee_tier) ? p.trading_fee_tier[0] : 0;
    const venue: VenuePool = {
      venue: venueNamed(p.type || "Minswap"),
      pool,
      feeLabel: feeN ? `${feeN}%` : p.type || "Minswap",
      priceAinB: price,
      tvlQuote: tvl,
      reserveA,
      reserveB,
    };
    const id = pairId(1815, tokenA, tokenB);
    const prev = byPair.get(id);
    if (prev) {
      if (!prev.venues.some((v) => v.pool === pool)) prev.venues.push(venue);
      prev.depth += tvl;
      if (!prev.venueNames.includes(venue.venue.name)) prev.venueNames.push(venue.venue.name);
      continue;
    }
    byPair.set(id, {
      pairId: id,
      chainId: 1815,
      chainShort: "ADA",
      symbolA,
      symbolB,
      iconA: adaIconOf(symbolA),
      iconB: adaIconOf(symbolB),
      tokenA,
      tokenB,
      venues: [venue],
      price: isAdaStable(tokenB) && price ? price : isAdaStable(tokenA) && price ? 1 / price : price || null,
      depth: tvl,
      venueNames: [venue.venue.name],
    });
  }
  return [...byPair.values()];
}

async function loadAdaMarketsFromEstimate(): Promise<NativeMarket[]> {
  const rows: NativeMarket[] = [];
  await Promise.all(
    ADA_SEEDS.map(async (s) => {
      const est = await estimate(s.a.address, s.b.address, String(10 ** s.a.decimals));
      if (!est) return;
      const price = priceFromEstimate(est, s.a.decimals, s.b.decimals);
      if (price == null) return;
      const venues = venuesFromEstimate(est, price);
      const names = [...new Set(venues.map((v) => v.venue.name))];
      rows.push({
        pairId: pairId(1815, s.a.address, s.b.address),
        chainId: 1815,
        chainShort: "ADA",
        symbolA: s.a.symbol,
        symbolB: s.b.symbol,
        iconA: s.a.icon,
        iconB: s.b.icon,
        tokenA: s.a.address,
        tokenB: s.b.address,
        venues,
        price,
        depth: 0,
        venueNames: names,
      });
    }),
  );
  return rows;
}

let adaUsdJob: Promise<number | null> | null = null;

export async function adaUsd(): Promise<number | null> {
  if (!adaUsdJob) {
    adaUsdJob = (async () => {
      const est = await estimate(A_ADA.address, A_USDM.address, "1000000");
      if (est) {
        const p = priceFromEstimate(est, 6, 6);
        if (p) return p;
      }
      try {
        const json = await aggGet<{ value?: { price?: number } }>("/ada-price?currency=usd");
        const n = Number(json.value?.price);
        return Number.isFinite(n) && n > 0 ? n : null;
      } catch {
        return null;
      }
    })();
  }
  return adaUsdJob;
}

type TokenHit = { token_id: string; ticker?: string | null; price_by_ada?: number | null; decimals?: number | null };

export async function quoteAdaToken(unit?: string, native?: boolean): Promise<Quote | null> {
  const id = native || !unit || unit === "lovelace" ? "lovelace" : unit.toLowerCase();
  if (isAdaStable(id)) return { usdc: 1, source: "stable" };
  const usd = await adaUsd();
  if (id === "lovelace") return usd ? { usdc: usd, source: "minswap" } : null;
  try {
    const json = await aggPost<{ tokens?: TokenHit[] }>("/tokens", {
      query: "",
      only_verified: false,
      assets: [id],
    });
    const hit = json.tokens?.find((t) => t.token_id.toLowerCase() === id) ?? json.tokens?.[0];
    const ada = Number(hit?.price_by_ada);
    if (usd && Number.isFinite(ada) && ada > 0) return { usdc: ada * usd, source: "minswap" };
  } catch {
    /* estimate fallback */
  }
  const est = await estimate(id, A_USDM.address, "1000000");
  if (est) {
    const p = priceFromEstimate(est, 6, 6);
    if (p) return { usdc: p, source: "minswap" };
  }
  if (usd) {
    const vsAda = await estimate(id, "lovelace", "1000000");
    const p = vsAda ? priceFromEstimate(vsAda, 6, 6) : null;
    if (p) return { usdc: p * usd, source: "minswap" };
  }
  return null;
}

export function adaTokenMeta(id: string): AdaTok | undefined {
  const all = [A_ADA, A_USDM, A_USDA, A_IUSD, A_MIN, A_SNEK];
  return all.find((t) => t.address.toLowerCase() === id.toLowerCase());
}

export async function adaMyLp(units: string[]): Promise<NativeMarket[]> {
  const have = new Set(units.map((u) => u.toLowerCase()));
  if (!have.size) return [];
  const out: NativeMarket[] = [];
  await Promise.all(
    ADA_SEEDS.map(async (s) => {
      const est = await estimate(s.a.address, s.b.address, String(10 ** s.a.decimals));
      const lp = est?.paths?.flat().map((h) => h.lp_token).find(Boolean);
      if (!lp || !have.has(lp.toLowerCase())) return;
      const price = est ? priceFromEstimate(est, s.a.decimals, s.b.decimals) : null;
      const venues = est && price != null ? venuesFromEstimate(est, price) : [];
      out.push({
        pairId: pairId(1815, s.a.address, s.b.address),
        chainId: 1815,
        chainShort: "ADA",
        symbolA: s.a.symbol,
        symbolB: s.b.symbol,
        iconA: s.a.icon,
        iconB: s.b.icon,
        tokenA: s.a.address,
        tokenB: s.b.address,
        venues,
        price,
        depth: 0,
        venueNames: [...new Set(venues.map((v) => v.venue.name))],
      });
    }),
  );
  return out;
}
