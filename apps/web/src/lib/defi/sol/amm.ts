import { pairId } from "../../pairKey.ts";
import type { DefiProtocol, MarketRow, VenueQuote } from "../types.ts";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const PAGE_CAP = 300;

type Row = {
  pool: string;
  mintA: string;
  mintB: string;
  symbolA: string;
  symbolB: string;
  decimalsA: number;
  decimalsB: number;
  reserveA: number;
  reserveB: number;
  price: number;
  tvl: number;
  feeLabel: string;
};

function iconOf(symbol: string) {
  const s = symbol.toLowerCase();
  if (s.includes("sol")) return "/tokens/sol.png";
  if (s.includes("btc")) return "/tokens/wbtc.png";
  if (s.includes("eth")) return "/tokens/eth.png";
  if (s.includes("usd") || s === "usdt" || s === "usdc") return "/tokens/usdc.png";
  return "/tokens/sol.png";
}

function isUsd(mint: string, symbol: string) {
  const m = mint.toLowerCase();
  const s = symbol.toUpperCase();
  return m === USDC.toLowerCase() || m === USDT.toLowerCase() || s === "USDC" || s === "USDT";
}

function keep(row: Row) {
  if (!(row.tvl > 0) || !row.mintA || !row.mintB || row.mintA === row.mintB) return false;
  return true;
}

function venue(protocolId: string, name: string, row: Row): VenueQuote {
  const priceAinB = isUsd(row.mintB, row.symbolB) ? row.price : isUsd(row.mintA, row.symbolA) && row.price ? 1 / row.price : row.price;
  return {
    protocolId,
    protocolName: name,
    chainId: 101,
    pool: row.pool,
    feeLabel: row.feeLabel,
    priceAinB: Number.isFinite(priceAinB) ? priceAinB : 0,
    reserveA: row.reserveA,
    reserveB: row.reserveB,
    tvlQuote: row.tvl,
    kind: "jup",
  };
}

function toMarkets(protocolId: string, name: string, rows: Row[]): MarketRow[] {
  const picked = rows.filter(keep).sort((a, b) => b.tvl - a.tvl).slice(0, PAGE_CAP);
  const byPair = new Map<string, MarketRow>();
  for (const r of picked) {
    const id = pairId(101, r.mintA, r.mintB);
    const v = venue(protocolId, name, r);
    const prev = byPair.get(id);
    if (prev) {
      prev.venues.push(v);
      prev.depth += r.tvl;
      if (!prev.venueNames.includes(name)) prev.venueNames.push(name);
      continue;
    }
    byPair.set(id, {
      pairId: id,
      chainId: 101,
      chainShort: "SOL",
      symbolA: r.symbolA || "TKN",
      symbolB: r.symbolB || "TKN",
      iconA: iconOf(r.symbolA),
      iconB: iconOf(r.symbolB),
      tokenA: r.mintA,
      tokenB: r.mintB,
      venues: [v],
      price: isUsd(r.mintB, r.symbolB) ? r.price : isUsd(r.mintA, r.symbolA) ? 1 : r.price,
      depth: r.tvl,
      venueNames: [name],
    });
  }
  return [...byPair.values()];
}

async function getJson<T>(url: string, ms = 15000): Promise<T | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function num(x: unknown): number {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : 0;
}

function feePct(rate: number) {
  if (!Number.isFinite(rate) || rate <= 0) return "dyn";
  const pct = rate > 1 ? rate / 10000 : rate * 100;
  return `${pct.toFixed(pct >= 1 ? 2 : 3).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

export const raydiumProtocol: DefiProtocol = {
  id: "raydium-101",
  name: "Raydium",
  chainId: 101,
  caps: ["markets"],
  async markets() {
    const rows: Row[] = [];
    const seen = new Set<string>();
    for (let page = 1; page <= 6 && rows.length < PAGE_CAP; page++) {
      const json = await getJson<{ data?: { data?: Array<Record<string, unknown>> } }>(
        `https://api-v3.raydium.io/pools/info/list?poolType=all&poolSortField=liquidity&sortType=desc&pageSize=50&page=${page}`,
      );
      const list = json?.data?.data ?? [];
      let added = 0;
      for (const p of list) {
        const a = p.mintA as { address?: string; symbol?: string; decimals?: number } | undefined;
        const b = p.mintB as { address?: string; symbol?: string; decimals?: number } | undefined;
        const pool = String(p.id ?? "");
        if (!a?.address || !b?.address || !pool || seen.has(pool)) continue;
        seen.add(pool);
        added += 1;
        rows.push({
          pool,
          mintA: a.address,
          mintB: b.address,
          symbolA: a.symbol || "TKN",
          symbolB: b.symbol || "TKN",
          decimalsA: a.decimals ?? 9,
          decimalsB: b.decimals ?? 6,
          reserveA: num(p.mintAmountA),
          reserveB: num(p.mintAmountB),
          price: num(p.price),
          tvl: num(p.tvl),
          feeLabel: feePct(num(p.feeRate)),
        });
      }
      if (!added || list.length < 50) break;
    }
    return toMarkets("raydium-101", "Raydium", rows);
  },
};

