#!/usr/bin/env node
/**
 * Bake CMC ∪ CoinGecko top-500 platform contracts onto featured chains.
 * No API keys. Runtime SPA must not call these endpoints.
 *
 *   node scripts/snapshot-top500.mjs
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WEB = join(ROOT, "apps/web");
const OUT_JSON = join(WEB, "src/lib/cmcCatalog.json");
const ICON_DIR = join(WEB, "public/tokens");
const SOURCE = join(ICON_DIR, "SOURCE.txt");
const CHAINS_TS = join(ROOT, "packages/config/src/chains.ts");
const CACHE = "/tmp/ysk-mint-snapshot";
const UA = "Mozilla/5.0 (compatible; ysk-mint-snapshot/1.0)";
const SENTINEL = /^0x0{40}$|^0xe{40}$/i;
const DECIMALS_SEL = "0x313ce567";

const SUFFIX = {
  101: "sol",
  397: "near",
  1815: "ada",
  728126428: "trx",
  784: "sui",
  607: "ton",
  637: "apt",
  998: "hypercore",
  833: "btc",
  144: "xrp",
  148: "xlm",
  118: "atom",
  100001: "osmo",
  100002: "tia",
  100003: "strk",
};

const CG_PLAT = {
  solana: 101,
  "near-protocol": 397,
  cardano: 1815,
  tron: 728126428,
  sui: 784,
  "the-open-network": 607,
  aptos: 637,
  hyperliquid: 998,
  hyperevm: 999,
  bitcoin: 833,
  xrp: 144,
  stellar: 148,
  cosmos: 118,
  osmosis: 100001,
  celestia: 100002,
  starknet: 100003,
  filecoin: 314,
};

const CMC_PLAT_NAME = {
  ethereum: 1,
  "bnb smart chain": 56,
  bnb: 56,
  solana: 101,
  tron20: 728126428,
  tron: 728126428,
  near: 397,
  "near protocol": 397,
  cardano: 1815,
  aptos: 637,
  "sui network": 784,
  sui: 784,
  ton: 607,
  "the open network": 607,
  optimism: 10,
  "optimistic ethereum": 10,
  arbitrum: 42161,
  "arbitrum one": 42161,
  base: 8453,
  polygon: 137,
  "polygon pos": 137,
  "avalanche c chain": 43114,
  avalanche: 43114,
  fantom: 250,
  "gnosis chain": 100,
  gnosis: 100,
  "zksync era": 324,
  zksync: 324,
  scroll: 534352,
  linea: 59144,
  mantle: 5000,
  opbnb: 204,
  "world chain mainnet": 480,
  "world chain": 480,
  unichain: 130,
  soneium: 1868,
  "abstract chain": 2741,
  abstract: 2741,
  hyperliquid: 998,
  hyperevm: 999,
  starknet: 100003,
  osmosis: 100001,
  injective: 1776,
  "xdc network": 50,
  xdc: 50,
  celo: 42220,
  "x layer": 196,
  "sei v2": 1329,
  "sei network": 1329,
  sei: 1329,
  "flare network": 14,
  flare: 14,
  kaia: 8217,
  viction: 88,
  cronos: 25,
  "boba network": 288,
  boba: 288,
  "metis andromeda": 1088,
  metis: 1088,
  "manta pacific": 169,
  manta: 169,
  core: 1116,
  iotex: 4689,
  stellar: 148,
  "xrp ledger": 144,
  xrpl: 144,
  cosmos: 118,
  celestia: 100002,
  sonic: 146,
  berachain: 80094,
  ronin: 2020,
  ink: 57073,
  blast: 81457,
  mode: 34443,
  fraxtal: 252,
  lisk: 1135,
  zora: 7777777,
  "robinhood chain": 4663,
  robinhood: 4663,
  plasma: 9745,
  monad: 143,
  plume: 98866,
  "plume network": 98866,
  apechain: 33139,
  taiko: 167000,
  katana: 747474,
  gravity: 1625,
  "immutable zkevm": 13371,
  bob: 60808,
  morph: 2818,
  "flow evm": 747,
  megaeth: 4326,
  filecoin: 314,
  bitcoin: 833,
};

const FORCE_GECKO = [
  "wrapped-bitcoin",
  "coinbase-wrapped-btc",
  "staked-ether",
  "wrapped-steth",
  "pax-gold",
  "tether-gold",
  "ondo-us-dollar-yield",
  "hashnote-usyc",
  "blackrock-usd-institutional-digital-liquidity-fund",
  "superstate-ustb",
  "ondo-us-government-bond",
  "franklin-onchain-u-s-government-money-fund",
  "openeden-tbill",
  "mountain-protocol-usdm",
  "backed-ib01-treasury-bond-0-1yr",
  "syrup",
  "ethena-staked-usde",
  "apple-xstock",
  "tesla-xstock",
  "nvidia-xstock",
  "sp500-xstock",
  "wisdomtree-government-money-market-digital-fund",
];
const USD_SYM = /^(usdt|usdc|usde|usds|usd1|busd|tusd|fdusd|usdp|rlusd|pyusd)$/i;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function getJson(url, tries = 6) {
  let last = 0;
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" } });
    last = res.status;
    if (res.status === 429 || res.status >= 500) {
      await sleep(800 * (i + 1));
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.json();
  }
  throw new Error(`retry ${last} ${url}`);
}

function parseChains(src) {
  const featured = [];
  const blocks = src.split(/\n  \[ChainKey\./).slice(1);
  for (const b of blocks) {
    const key = b.split("]")[0];
    const chainId = Number(/chainId:\s*(\d+)/.exec(b)?.[1]);
    const featuredOn = /featured:\s*true/.test(b);
    const testnet = /testnet:\s*true/.test(b);
    const name = /name:\s*"([^"]+)"/.exec(b)?.[1] ?? key;
    const rpc = /rpc:\s*"([^"]+)"/.exec(b)?.[1];
    const nativeSymbol = /nativeSymbol:\s*"([^"]+)"/.exec(b)?.[1] ?? "";
    const vm = /vm:\s*"(\w+)"/.exec(b)?.[1] ?? "evm";
    if (!Number.isFinite(chainId) || !featuredOn || testnet) continue;
    featured.push({ key, chainId, name, rpc, nativeSymbol, vm });
  }
  return featured;
}

function chainKeyOf(chainId) {
  return SUFFIX[chainId] ?? String(chainId);
}

function recordId(cmcId, geckoId, chainId) {
  const tail = chainKeyOf(chainId);
  if (cmcId) return `cmc-${cmcId}-${tail}`;
  const slug = String(geckoId || "tok").replace(/[^a-z0-9]+/g, "");
  return `cg-${slug}-${tail}`;
}

function isEvmAddr(addr) {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

function isNativePlaceholder(vm, addr) {
  const a = String(addr || "").trim();
  const l = a.toLowerCase();
  if (!a || SENTINEL.test(a)) return true;
  if (l === "xrp" || l === "lovelace" || l === "wrap.near" || l === "native" || l === "xlm") return true;
  if (vm === "sui" && /::sui::sui$/i.test(l)) return true;
  if (vm === "aptos" && /aptos_coin/i.test(l)) return true;
  if (vm === "ton" && /^EQA{8,}/.test(a)) return true;
  if (vm === "bitcoin") return true;
  return false;
}

function normalizeAddr(vm, addr) {
  const a = String(addr || "").trim();
  if (!a || isNativePlaceholder(vm, a)) return "";
  if (vm === "evm") return isEvmAddr(a) ? a.toLowerCase() : "";
  if (vm === "near") return a.toLowerCase();
  if (vm === "solana" || vm === "tron" || vm === "ton") return a;
  if (vm === "sui" || vm === "aptos" || vm === "starknet") return a;
  return a;
}

function defaultDecimals(vm, symbol) {
  if (USD_SYM.test(symbol)) return 6;
  if (vm === "near") return 18;
  if (vm === "cardano" || vm === "tron" || vm === "xrpl" || vm === "cosmos") return 6;
  if (vm === "stellar") return 7;
  if (vm === "bitcoin") return 8;
  if (vm === "solana" || vm === "sui" || vm === "ton") return 9;
  if (vm === "aptos" || vm === "hypercore") return 8;
  return 18;
}

function iconFor(symbol, cmcId, files) {
  const s = symbol.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (s === "weth" && files.has("eth.png")) return "/tokens/eth.png";
  if (cmcId === 11419 && files.has("ton.png")) return "/tokens/ton.png";
  if (files.has(`${s}.png`)) return `/tokens/${s}.png`;
  if (cmcId && files.has(`cmc-${cmcId}.png`)) return `/tokens/cmc-${cmcId}.png`;
  if (cmcId) return `/tokens/cmc-${cmcId}.png`;
  return files.has("eth.png") ? "/tokens/eth.png" : "/tokens/eth.png";
}

function mapCmcPlatform(p, featuredEvm, byId) {
  const chainHint = Number(p.contractChainId);
  const name = normName(p.contractPlatform);
  let chainId = CMC_PLAT_NAME[name];
  if (featuredEvm.has(chainHint)) chainId = chainHint;
  if (chainId == null) return null;
  const meta = byId.get(chainId);
  if (!meta) return null;
  return { chainId, vm: meta.vm, address: p.contractAddress, hintDecimals: Number(p.contractDecimals) };
}

function mapCgPlatform(platId, addr, featuredEvm, cgChainOf, byId) {
  let chainId = CG_PLAT[platId];
  const cid = cgChainOf.get(platId);
  if (chainId == null && cid != null && featuredEvm.has(cid) && !CG_PLAT[platId]) chainId = cid;
  if (chainId == null) return null;
  const meta = byId.get(chainId);
  if (!meta) return null;
  return { chainId, vm: meta.vm, address: addr };
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length || 1) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    }),
  );
  return out;
}

const RPC_FALLBACK = {
  1: "https://ethereum-rpc.publicnode.com",
  56: "https://bsc-rpc.publicnode.com",
  8453: "https://base.publicnode.com",
  42161: "https://arbitrum-one-rpc.publicnode.com",
  10: "https://optimism-rpc.publicnode.com",
  137: "https://polygon-bor-rpc.publicnode.com",
  43114: "https://avalanche-c-chain-rpc.publicnode.com",
  250: "https://fantom-rpc.publicnode.com",
  130: "https://mainnet.unichain.org",
  999: "https://rpc.hyperliquid.xyz/evm",
  196: "https://rpc.xlayer.tech",
  5000: "https://rpc.mantle.xyz",
};

async function ethCallDecimals(rpc, to) {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": UA },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to, data: DECIMALS_SEL }, "latest"],
    }),
  });
  const json = await res.json();
  const hex = json.result;
  if (typeof hex === "string" && hex.startsWith("0x") && hex.length > 2) {
    const n = Number(BigInt(hex));
    if (Number.isFinite(n) && n >= 0 && n <= 36) return n;
  }
  return null;
}

async function evmDecimals(rpcs, addresses) {
  const result = new Map();
  const urls = rpcs.filter(Boolean);
  if (!urls.length || !addresses.length) return result;
  const uniq = [...new Set(addresses.filter(isEvmAddr))];
  const chunk = 25;
  for (const rpc of urls) {
    const missing = uniq.filter((a) => !result.has(a.toLowerCase()));
    if (!missing.length) break;
    for (let i = 0; i < missing.length; i += chunk) {
      const part = missing.slice(i, i + chunk);
      let usedBatch = false;
      try {
        const res = await fetch(rpc, {
          method: "POST",
          headers: { "content-type": "application/json", "user-agent": UA },
          body: JSON.stringify(
            part.map((to, k) => ({
              jsonrpc: "2.0",
              id: k + 1,
              method: "eth_call",
              params: [{ to, data: DECIMALS_SEL }, "latest"],
            })),
          ),
        });
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        const rows = Array.isArray(json) ? json : [json];
        let hits = 0;
        for (const row of rows) {
          const id = Number(row.id) - 1;
          const hex = row.result;
          if (typeof hex !== "string" || !hex.startsWith("0x") || hex.length <= 2) continue;
          const n = Number(BigInt(hex));
          if (!Number.isFinite(n) || n < 0 || n > 36 || !part[id]) continue;
          result.set(part[id].toLowerCase(), n);
          hits += 1;
        }
        usedBatch = hits > 0;
      } catch {
        usedBatch = false;
      }
      if (usedBatch) continue;
      await pool(part, 6, async (to) => {
        try {
          const n = await ethCallDecimals(rpc, to);
          if (n != null) result.set(to.toLowerCase(), n);
        } catch {
          /* skip */
        }
      });
    }
  }
  return result;
}

