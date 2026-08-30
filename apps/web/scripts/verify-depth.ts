/**
 * Chain/DEX depth audit.
 *
 * USD fields (do not reuse one reserve×price formula):
 * - SOL Raydium `tvl` USD; `price` is mintA in mintB; reserves UI
 * - SOL Orca `tvlUsdc` USD; `tokenBalance*` raw (÷ decimals); `price` mintA in mintB
 * - SOL Meteora `tvl` USD; `current_price` token_x in token_y
 * - SUI Cetus `pure_tvl_in_usd` USD; `price` coin_a in coin_b (USD-left keeps price)
 * - EVM Gecko `reserve_in_usd` USD; `base_token_price_quote_token` A-in-B
 *   (Sonic/HyperEVM/BERA plus ETH/Base/BNB/AVAX spot samples)
 * - TON STON.fi `lp_total_supply_usd` USD
 * - NEAR `nearUsdFromLegs` (stables + wrap); never indexer TVL
 * - ADA Minswap `liquidity_currency` USD
 * - APT Gecko `reserve_in_usd`
 *
 * `invertVenue` must keep `tvlQuote` on NATIVE_USD chains.
 */
import { featuredChains } from "@ysk-mint/config";
import { ensureProtocols } from "../src/lib/defi/protocols.ts";
import { protocolsOn } from "../src/lib/defi/registry.ts";
import type { MarketRow as DefiMarket, VenueQuote } from "../src/lib/defi/types.ts";
import { NATIVE_USD, venueDisplayDepth } from "../src/lib/defi/quote.ts";
import { invertVenue, mergeOriented } from "../src/lib/pairOrient.ts";
import { looksLikeContractLabel, resolveTokenMeta } from "../src/lib/tokenLabel.ts";

const INSANE = 5e10;

function fail(msg: string, data: Record<string, unknown> = {}): never {
  console.error("FAIL", msg, JSON.stringify(data));
  throw new Error(msg);
}

function pick(rows: DefiMarket[], re: RegExp) {
  return rows.filter((r) => re.test(`${r.symbolA}/${r.symbolB}`));
}

function btcLike(sym: string) {
  return /btc|wbtc|cbbtc|tbtc/i.test(sym);
}

function closeUsd(a: number, b: number, maxRatio = 2) {
  if (!(a > 0) || !(b > 0)) return false;
  const r = a > b ? a / b : b / a;
  return r <= maxRatio;
}

function num(x: unknown) {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : 0;
}

/** HTTP adapters only — skip on-chain factory walks. */
function httpProtocols(chainId: number) {
  return protocolsOn(chainId).filter((p) => p.markets && !p.discover);
}

async function load(chainId: number): Promise<DefiMarket[]> {
  ensureProtocols();
  const parts = await Promise.all(
    httpProtocols(chainId).map((p) => p.markets!({}).catch(() => [] as DefiMarket[])),
  );
  return mergeOriented(parts.flat()) as DefiMarket[];
}

