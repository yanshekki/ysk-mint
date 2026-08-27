import { CHAINS } from "@ysk-mint/config";
import { DEX, isUsdStableAddress } from "../defiAddresses.ts";
import { pairId } from "../pairKey.ts";
import { cached, forChunks } from "./cache.ts";
import { evmPublicClient } from "./evm/client.ts";
import { ensureProtocols } from "./protocols.ts";
import { protocolsOn } from "./registry.ts";
import { rejectOutliers, weightedUsd } from "./quote.ts";
import type { DefiCtx, DefiProtocol, MarketRow, PoolRef, TokenRef, VenueQuote } from "./types.ts";
import { candidatePairs, marketTokensOn, tokensFromMarketRows, type MarketToken } from "./universe.ts";

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
  return discovered.get(chainId) ?? [];
}

function evmClient(chainId: number) {
  return evmPublicClient(chainId);
}

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
      a: { chainId: r.chainId, address: r.tokenA, decimals: 18, symbol: r.symbolA, icon: r.iconA },
      b: { chainId: r.chainId, address: r.tokenB, decimals: 18, symbol: r.symbolB, icon: r.iconB },
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
  return cached(
    `markets:${chainId}`,
    60_000,
    async () => {
    const client = evmClient(chainId);
    if (!client) return [];
    const ctx: DefiCtx = { evm: client };
    const protocols = protocolsOn(chainId);
    const listed: MarketRow[] = [];
    const skip = new Set<string>();
    await Promise.all(
      protocols.map(async (p) => {
        if (!p.markets) return;
        const rows = await p.markets(ctx).catch(() => []);
        if (!rows.length) return;
        skip.add(p.id);
        listed.push(...rows);
      }),
    );
    const extras = marketTokensOn(chainId).length < 40 ? tokensFromMarketRows(listed) : [];
    const pairs = candidatePairs(chainId, extras);
    const hits = await discoverHits(
      ctx,
      chainId,
      pairs,
      protocols.filter((p) => !skip.has(p.id)),
    );
    const live = [...listedToLive(listed), ...(await readHits(ctx, hits))];
    discovered.set(
      chainId,
      live.flatMap((h) =>
        h.venues.map((v) => ({
          chainId,
          tokenA: h.a.address,
          tokenB: h.b.address,
          pool: v.pool,
          protocolId: v.protocolId,
          protocolName: v.protocolName,
        })),
      ),
    );

    const wrap = d.wrapped.toLowerCase();
    const wrapRows = live.filter((h) => h.a.address.toLowerCase() === wrap);
    const wrapUsd =
      usdForBase(wrap, wrapRows, wrap, null, chainId).usdc ??
      usdForBase(wrap, live, wrap, null, chainId).usdc;

    const byPair = new Map<string, MarketRow>();
    const bases = new Set(live.map((h) => h.a.address.toLowerCase()));
    const usdByBase = new Map<string, { usdc: number | null; depth: number }>();
    for (const b of bases) usdByBase.set(b, usdForBase(b, live, wrap, wrapUsd, chainId));

    for (const h of live) {
      const id = pairId(chainId, h.a.address, h.b.address);
      const prev = byPair.get(id);
      const venues = [...(prev?.venues ?? [])];
      const seenPool = new Set(venues.map((v) => `${v.protocolId}:${v.pool.toLowerCase()}`));
      for (const v of h.venues) {
        const k = `${v.protocolId}:${v.pool.toLowerCase()}`;
        if (seenPool.has(k)) continue;
        seenPool.add(k);
        venues.push(v);
      }
      const names = [...new Set(venues.map((v) => v.protocolName))];
      const usd = usdByBase.get(h.a.address.toLowerCase());
      byPair.set(id, {
        pairId: id,
        chainId,
        chainShort: chain.short,
        symbolA: h.a.symbol ?? h.a.address.slice(0, 6),
        symbolB: h.b.symbol ?? h.b.address.slice(0, 6),
        iconA: h.a.icon ?? "/tokens/eth.png",
        iconB: h.b.icon ?? "/tokens/eth.png",
        tokenA: h.a.address,
        tokenB: h.b.address,
        venues,
        price: usd?.usdc ?? null,
        depth: usd?.depth ?? venues.reduce((n, v) => n + v.tvlQuote, 0),
        venueNames: names,
      });
    }
    return [...byPair.values()];
    },
    (rows) => rows.length > 0,
  );
}