function addRow(rows, seen, rec) {
  const addr = normalizeAddr(rec.vm, rec.address);
  if (!addr) return;
  const k = `${rec.chainId}:${addr.toLowerCase()}`;
  if (seen.has(k)) return;
  seen.add(k);
  rows.push({ ...rec, address: addr });
}

mkdirSync(CACHE, { recursive: true });
const featured = parseChains(readFileSync(CHAINS_TS, "utf8"));
const byId = new Map(featured.map((c) => [c.chainId, c]));
const featuredEvm = new Set(featured.filter((c) => c.vm === "evm").map((c) => c.chainId));
const iconFiles = new Set(existsSync(ICON_DIR) ? readdirSync(ICON_DIR) : []);

console.log(`featured chains ${featured.length} (evm ${featuredEvm.size})`);

const old = existsSync(OUT_JSON) ? JSON.parse(readFileSync(OUT_JSON, "utf8")) : [];
const oldDec = new Map(old.map((t) => [`${t.chainId}:${String(t.address || "").toLowerCase()}`, t.decimals]));

console.log("fetch CoinGecko markets + list + platforms");
const [cg1, cg2, cgList, cgPlats, cmcWrap] = await Promise.all([
  getJson("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false"),
  getJson("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=2&sparkline=false"),
  getJson("https://api.coingecko.com/api/v3/coins/list?include_platform=true"),
  getJson("https://api.coingecko.com/api/v3/asset_platforms"),
  getJson("https://api.coinmarketcap.com/data-api/v3/cryptocurrency/listing?start=1&limit=500&sortBy=market_cap&sortType=desc&convert=USD&cryptoType=all&tagType=all"),
]);

