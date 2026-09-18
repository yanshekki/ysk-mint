import { cacheGet, cacheInvalidate, cacheKey, POLICIES } from "../defi/cache.ts";
import { geckoEnqueue } from "../defi/http/geckoDex.ts";
import { outboundFetch } from "../outbound.ts";
import type { ScaleAsset } from "./assets.ts";

export type CapMode = "circ" | "fdv";

export type ScaleMetrics = {
  price: number | null;
  cap: number | null;
  fdv: number | null;
  reserveUsd: number | null;
  thin: boolean;
};

export type ScaleResult = {
  implied: number | null;
  multiple: number | null;
  share: number | null;
  bag: number | null;
};

const THIN_USD = 1_000;
const nativePolicy = { ...POLICIES.catalog, keep: (m: Map<string, { usd: number; cap: number }>) => m.size > 0 };
const tokenPolicy = { ...POLICIES.catalog, keep: (m: ScaleMetrics) => m.price != null || m.cap != null || m.fdv != null };

function num(x: unknown): number | null {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function fetchJson(url: string, ms = 12000): Promise<unknown> {
  for (let i = 0; i < 3; i++) {
    const ac = new AbortController();
    const t = globalThis.setTimeout(() => ac.abort(), ms);
    try {
      const res = await outboundFetch(url, { signal: ac.signal, headers: { accept: "application/json" } });
      if (res.status === 429) {
        await new Promise((r) => globalThis.setTimeout(r, 1200 * (i + 1)));
        continue;
      }
      if (!res.ok) return null;
      return await res.json();
    } catch {
      if (i === 2) return null;
    } finally {
      globalThis.clearTimeout(t);
    }
  }
  return null;
}

/** Native circulating caps. Wrapped GT caps are the wrapper, not BTC/ETH/SOL. */
export async function fetchNativeCaps(ids: string[]): Promise<Map<string, { usd: number; cap: number }>> {
  const list = [...new Set(ids.filter(Boolean))].sort();
  if (!list.length) return new Map();
  return cacheGet({ key: cacheKey("http.cg", 0, list.join(",")), policy: nativePolicy }, async () => {
    const json = (await fetchJson(
      `https://api.coingecko.com/api/v3/simple/price?ids=${list.join(",")}&vs_currencies=usd&include_market_cap=true`,
    )) as Record<string, { usd?: unknown; usd_market_cap?: unknown }> | null;
    const out = new Map<string, { usd: number; cap: number }>();
    if (!json || typeof json !== "object") throw new Error("cg miss");
    for (const id of list) {
      const row = json[id];
      const usd = num(row?.usd);
      const cap = num(row?.usd_market_cap);
      if (usd && cap) out.set(id, { usd, cap });
    }
    if (!out.size) throw new Error("cg empty");
    return out;
  });
}

async function fetchGtToken(network: string, address: string): Promise<ScaleMetrics> {
  const empty: ScaleMetrics = { price: null, cap: null, fdv: null, reserveUsd: null, thin: false };
  return cacheGet({ key: cacheKey("http.gecko", 0, `tok:${network}:${address}`), policy: tokenPolicy }, async () => {
    const json = await geckoEnqueue(() =>
      fetchJson(`https://api.geckoterminal.com/api/v2/networks/${encodeURIComponent(network)}/tokens/${encodeURIComponent(address)}`),
    );
    const attr =
      json && typeof json === "object" && "data" in json
        ? ((json as { data?: { attributes?: Record<string, unknown> } }).data?.attributes ?? {})
        : {};
    const price = num(attr.price_usd);
    const cap = num(attr.market_cap_usd);
    const fdv = num(attr.fdv_usd);
    const reserveUsd = num(attr.total_reserve_in_usd);
    return {
      price,
      cap,
      fdv,
      reserveUsd,
      thin: reserveUsd != null && reserveUsd < THIN_USD,
    };
  }).catch(() => empty);
}

export async function loadScaleMetrics(asset: ScaleAsset): Promise<ScaleMetrics> {
  const many = await loadScaleMany([asset]);
  return many[asset.id] ?? { price: null, cap: null, fdv: null, reserveUsd: null, thin: false };
}

export async function loadScaleMany(assets: ScaleAsset[]): Promise<Record<string, ScaleMetrics>> {
  const out: Record<string, ScaleMetrics> = {};
  const geckoIds = [...new Set(assets.map((a) => a.geckoId).filter(Boolean) as string[])];
  const native = geckoIds.length ? await fetchNativeCaps(geckoIds).catch(() => new Map()) : new Map();
  const rest = assets.filter((a) => !(a.geckoId && native.get(a.geckoId)));
  const gt = await Promise.all(
    rest
      .filter((a) => a.geckoNetwork && a.address)
      .map(async (a) => [a.id, await fetchGtToken(a.geckoNetwork!, a.address!)] as const),
  );
  const gtMap = new Map(gt);
  for (const a of assets) {
    if (a.geckoId) {
      const hit = native.get(a.geckoId);
      if (hit) {
        out[a.id] = { price: hit.usd, cap: hit.cap, fdv: hit.cap, reserveUsd: null, thin: false };
        continue;
      }
    }
    const g = gtMap.get(a.id);
    if (g) out[a.id] = g;
  }
  return out;
}

export function capOf(m: ScaleMetrics | undefined, mode: CapMode): number | null {
  if (!m) return null;
  if (mode === "fdv") return m.fdv ?? m.cap;
  return m.cap;
}

export function scaleResult(a: ScaleMetrics | undefined, b: ScaleMetrics | undefined, mode: CapMode, amount: number | null): ScaleResult {
  const capA = capOf(a, mode);
  const capB = capOf(b, mode);
  const unitA = a?.price ?? null;
  const circA = capA && unitA ? capA / unitA : null;
  const implied = capB && circA ? capB / circA : capB && capA && unitA ? (capB / capA) * unitA : null;
  const multiple = implied && unitA ? implied / unitA : capB && capA ? capB / capA : null;
  const share = capA && capB ? capA / capB : null;
  const bag = implied && amount && amount > 0 ? implied * amount : null;
  return {
    implied: implied && implied > 0 ? implied : null,
    multiple: multiple && multiple > 0 ? multiple : null,
    share: share && share > 0 ? share : null,
    bag: bag && bag > 0 ? bag : null,
  };
}

export function parseAmount(raw: string): number | null {
  const n = Number(String(raw).trim().replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Drop circulating-cap cache. Does not touch holdings or market pools. */
export function invalidateScaleQuotes() {
  cacheInvalidate("v1:http.cg");
  cacheInvalidate("v1:http.gecko:0:tok:");
}
