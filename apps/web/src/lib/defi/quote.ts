import type { Address, PublicClient } from "viem";
import { DEX, isUsdStableAddress, usdStables } from "../defiAddresses.ts";
import { canonAddr, pairId } from "../pairKey.ts";
import { cacheGet, cacheKey, cacheLastGood, POLICIES } from "./cache.ts";
import { ensureProtocols } from "./protocols.ts";
import { protocolById, protocolsOn } from "./registry.ts";
import type { DefiCtx, MarketRow, Quote, QuoteSource, TokenRef, VenueQuote } from "./types.ts";

export const VENUES_CACHE = "venues5";

const OUTLIER = 0.15;
const quotePolicy = { ...POLICIES.quote, keep: (q: Quote | null) => Boolean(q && q.usdc > 0) };
const wrapPolicy = { ...POLICIES.quote, keep: (n: number | null) => n != null && n > 0 };

export function rejectOutliers<T extends { usdc: number; depth: number }>(rows: T[]): T[] {
  if (rows.length < 2) return rows;
  const best = rows.reduce((a, b) => (b.depth > a.depth ? b : a));
  if (!best.usdc || best.depth <= 0) return rows;
  const kept = rows.filter((r) => Math.abs(r.usdc - best.usdc) / best.usdc <= OUTLIER);
  return kept.length ? kept : [best];
}

export function weightedUsd(rows: Array<{ usdc: number; depth: number }>): number | null {
  let num = 0;
  let den = 0;
  for (const r of rows) {
    const w = Math.max(r.depth, 0);
    if (!w || !r.usdc) continue;
    num += r.usdc * w;
    den += w;
  }
  if (den) return num / den;
  return rows[0]?.usdc ?? null;
}

function asToken(chainId: number, token: string | undefined, decimals: number, native?: boolean): TokenRef {
  return { chainId, address: token ?? "", decimals, native };
}

async function discoverRead(
  ctx: DefiCtx,
  chainId: number,
  tokenA: TokenRef,
  tokenB: TokenRef,
): Promise<VenueQuote[]> {
  const out: VenueQuote[] = [];
  await Promise.all(
    protocolsOn(chainId).map(async (p) => {
      if (!p.discover || !p.readPool) return;
      const refs = await p.discover(ctx, tokenA, tokenB).catch(() => []);
      await Promise.all(
        refs.map(async (ref) => {
          const row = await p.readPool!(ctx, ref, tokenA, tokenB).catch(() => null);
          if (row) out.push(row);
        }),
      );
    }),
  );
  return out;
}

type Spot = { usdc: number; depth: number; source: QuoteSource; venue: VenueQuote };

async function spotsVsStables(ctx: DefiCtx, chainId: number, token: TokenRef): Promise<Spot[]> {
  const d = DEX[chainId];
  if (!d) return [];
  const addr = token.address.toLowerCase();
  const legs = usdStables(d).filter((s) => s.address.toLowerCase() !== addr);
  const spots: Spot[] = [];
  await Promise.all(
    legs.map(async (leg) => {
      const venues = await discoverRead(ctx, chainId, token, {
        chainId,
        address: leg.address,
        decimals: leg.decimals,
        symbol: leg.symbol,
      });
      for (const v of venues) {
        if (!v.priceAinB) continue;
        spots.push({
          usdc: v.priceAinB,
          depth: Math.max(v.tvlQuote, 0),
          source: v.kind === "v3" ? "v3" : "v2",
          venue: v,
        });
      }
    }),
  );
  return spots;
}

async function wrappedUsd(ctx: DefiCtx, chainId: number): Promise<number | null> {
  const d = DEX[chainId];
  if (!d) return null;
  return cacheGet({ key: cacheKey("quote.wrap", chainId), policy: wrapPolicy }, async () => {
    const token: TokenRef = { chainId, address: d.wrapped, decimals: 18 };
    const spots = rejectOutliers(await spotsVsStables(ctx, chainId, token));
    return weightedUsd(spots);
  });
}