const cgMarkets = [...cg1, ...cg2];
const cgById = new Map(cgList.map((c) => [c.id, c]));
const cgChainOf = new Map(cgPlats.map((p) => [p.id, p.chain_identifier]));
const cmcList = cmcWrap?.data?.cryptoCurrencyList ?? [];
if (!cmcList.length) console.warn("CMC listing empty — continuing with CoinGecko only");

const coins = [];
const seenCoin = new Set();

for (const c of cmcList) {
  const key = `cmc:${c.id}`;
  if (seenCoin.has(key)) continue;
  seenCoin.add(key);
  coins.push({
    cmcId: c.id,
    geckoId: c.slug && cgById.has(c.slug) ? c.slug : null,
    symbol: c.symbol,
    name: c.name,
    slug: c.slug,
    rank: c.cmcRank ?? 9999,
    src: "cmc",
  });
}

for (const c of cgMarkets) {
  const slugHit = coins.find((x) => x.slug === c.id || x.geckoId === c.id);
  if (slugHit) {
    slugHit.geckoId = c.id;
    slugHit.rank = Math.min(slugHit.rank, c.market_cap_rank ?? 9999);
    continue;
  }
  const symHit = coins.find(
    (x) => x.symbol.toUpperCase() === c.symbol.toUpperCase() && x.name.toLowerCase() === c.name.toLowerCase(),
  );
  if (symHit) {
    symHit.geckoId = c.id;
    continue;
  }
  const key = `cg:${c.id}`;
  if (seenCoin.has(key)) continue;
  seenCoin.add(key);
  coins.push({
    cmcId: null,
    geckoId: c.id,
    symbol: c.symbol.toUpperCase(),
    name: c.name,
    slug: c.id,
    rank: c.market_cap_rank ?? 9999,
    src: "cg",
  });
}

