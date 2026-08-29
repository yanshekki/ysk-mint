import { CHAINS } from "@ysk-mint/config";
import { DEX, isUsdStableAddress, usdStables } from "../defiAddresses.ts";
import { pairId } from "../pairKey.ts";
import { displayStableSymbol, invertVenue, isQuoteOnRight } from "../pairOrient.ts";
import { cacheGet, cacheKey, cacheLastGood, cacheWrite, forChunks, POLICIES } from "./cache.ts";
import { evmPublicClient } from "./evm/client.ts";
import { ensureProtocols } from "./protocols.ts";
import { protocolsOn } from "./registry.ts";
import { consensusPairPrice, quoteUsd, rejectOutliers, venueDepthUsd, weightedUsd } from "./quote.ts";
import type { DefiCtx, DefiProtocol, MarketRow, PoolRef, TokenRef, VenueQuote } from "./types.ts";
import { candidatePairs, evmTokenDecimals, localTokenIcon, marketTokensOn, tokensFromMarketRows, type MarketToken } from "./universe.ts";

export function marketsCacheKey(chainId: number) {
  return cacheKey("markets", chainId, "usd4");
}

export type DiscoveredPool = {
  chainId: number;
  tokenA: string;
  tokenB: string;
  pool: string;
  protocolId: string;
  protocolName: string;
};

const discovered = new Map<number, DiscoveredPool[]>();

export function discoveredPools(chainId: number) {
  const ram = discovered.get(chainId);
  if (ram?.length) return ram;
  const persisted = cacheLastGood<DiscoveredPool[]>(cacheKey("discovered", chainId));
  if (persisted?.length) {
    discovered.set(chainId, persisted);
    return persisted;
  }
  return ram ?? [];
}

function evmClient(chainId: number) {
  return evmPublicClient(chainId);
}

function approxStableUsd(symbol?: string): number | null {
  const s = (symbol ?? "").replace(/\s+/g, "").toUpperCase();
  if (!s) return null;
  if (/^(W?USDC|W?USDT|DAI|USDS|FRAX|USDB|USDE|USDM|USDA|USD1)(\.E)?$/.test(s)) return 1;
  return null;
}

let _mktDbg = 0;

type Hit = { a: MarketToken; b: MarketToken; protocolId: string; refs: PoolRef[] };

async function discoverHits(
  ctx: DefiCtx,
  chainId: number,
  pairs: Array<{ a: MarketToken; b: MarketToken }>,
  protocols: DefiProtocol[] = protocolsOn(chainId),
): Promise<Hit[]> {
  const hits: Hit[] = [];
  await Promise.all(
    protocols.map(async (p) => {
      if (p.discoverMany) {
        const part = await p.discoverMany(ctx, pairs).catch(() => []);
        for (const row of part) {
          if (!row.refs.length) continue;
          hits.push({
            a: row.a as MarketToken,
            b: row.b as MarketToken,
            protocolId: p.id,
            refs: row.refs,
          });
        }
        return;
      }
      if (!p.discover) return;
      await forChunks(pairs, 20, async (chunk) => {
        await Promise.all(
          chunk.map(async (pair) => {
            const refs = await p.discover!(ctx, pair.a, pair.b).catch(() => []);
            if (refs.length) hits.push({ a: pair.a, b: pair.b, protocolId: p.id, refs });
          }),
        );
      });
    }),
  );
  return hits;
}

async function readHits(ctx: DefiCtx, hits: Hit[]): Promise<Array<Hit & { venues: VenueQuote[] }>> {
  const protocols = new Map(protocolsOn(hits[0]?.a.chainId ?? 0).map((p) => [p.id, p]));
  const jobs = hits.flatMap((h) => h.refs.map((ref) => ({ h, ref })));
  const venuesByHit = new Map<Hit, VenueQuote[]>();
  await forChunks(jobs, 16, async (chunk) => {
    await Promise.all(
      chunk.map(async ({ h, ref }) => {
        const p = protocols.get(h.protocolId);
        if (!p?.readPool) return;
        const row = await p.readPool(ctx, ref, h.a, h.b).catch(() => null);
        if (!row) return;
        const list = venuesByHit.get(h) ?? [];
        list.push(row);
        venuesByHit.set(h, list);
      }),
    );
  });
  return hits
    .map((h) => ({ ...h, venues: venuesByHit.get(h) ?? [] }))
    .filter((h) => h.venues.length);
}

