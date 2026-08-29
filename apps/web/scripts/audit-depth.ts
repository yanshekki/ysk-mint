import { appendFileSync } from "node:fs";
import { featuredChains } from "@ysk-mint/config";
import { loadEvmMarkets } from "../src/lib/defi/markets.ts";
import { ensureProtocols } from "../src/lib/defi/protocols.ts";
import { protocolsOn } from "../src/lib/defi/registry.ts";
import { quoteAmountUsd } from "../src/lib/defi/quote.ts";
import type { MarketRow as DefiMarket, VenueQuote } from "../src/lib/defi/types.ts";
import { mergeOriented, quoteRank } from "../src/lib/pairOrient.ts";

const LOG = "/home/ki/文件/ysk-mint/.cursor/debug-05e1c5.log";
const NATIVE = new Set([101, 397, 1815, 784, 607, 637]);

type Row = {
  pairId: string;
  chainId: number;
  chainShort: string;
  symbolA: string;
  symbolB: string;
  tokenA: string;
  tokenB: string;
  venues: Array<{ tvlQuote: number; reserveA: number; reserveB: number; priceAinB: number; pool?: string; protocolId?: string }>;
  price: number | null;
  depth: number;
  venueNames: string[];
};

function emit(hypothesisId: string, location: string, message: string, data: Record<string, unknown>) {
  const payload = {
    sessionId: "05e1c5",
    runId: "post-fix",
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  appendFileSync(LOG, `${JSON.stringify(payload)}\n`);
  void fetch("http://127.0.0.1:7877/ingest/5e2e6afe-2618-4b13-996a-8c6b0be88e05", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "05e1c5" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

function asRow(r: DefiMarket): Row {
  return {
    ...r,
    venues: r.venues.map((q: VenueQuote) => ({
      tvlQuote: q.tvlQuote,
      reserveA: q.reserveA,
      reserveB: q.reserveB,
      priceAinB: q.priceAinB,
      pool: q.pool,
      protocolId: q.protocolId,
    })),
  };
}

function closeNum(a: number, b: number) {
  const m = Math.max(Math.abs(a), Math.abs(b));
  return m > 0 && Math.abs(a - b) / m < 0.2;
}

function audit(stage: string, hypothesisId: string, rows: Row[], extra?: Record<string, unknown>) {
  const chains: Record<string, { n: number; zero: number; quoteAsUsd: number; indexedUsd: number; insane: number; diverge: number; maxDepth: number; top: string }> = {};
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
  emit(hypothesisId, `audit-depth.ts:${stage}`, "market-audit", {
    stage,
    n: rows.length,
    chains,
    outliers: outliers.slice(0, 20),
    ...(extra ?? {}),
  });
}

function mergeDelta(before: Row[], after: Row[]) {
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

async function withTimeout<T>(ms: number, fn: () => Promise<T>, fallback: T): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((resolve) => {
        t = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (t) clearTimeout(t);
  }
}

async function loadNative(chainId: number): Promise<DefiMarket[]> {
  const parts = await Promise.all(protocolsOn(chainId).map((p) => (p.markets ? p.markets({}).catch(() => []) : Promise.resolve([]))));
  return parts.flat();
}

async function loadEvm(chainId: number): Promise<DefiMarket[]> {
  const rows = await loadEvmMarkets(chainId).catch(() => [] as DefiMarket[]);
  const extra = await Promise.all(
    protocolsOn(chainId).map((p) => (p.markets ? p.markets({}).catch(() => [] as DefiMarket[]) : Promise.resolve([] as DefiMarket[]))),
  );
  return [...rows, ...extra.flat()];
}

async function one(chainId: number, native: boolean) {
  const short = featuredChains().find((c) => c.chainId === chainId)?.short ?? String(chainId);
  emit(native ? "C" : "A", "audit-depth.ts:start", "chain-start", { chainId, short, native });
  const raw = await withTimeout(native ? 90_000 : 120_000, () => (native ? loadNative(chainId) : loadEvm(chainId)), []);
  const before = raw.map(asRow);
  const after = mergeOriented(before) as Row[];
  audit(native ? `loadNative:${chainId}` : `loadEvm:${chainId}`, native ? "C" : "A", after, {
    chainId,
    short,
    rawN: before.length,
    ...mergeDelta(before, after),
  });
}

async function main() {
  ensureProtocols();
  const ids = featuredChains()
    .filter((c) => !c.testnet && protocolsOn(c.chainId).length > 0)
    .map((c) => c.chainId);
  emit("E", "audit-depth.ts:main", "protocol-ids", {
    ids,
    native: ids.filter((id) => NATIVE.has(id)),
    evm: ids.filter((id) => !NATIVE.has(id)),
  });
  for (const id of ids.filter((id) => NATIVE.has(id))) {
    await one(id, true);
  }
  const evmFirst = [1, 8453, 56, 999, 146, 80094, 42161, 43114];
  const evmRest = ids.filter((id) => !NATIVE.has(id) && !evmFirst.includes(id));
  emit("E", "audit-depth.ts:main", "evm-rest-deferred", { evmRest });
  for (const id of [1, 8453]) {
    if (!ids.includes(id)) continue;
    await one(id, false);
  }
  emit("E", "audit-depth.ts:main", "done", { ok: true });
}

main().catch((e) => {
  emit("E", "audit-depth.ts:main", "fatal", { err: String(e) });
  process.exit(1);
});