async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 20000);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ac.signal,
      headers: {
        accept: "application/json",
        "user-agent": "ysk-mint-verify/1.0",
        ...init?.headers,
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function venuesByPool(rows: DefiMarket[], protocol: string) {
  const by = new Map<string, VenueQuote>();
  for (const r of rows) {
    for (const v of r.venues) {
      if (v.protocolId !== protocol && v.protocolName.toLowerCase() !== protocol.toLowerCase()) continue;
      if (v.pool) by.set(v.pool.toLowerCase(), v);
    }
  }
  return by;
}

function sampleMatch(label: string, api: Array<{ pool: string; usd: number }>, rows: DefiMarket[], protocolId: string) {
  const by = venuesByPool(rows, protocolId);
  let n = 0;
  let clamped = 0;
  for (const row of api) {
    if (!(row.usd > 0)) continue;
    const v = by.get(row.pool.toLowerCase());
    if (row.usd > INSANE) {
      if (v && v.tvlQuote > INSANE) fail(`${label} API+adapter USD insane`, { pool: row.pool, usd: row.usd });
      continue;
    }
    if (!v) continue;
    n += 1;
    if (v.tvlQuote > INSANE) fail(`${label} adapter USD insane`, { pool: row.pool, adapter: v.tvlQuote, api: row.usd });
    if (v.tvlQuote > row.usd * 2.5) {
      fail(`${label} adapter USD inflated vs API`, { pool: row.pool, api: row.usd, adapter: v.tvlQuote });
    }
    if (!closeUsd(v.tvlQuote, row.usd)) clamped += 1;
    if (n >= 8) break;
  }
  console.log("spot", label, { matched: n, clamped, apiN: api.length });
  if (!n && api.length) console.log("spot-miss", label, "no pool overlap (cache/page cap)");
}

/** Real SOL/USDC (etc.) must keep protocol USD, not a clamped meme TVL. */
function spotLiquidPair(label: string, rows: DefiMarket[], re: RegExp, protocolId: string, minUsd: number) {
  const v = pick(rows, re)
    .flatMap((r) => r.venues)
    .find((x) => x.protocolId === protocolId || x.protocolName.toLowerCase() === protocolId.toLowerCase());
  if (!v) {
    console.log("spot-skip", label, "pair not in adapter");
    return;
  }
  if (!(v.tvlQuote >= minUsd) || v.tvlQuote > INSANE) {
    fail(`${label} liquid pair depth not protocol USD`, { pool: v.pool, depth: v.tvlQuote });
  }
  console.log("spot-liquid", label, { pool: v.pool, usd: v.tvlQuote });
}

function assertInvertKeepsUsd(short: string, chainId: number, rows: DefiMarket[]) {
  if (!NATIVE_USD.has(chainId)) return;
  for (const r of rows.slice(0, 8)) {
    for (const v of r.venues.slice(0, 2)) {
      const inv = invertVenue(v, chainId);
      if (inv.tvlQuote !== v.tvlQuote) {
        fail(`${short} invertVenue overwrote USD tvlQuote`, {
          pair: `${r.symbolA}/${r.symbolB}`,
          before: v.tvlQuote,
          after: inv.tvlQuote,
        });
      }
    }
  }
}

function audit(chainId: number, short: string, rows: DefiMarket[]) {
  const insane = rows.filter((r) => r.depth > INSANE);
  if (insane.length) {
    fail(`${short} still has T-scale depth`, {
      n: insane.length,
      top: insane.slice(0, 5).map((r) => ({ pair: `${r.symbolA}/${r.symbolB}`, depth: r.depth, price: r.price, names: r.venueNames })),
    });
  }
  for (const r of rows) {
    const usdcQuote = /usd/i.test(r.symbolB) && (r.price ?? 0) > 1e6 && !btcLike(r.symbolA) && r.depth >= 10_000;
    if (usdcQuote) fail(`${short} USDC quote looks inverted`, { pair: `${r.symbolA}/${r.symbolB}`, price: r.price, depth: r.depth });
  }
  const named = rows.filter((r) => /USDC/i.test(r.symbolA) || /USDC/i.test(r.symbolB)).slice(0, 12);
  for (const r of named) {
    if (looksLikeContractLabel(r.symbolA) || looksLikeContractLabel(r.symbolB)) {
      fail(`${short} pair shows mint instead of symbol`, { pair: `${r.symbolA}/${r.symbolB}`, tokenA: r.tokenA, tokenB: r.tokenB });
    }
    const metaA = resolveTokenMeta(chainId, r.tokenA, { symbol: r.symbolA, icon: r.iconA });
    const metaB = resolveTokenMeta(chainId, r.tokenB, { symbol: r.symbolB, icon: r.iconB });
    if (looksLikeContractLabel(metaA.symbol) || looksLikeContractLabel(metaB.symbol)) {
      fail(`${short} pair page meta still a mint`, { pair: `${metaA.symbol}/${metaB.symbol}`, tokenA: r.tokenA });
    }
    for (const v of r.venues.slice(0, 3)) {
      const shown = venueDisplayDepth(v, r.tokenA, r.tokenB, chainId);
      if (shown > INSANE) fail(`${short} venue display depth insane`, { pair: `${r.symbolA}/${r.symbolB}`, depth: shown, tvl: v.tvlQuote });
    }
  }
  assertInvertKeepsUsd(short, chainId, rows);
  const dex = [...new Set(rows.flatMap((r) => r.venueNames))];
  console.log("ok", short, { n: rows.length, maxDepth: rows.reduce((n, r) => Math.max(n, r.depth || 0), 0), dex });
}

async function spotSol(rows: DefiMarket[]) {
  const ray = await getJson("https://api-v3.raydium.io/pools/info/list?poolType=all&poolSortField=liquidity&sortType=desc&pageSize=20&page=1");
  const rayList = ((ray as { data?: { data?: Array<Record<string, unknown>> } } | null)?.data?.data ?? []).map((p) => ({
    pool: String(p.id ?? ""),
    usd: num(p.tvl),
  }));
  sampleMatch("Raydium tvl", rayList, rows, "raydium-101");

  const orca = await getJson("https://api.orca.so/v2/solana/pools?sortBy=tvl&sortDirection=desc&size=20");
  const orcaList = ((orca as { data?: Array<Record<string, unknown>> } | null)?.data ?? []).map((p) => ({
    pool: String(p.address ?? ""),
    usd: num(p.tvlUsdc ?? p.tvl),
  }));
  sampleMatch("Orca tvlUsdc", orcaList, rows, "orca-101");

  const met = await getJson("https://dlmm.datapi.meteora.ag/pools?page=1&page_size=20&sort_by=tvl:desc");
  const metList = ((met as { data?: Array<Record<string, unknown>> } | null)?.data ?? []).map((p) => ({
    pool: String(p.address ?? ""),
    usd: num(p.tvl),
  }));
  sampleMatch("Meteora tvl", metList, rows, "meteora-101");
  spotLiquidPair("Raydium SOL/USDC", rows, /^(W)?SOL\/USDC$/i, "raydium-101", 1_000_000);
  spotLiquidPair("Orca SOL/USDC", rows, /^(W)?SOL\/USDC$/i, "orca-101", 100_000);
  const raySol = pick(rows, /^(W)?SOL\/USDC$/i)
    .flatMap((r) => r.venues)
    .find((v) => v.protocolId === "raydium-101");
  if (raySol) {
    const info = await getJson(`https://api-v3.raydium.io/pools/info/ids?ids=${encodeURIComponent(raySol.pool)}`);
    const raw = (info as { data?: Array<Record<string, unknown>> } | null)?.data?.[0];
    const usd = num(raw?.tvl);
    if (usd > 0 && raySol.tvlQuote > usd * 2.5) {
      fail("Raydium SOL/USDC adapter inflated vs ids API", { pool: raySol.pool, api: usd, adapter: raySol.tvlQuote });
    }
    if (usd > 0) console.log("spot-ids", "Raydium SOL/USDC", { api: usd, adapter: raySol.tvlQuote });
  }
}

async function spotSui(rows: DefiMarket[]) {
  const json = await getJson("https://api-sui.cetus.zone/v2/sui/stats_pools?limit=20&offset=0&order=tvl&sort=desc");
  const list = ((json as { data?: { lp_list?: Array<Record<string, unknown>> } } | null)?.data?.lp_list ?? []).map((p) => ({
    pool: String(p.address ?? ""),
    usd: num(p.pure_tvl_in_usd ?? p.tvl),
  }));
  sampleMatch("Cetus pure_tvl_in_usd", list, rows, "cetus-784");
  spotLiquidPair("Cetus SUI/USDC", rows, /^(W)?SUI\/USDC$/i, "cetus-784", 100_000);
}

async function spotGeckoEvm() {
  const samples = [
    { chain: "ETH", network: "eth" },
    { chain: "BASE", network: "base" },
    { chain: "BNB", network: "bsc" },
    { chain: "AVAX", network: "avax" },
  ];
  for (const s of samples) {
    const json = await getJson(`https://api.geckoterminal.com/api/v2/networks/${s.network}/pools?page=1`);
    const pools = ((json as { data?: Array<{ attributes?: { reserve_in_usd?: string; name?: string } }> } | null)?.data ?? []).slice(
      0,
      5,
    );
    if (!pools.length) {
      console.log("skip-gecko", s.chain);
      continue;
    }
    for (const p of pools) {
      const usd = num(p.attributes?.reserve_in_usd);
      if (usd > INSANE) fail(`${s.chain} Gecko reserve_in_usd insane`, { name: p.attributes?.name, usd });
    }
    console.log("spot-gecko", s.chain, { n: pools.length, max: Math.max(...pools.map((p) => num(p.attributes?.reserve_in_usd))) });
    await new Promise((r) => setTimeout(r, 800));
  }
}

async function spotTon(rows: DefiMarket[]) {
  const json = await getJson("https://api.ston.fi/v1/pools/query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ condition: "asset:popular", limit: 20, sort_by: ["lp_total_supply_usd:desc"] }),
  });
  const list = ((json as { pool_list?: Array<{ address?: string; lp_total_supply_usd?: unknown }> } | null)?.pool_list ?? []).map((p) => ({
    pool: String(p.address ?? ""),
    usd: num(p.lp_total_supply_usd),
  }));
  sampleMatch("STON.fi lp_total_supply_usd", list, rows, "stonfi-607");
}

