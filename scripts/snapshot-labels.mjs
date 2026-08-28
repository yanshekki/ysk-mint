#!/usr/bin/env node
/**
 * Bake a compact CEX address book for the activity tab.
 * Official Binance PoR + DefiLlama CEX adapters (exchanges' own disclosed wallets)
 * + a short list of well-known Etherscan-tagged hot wallets.
 * Not deposit-per-user addresses. Runtime SPA does not call these endpoints.
 *
 *   node scripts/snapshot-labels.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "apps/web/src/lib/labels");
const UA = "Mozilla/5.0 (compatible; ysk-mint-labels/1.0)";
const LLAMA = "https://raw.githubusercontent.com/DefiLlama/DefiLlama-Adapters/main";

const CHAIN = {
  ethereum: 1,
  eth: 1,
  bsc: 56,
  arbitrum: 42161,
  optimism: 10,
  avax: 43114,
  avalanche: 43114,
  avaxc: 43114,
  polygon: 137,
  matic: 137,
  base: 8453,
  linea: 59144,
  era: 324,
  zksync: 324,
  zksyncera: 324,
  fantom: 250,
  tron: 728126428,
  trx: 728126428,
  solana: 101,
  sol: 101,
  cardano: 1815,
  near: 397,
  sui: 784,
  aptos: 637,
  apt: 637,
  mantle: 5000,
  scroll: 534352,
  blast: 81457,
  celo: 42220,
  gnosis: 100,
  opbnb: 204,
  worldchain: 480,
  wld: 480,
  unichain: 130,
  sonic: 146,
  sei: 1329,
  seievm: 1329,
  ronin: 2020,
  ron: 2020,
  kaia: 8217,
  starknet: 100003,
  ton: 607,
  plasma: 9745,
};

const BINANCE_NET = {
  ETH: 1,
  BSC: 56,
  ARBITRUM: 42161,
  OPTIMISM: 10,
  AVAXC: 43114,
  MATIC: 137,
  BASE: 8453,
  SOL: 101,
  TRX: 728126428,
  NEAR: 397,
  APT: 637,
  SUI: 784,
  SCROLL: 534352,
  ZKSYNCERA: 324,
  CELO: 42220,
  OPBNB: 204,
  LINEA: 59144,
  WLD: 480,
  SEIEVM: 1329,
  TON: 607,
  STARKNET: 100003,
  SONIC: 146,
  RON: 2020,
  KAIA: 8217,
};

const LLAMA_FILES = [
  ["projects/binance/index.js", "Binance"],
  ["projects/okex/index.js", "OKX"],
  ["projects/kucoin/index.js", "KuCoin"],
  ["projects/bitget/index.js", "Bitget"],
  ["projects/gate-io/index.js", "Gate.io"],
  ["projects/huobi/index.js", "HTX"],
  ["projects/bitfinex/index.js", "Bitfinex"],
  ["projects/gemini/index.js", "Gemini"],
  ["projects/bitstamp/index.js", "Bitstamp"],
  ["cex/mexc-cex.js", "MEXC"],
];

/** Public Etherscan name tags (hot wallets). Not customer deposit addresses. */
const WELL_KNOWN = [
  [1, "Binance", [
    "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE",
    "0xD551234Ae421e3BCBA99A0Da6d736074f22192FF",
    "0x564286362092D8e7936f0549571a803B203aAceD",
    "0x0681d8Db095565FE8A346fA0277bFfdE9C0eDBBF",
    "0xFE9e8709d321531007F0B81e15C184F26e3DdE88",
    "0x4E9ce36E442e55EcD9025B9a6E0D88485d628A67",
    "0xF977814e90dA44bFA03b6295A0616a897441aceC",
    "0x28C6c06298d514Db089934071355E5743bf21d60",
    "0x21a31Ee1afC51d94C2eFcCAa2092aD102276e3FB",
    "0xDFd5293D8e347dFe59E90eFd55b2956a1343963d",
    "0x56Eddb7aa87536c09CCc2793473599fD21A8b17F",
    "0x9696f59E4d72E237BE84fFD425DCaD154Bf96976",
    "0x5a52E96BAcdaBb82fd05763E25335261B270Efcb",
    "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8",
    "0x4976A4A02f38326660D17Bf34b431dC6e2eb2327",
    "0x5a52e96bacdabb82fd05763e25335261b270efcb",
  ]],
  [1, "Coinbase", [
    "0xA9D1e08C7793af67e9d92fe308d5697FB81d3E43",
    "0x71660c4f0F8A1108d9090f56AB9497BA7497E5c3",
    "0x503828976D22510aad0201ac7EC88293211D23Da",
    "0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740",
    "0x3cD751E6b0078Be393132286c442345e5DC49699",
    "0xb5d85CBf7cB3EE0D56b3bB207D5Fc4B3d2B200d3",
    "0xeb2629a2734e272bcc07bda959863cf71412da46",
  ]],
  [1, "Kraken", [
    "0x291054159fC8d0A2D76593788BcbC1611bBcA4D0",
    "0x0A869d79a7052C7f1b55a8EbAbbEa3425A7B08d7",
    "0x267be1C1D684F78cb4F6a176C4911b741E4Ffdc0",
    "0xFa52274DD61E1643d2205169732f2914288686Bc",
    "0xAe2D4617cBb12457f4340896b944A9bF8B2b38c5",
    "0xE853c56864A2ebe4576a807D26Fdc4A0adA51919",
  ]],
  [1, "OKX", [
    "0x6cC5F688a315f3dC28A7781717a9A798a59fDA7b",
    "0x236F9f97c8B2691ba278cD623FF440C105634B0d",
    "0xa7efae728D2936e78BDA97dc267687568dD593f3",
    "0x5041ed759Dd4aFc3a72b8192C143F72f4724081A",
  ]],
  [1, "Bybit", [
    "0x1db92e2eebc8e0c075a02bea49a2935bcd2dfcf4",
    "0xf89d7b9c864f589bbF53a82105107622B35EaA40",
  ]],
];