async function evmQuoteUsd(ctx: DefiCtx, chainId: number, token: TokenRef): Promise<Quote | null> {
  const d = DEX[chainId];
  if (!d || !ctx.evm) return null;
  const addr = (token.native ? d.wrapped : token.address)?.toLowerCase();
  if (!addr) return null;
  if (isUsdStableAddress(d, addr)) return { usdc: 1, source: "stable", depth: 0 };

  return cacheGet({ key: cacheKey("quote.usd", chainId, addr), policy: quotePolicy }, async () => {
    const base: TokenRef = { ...token, address: addr, native: false };
    let spots = await spotsVsStables(ctx, chainId, base);
    if (!spots.length && addr !== d.wrapped.toLowerCase()) {
      const wrap = await wrappedUsd(ctx, chainId);
      if (wrap) {
        const vsW = await discoverRead(ctx, chainId, base, {
          chainId,
          address: d.wrapped,
          decimals: 18,
        });
        for (const v of vsW) {
          if (!v.priceAinB) continue;
          spots.push({
            usdc: v.priceAinB * wrap,
            depth: Math.max(v.tvlQuote, 0) * wrap,
            source: v.kind === "v3" ? "v3" : "v2",
            venue: v,
          });
        }
      }
    }
    const kept = rejectOutliers(spots);
    const usdc = weightedUsd(kept);
    if (usdc == null) return null;
    const depth = kept.reduce((n, s) => n + s.depth, 0);
    const v3 = kept.some((s) => s.source === "v3");
    return { usdc, source: v3 ? "v3" : kept[0]?.source ?? "agg", depth };
  });
}

export async function quoteUsd(
  ctx: DefiCtx,
  chainId: number,
  token: string | undefined,
  decimals: number,
  native?: boolean,
): Promise<Quote | null> {
  ensureProtocols();
  const ref = asToken(chainId, token, decimals, native);
  const nativeQuote = protocolsOn(chainId).find((p) => p.quoteUsd && !p.discover);
  if (nativeQuote?.quoteUsd) {
    return cacheGet(
      { key: cacheKey("quote.usd", chainId, native ? "native" : (token ?? "").toLowerCase()), policy: quotePolicy },
      () => nativeQuote.quoteUsd!(ctx, ref),
    );
  }
  return evmQuoteUsd(ctx, chainId, ref);
}

function mergeQuotes(parts: VenueQuote[][]): VenueQuote[] {
  const by = new Map<string, VenueQuote>();
  for (const list of parts) {
    for (const q of list) {
      const pool = (q.pool || "").toLowerCase();
      if (!pool) continue;
      const k = `${q.protocolId}:${pool}`;
      if (!by.has(k)) by.set(k, q);
    }
  }
  return [...by.values()];
}

function faceQuotes(venues: VenueQuote[], rowA: string, wantA: string): VenueQuote[] {
  if (rowA.toLowerCase() === wantA.toLowerCase()) return venues;
  return venues.map((v) => {
    const priceAinB = v.priceAinB && Number.isFinite(v.priceAinB) ? 1 / v.priceAinB : v.priceAinB;
    const reserveA = v.reserveB;
    const reserveB = v.reserveA;
    const tvlQuote =
      reserveA > 0 && priceAinB > 0 && Number.isFinite(priceAinB)
        ? reserveA * priceAinB + Math.max(reserveB, 0)
        : Math.max(reserveB, 0) * 2;
    return { ...v, priceAinB, reserveA, reserveB, tvlQuote };
  });
}

function quotesFromMarketList(chainId: number, tokenA: string, tokenB: string): VenueQuote[] {
  const g4 = cacheLastGood<MarketRow[]>(cacheKey("markets", chainId, "g4"));
  const usd4 = cacheLastGood<MarketRow[]>(cacheKey("markets", chainId, "usd4"));
  const native = cacheLastGood<MarketRow[]>(cacheKey("markets", chainId));
  const rows = (g4?.length ? g4 : usd4?.length ? usd4 : native) ?? [];
  if (!rows.length) return [];
  const id = pairId(chainId, tokenA, tokenB);
  const xa = tokenA.toLowerCase();
  const xb = tokenB.toLowerCase();
  const row = rows.find((r) => {
    if (r.pairId === id) return true;
    const ta = r.tokenA.toLowerCase();
    const tb = r.tokenB.toLowerCase();
    return (ta === xa && tb === xb) || (ta === xb && tb === xa);
  });
  if (!row?.venues?.length) return [];
  return faceQuotes(row.venues, row.tokenA, tokenA);
}

