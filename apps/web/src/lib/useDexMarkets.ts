import { useEffect, useState } from "react";
import { featuredChains } from "@ysk-mint/config";
import { type VenuePool } from "./dexPools.ts";
import { cacheFresh, cacheKey, cacheLastGood, cacheReady, onVisibleInterval, POLICIES, cacheGet } from "./defi/cache.ts";
import { loadEvmMarkets } from "./defi/markets.ts";
import { ensureProtocols } from "./defi/protocols.ts";
import { protocolsOn } from "./defi/registry.ts";
import type { MarketRow as DefiMarket, VenueQuote } from "./defi/types.ts";
import { useLiveStatus } from "./liveStatus.ts";
import { mergeOriented } from "./pairOrient.ts";

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

async function loadEvm(chainId: number): Promise<MarketRow[]> {
  const rows = await loadEvmMarkets(chainId).catch(() => [] as DefiMarket[]);
  return mergeOriented(rows.map(asRow)) as MarketRow[];
}

async function loadNative(chainId: number): Promise<MarketRow[]> {
  const raw = await cacheGet(
    {
      key: cacheKey("markets", chainId),
      policy: { ...POLICIES.markets, keep: (rows: DefiMarket[]) => rows.length > 0 },
    },
    async () => {
      const parts = await Promise.all(
        protocolsOn(chainId).map((p) => (p.markets ? p.markets({}).catch(() => []) : Promise.resolve([]))),
      );
      return parts.flat();
    },
  ).catch(() => [] as DefiMarket[]);
  return mergeOriented(raw.map(asRow)) as MarketRow[];
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

const NATIVE = new Set([101, 397, 1815, 784, 607]);
const SKIP = new Set([101, 397, 1815, 398, 18151, 103, 784, 607, 637, 998, 728126428]);

function marketIds(chainId: number | "all") {
  ensureProtocols();
  return chainId === "all"
    ? featuredChains()
        .filter((c) => !c.testnet && protocolsOn(c.chainId).length > 0)
        .map((c) => c.chainId)
    : protocolsOn(chainId).length
      ? [chainId]
      : [];
}

function seedRows(ids: number[]) {
  const out: MarketRow[] = [];
  for (const id of ids) {
    const raw = cacheLastGood<DefiMarket[]>(cacheKey("markets", id));
    if (raw?.length) out.push(...raw.map(asRow));
  }
  return sortMarkets(mergeOriented(out) as MarketRow[]);
}

export function useDexMarkets(chainId: number | "all") {
  const [rows, setRows] = useState<MarketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ids = marketIds(chainId);
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
        if (!cacheFresh(cacheKey("markets", id))) live.start(`markets:${id}`, id, "markets", "wait");
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
          const miss = !cacheFresh(cacheKey("markets", id));
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
        if (!cancelled) setLoading(false);
        useLiveStatus.getState().clear("markets:");
      }
    })();

    const stopPoll = onVisibleInterval(60_000, () => {
      if (cancelled) return;
      const evmIds = ids.filter((id) => !SKIP.has(id));
      const nativeIds = ids.filter((id) => NATIVE.has(id));
      const one = async (id: number, fn: () => Promise<MarketRow[]>) => {
        const miss = !cacheFresh(cacheKey("markets", id));
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
  }, [chainId]);

  return { rows, loading, error };
}