async function http(url) {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "*/*" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res;
}

function put(map, chainId, address, name, src) {
  if (chainId == null || !address) return;
  const a = address.trim();
  if (a.length < 8) return;
  const key = `${chainId}:${a.toLowerCase()}`;
  if (map.has(key)) return;
  map.set(key, { chainId, address: a.startsWith("0x") ? a.toLowerCase() : a, name, src });
}

function parseLlamaJs(text, name) {
  const out = [];
  const re = /\b([A-Za-z][A-Za-z0-9_-]*)\s*:\s*\{/g;
  let m;
  while ((m = re.exec(text))) {
    const slug = m[1].toLowerCase();
    const chainId = CHAIN[slug];
    if (!chainId) continue;
    let i = m.index + m[0].length;
    let depth = 1;
    while (i < text.length && depth > 0) {
      if (text[i] === "{") depth += 1;
      else if (text[i] === "}") depth -= 1;
      i += 1;
    }
    const block = text.slice(m.index, i);
    for (const addr of block.match(/0x[a-fA-F0-9]{40}/g) || []) out.push([chainId, addr, name]);
    if (chainId === 101) {
      for (const addr of block.match(/["']([1-9A-HJ-NP-Za-km-z]{32,44})["']/g) || []) {
        const v = addr.slice(1, -1);
        if (!/^0x/i.test(v)) out.push([chainId, v, name]);
      }
    }
    if (chainId === 1815) {
      for (const addr of block.match(/addr1[0-9a-z]{20,}/g) || []) out.push([chainId, addr, name]);
    }
    if (chainId === 397) {
      for (const addr of block.match(/["']([a-z0-9._-]{2,64}\.near)["']/g) || []) out.push([chainId, addr.slice(1, -1), name]);
    }
  }
  return out;
}

async function main() {
  const map = new Map();
  const srcs = [];

  try {
    const j = await (await http("https://www.binance.com/bapi/apex/v1/public/apex/market/por/address")).json();
    const rows = Array.isArray(j?.data) ? j.data : [];
    let n = 0;
    for (const r of rows) {
      const id = BINANCE_NET[String(r.network || "").toUpperCase()];
      if (!id || !r.address) continue;
      put(map, id, r.address, "Binance", "binance-por");
      n += 1;
    }
    srcs.push(`Binance PoR API ${n} mapped rows (https://www.binance.com/bapi/apex/v1/public/apex/market/por/address)`);
    console.log("binance por", n);
  } catch (e) {
    console.warn("binance por failed", e.message);
  }

  for (const [path, name] of LLAMA_FILES) {
    try {
      const text = await (await http(`${LLAMA}/${path}`)).text();
      const rows = parseLlamaJs(text, name);
      for (const [id, addr] of rows) put(map, id, addr, name, `llama:${path}`);
      srcs.push(`DefiLlama ${path} → ${name} (${rows.length} extracts)`);
      console.log(path, name, rows.length);
    } catch (e) {
      console.warn("skip", path, e.message);
    }
  }

  for (const [chainId, name, addrs] of WELL_KNOWN) {
    for (const a of addrs) {
      put(map, chainId, a, name, "etherscan-nametag");
    }
  }
  srcs.push("Etherscan public name tags for Coinbase / Kraken / extra Binance / OKX / Bybit hot wallets");

  const list = [...map.values()].sort((a, b) => a.chainId - b.chainId || a.name.localeCompare(b.name) || a.address.localeCompare(b.address));
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "cex.json"), JSON.stringify(list));
  writeFileSync(
    join(OUT_DIR, "SOURCE.txt"),
    [
      `ysk-mint CEX address book  ${new Date().toISOString().slice(0, 10)}`,
      "",
      "These are publicly disclosed exchange hot/cold wallets (proof-of-reserves / explorer name tags).",
      "They are NOT per-customer deposit addresses. Exchanges issue those privately and rotate them.",
      "Unknown counterparties are labelled 系統外 in the UI — that means unlisted, not a scam verdict.",
      "",
      ...srcs.map((s) => `- ${s}`),
      `- ${list.length} unique chainId+address rows`,
    ].join("\n") + "\n",
  );
  console.log("wrote", list.length, "rows");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
