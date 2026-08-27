import { useEffect, useState } from "react";
import { featuredChains } from "@ysk-mint/config";
import { type VenuePool } from "./dexPools.ts";
import { loadEvmMarkets } from "./defi/markets.ts";
import { ensureProtocols } from "./defi/protocols.ts";
import { protocolsOn } from "./defi/registry.ts";
import type { MarketRow as DefiMarket, VenueQuote } from "./defi/types.ts";
import { useLiveStatus } from "./liveStatus.ts";

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
  const rows = await loadEvmMarkets(chainId).catch(() => []);
  return rows.map(asRow);
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

export function useDexMarkets(chainId: number | "all") {
  const [rows, setRows] = useState<MarketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRows([]);
    ensureProtocols();
    const ids =
      chainId === "all"
        ? featuredChains()
            .filter((c) => !c.testnet && protocolsOn(c.chainId).length > 0)
            .map((c) => c.chainId)
        : protocolsOn(chainId).length
          ? [chainId]
          : [];
    const live = useLiveStatus.getState();
    for (const id of ids) live.start(`markets:${id}`, id, "markets", "wait");
    void (async () => {
      try {
        if (!ids.length) {
          if (!cancelled) {
            setRows([]);
            setLoading(false);
          }
          return;
        }
        const evmIds = ids.filter((id) => ![101, 397, 1815, 398, 18151, 103, 784, 607, 637, 998, 728126428].includes(id));
        const nativeIds = ids.filter((id) => [101, 397, 1815, 784, 607].includes(id));
        const jobs: Array<Promise<void>> = [];
        const acc: MarketRow[] = [];
        const push = (part: MarketRow[]) => {
          if (cancelled || !part.length) return;
          acc.push(...part);
          setRows(sortMarkets([...acc]));
        };
        const one = async (id: number, fn: () => Promise<MarketRow[]>) => {
          useLiveStatus.getState().run(`markets:${id}`);
          try {
            const part = await fn();
            if (!cancelled) push(part);
            useLiveStatus.getState().finish(`markets:${id}`, true);
          } catch {
            useLiveStatus.getState().finish(`markets:${id}`, false);
          }
        };
        jobs.push(
          mapLimit(evmIds, 2, async (id) => {
            await one(id, () => loadEvm(id));
          }),
        );
        for (const id of nativeIds) {
          jobs.push(
            one(id, async () => {
              const parts = await Promise.all(
                protocolsOn(id).map((p) => (p.markets ? p.markets({}).catch(() => []) : Promise.resolve([]))),
              );
              return parts.flat().map(asRow);
            }),
          );
        }
        await Promise.all(jobs);
        if (!cancelled && !acc.length) setRows([]);
      } catch (e) {
        if (!cancelled) {
          setRows([]);
          setError(e instanceof Error ? e.message : "rpc");
        }
      } finally {
        if (!cancelled) setLoading(false);
        useLiveStatus.getState().clear("markets:");
      }
    })();
    return () => {
      cancelled = true;
      useLiveStatus.getState().clear("markets:");
    };
  }, [chainId]);

  return { rows, loading, error };
}
