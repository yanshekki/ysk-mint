import { pairId } from "../../pairKey.ts";
import { cacheGet, cacheHash, cacheKey, POLICIES } from "../cache.ts";
import type { DefiProtocol, MarketRow, VenueQuote } from "../types.ts";

const PAGE = 20;
const PAGE_CAP = 80;

type GeckoPool = {
  attributes?: {
    address?: string;
    name?: string;
    reserve_in_usd?: string;
    base_token_price_quote_token?: string;
    base_token_price_usd?: string;
  };
  relationships?: {
    base_token?: { data?: { id?: string } };
    quote_token?: { data?: { id?: string } };
  };
};

type GeckoToken = {
  id?: string;
  type?: string;
  attributes?: { address?: string; symbol?: string; decimals?: number };
};

export type GeckoDexSpec = {
  network: string;
  dex: string;
  chainId: number;
  chainShort: string;
  protocolId: string;
  protocolName: string;
  feeLabel: string;
  pages?: number;
};

function num(x: unknown): number {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : 0;
}

function isUsd(symbol: string, addr: string) {
  const s = symbol.toUpperCase().replace(/₮/g, "T");
  if (/^(W?USDC|W?USDT|DAI|USDS|USDE|USD1|USDC\.E|USDT\.E)$/.test(s)) return true;
  const a = addr.toLowerCase();
  return a.includes("::usdc::") || a.includes("::usdt::");
}

function iconOf(symbol: string, chainShort: string) {
  const s = symbol.toLowerCase();
  if (s.includes("btc")) return "/tokens/wbtc.png";
  if (s.includes("eth")) return "/tokens/eth.png";
  if (s.includes("sui")) return "/tokens/sui.png";
  if (s.includes("apt")) return "/tokens/apt.png";
  if (s.includes("usd") || s === "dai") return "/tokens/usdc.png";
  return chainShort === "APT" ? "/tokens/apt.png" : "/tokens/sui.png";
}

let geckoQ: Promise<void> = Promise.resolve();

function geckoEnqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = geckoQ.then(fn, fn);
  geckoQ = run.then(
    () => new Promise<void>((r) => setTimeout(r, 350)),
    () => new Promise<void>((r) => setTimeout(r, 350)),
  );
  return run;
}

async function fetchJson<T>(url: string, ms: number): Promise<T | null> {
  for (let i = 0; i < 3; i++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    try {
      const res = await fetch(url, { signal: ac.signal, headers: { accept: "application/json" } });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
        continue;
      }
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  }
  return null;
}

async function getJson<T>(url: string, ms = 15000): Promise<T | null> {
  return cacheGet(
    {
      key: cacheKey("http.gecko", 0, cacheHash(url)),
      policy: { ...POLICIES.catalog, keep: (v: T | null) => v != null },
    },
    () => geckoEnqueue(() => fetchJson<T>(url, ms)),
  );
}

function tokenOf(included: Map<string, GeckoToken>, id: string | undefined, fallbackSym: string): { addr: string; symbol: string } | null {
  if (!id) return null;
  const tok = included.get(id);
  const addr = tok?.attributes?.address || id.replace(/^[^_]+_/, "");
  const symbol = tok?.attributes?.symbol || fallbackSym || "TKN";
  if (!addr) return null;
  return { addr, symbol };
}

function parseName(name: string): [string, string] {
  const [a, b] = name.split("/").map((s) => s.trim());
  return [a || "TKN", b || "TKN"];
}

