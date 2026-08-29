import { useEffect, useState } from "react";
import { featuredChains } from "@ysk-mint/config";
import { type VenuePool } from "./dexPools.ts";
import { cacheFresh, cacheKey, cacheLastGood, cacheReady, onVisibleInterval, POLICIES, cacheGet } from "./defi/cache.ts";
import { loadEvmMarkets } from "./defi/markets.ts";
import { ensureProtocols } from "./defi/protocols.ts";
import { protocolsOn } from "./defi/registry.ts";
import type { MarketRow as DefiMarket, VenueQuote } from "./defi/types.ts";
import { quoteAmountUsd } from "./defi/quote.ts";
import { useLiveStatus } from "./liveStatus.ts";
import { mergeOriented, quoteRank } from "./pairOrient.ts";
import { useUserSettings } from "./userSettings.ts";

export type MarketRow = {
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

function toPools(venues: VenueQuote[]): VenuePool[] {
  return venues.map((q) => ({
    venue: {
      id: q.protocolId,
      name: q.protocolName,
      chainId: q.chainId,
      kind: q.kind === "aero" ? "aero" : q.kind === "v3" ? "v3" : "v2",
      factory: "0x0000000000000000000000000000000000000000",
    },
    pool: q.pool,
    feeLabel: q.feeLabel,
    priceAinB: q.priceAinB,
    tvlQuote: q.tvlQuote,
    reserveA: q.reserveA,
    reserveB: q.reserveB,
  }));
}

function asRow(r: DefiMarket): MarketRow {
  return { ...r, venues: toPools(r.venues) };
}

function dbgMarkets(hypothesisId: string, location: string, message: string, data: Record<string, unknown>) {
  // #region agent log
  fetch("http://127.0.0.1:7877/ingest/5e2e6afe-2618-4b13-996a-8c6b0be88e05", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "05e1c5" },
    body: JSON.stringify({ sessionId: "05e1c5", runId: "post-fix", hypothesisId, location, message, data, timestamp: Date.now() }),
  }).catch(() => {});
  // #endregion
}

function closeNum(a: number, b: number) {
  const m = Math.max(Math.abs(a), Math.abs(b));
  return m > 0 && Math.abs(a - b) / m < 0.2;
}

function auditDisplayed(stage: string, hypothesisId: string, rows: MarketRow[], extra?: Record<string, unknown>) {
  const chains: Record<
    string,
    { n: number; zero: number; quoteAsUsd: number; indexedUsd: number; insane: number; diverge: number; maxDepth: number; top: string }
  > = {};
  const outliers: Array<Record<string, unknown>> = [];
  for (const r of rows) {
    const tvlQ = r.venues.reduce((n, v) => n + (v.tvlQuote || 0), 0);
    let fromRes = 0;
    for (const v of r.venues) {
      if (v.reserveA > 0 && v.priceAinB > 0 && Number.isFinite(v.reserveB)) {
        fromRes += v.reserveA * v.priceAinB + Math.max(v.reserveB, 0);
      }
    }
    const usdTry = quoteAmountUsd(tvlQ, r.tokenB, r.chainId, null);
    const rank = quoteRank(r.chainId, r.tokenB, r.symbolB);
    const ratio = fromRes > 0 && tvlQ > 0 ? Math.max(fromRes, tvlQ) / Math.min(fromRes, tvlQ) : 0;
    let flag = "";
    if (r.venues.length && !(r.depth > 0)) flag = "ZERO";
    else if (r.depth > 5e10) flag = "INSANE";
    else if (rank !== 0 && usdTry == null && fromRes > 0 && closeNum(r.depth, fromRes)) flag = "QUOTE_UNITS_AS_USD";
    else if (rank !== 0 && usdTry == null && tvlQ > 0 && closeNum(r.depth, tvlQ) && (fromRes === 0 || ratio > 8)) flag = "INDEXED_USD";
    else if (ratio > 8) flag = "DIVERGE";
    const key = `${r.chainId}:${r.chainShort}`;
    const s = (chains[key] ??= { n: 0, zero: 0, quoteAsUsd: 0, indexedUsd: 0, insane: 0, diverge: 0, maxDepth: 0, top: "" });
    s.n += 1;
    if (flag === "ZERO") s.zero += 1;
    if (flag === "QUOTE_UNITS_AS_USD") s.quoteAsUsd += 1;
    if (flag === "INDEXED_USD") s.indexedUsd += 1;
    if (flag === "INSANE") s.insane += 1;
    if (flag === "DIVERGE") s.diverge += 1;
    if (r.depth > s.maxDepth) {
      s.maxDepth = r.depth;
      s.top = `${r.symbolA}/${r.symbolB}`;
    }
    if (flag && flag !== "INDEXED_USD") {
      outliers.push({
        flag,
        chainId: r.chainId,
        pair: `${r.symbolA}/${r.symbolB}`,
        depth: r.depth,
        tvlQ,
        fromRes,
        usdTry,
        rank,
        ratio: Number(ratio.toFixed(2)),
        venues: r.venues.length,
        names: r.venueNames,
      });
    }
  }
  const pri: Record<string, number> = { INSANE: 0, QUOTE_UNITS_AS_USD: 1, DIVERGE: 2, ZERO: 3 };
  outliers.sort((a, b) => (pri[String(a.flag)] ?? 9) - (pri[String(b.flag)] ?? 9));
  dbgMarkets(hypothesisId, `useDexMarkets.ts:${stage}`, "market-audit", {
    stage,
    n: rows.length,
    chains,
    outliers: outliers.slice(0, 20),
    ...(extra ?? {}),
  });
}

