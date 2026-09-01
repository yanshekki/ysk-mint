import { useEffect, useRef, useState } from "react";
import { cacheGet, cacheKey, cacheLastGood, onVisibleInterval, POLICIES } from "./defi/cache.ts";
import { geckoEnqueue } from "./defi/http/geckoDex.ts";
import { outboundFetch } from "./outbound.ts";
import { cancelLive, trackLive } from "./liveStatus.ts";
import type { VenuePool } from "./dexPools.ts";
import type { SwapCandle } from "./swapCandles.ts";

/** One public Gecko call: 15m × 1000 ≈ 10.4 days. */
export const OHLCV_BUCKET_SEC = 900;
export const OHLCV_LIMIT = 1000;

const GECKO_NETWORK: Record<number, string> = {
  1: "eth",
  10: "optimism",
  25: "cronos",
  56: "bsc",
  100: "xdai",
  101: "solana",
  130: "unichain",
  137: "polygon_pos",
  143: "monad",
  146: "sonic",
  169: "manta-pacific",
  196: "x-layer",
  204: "opbnb",
  250: "ftm",
  252: "fraxtal",
  324: "zksync",
  480: "world-chain",
  607: "ton",
  637: "aptos",
  784: "sui-network",
  999: "hyperevm",
  1088: "metis",
  1135: "lisk",
  1329: "sei-evm",
  1868: "soneium",
  5000: "mantle",
  8453: "base",
  42161: "arbitrum",
  42220: "celo",
  43114: "avax",
  57073: "ink",
  59144: "linea",
  80094: "berachain",
  81457: "blast",
  534352: "scroll",
  747474: "katana",
  7777777: "zora",
};

type GeckoOhlcvJson = {
  data?: { attributes?: { ohlcv_list?: unknown[] } };
  meta?: { base?: { address?: string }; quote?: { address?: string } };
};

export function geckoNetworkOf(chainId: number | undefined): string | undefined {
  if (!chainId) return undefined;
  return GECKO_NETWORK[chainId];
}

function geckoPoolId(pool: string) {
  return /^0x[0-9a-fA-F]+$/.test(pool) ? pool.toLowerCase() : pool;
}

function sameAddr(a?: string, b?: string) {
  if (!a || !b) return false;
  const x = a.trim();
  const y = b.trim();
  return x === y || x.toLowerCase() === y.toLowerCase();
}

function num(x: unknown) {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : NaN;
}

function ohlcvCacheKey(chainId: number, pool: string) {
  return cacheKey("ohlcv", chainId, geckoPoolId(pool), "15m");
}

export function deepestPool(venues: VenuePool[]): VenuePool | undefined {
  let best: VenuePool | undefined;
  let depth = -1;
  for (const v of venues) {
    if (!v.pool) continue;
    if (v.tvlQuote > depth) {
      depth = v.tvlQuote;
      best = v;
    }
  }
  return best;
}

function invertCandle(c: SwapCandle): SwapCandle {
  const open = 1 / c.open;
  const close = 1 / c.close;
  const high = 1 / c.low;
  const low = 1 / c.high;
  return {
    time: c.time,
    open,
    high: Math.max(high, open, close),
    low: Math.min(low, open, close),
    close,
    volume: c.volume,
  };
}

function needsInvert(meta: GeckoOhlcvJson["meta"], tokenA: string) {
  if (sameAddr(meta?.base?.address, tokenA)) return false;
  if (sameAddr(meta?.quote?.address, tokenA)) return true;
  return false;
}