const sol = await load(101);
const sui = await load(784);
audit(101, "SOL", sol);
audit(784, "SUI", sui);
await spotSol(sol);
await spotSui(sui);

const pepe = pick(sol, /^PEPE\/USDC$/i);
const jitoJto = pick(sol, /JitoSOL\/JTO/i);
const jitoSol = pick(sol, /JitoSOL\/(W)?SOL$/i);
const cbbtc = pick(sol, /^cbBTC\/SOL$/i);
const sbox = pick(sui, /CETUS\/SBOX|SBOX\/CETUS/i);
const solUsdc = pick(sol, /^(W)?SOL\/USDC$/i);

for (const r of pepe) {
  if (!(r.depth > 1_000 && r.depth < 50_000_000)) fail("PEPE depth not USD TVL", { depth: r.depth, price: r.price });
  if (!(r.price != null && r.price > 0 && r.price < 0.01)) fail("PEPE price still inverted", { price: r.price, depth: r.depth });
}
for (const r of jitoJto) {
  if (!(r.depth > 1_000 && r.depth < 50_000_000)) fail("JitoSOL/JTO depth not USD TVL", { depth: r.depth, price: r.price });
}
for (const r of jitoSol) {
  if (!(r.depth > 10_000 && r.depth < 200_000_000)) fail("JitoSOL/SOL depth not USD TVL", { depth: r.depth, price: r.price });
  if (!(r.price != null && r.price > 20 && r.price < 500)) fail("JitoSOL/SOL price not USD", { price: r.price, quote: r.tokenB, depth: r.depth });
}
for (const r of cbbtc) {
  if (!(r.depth > 10_000 && r.depth < 200_000_000)) fail("cbBTC/SOL depth not USD TVL", { depth: r.depth, price: r.price });
  if (!(r.price != null && r.price > 10_000 && r.price < 200_000)) fail("cbBTC/SOL price not USD", { price: r.price, quote: r.tokenB, depth: r.depth });
}
for (const r of sbox) {
  if (!(r.depth > 10 && r.depth < 1_000_000)) fail("CETUS/SBOX depth not USD TVL", { depth: r.depth, price: r.price });
}
if (!solUsdc.length) fail("missing SOL/USDC sample");
for (const r of solUsdc) {
  const metaA = resolveTokenMeta(101, r.tokenA, { symbol: r.symbolA, icon: r.iconA });
  const metaB = resolveTokenMeta(101, r.tokenB, { symbol: r.symbolB, icon: r.iconB });
  if (looksLikeContractLabel(metaA.symbol) || looksLikeContractLabel(metaB.symbol)) {
    fail("SOL/USDC pair page would show mint", { a: metaA.symbol, b: metaB.symbol, tokenA: r.tokenA });
  }
}

