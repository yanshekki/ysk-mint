import type { DefiProtocol, MarketRow, VenueQuote } from "../types.ts";

const TON_NATIVE = "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c";
const PAGE_CAP = 300;

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

type PoolJson = {
  address?: string;
  token0_address?: string;
  token1_address?: string;
  reserve0?: string;
  reserve1?: string;
  lp_total_supply_usd?: string;
  lp_fee?: string | number;
  protocol_fee?: string | number;
  deprecated?: boolean;
};

type AssetJson = {
  contract_address?: string;
  symbol?: string;
  decimals?: number;
  kind?: string;
};

function num(x: unknown): number {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : 0;
}

function isUsd(symbol: string) {
  const s = symbol.toUpperCase();
  return s === "USDC" || s === "USDT" || s === "USD" || s === "USDE" || s === "USD1" || s === "USD₮";
}

function keep(row: Row) {
  if (!(row.tvl > 0) || !row.mintA || !row.mintB || row.mintA === row.mintB) return false;
  return true;
}

function iconOf(symbol: string) {
  const s = symbol.toLowerCase();
  if (s.includes("ton")) return "/tokens/ton.png";
  if (s.includes("btc")) return "/tokens/wbtc.png";
  if (s.includes("eth")) return "/tokens/eth.png";
  if (s.includes("usd")) return "/tokens/usdc.png";
  return "/tokens/ton.png";
}

function pairKey(a: string, b: string) {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x < y ? `607:${x}|${y}` : `607:${y}|${x}`;
}

function feeLabel(lp: unknown, proto: unknown) {
  const n = num(lp) + num(proto);
  if (!(n > 0)) return "dyn";
  const pct = n / 10;
  return `${pct.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

function venue(row: Row): VenueQuote {
  const priceAinB = isUsd(row.symbolB)
    ? row.price
    : isUsd(row.symbolA) && row.price
      ? 1 / row.price
      : row.price;
  return {
    protocolId: "stonfi-607",
    protocolName: "STON.fi",
    chainId: 607,
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
  const picked = rows.filter(keep).sort((a, b) => b.tvl - a.tvl).slice(0, PAGE_CAP);
  const byPair = new Map<string, MarketRow>();
  for (const r of picked) {
    const id = pairKey(r.mintA, r.mintB);
    const v = venue(r);
    const prev = byPair.get(id);
    if (prev) {
      prev.venues.push(v);
      prev.depth += r.tvl;
      if (!prev.venueNames.includes("STON.fi")) prev.venueNames.push("STON.fi");
      continue;
    }
    byPair.set(id, {
      pairId: id,
      chainId: 607,
      chainShort: "TON",
      symbolA: r.symbolA || "TKN",
      symbolB: r.symbolB || "TKN",
      iconA: iconOf(r.symbolA),
      iconB: iconOf(r.symbolB),
      tokenA: r.mintA,
      tokenB: r.mintB,
      venues: [v],
      price: isUsd(r.symbolB) ? r.price : isUsd(r.symbolA) ? 1 : r.price,
      depth: r.tvl,
      venueNames: ["STON.fi"],
    });
  }
  return [...byPair.values()];
}

async function getJson<T>(url: string, init?: RequestInit, ms = 15000): Promise<T | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: ac.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function human(raw: string | undefined, decimals: number) {
  const n = Number(raw ?? "0") / 10 ** decimals;
  return Number.isFinite(n) ? n : 0;
}

function metaOf(asset: AssetJson | undefined, fallback: string) {
  const kind = (asset?.kind || "").toLowerCase();
  const addr = asset?.contract_address || fallback;
  const native = kind === "ton" || addr === TON_NATIVE;
  const symbol = native ? "TON" : asset?.symbol || "TKN";
  return { addr, symbol, decimals: asset?.decimals ?? (native ? 9 : 9) };
}

export const stonProtocol: DefiProtocol = {
  id: "stonfi-607",
  name: "STON.fi",
  chainId: 607,
  caps: ["markets"],
  async markets() {
    const json = await getJson<{ pool_list?: PoolJson[] }>("https://api.ston.fi/v1/pools/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ condition: "asset:popular", limit: PAGE_CAP, sort_by: ["lp_total_supply_usd:desc"] }),
    });
    const list = (json?.pool_list ?? []).filter((p) => p.address && !p.deprecated);
    const tokens = [...new Set(list.flatMap((p) => [p.token0_address, p.token1_address].filter(Boolean) as string[]))];
    const assets = new Map<string, AssetJson>();
    const bulk = await getJson<{ asset_list?: AssetJson[] }>("https://api.ston.fi/v1/assets");
    for (const a of bulk?.asset_list ?? []) {
      if (a.contract_address) assets.set(a.contract_address, a);
    }
    const missing = tokens.filter((addr) => !assets.has(addr));
    await Promise.all(
      missing.slice(0, 80).map(async (addr) => {
        const row = await getJson<{ asset?: AssetJson }>(`https://api.ston.fi/v1/assets/${encodeURIComponent(addr)}`);
        if (row?.asset) assets.set(addr, row.asset);
      }),
    );
    const rows: Row[] = [];
    for (const p of list) {
      const a0 = metaOf(assets.get(p.token0_address || ""), p.token0_address || "");
      const a1 = metaOf(assets.get(p.token1_address || ""), p.token1_address || "");
      if (!a0.addr || !a1.addr) continue;
      let row: Row = {
        pool: p.address || "",
        mintA: a0.addr,
        mintB: a1.addr,
        symbolA: a0.symbol,
        symbolB: a1.symbol,
        reserveA: human(p.reserve0, a0.decimals),
        reserveB: human(p.reserve1, a1.decimals),
        price: 0,
        tvl: num(p.lp_total_supply_usd),
        feeLabel: feeLabel(p.lp_fee, p.protocol_fee),
      };
      if (row.reserveA > 0 && row.reserveB > 0) row.price = row.reserveB / row.reserveA;
      if (isUsd(row.symbolA) && !isUsd(row.symbolB)) {
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
      rows.push(row);
    }
    return toMarkets(rows);
  },
};