export async function geckoDexMarkets(spec: GeckoDexSpec): Promise<MarketRow[]> {
  const pages = spec.pages ?? 1;
  const included = new Map<string, GeckoToken>();
  const pools: GeckoPool[] = [];
  for (let page = 1; page <= pages && pools.length < PAGE_CAP; page++) {
    const json = await getJson<{ data?: GeckoPool[]; included?: GeckoToken[] }>(
      `https://api.geckoterminal.com/api/v2/networks/${spec.network}/dexes/${spec.dex}/pools?page=${page}&include=base_token,quote_token`,
    );
    for (const t of json?.included ?? []) {
      if (t.id && t.type === "token") included.set(t.id, t);
    }
    const list = json?.data ?? [];
    pools.push(...list);
    if (list.length < PAGE) break;
  }
  const byPair = new Map<string, MarketRow>();
  for (const p of pools) {
    const attr = p.attributes ?? {};
    const tvl = num(attr.reserve_in_usd);
    if (!(tvl >= 1000)) continue;
    const pool = String(attr.address ?? "");
    const [nameA, nameB] = parseName(String(attr.name ?? ""));
    const base = tokenOf(included, p.relationships?.base_token?.data?.id, nameA);
    const quote = tokenOf(included, p.relationships?.quote_token?.data?.id, nameB);
    if (!pool || !base || !quote || base.addr.toLowerCase() === quote.addr.toLowerCase()) continue;
    let mintA = base.addr;
    let mintB = quote.addr;
    let symbolA = base.symbol;
    let symbolB = quote.symbol;
    let price = num(attr.base_token_price_quote_token);
    if (isUsd(symbolA, mintA) && !isUsd(symbolB, mintB)) {
      [mintA, mintB] = [mintB, mintA];
      [symbolA, symbolB] = [symbolB, symbolA];
      price = price ? 1 / price : 0;
    }
    if (isUsd(symbolB, mintB) && !price) price = num(attr.base_token_price_usd) || num(attr.base_token_price_quote_token);
    const venue: VenueQuote = {
      protocolId: spec.protocolId,
      protocolName: spec.protocolName,
      chainId: spec.chainId,
      pool,
      feeLabel: spec.feeLabel,
      priceAinB: Number.isFinite(price) ? price : 0,
      reserveA: 0,
      reserveB: 0,
      tvlQuote: tvl,
      kind: "jup",
    };
    const id = pairId(spec.chainId, mintA, mintB);
    const prev = byPair.get(id);
    if (prev) {
      prev.venues.push(venue);
      prev.depth += tvl;
      if (!prev.venueNames.includes(spec.protocolName)) prev.venueNames.push(spec.protocolName);
      continue;
    }
    byPair.set(id, {
      pairId: id,
      chainId: spec.chainId,
      chainShort: spec.chainShort,
      symbolA: symbolA || "TKN",
      symbolB: symbolB || "TKN",
      iconA: iconOf(symbolA, spec.chainShort),
      iconB: iconOf(symbolB, spec.chainShort),
      tokenA: mintA,
      tokenB: mintB,
      venues: [venue],
      price: Number.isFinite(price) && price > 0 ? price : null,
      depth: tvl,
      venueNames: [spec.protocolName],
    });
  }
  return [...byPair.values()];
}

export function mergeMarketRows(parts: MarketRow[][]): MarketRow[] {
  const by = new Map<string, MarketRow>();
  for (const rows of parts) {
    for (const r of rows) {
      const prev = by.get(r.pairId);
      if (!prev) {
        by.set(r.pairId, { ...r, venues: [...r.venues], venueNames: [...r.venueNames] });
        continue;
      }
      prev.venues.push(...r.venues);
      prev.depth += r.depth;
      for (const n of r.venueNames) if (!prev.venueNames.includes(n)) prev.venueNames.push(n);
    }
  }
  return [...by.values()].sort((a, b) => b.depth - a.depth);
}

export function makeGeckoProtocol(p: { id: string; name: string; chainId: number; specs: GeckoDexSpec[] }): DefiProtocol {
  return {
    id: p.id,
    name: p.name,
    chainId: p.chainId,
    caps: ["markets"],
    async markets() {
      const parts: MarketRow[][] = [];
      for (const spec of p.specs) parts.push(await geckoDexMarkets(spec).catch(() => []));
      return mergeMarketRows(parts);
    },
  };
}