function mergeDelta(before: MarketRow[], after: MarketRow[]) {
  const byId = new Map(before.map((r) => [r.pairId, r]));
  let changed = 0;
  let droppedUsd = 0;
  const samples: Array<Record<string, unknown>> = [];
  for (const r of after) {
    const prev = byId.get(r.pairId);
    if (!prev) continue;
    if (!(Math.abs((prev.depth || 0) - (r.depth || 0)) > 1)) continue;
    changed += 1;
    const rank = quoteRank(r.chainId, r.tokenB, r.symbolB);
    if (prev.depth > r.depth * 5 || (rank !== 0 && r.depth > 0 && r.depth < prev.depth * 0.5)) droppedUsd += 1;
    if (samples.length < 8) {
      samples.push({
        pair: `${r.symbolA}/${r.symbolB}`,
        before: prev.depth,
        after: r.depth,
        quote: r.symbolB,
        rank,
        venues: r.venues.length,
      });
    }
  }
  return { changed, droppedUsd, samples, beforeN: before.length, afterN: after.length };
}

async function loadEvm(chainId: number): Promise<MarketRow[]> {
  const raw = await cacheGet(
    {
      key: cacheKey("markets", chainId, "g4"),
      policy: { ...POLICIES.markets, keep: (rows: DefiMarket[]) => rows.length > 0 },
    },
    async () => {
      const rows = await loadEvmMarkets(chainId).catch(() => [] as DefiMarket[]);
      const extra = await Promise.all(
        protocolsOn(chainId).map((p) => (p.markets ? p.markets({}).catch(() => [] as DefiMarket[]) : Promise.resolve([] as DefiMarket[]))),
      );
      return [...rows, ...extra.flat()];
    },
  ).catch(() => [] as DefiMarket[]);
  const before = raw.map(asRow);
  const after = mergeOriented(before) as MarketRow[];
  auditDisplayed(`loadEvm:${chainId}:after`, "A", after, { chainId, ...mergeDelta(before, after) });
  return after;
}

async function loadNative(chainId: number): Promise<MarketRow[]> {
  const raw = await cacheGet(
    {
      key: cacheKey("markets", chainId, "n11"),
      policy: { ...POLICIES.markets, keep: (rows: DefiMarket[]) => rows.length > 0 },
    },
    async () => {
      const parts = await Promise.all(
        protocolsOn(chainId).map((p) => (p.markets ? p.markets({}).catch(() => []) : Promise.resolve([]))),
      );
      return parts.flat();
    },
  ).catch(() => [] as DefiMarket[]);
  const before = raw.map(asRow);
  const after = mergeOriented(before) as MarketRow[];
  auditDisplayed(`loadNative:${chainId}:after`, "C", after, { chainId, ...mergeDelta(before, after) });
  return after;
}

async function mapLimit<T>(ids: T[], n: number, fn: (id: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(n, ids.length) }, async () => {
    while (i < ids.length) {
      const id = ids[i++];
      await fn(id);
    }
  });
  await Promise.all(workers);
}

function sortMarkets(rows: MarketRow[]) {
  rows.sort((a, b) => (b.depth || 0) - (a.depth || 0));
  return rows;
}

const NATIVE = new Set([101, 397, 1815, 784, 607, 637]);
const SKIP = new Set([101, 397, 1815, 398, 18151, 103, 784, 607, 637, 998, 728126428]);