for (const id of FORCE_GECKO) {
  if (coins.some((c) => c.geckoId === id)) continue;
  const info = cgById.get(id);
  if (!info) continue;
  coins.push({
    cmcId: id === "wrapped-bitcoin" ? 3717 : id === "coinbase-wrapped-btc" ? 32994 : id === "staked-ether" ? 8085 : id === "wrapped-steth" ? 12409 : null,
    geckoId: id,
    symbol: info.symbol.toUpperCase(),
    name: info.name,
    slug: id,
    rank: 501,
    src: "force",
  });
}

console.log(`union coins ${coins.length} (cmc ${cmcList.length}, cg ${cgMarkets.length})`);

const cmcIds = [...new Set(coins.map((c) => c.cmcId).filter(Boolean))];
console.log(`CMC detail ${cmcIds.length}`);
const cmcPlatforms = new Map();
await pool(cmcIds, 4, async (id) => {
  const cachePath = join(CACHE, `cmc-${id}.json`);
  try {
    if (existsSync(cachePath)) {
      cmcPlatforms.set(id, JSON.parse(readFileSync(cachePath, "utf8")));
      return;
    }
    const json = await getJson(`https://api.coinmarketcap.com/data-api/v3/cryptocurrency/detail?id=${id}`);
    const plats = json?.data?.platforms ?? [];
    writeFileSync(cachePath, JSON.stringify(plats));
    cmcPlatforms.set(id, plats);
    await sleep(120);
  } catch (e) {
    console.warn(`cmc detail ${id}: ${e.message || e}`);
    cmcPlatforms.set(id, []);
  }
});

