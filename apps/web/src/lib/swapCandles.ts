import type { SwapRow } from "./usePairSwaps.ts";

export type SwapCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export function pickCandleBucket(rows: SwapRow[]): number {
  const times = rows.map((r) => r.ts).filter((n): n is number => Boolean(n && n > 0));
  if (times.length < 2) return 60;
  const span = Math.max(...times) - Math.min(...times);
  if (span <= 45 * 60) return 60;
  if (span <= 4 * 3600) return 300;
  return 900;
}

export function swapsToCandles(rows: SwapRow[], bucketSec?: number): SwapCandle[] {
  const ticks = rows
    .filter((r) => r.ts && r.ts > 0 && r.price != null && r.price > 0)
    .map((r) => ({ ts: r.ts!, price: r.price!, vol: r.amountA > 0 ? r.amountA : r.amountB }))
    .sort((a, b) => a.ts - b.ts);
  if (!ticks.length) return [];
  const bucket = bucketSec && bucketSec > 0 ? bucketSec : pickCandleBucket(rows);
  const by = new Map<number, SwapCandle>();
  for (const t of ticks) {
    const time = Math.floor(t.ts / bucket) * bucket;
    const prev = by.get(time);
    if (!prev) {
      by.set(time, { time, open: t.price, high: t.price, low: t.price, close: t.price, volume: t.vol });
      continue;
    }
    prev.high = Math.max(prev.high, t.price);
    prev.low = Math.min(prev.low, t.price);
    prev.close = t.price;
    prev.volume += t.vol;
  }
  return [...by.values()].sort((a, b) => a.time - b.time);
}
