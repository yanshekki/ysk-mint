import { pairId } from "../../pairKey.ts";
import type { DefiProtocol, MarketRow, VenueQuote } from "../types.ts";

const SUI = "0x0000000000000000000000000000000000000000000000000000000000000002::sui::sui";
const MIN_TVL = 50_000;
const MAX_ROWS = 24;

type Row = {
  pool: string;
  mintA: string;
  mintB: string;
  symbolA: string;
  symbolB: string;
  reserveA: number;
  reserveB: number;
  price: number;
  tvl: number;
  feeLabel: string;
};

function iconOf(symbol: string) {
  const s = symbol.toLowerCase();
  if (s.includes("sui")) return "/tokens/sui.png";
  if (s.includes("btc")) return "/tokens/wbtc.png";
  if (s.includes("eth")) return "/tokens/eth.png";
  if (s.includes("usd") || s === "usdt" || s === "usdc") return "/tokens/usdc.png";
  return "/tokens/sui.png";
}

function num(x: unknown): number {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : 0;
}

function isSui(mint: string) {
  const m = mint.toLowerCase();
  return m === SUI || m.endsWith("::sui::sui");
}

function isUsd(mint: string, symbol: string) {
  const m = mint.toLowerCase();
  const s = symbol.toUpperCase();
  if (s === "USDC" || s === "USDT" || s === "USD" || s === "USDE" || s === "USD1") return true;
  return m.includes("::usdc::") || m.includes("::usdt::");
}

function keep(row: Row) {
  if (!(row.tvl >= MIN_TVL) || !row.mintA || !row.mintB || row.mintA === row.mintB) return false;
  return isSui(row.mintA) || isSui(row.mintB) || isUsd(row.mintA, row.symbolA) || isUsd(row.mintB, row.symbolB);
}

function feeLabel(fee: unknown) {
  const s = String(fee ?? "").trim();
  if (!s) return "dyn";
  return s.endsWith("%") ? s : `${s}%`;
}

function venue(row: Row): VenueQuote {
  const priceAinB = isUsd(row.mintB, row.symbolB)
    ? row.price
    : isUsd(row.mintA, row.symbolA) && row.price
      ? 1 / row.price
      : row.price;
  return {
    protocolId: "cetus-784",
    protocolName: "Cetus",
    chainId: 784,
    pool: row.pool,
    feeLabel: row.feeLabel,
    priceAinB: Number.isFinite(priceAinB) ? priceAinB : 0,
    reserveA: row.reserveA,
    reserveB: row.reserveB,
    tvlQuote: row.tvl,
    kind: "jup",
  };
}

function toMarkets(rows: Row[]): MarketRow[] {
  const picked = rows.filter(keep).sort((a, b) => b.tvl - a.tvl).slice(0, MAX_ROWS);
  const byPair = new Map<string, MarketRow>();
  for (const r of picked) {
    const id = pairId(784, r.mintA, r.mintB);
    const v = venue(r);
    const prev = byPair.get(id);
    if (prev) {
      prev.venues.push(v);
      prev.depth += r.tvl;
      if (!prev.venueNames.includes("Cetus")) prev.venueNames.push("Cetus");
      continue;
    }
    byPair.set(id, {
      pairId: id,
      chainId: 784,
      chainShort: "SUI",
      symbolA: r.symbolA || "TKN",
      symbolB: r.symbolB || "TKN",
      iconA: iconOf(r.symbolA),
      iconB: iconOf(r.symbolB),
      tokenA: r.mintA,
      tokenB: r.mintB,
      venues: [v],
      price: isUsd(r.mintB, r.symbolB) ? r.price : isUsd(r.mintA, r.symbolA) ? 1 : r.price,
      depth: r.tvl,
      venueNames: ["Cetus"],
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

type Coin = { name?: string; symbol?: string; decimals?: number; address?: string; balance?: unknown };

function asRow(p: Record<string, unknown>): Row | null {
  if (p.is_closed === true) return null;
  const a = (p.coin_a as Coin | undefined) ?? {};
  const b = (p.coin_b as Coin | undefined) ?? {};
  const mintA = a.address || String(p.coin_a_address ?? "");
  const mintB = b.address || String(p.coin_b_address ?? "");
  const pool = String(p.address ?? "");
  if (!mintA || !mintB || !pool) return null;
  let row: Row = {
    pool,
    mintA,
    mintB,
    symbolA: a.symbol || "TKN",
    symbolB: b.symbol || "TKN",
    reserveA: num(a.balance),
    reserveB: num(b.balance),
    price: num(p.price),
    tvl: num(p.pure_tvl_in_usd ?? p.tvl),
    feeLabel: feeLabel(p.fee),
  };
  if (isUsd(row.mintA, row.symbolA) && !isUsd(row.mintB, row.symbolB)) {
    row = {
      ...row,
      mintA: row.mintB,
      mintB: row.mintA,
      symbolA: row.symbolB,
      symbolB: row.symbolA,
      reserveA: row.reserveB,
      reserveB: row.reserveA,
      price: row.price ? 1 / row.price : 0,
    };
  }
  return row;
}

export const cetusProtocol: DefiProtocol = {
  id: "cetus-784",
  name: "Cetus",
  chainId: 784,
  caps: ["markets"],
  async markets() {
    const json = await getJson<{ data?: { lp_list?: Array<Record<string, unknown>> } }>(
      "https://api-sui.cetus.zone/v2/sui/stats_pools?limit=80",
    );
    const list = json?.data?.lp_list ?? [];
    const rows: Row[] = [];
    for (const p of list) {
      const row = asRow(p);
      if (row) rows.push(row);
    }
    return toMarkets(rows);
  },
};