const rows = [];
const seen = new Set();
const noChain = [];

for (const coin of coins) {
  const plats = [];
  for (const p of cmcPlatforms.get(coin.cmcId) ?? []) {
    const m = mapCmcPlatform(p, featuredEvm, byId);
    if (m) plats.push(m);
  }
  const cg = coin.geckoId ? cgById.get(coin.geckoId) : null;
  for (const [platId, addr] of Object.entries(cg?.platforms || {})) {
    if (!addr) continue;
    const m = mapCgPlatform(platId, addr, featuredEvm, cgChainOf, byId);
    if (m) plats.push(m);
  }
  if (!plats.length) {
    const nativeSym = new Set(featured.map((c) => c.nativeSymbol.toUpperCase()));
    if (nativeSym.has(String(coin.symbol).toUpperCase())) continue;
    if (coin.rank <= 500) noChain.push(`${coin.rank} ${coin.symbol} ${coin.name}`);
    continue;
  }
  const filesNow = iconFiles;
  const icon = iconFor(coin.symbol, coin.cmcId, filesNow);
  for (const p of plats) {
    const address = normalizeAddr(p.vm, p.address);
    if (!address) continue;
    let decimals = oldDec.get(`${p.chainId}:${address.toLowerCase()}`);
    if (p.vm === "evm") {
      /* filled later by eth_call; keep old / default as fallback */
    } else {
      decimals = defaultDecimals(p.vm, coin.symbol);
    }
    if (decimals == null) decimals = defaultDecimals(p.vm, coin.symbol);
    addRow(rows, seen, {
      id: recordId(coin.cmcId, coin.geckoId, p.chainId),
      vm: p.vm,
      chainId: p.chainId,
      symbol: coin.cmcId === 11419 ? "TON" : coin.symbol,
      name: coin.cmcId === 11419 ? "Toncoin" : coin.name,
      decimals,
      address,
      icon,
      _rank: coin.rank,
    });
  }
}

for (const t of old) {
  if (!t.address) continue;
  const k = `${t.chainId}:${String(t.address).toLowerCase()}`;
  if (seen.has(k)) continue;
  if (SENTINEL.test(t.address)) continue;
  addRow(rows, seen, { ...t, _rank: t._rank ?? 9000 });
}

rows.sort((a, b) => (a._rank ?? 9999) - (b._rank ?? 9999) || a.chainId - b.chainId || a.symbol.localeCompare(b.symbol));

const evmByChain = new Map();
for (const t of rows) {
  if (t.vm !== "evm" || !isEvmAddr(t.address)) continue;
  const list = evmByChain.get(t.chainId) ?? [];
  list.push(t);
  evmByChain.set(t.chainId, list);
}

console.log(`on-chain decimals for ${[...evmByChain.values()].reduce((n, a) => n + a.length, 0)} evm rows`);
for (const [chainId, list] of evmByChain) {
  const rpc = byId.get(chainId)?.rpc;
  const need = list.map((t) => t.address);
  const decs = await evmDecimals([RPC_FALLBACK[chainId], rpc].filter((u, i, a) => u && a.indexOf(u) === i), need);
  let hit = 0;
  for (const t of list) {
    const n = decs.get(t.address.toLowerCase());
    if (n != null) {
      t.decimals = n;
      hit += 1;
    }
  }
  console.log(`  chain ${chainId} fetched ${hit}/${need.length}`);
}