export async function readPairVenues(
  client: PublicClient,
  chainId: number,
  tokenA: Address | string,
  tokenB: Address | string,
  decA: number,
  decB: number,
): Promise<VenueQuote[]> {
  ensureProtocols();
  const pid = pairId(chainId, String(tokenA), String(tokenB));
  return cacheGet(
    {
      key: cacheKey(VENUES_CACHE, pid, String(tokenA).toLowerCase()),
      policy: { ...POLICIES.venues, keep: (rows: VenueQuote[]) => rows.length > 0 },
    },
    async () => {
  const ctx: DefiCtx = { evm: client };
  const a: TokenRef = { chainId, address: tokenA, decimals: decA };
  const b: TokenRef = { chainId, address: tokenB, decimals: decB };
  const fromList = quotesFromMarketList(chainId, String(tokenA), String(tokenB));
  const out = await discoverRead(ctx, chainId, a, b);
  const seen = new Set(out.map((v) => `${v.protocolId}:${v.pool.toLowerCase()}`));
  const a0 = canonAddr(String(tokenA));
  const b0 = canonAddr(String(tokenB));
  const { discoveredPools } = await import("./markets.ts");
  for (const hit of discoveredPools(chainId)) {
    const x = canonAddr(hit.tokenA);
    const y = canonAddr(hit.tokenB);
    const same = (x === a0 && y === b0) || (x === b0 && y === a0);
    if (!same) continue;
    const key = `${hit.protocolId}:${hit.pool.toLowerCase()}`;
    if (seen.has(key)) continue;
    const p = protocolById(hit.protocolId);
    if (!p?.readPool) continue;
    const row = await p
      .readPool(ctx, {
        protocolId: hit.protocolId,
        chainId,
        pool: hit.pool,
        tokenA: String(tokenA),
        tokenB: String(tokenB),
        feeLabel: "0.30%",
      }, a, b)
      .catch(() => null);
    if (!row) continue;
    seen.add(key);
    out.push(row);
  }
  return mergeQuotes([out, fromList]);
    },
  );
}

export type TvlLike = { priceAinB: number; reserveA: number; reserveB: number; tvlQuote?: number; pool?: string; chainId?: number };

export function venueTvlInQuote(v: TvlLike): number {
  const indexed = Math.max(v.tvlQuote ?? 0, 0);
  // Rhea depth is only USD from stables / wrap.NEAR. Never recompute from meme reserves or indexer TVL.
  if (v.pool && /^(ref|sauce):/i.test(v.pool)) return indexed;
  if (v.chainId != null && NATIVE_USD.has(v.chainId)) return indexed;
  let fromReserves = 0;
  if (v.reserveA > 0 && v.priceAinB > 0 && Number.isFinite(v.reserveB)) {
    const tvl = v.reserveA * v.priceAinB + Math.max(v.reserveB, 0);
    if (Number.isFinite(tvl) && tvl > 0) fromReserves = tvl;
  }
  if (indexed > 0 && fromReserves > 0) return fromReserves;
  return fromReserves > 0 ? fromReserves : indexed;
}

export function quoteAmountUsd(amount: number, quoteAddr: string, chainId: number, wrapUsd: number | null): number | null {
  const d = DEX[chainId];
  if (!d || !Number.isFinite(amount) || amount < 0) return null;
  const q = quoteAddr.toLowerCase();
  if (isUsdStableAddress(d, q)) return amount;
  if (wrapUsd && wrapUsd > 0 && q === d.wrapped.toLowerCase()) return amount * wrapUsd;
  return null;
}