function usdForBase(
  base: string,
  rows: Array<{ a: TokenRef; b: TokenRef; venues: VenueQuote[] }>,
  wrap: string,
  wrapUsd: number | null,
  chainId: number,
) {
  const d = DEX[chainId];
  const spots: Array<{ usdc: number; depth: number }> = [];
  for (const row of rows) {
    if (row.a.address.toLowerCase() !== base) continue;
    const b = row.b.address.toLowerCase();
    const stable = d ? isUsdStableAddress(d, b) : false;
    for (const v of row.venues) {
      if (!v.priceAinB) continue;
      if (stable) spots.push({ usdc: v.priceAinB, depth: v.tvlQuote });
      else if (wrapUsd && b === wrap) spots.push({ usdc: v.priceAinB * wrapUsd, depth: v.tvlQuote * wrapUsd });
    }
  }
  const kept = rejectOutliers(spots);
  return { usdc: weightedUsd(kept), depth: kept.reduce((n, s) => n + s.depth, 0) };
}

function listedToLive(rows: MarketRow[]): Array<Hit & { venues: VenueQuote[] }> {
  return rows
    .filter((r) => r.venues.length)
    .map((r) => ({
      a: {
        chainId: r.chainId,
        address: r.tokenA,
        decimals: evmTokenDecimals(r.chainId, r.tokenA),
        symbol: r.symbolA,
        icon: localTokenIcon(r.symbolA, r.iconA),
      },
      b: {
        chainId: r.chainId,
        address: r.tokenB,
        decimals: evmTokenDecimals(r.chainId, r.tokenB),
        symbol: r.symbolB,
        icon: localTokenIcon(r.symbolB, r.iconB),
      },
      protocolId: r.venues[0].protocolId,
      refs: [],
      venues: r.venues,
    }));
}