const needIcons = new Map();
for (const t of rows) {
  const m = /\/tokens\/(cmc-\d+)\.png$/.exec(t.icon);
  if (!m) continue;
  const file = `${m[1]}.png`;
  if (iconFiles.has(file)) continue;
  const id = Number(m[1].slice(4));
  if (Number.isFinite(id)) needIcons.set(id, file);
}

console.log(`download ${needIcons.size} icons`);
await pool([...needIcons.entries()], 6, async ([id, file]) => {
  const dest = join(ICON_DIR, file);
  try {
    const res = await fetch(`https://s2.coinmarketcap.com/static/img/coins/64x64/${id}.png`, {
      headers: { "user-agent": UA },
    });
    if (!res.ok) return;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 40) return;
    writeFileSync(dest, buf);
    iconFiles.add(file);
  } catch {
    /* skip */
  }
});

for (const t of rows) {
  const m = /\/tokens\/(cmc-\d+)\.png$/.exec(t.icon);
  if (m && !iconFiles.has(`${m[1]}.png`)) t.icon = "/tokens/eth.png";
  delete t._rank;
}

const clean = rows.map(({ id, vm, chainId, symbol, name, decimals, address, icon }) => ({
  id,
  vm,
  chainId,
  symbol,
  name,
  decimals,
  address,
  icon,
}));

writeFileSync(OUT_JSON, `${JSON.stringify(clean)}\n`);

const uniqCmc = new Set(clean.map((t) => (/^cmc-(\d+)/.exec(t.id) || [])[1]).filter(Boolean));
const uniqCg = new Set(clean.map((t) => (/^cg-/.test(t.id) ? t.id : null)).filter(Boolean));
const byVm = {};
const byChain = {};
for (const t of clean) {
  byVm[t.vm] = (byVm[t.vm] ?? 0) + 1;
  byChain[t.chainId] = (byChain[t.chainId] ?? 0) + 1;
}
const asOf = new Date().toISOString().slice(0, 10);
const noChainText = noChain.slice(0, 80).join("\n  ");
const source = `Token icons copied from CoinMarketCap public 64×64 CDN
(https://s2.coinmarketcap.com/static/img/coins/64x64/{id}.png)
into this folder so the SPA does not hotlink at runtime.

cmcCatalog.json is CMC ∪ CoinGecko top-500 platform contracts on
ysk-mint featured chains, snapshotted ${asOf}.
CMC listing ${cmcList.length}, CoinGecko markets ${cgMarkets.length},
union ${coins.length}, catalog rows ${clean.length}, unique CMC ids ${uniqCmc.size}.
This is not the entire CMC/CG universe. Extra natives live in
tokenRegistry AUTO_NATIVES. Named files below are reused when the
symbol or CMC id is known; others are cmc-{id}.png.

EVM decimals from on-chain eth_call. CMC contractDecimals is often wrong.

Rows by vm: ${JSON.stringify(byVm)}
Featured chain ids with rows: ${Object.keys(byChain)
  .map(Number)
  .sort((a, b) => a - b)
  .join(", ")}

Coins in the top 500 with no featured-chain contract (native L1 we
do not wallet, or no bridged token). Holdings cannot show a native
balance for these unless the user holds a wrapped/bridged variant:

  ${noChainText}${noChain.length > 80 ? `\n  … ${noChain.length - 80} more` : ""}

CMC IDs:
  btc=1 eth=1027 usdt=825 bnb=1839 usdc=3408 ada=2010
  avax=5805 dai=4943 wbtc=3717 link=1975 uni=7083
  arb=11841 op=11840 near=6535 aave=7278 sol=5426
  cake=7186 aero=29270 joe=11396 snek=25264 jup=29210
  ray=8526 bonk=23095 wif=28752 pyth=28177 jto=28541
  orca=11165 render=5690 cbbtc=32994 gmx=11857 min=12787
  djed=21639 hosky=16755 sundae=11986 indy=22771 iag=11078
  night=39064 wmtx=13769 aurora=14803 msol=11461 shib=5994
  pepe=24478 png=8422 ref=11809 degen=30096 jitosol=22533
  steth=8085 wsteth=12409 virtual=29420
  (4846 is Kusama — do not use)
`;
writeFileSync(SOURCE, source);
console.log(`wrote ${clean.length} rows, ${uniqCmc.size} cmc ids, ${uniqCg.size} cg-only ids → ${OUT_JSON}`);
console.log(`no featured contract: ${noChain.length}`);