/** USD of the volatile leg when one side is a stable; otherwise base in USD via wrap. */
export function pairPriceUsd(
  priceAinB: number,
  tokenA: string,
  tokenB: string,
  chainId: number,
  wrapUsd: number | null = null,
): number | null {
  if (!(priceAinB > 0) || !Number.isFinite(priceAinB)) return null;
  const d = DEX[chainId];
  if (!d) return priceAinB;
  if (isUsdStableAddress(d, tokenB)) return priceAinB;
  if (isUsdStableAddress(d, tokenA)) {
    const inv = 1 / priceAinB;
    return Number.isFinite(inv) && inv > 0 ? inv : null;
  }
  return quoteAmountUsd(priceAinB, tokenB, chainId, wrapUsd ?? cacheLastGood<number>(cacheKey("quote.wrap", chainId)) ?? null);
}

export function consensusPairPrice(venues: TvlLike[]): number | null {
  const rows = venues.map((v) => ({ usdc: v.priceAinB, depth: venueTvlInQuote(v) }));
  return weightedUsd(rejectOutliers(rows));
}

export function venuesPriceUsd(venues: TvlLike[], quoteAddr: string, chainId: number, wrapUsd: number | null, baseAddr?: string): number | null {
  const px = consensusPairPrice(venues);
  if (px == null) return null;
  if (baseAddr) return pairPriceUsd(px, baseAddr, quoteAddr, chainId, wrapUsd);
  return quoteAmountUsd(px, quoteAddr, chainId, wrapUsd);
}

export function venuesTvlUsd(venues: TvlLike[], quoteAddr: string, chainId: number, wrapUsd: number | null): number {
  const tvlQ = venues.reduce((n, v) => n + venueTvlInQuote(v), 0);
  return quoteAmountUsd(tvlQ, quoteAddr, chainId, wrapUsd) ?? 0;
}

/** Native/Gecko adapters already store USD in tvlQuote. Do not treat quote-token reserves as dollars. */
export const NATIVE_USD = new Set([101, 397, 1815, 784, 607, 637]);

export function marketDepthUsd(venues: TvlLike[], quoteAddr: string, chainId: number, wrapUsd: number | null, prevUsd = 0): number {
  const indexed = venues.reduce((n, v) => n + Math.max(v.tvlQuote ?? 0, 0), 0);
  if (NATIVE_USD.has(chainId)) return indexed;
  const converted = venuesTvlUsd(venues, quoteAddr, chainId, wrapUsd);
  if (converted > 0) return converted;
  let fromRes = 0;
  for (const v of venues) {
    if (v.reserveA > 0 && v.priceAinB > 0 && Number.isFinite(v.reserveB)) {
      const tvl = v.reserveA * v.priceAinB + Math.max(v.reserveB, 0);
      if (Number.isFinite(tvl) && tvl > 0) fromRes += tvl;
    }
  }
  if (!(fromRes > 0) && indexed > 0) return indexed;
  if (prevUsd > 0) return prevUsd;
  return 0;
}

export function venueDisplayDepth(v: TvlLike, asUsd: boolean): number {
  const indexed = Math.max(v.tvlQuote ?? 0, 0);
  let fromReserves = 0;
  if (v.reserveA > 0 && v.priceAinB > 0 && Number.isFinite(v.reserveB)) {
    const tvl = v.reserveA * v.priceAinB + Math.max(v.reserveB, 0);
    if (Number.isFinite(tvl) && tvl > 0) fromReserves = tvl;
  }
  if (v.pool && /^(ref|sauce):/i.test(v.pool)) return indexed;
  if (asUsd) {
    if (indexed > 0 && fromReserves > 0) {
      const ratio = fromReserves > indexed ? fromReserves / indexed : indexed / fromReserves;
      return ratio > 2 ? indexed : fromReserves;
    }
    return indexed || fromReserves;
  }
  return fromReserves || indexed;
}

export function venueDepthUsd(venues: TvlLike[]): number {
  return venues.reduce((n, v) => n + venueTvlInQuote(v), 0);
}
