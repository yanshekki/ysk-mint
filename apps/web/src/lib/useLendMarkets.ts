import { useEffect, useState } from "react";
import { cacheFresh, cacheKey, cacheLastGood, cacheReady, onVisibleInterval } from "./defi/cache.ts";
import { lendChainIds, loadLendMarkets, type LendMarketRow } from "./lendMarkets.ts";
import { useLiveStatus } from "./liveStatus.ts";
import { useUserSettings } from "./userSettings.ts";

function sortRows(rows: LendMarketRow[]) {
  return [...rows].sort((a, b) => (b.supplyUsd ?? 0) - (a.supplyUsd ?? 0));
}

function seed(ids: number[]) {
  const out: LendMarketRow[] = [];
  for (const id of ids) {
    const raw = cacheLastGood<LendMarketRow[]>(cacheKey("lend", id));
    if (raw?.length) out.push(...raw);
  }
  return sortRows(out);
}

async function mapLimit<T>(ids: T[], n: number, fn: (id: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, ids.length) }, async () => {
      while (i < ids.length) {
        const id = ids[i++];
        await fn(id);
      }
    }),
  );
}

export function useLendMarkets(chainId: number | "all") {
  const [rows, setRows] = useState<LendMarketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const disabledChains = useUserSettings((s) => s.disabledChains);

  useEffect(() => {
    let cancelled = false;
    const ids = lendChainIds(chainId, disabledChains);
    const byChain = new Map<number, LendMarketRow[]>();
    const publish = () => {
      if (!cancelled) setRows(sortRows([...byChain.values()].flat()));
    };

    void (async () => {
      await cacheReady();
      if (cancelled) return;
      const seeded = seed(ids);
      for (const r of seeded) {
        const list = byChain.get(r.chainId) ?? [];
        list.push(r);
        byChain.set(r.chainId, list);
      }
      if (seeded.length) {
        setRows(seeded);
        setLoading(false);
      } else setLoading(true);
      setError(null);
      const live = useLiveStatus.getState();
      for (const id of ids) {
        if (!cacheFresh(cacheKey("lend", id))) live.start(`lend:${id}`, id, "lend", "wait");
      }
      try {
        if (!ids.length) {
          if (!cancelled) {
            if (!seeded.length) setRows([]);
            setLoading(false);
          }
          return;
        }
        await mapLimit(ids, 2, async (id) => {
          const miss = !cacheFresh(cacheKey("lend", id));
          if (miss) useLiveStatus.getState().run(`lend:${id}`);
          try {
            const part = await loadLendMarkets(id, (rows) => {
              if (cancelled || !rows.length) return;
              byChain.set(id, rows);
              publish();
            });
            if (cancelled) return;
            if (part.length) byChain.set(id, part);
            publish();
            if (miss) useLiveStatus.getState().finish(`lend:${id}`, true);
          } catch {
            if (miss) useLiveStatus.getState().finish(`lend:${id}`, false);
          }
        });
      } catch (e) {
        if (!cancelled && !byChain.size) setError(e instanceof Error ? e.message : "rpc");
      } finally {
        if (!cancelled) setLoading(false);
        useLiveStatus.getState().clear("lend:");
      }
    })();

    const stop = onVisibleInterval(90_000, () => {
      if (cancelled) return;
      void Promise.all(ids.map((id) => loadLendMarkets(id).then((part) => part.length && byChain.set(id, part)))).then(publish);
    });
    return () => {
      cancelled = true;
      stop();
      useLiveStatus.getState().clear("lend:");
    };
  }, [chainId, disabledChains]);

  return { rows, loading, error };
}