export async function loadEvmMarkets(chainId: number): Promise<MarketRow[]> {
  ensureProtocols();
  const d = DEX[chainId];
  if (!d) return [];
  const chain = Object.values(CHAINS).find((c) => c.chainId === chainId);
  if (!chain) return [];
  return cacheGet(
    {
      key: marketsCacheKey(chainId),
      policy: { ...POLICIES.markets, keep: (rows: MarketRow[]) => rows.length > 0 },
    },
    async () => {
    const client = evmClient(chainId);
    if (!client) return [];
    const ctx: DefiCtx = { evm: client };
    const protocols = protocolsOn(chainId);
    const listed: MarketRow[] = [];
    await Promise.all(
      protocols.map(async (p) => {
        if (!p.markets) return;
        const rows = await p.markets(ctx).catch(() => []);
        if (!rows.length) return;
        listed.push(...rows);
      }),
    );
    const extras = marketTokensOn(chainId).length < 40 ? tokensFromMarketRows(listed) : [];
    const pairs = candidatePairs(chainId, extras);
    const hits = await discoverHits(ctx, chainId, pairs, protocols);
    const live = [...listedToLive(listed), ...(await readHits(ctx, hits))];
    const found: DiscoveredPool[] = live.flatMap((h) =>
      h.venues.map((v) => ({
        chainId,
        tokenA: h.a.address,
        tokenB: h.b.address,
        pool: v.pool,
        protocolId: v.protocolId,
        protocolName: v.protocolName,
      })),
    );
    discovered.set(chainId, found);
    if (found.length) cacheWrite(cacheKey("discovered", chainId), { ...POLICIES.catalog, keep: (rows: DiscoveredPool[]) => rows.length > 0 }, found);

    const wrap = d.wrapped.toLowerCase();
    const wrapRows = live.filter((h) => h.a.address.toLowerCase() === wrap);
    const wrapUsd =
      usdForBase(wrap, wrapRows, wrap, null, chainId).usdc ??
      usdForBase(wrap, live, wrap, null, chainId).usdc ??
      (await quoteUsd(ctx, chainId, d.wrapped, 18).then((q) => q?.usdc ?? null).catch(() => null));

    const byPair = new Map<string, MarketRow>();
    const bases = new Set(live.flatMap((h) => [h.a.address.toLowerCase(), h.b.address.toLowerCase()]));
    const usdByBase = new Map<string, { usdc: number | null; depth: number }>();
    for (const b of bases) usdByBase.set(b, usdForBase(b, live, wrap, wrapUsd, chainId));

    for (const h of live) {
      const keep = isQuoteOnRight(
        chainId,
        { address: h.a.address, symbol: h.a.symbol },
        { address: h.b.address, symbol: h.b.symbol },
      );
      const a = keep ? h.a : h.b;
      const b = keep ? h.b : h.a;
      const hitVenues = keep ? h.venues : h.venues.map(invertVenue);
      const id = pairId(chainId, a.address, b.address);
      const prev = byPair.get(id);
      const venues = [...(prev?.venues ?? [])];
      const seenPool = new Set(venues.map((v) => `${v.protocolId}:${v.pool.toLowerCase()}`));
      for (const v of hitVenues) {
        const k = `${v.protocolId}:${v.pool.toLowerCase()}`;
        if (seenPool.has(k)) continue;
        seenPool.add(k);
        venues.push(v);
      }
      const names = [...new Set(venues.map((v) => v.protocolName))];
      const usd = usdByBase.get(a.address.toLowerCase());
      const qUsd = isUsdStableAddress(d, b.address)
        ? 1
        : (approxStableUsd(b.symbol) ??
          (b.address.toLowerCase() === wrap ? wrapUsd : null) ??
          usdByBase.get(b.address.toLowerCase())?.usdc ??
          null);
      const px = consensusPairPrice(venues);
      const tvlQ = venueDepthUsd(venues);
      const price = px != null && qUsd != null ? px * qUsd : (usd?.usdc ?? null);
      const depth = qUsd != null && tvlQ > 0 ? tvlQ * qUsd : 0;
      // #region agent log
      {
        const pairSym = `${a.symbol}/${b.symbol}`;
        const deadIco = (a.icon || "").includes(".e") || (b.icon || "").includes(".e");
        const usdce = /usdc\.e/i.test(pairSym);
        const sample = _mktDbg < 8 && chainId === 43114 && /usd/i.test(pairSym);
        if (deadIco || usdce || sample) {
          if (sample && !deadIco && !usdce) _mktDbg += 1;
        const wantA = usdStables(d).find((s) => s.address.toLowerCase() === a.address.toLowerCase())?.decimals ?? null;
        const wantB = usdStables(d).find((s) => s.address.toLowerCase() === b.address.toLowerCase())?.decimals ?? null;
        fetch("http://127.0.0.1:7877/ingest/5e2e6afe-2618-4b13-996a-8c6b0be88e05", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "05e1c5" },
          body: JSON.stringify({
            sessionId: "05e1c5",
            runId: "pre-fix",
            hypothesisId: "B",
            location: "markets.ts:loadEvmMarkets",
            message: "evm-depth-row",
            data: {
              chainId,
              pair: pairSym,
              usedDecA: a.decimals,
              usedDecB: b.decimals,
              wantDecA: wantA,
              wantDecB: wantB,
              wrapUsd,
              qUsd,
              tvlQ,
              depth,
              price,
              iconA: a.icon,
              venues: names,
              n: venues.length,
              tvlQuotes: venues.slice(0, 6).map((v) => ({ id: v.protocolId, tvl: v.tvlQuote, rA: v.reserveA, rB: v.reserveB })),
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        }
      }
      // #endregion
      byPair.set(id, {
        pairId: id,
        chainId,
        chainShort: chain.short,
        symbolA: displayStableSymbol(chainId, a.address, a.symbol ?? a.address.slice(0, 6)),
        symbolB: displayStableSymbol(chainId, b.address, b.symbol ?? b.address.slice(0, 6)),
        iconA: localTokenIcon(a.symbol, a.icon ?? "/tokens/eth.png"),
        iconB: localTokenIcon(b.symbol, b.icon ?? "/tokens/eth.png"),
        tokenA: a.address,
        tokenB: b.address,
        venues,
        price,
        depth,
        venueNames: names,
      });
    }
    return [...byPair.values()];
    },
  );
}