function parseOhlcv(json: GeckoOhlcvJson | null, tokenA: string): SwapCandle[] {
  const list = json?.data?.attributes?.ohlcv_list ?? [];
  const raw: SwapCandle[] = [];
  for (const row of list) {
    if (!Array.isArray(row) || row.length < 5) continue;
    let time = Math.floor(num(row[0]));
    if (!(time > 0)) continue;
    if (time > 1e12) time = Math.floor(time / 1000);
    const open = num(row[1]);
    const high = num(row[2]);
    const low = num(row[3]);
    const close = num(row[4]);
    const volume = num(row[5]);
    if (!(open > 0 && high > 0 && low > 0 && close > 0)) continue;
    raw.push({
      time,
      open,
      high,
      low,
      close,
      volume: volume >= 0 ? volume : 0,
    });
  }
  const by = new Map<number, SwapCandle>();
  for (const c of raw) by.set(c.time, c);
  const ordered = [...by.values()].sort((a, b) => a.time - b.time);
  if (needsInvert(json?.meta, tokenA)) return ordered.map(invertCandle);
  return ordered;
}

async function geckoOhlcvJson(url: string): Promise<GeckoOhlcvJson | null> {
  return geckoEnqueue(async () => {
    for (let i = 0; i < 3; i++) {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 15000);
      try {
        const res = await outboundFetch(url, { signal: ac.signal, headers: { accept: "application/json" } });
        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
          continue;
        }
        if (!res.ok) return null;
        return (await res.json()) as GeckoOhlcvJson;
      } catch {
        return null;
      } finally {
        clearTimeout(t);
      }
    }
    return null;
  });
}

export async function fetchPoolOhlcv(chainId: number, pool: string, tokenA: string): Promise<SwapCandle[]> {
  const network = geckoNetworkOf(chainId);
  if (!network || !pool || !tokenA) return [];
  const id = geckoPoolId(pool);
  return cacheGet(
    {
      key: ohlcvCacheKey(chainId, id),
      policy: { ...POLICIES.swaps, ttlMs: 60_000, keep: (rows: SwapCandle[]) => rows.length > 0 },
    },
    async () => {
      const url = `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${encodeURIComponent(id)}/ohlcv/minute?aggregate=15&limit=${OHLCV_LIMIT}&currency=token`;
      const json = await geckoOhlcvJson(url);
      return parseOhlcv(json, tokenA);
    },
  );
}

export function seedPoolOhlcv(chainId: number | undefined, pool: string | undefined): SwapCandle[] {
  if (!chainId || !pool) return [];
  return cacheLastGood<SwapCandle[]>(ohlcvCacheKey(chainId, geckoPoolId(pool))) ?? [];
}

export function usePoolOhlcv(chainId: number | undefined, venues: VenuePool[], tokenA: string) {
  const [candles, setCandles] = useState<SwapCandle[]>([]);
  const [loading, setLoading] = useState(false);
  const deep = deepestPool(venues);
  const pool = deep?.pool ?? "";
  const network = geckoNetworkOf(chainId);
  const venuesRef = useRef(venues);
  venuesRef.current = venues;

  useEffect(() => {
    if (!chainId || !network || !pool || !tokenA) {
      setCandles([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const seeded = seedPoolOhlcv(chainId, pool);
    if (seeded.length) {
      setCandles(seeded);
      setLoading(false);
    } else {
      setLoading(true);
    }
    const run = () => {
      const v = deepestPool(venuesRef.current);
      return fetchPoolOhlcv(chainId, v?.pool ?? pool, tokenA);
    };
    const job = trackLive(`ohlcv:${chainId}`, chainId, "trades", run);
    void job
      .then((rows) => {
        if (cancelled) return;
        if (rows.length) setCandles(rows);
      })
      .catch(() => {
        if (!cancelled && !seeded.length) setCandles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const stop = onVisibleInterval(60_000, () => {
      if (cancelled) return;
      void trackLive(`ohlcv:${chainId}`, chainId, "trades", run)
        .then((rows) => {
          if (cancelled) return;
          if (rows.length) setCandles(rows);
        })
        .catch(() => undefined);
    });
    return () => {
      cancelled = true;
      stop();
      cancelLive(`ohlcv:${chainId}`);
    };
  }, [chainId, network, pool, tokenA]);

  return { candles, loading };
}