function marketKey(id: number) {
  return NATIVE.has(id) ? cacheKey("markets", id, "n11") : cacheKey("markets", id, "g4");
}

function marketIds(chainId: number | "all", disabled: number[]) {
  ensureProtocols();
  const off = new Set(disabled);
  return chainId === "all"
    ? featuredChains()
        .filter((c) => !c.testnet && !off.has(c.chainId) && protocolsOn(c.chainId).length > 0)
        .map((c) => c.chainId)
    : !off.has(chainId) && protocolsOn(chainId).length
      ? [chainId]
      : [];
}

function seedRows(ids: number[]) {
  const out: MarketRow[] = [];
  for (const id of ids) {
    const raw = cacheLastGood<DefiMarket[]>(marketKey(id));
    if (raw?.length) out.push(...raw.map(asRow));
  }
  return sortMarkets(mergeOriented(out) as MarketRow[]);
}

export function useDexMarkets(chainId: number | "all") {
  const [rows, setRows] = useState<MarketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const disabledChains = useUserSettings((s) => s.disabledChains);

  useEffect(() => {
    let cancelled = false;
    const ids = marketIds(chainId, disabledChains);
    const byChain = new Map<number, MarketRow[]>();

    const publish = () => {
      if (cancelled) return;
      setRows(sortMarkets([...byChain.values()].flat()));
    };

    void (async () => {
      await cacheReady();
      if (cancelled) return;
      const seeded = seedRows(ids);
      for (const r of seeded) {
        const list = byChain.get(r.chainId) ?? [];
        list.push(r);
        byChain.set(r.chainId, list);
      }
      if (seeded.length) {
        setRows(seeded);
        setLoading(false);
      } else {
        setLoading(true);
      }
      setError(null);

      const live = useLiveStatus.getState();
      for (const id of ids) {
        if (!cacheFresh(marketKey(id))) live.start(`markets:${id}`, id, "markets", "wait");
      }

      try {
        if (!ids.length) {
          if (!cancelled) {
            if (!seeded.length) setRows([]);
            setLoading(false);
          }
          return;
        }
        const evmIds = ids.filter((id) => !SKIP.has(id));
        const nativeIds = ids.filter((id) => NATIVE.has(id));
        const one = async (id: number, fn: () => Promise<MarketRow[]>) => {
          const miss = !cacheFresh(marketKey(id));
          if (miss) useLiveStatus.getState().run(`markets:${id}`);
          try {
            const part = await fn();
            if (cancelled) return;
            if (part.length) byChain.set(id, part);
            publish();
            if (miss) useLiveStatus.getState().finish(`markets:${id}`, true);
          } catch {
            if (miss) useLiveStatus.getState().finish(`markets:${id}`, false);
          }
        };
        await Promise.all([
          mapLimit(evmIds, 2, async (id) => {
            await one(id, () => loadEvm(id));
          }),
          ...nativeIds.map((id) => one(id, () => loadNative(id))),
        ]);
      } catch (e) {
        if (!cancelled && !byChain.size) {
          setError(e instanceof Error ? e.message : "rpc");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          auditDisplayed("displayed-all", "E", [...byChain.values()].flat());
        }
        useLiveStatus.getState().clear("markets:");
      }
    })();

    const stopPoll = onVisibleInterval(60_000, () => {
      if (cancelled) return;
      const evmIds = ids.filter((id) => !SKIP.has(id));
      const nativeIds = ids.filter((id) => NATIVE.has(id));
      const one = async (id: number, fn: () => Promise<MarketRow[]>) => {
        const miss = !cacheFresh(marketKey(id));
        if (miss) useLiveStatus.getState().start(`markets:${id}`, id, "markets", "run");
        try {
          const part = await fn();
          if (cancelled) return;
          if (part.length) byChain.set(id, part);
          publish();
          if (miss) useLiveStatus.getState().finish(`markets:${id}`, true);
        } catch {
          if (miss) useLiveStatus.getState().finish(`markets:${id}`, false);
        }
      };
      void Promise.all([
        mapLimit(evmIds, 2, async (id) => {
          await one(id, () => loadEvm(id));
        }),
        ...nativeIds.map((id) => one(id, () => loadNative(id))),
      ]);
    });

    return () => {
      cancelled = true;
      stopPoll();
      useLiveStatus.getState().clear("markets:");
    };
  }, [chainId, disabledChains]);

  return { rows, loading, error };
}