ensureProtocols();
const featured = featuredChains().filter((c) => !c.testnet && httpProtocols(c.chainId).length > 0);
const loaded = new Map<number, DefiMarket[]>([
  [101, sol],
  [784, sui],
]);
for (const c of featured) {
  if (c.chainId === 101 || c.chainId === 784) continue;
  try {
    const rows = await load(c.chainId);
    loaded.set(c.chainId, rows);
    if (!rows.length) {
      console.log("skip-empty", c.short, c.chainId);
      continue;
    }
    audit(c.chainId, c.short, rows);
  } catch (e) {
    if (e instanceof Error && e.message.includes("still has T-scale")) throw e;
    if (e instanceof Error && e.message.includes("mint")) throw e;
    if (e instanceof Error && e.message.includes("inverted")) throw e;
    if (e instanceof Error && e.message.includes("overwrote USD")) throw e;
    console.log("skip-error", c.short, e instanceof Error ? e.message : e);
  }
}

const ton = loaded.get(607);
if (ton?.length) await spotTon(ton);
await spotGeckoEvm();

console.log("PASS", {
  solN: sol.length,
  suiN: sui.length,
  pepeDepth: pepe[0]?.depth,
  pepePrice: pepe[0]?.price,
  solUsdc: solUsdc.map((r) => ({ pair: `${r.symbolA}/${r.symbolB}`, depth: r.depth, price: r.price })),
});
