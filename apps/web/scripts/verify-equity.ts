/**
 * Classifier lock for tokenized US stocks / ETFs.
 * Run: pnpm --filter @ysk-mint/web verify:equity
 */
import { makeEquityLookup, nameLooksLikeUsEquity } from "../src/lib/tokenizedEquity.ts";

let fails = 0;

function assert(ok: boolean, msg: string) {
  if (ok) {
    console.log(`ok  ${msg}`);
    return;
  }
  fails += 1;
  console.error(`fail  ${msg}`);
}

assert(nameLooksLikeUsEquity("TSLAX", "Tesla tokenized stock (xStock)"), "TSLAX xStock");
assert(nameLooksLikeUsEquity("NVDAX", "NVIDIA tokenized stock (xStock)"), "NVDAX xStock");
assert(nameLooksLikeUsEquity("AAPLx", "Apple xStock"), "AAPLx xStock");
assert(nameLooksLikeUsEquity("NVDAon", "NVIDIA Tokenized Stock (Ondo)"), "NVDAon Ondo");
assert(nameLooksLikeUsEquity("SPYX", "SP500 tokenized ETF (xStock)"), "SPYX ETF");
assert(nameLooksLikeUsEquity("QQQX", "Nasdaq tokenized ETF (xStock)"), "QQQX ETF");
assert(nameLooksLikeUsEquity("CRCLon", "Circle Internet Group Tokenized Stock (Ondo)"), "CRCLon Ondo");
assert(nameLooksLikeUsEquity("SPCXx", "SpaceX tokenized stock (xStock)"), "SPCXx xStock");
assert(nameLooksLikeUsEquity("preSPCX", "SpaceX Pre-IPO stock (Republic)"), "Republic pre-IPO");
assert(nameLooksLikeUsEquity("CRCLB", "Circle Internet Group Tokenized bStocks"), "CRCLB bStocks");
assert(nameLooksLikeUsEquity("bTSLA", "Backed Tesla"), "bTSLA Backed equity");
assert(nameLooksLikeUsEquity("bCSPX", "Backed CSPX Core S&P 500"), "bCSPX S&P 500");
assert(nameLooksLikeUsEquity("AAPLc", "Apple Coinbase Tokenized Stock"), "AAPLc Coinbase");
assert(nameLooksLikeUsEquity("NVDAc", "NVIDIA Coinbase Tokenized Stock"), "NVDAc Coinbase");
assert(!nameLooksLikeUsEquity("cbBTC", "Coinbase Wrapped BTC"), "cbBTC is not a stock");
assert(!nameLooksLikeUsEquity("bIB01", "Backed IB01 $ Treasury Bond 0-1yr"), "bIB01 treasury stays out");

assert(!nameLooksLikeUsEquity("ETH", "Ethereum"), "ETH");
assert(!nameLooksLikeUsEquity("USDC", "USD Coin"), "USDC");
assert(!nameLooksLikeUsEquity("BENJI", "Franklin OnChain U.S. Government Money Fund"), "BENJI treasury");
assert(!nameLooksLikeUsEquity("PAXG", "PAX Gold"), "PAXG gold");
assert(!nameLooksLikeUsEquity("RIF", "Rootstock Infrastructure Framework"), "Rootstock");
assert(!nameLooksLikeUsEquity("BSPX", "Bending Spoons xStock"), "Bending Spoons");
assert(!nameLooksLikeUsEquity("SKHYB", "SK Hynix Tokenized bStocks"), "SK Hynix");
assert(!nameLooksLikeUsEquity("META", "MetaDAO"), "MetaDAO");

const tsla = "0x8ad3c73f833d3f9a523ab01476625f269aeb7cf0";
const usdc = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const lookup = makeEquityLookup([
  { symbol: "TSLAX", name: "Tesla tokenized stock (xStock)", chainId: 1, address: tsla },
  { symbol: "USDC", name: "USD Coin", chainId: 1, address: usdc },
  { symbol: "ETH", name: "Ethereum", chainId: 1 },
  { symbol: "BSPX", name: "Bending Spoons xStock", chainId: 1, address: "0x7796f4e23a62ef3653829c21032a9e24beaf4cf5" },
]);

assert(lookup.isToken("TSLAX", undefined, 1, tsla.toUpperCase().replace("0X", "0x")), "TSLAX by checksum address");
assert(lookup.isToken("tslax"), "TSLAX by symbol case");
assert(!lookup.isToken("BSPX", "Bending Spoons xStock", 1, "0x7796f4e23a62ef3653829c21032a9e24beaf4cf5"), "BSPX stays out of lookup");
assert(
  lookup.isPair({ chainId: 1, tokenA: tsla, tokenB: usdc, symbolA: "TSLAX", symbolB: "USDC" }),
  "TSLAX/USDC is an equity pair",
);
assert(
  !lookup.isPair({ chainId: 1, tokenA: "0xeeee", tokenB: usdc, symbolA: "ETH", symbolB: "USDC" }),
  "ETH/USDC is not an equity pair",
);
assert(lookup.chainIds.size === 1 && lookup.chainIds.has(1), "only the TSLAX chain is indexed");

const multi = makeEquityLookup([
  { symbol: "TSLAX", name: "Tesla tokenized stock (xStock)", chainId: 1, address: tsla },
  { symbol: "NVDAon", name: "NVIDIA Tokenized Stock (Ondo)", chainId: 56, address: "0xa9ee28c80f960b889dfbd1902055218cba016f75" },
  { symbol: "USDC", name: "USD Coin", chainId: 8453, address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" },
]);
assert(multi.chainIds.has(1) && multi.chainIds.has(56) && !multi.chainIds.has(8453), "equity chains exclude Base");

if (fails) {
  console.error(`verify-equity: ${fails} failed`);
  process.exit(1);
}
console.log("verify-equity ok");