export const orcaProtocol: DefiProtocol = {
  id: "orca-101",
  name: "Orca",
  chainId: 101,
  caps: ["markets"],
  async markets() {
    const rows: Row[] = [];
    const seen = new Set<string>();
    let next: string | undefined;
    for (let page = 0; page < 6 && rows.length < PAGE_CAP; page++) {
      const qs = new URLSearchParams({ sortBy: "tvl", sortDirection: "desc", size: "50" });
      if (next) qs.set("next", next);
      const json = await getJson<{ data?: Array<Record<string, unknown>>; meta?: { next?: string | null } }>(
        `https://api.orca.so/v2/solana/pools?${qs.toString()}`,
      );
      const list = json?.data ?? [];
      let added = 0;
      for (const p of list) {
        const a = (p.tokenA as { address?: string; mint?: string; symbol?: string; decimals?: number } | undefined) ?? {};
        const b = (p.tokenB as { address?: string; mint?: string; symbol?: string; decimals?: number } | undefined) ?? {};
        const mintA = a.address || a.mint || String(p.tokenMintA ?? "");
        const mintB = b.address || b.mint || String(p.tokenMintB ?? "");
        const pool = String(p.address ?? "");
        if (!mintA || !mintB || !pool || seen.has(pool)) continue;
        seen.add(pool);
        added += 1;
        rows.push({
          pool,
          mintA,
          mintB,
          symbolA: a.symbol || "TKN",
          symbolB: b.symbol || "TKN",
          decimalsA: a.decimals ?? 9,
          decimalsB: b.decimals ?? 6,
          reserveA: num(p.tokenBalanceA),
          reserveB: num(p.tokenBalanceB),
          price: num(p.price),
          tvl: num(p.tvlUsdc ?? p.tvl),
          feeLabel: feePct(num(p.feeRate) / 1e6),
        });
      }
      next = json?.meta?.next || undefined;
      if (!added || !next) break;
    }
    return toMarkets("orca-101", "Orca", rows);
  },
};

export const meteoraProtocol: DefiProtocol = {
  id: "meteora-101",
  name: "Meteora",
  chainId: 101,
  caps: ["markets"],
  async markets() {
    const rows: Row[] = [];
    const seen = new Set<string>();
    for (let page = 1; page <= 6 && rows.length < PAGE_CAP; page++) {
      const json = await getJson<{ data?: Array<Record<string, unknown>> }>(
        `https://dlmm.datapi.meteora.ag/pools?page=${page}&page_size=50&sort_by=tvl:desc`,
      );
      const list = json?.data ?? [];
      let added = 0;
      for (const p of list) {
        const x = p.token_x as { address?: string; symbol?: string; decimals?: number } | undefined;
        const y = p.token_y as { address?: string; symbol?: string; decimals?: number } | undefined;
        const pool = String(p.address ?? "");
        if (!x?.address || !y?.address || !pool || seen.has(pool)) continue;
        seen.add(pool);
        added += 1;
        rows.push({
          pool,
          mintA: x.address,
          mintB: y.address,
          symbolA: x.symbol || "TKN",
          symbolB: y.symbol || "TKN",
          decimalsA: x.decimals ?? 6,
          decimalsB: y.decimals ?? 6,
          reserveA: num(p.token_x_amount),
          reserveB: num(p.token_y_amount),
          price: num(p.current_price),
          tvl: num(p.tvl),
          feeLabel: "DLMM",
        });
      }
      if (!added || list.length < 50) break;
    }
    return toMarkets("meteora-101", "Meteora", rows);
  },
};
