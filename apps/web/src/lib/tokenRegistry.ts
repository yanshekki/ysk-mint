export type TokenVm = "evm" | "near" | "cardano";

export type TokenRecord = {
  id: string;
  vm: TokenVm;
  chainId: number;
  symbol: string;
  name: string;
  decimals: number;
  /** Native coin when omitted. */
  address?: string;
  icon: string;
  native?: boolean;
};

const I = (file: string) => `/tokens/${file}.png`;

/** Curated catalog. Icons are CoinMarketCap files stored in public/tokens. Not a full wallet indexer. */
export const TOKEN_CATALOG: TokenRecord[] = [
  { id: "eth-native", vm: "evm", chainId: 1, symbol: "ETH", name: "Ethereum", decimals: 18, icon: I("eth"), native: true },
  { id: "eth-weth", vm: "evm", chainId: 1, symbol: "WETH", name: "Wrapped Ether", decimals: 18, address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", icon: I("eth") },
  { id: "eth-usdt", vm: "evm", chainId: 1, symbol: "USDT", name: "Tether", decimals: 6, address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", icon: I("usdt") },
  { id: "eth-usdc", vm: "evm", chainId: 1, symbol: "USDC", name: "USD Coin", decimals: 6, address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", icon: I("usdc") },
  { id: "eth-dai", vm: "evm", chainId: 1, symbol: "DAI", name: "Dai", decimals: 18, address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", icon: I("dai") },
  { id: "eth-wbtc", vm: "evm", chainId: 1, symbol: "WBTC", name: "Wrapped Bitcoin", decimals: 8, address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", icon: I("wbtc") },
  { id: "eth-link", vm: "evm", chainId: 1, symbol: "LINK", name: "Chainlink", decimals: 18, address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", icon: I("link") },
  { id: "eth-uni", vm: "evm", chainId: 1, symbol: "UNI", name: "Uniswap", decimals: 18, address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", icon: I("uni") },
  { id: "eth-aave", vm: "evm", chainId: 1, symbol: "AAVE", name: "Aave", decimals: 18, address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", icon: I("aave") },

  { id: "base-native", vm: "evm", chainId: 8453, symbol: "ETH", name: "Ethereum", decimals: 18, icon: I("eth"), native: true },
  { id: "base-weth", vm: "evm", chainId: 8453, symbol: "WETH", name: "Wrapped Ether", decimals: 18, address: "0x4200000000000000000000000000000000000006", icon: I("eth") },
  { id: "base-usdc", vm: "evm", chainId: 8453, symbol: "USDC", name: "USD Coin", decimals: 6, address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", icon: I("usdc") },
  { id: "base-usdt", vm: "evm", chainId: 8453, symbol: "USDT", name: "Tether", decimals: 6, address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", icon: I("usdt") },

  { id: "arb-native", vm: "evm", chainId: 42161, symbol: "ETH", name: "Ethereum", decimals: 18, icon: I("eth"), native: true },
  { id: "arb-weth", vm: "evm", chainId: 42161, symbol: "WETH", name: "Wrapped Ether", decimals: 18, address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", icon: I("eth") },
  { id: "arb-arb", vm: "evm", chainId: 42161, symbol: "ARB", name: "Arbitrum", decimals: 18, address: "0x912CE59144191C1204E64559FE8253a0e49E6548", icon: I("arb") },
  { id: "arb-usdc", vm: "evm", chainId: 42161, symbol: "USDC", name: "USD Coin", decimals: 6, address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", icon: I("usdc") },
  { id: "arb-usdt", vm: "evm", chainId: 42161, symbol: "USDT", name: "Tether", decimals: 6, address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", icon: I("usdt") },
  { id: "arb-wbtc", vm: "evm", chainId: 42161, symbol: "WBTC", name: "Wrapped Bitcoin", decimals: 8, address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", icon: I("wbtc") },

  { id: "bnb-native", vm: "evm", chainId: 56, symbol: "BNB", name: "BNB", decimals: 18, icon: I("bnb"), native: true },
  { id: "bnb-wbnb", vm: "evm", chainId: 56, symbol: "WBNB", name: "Wrapped BNB", decimals: 18, address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", icon: I("bnb") },
  { id: "bnb-usdt", vm: "evm", chainId: 56, symbol: "USDT", name: "Tether", decimals: 18, address: "0x55d398326f99059fF775485246999027B3197955", icon: I("usdt") },
  { id: "bnb-usdc", vm: "evm", chainId: 56, symbol: "USDC", name: "USD Coin", decimals: 18, address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", icon: I("usdc") },
  { id: "bnb-btcb", vm: "evm", chainId: 56, symbol: "BTCB", name: "Bitcoin BEP20", decimals: 18, address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", icon: I("btc") },

  { id: "avax-native", vm: "evm", chainId: 43114, symbol: "AVAX", name: "Avalanche", decimals: 18, icon: I("avax"), native: true },
  { id: "avax-wavax", vm: "evm", chainId: 43114, symbol: "WAVAX", name: "Wrapped AVAX", decimals: 18, address: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", icon: I("avax") },
  { id: "avax-usdt", vm: "evm", chainId: 43114, symbol: "USDT", name: "Tether", decimals: 6, address: "0x9702230A8Ea53601f5cD2dc00f7C169313d453e7", icon: I("usdt") },
  { id: "avax-usdc", vm: "evm", chainId: 43114, symbol: "USDC", name: "USD Coin", decimals: 6, address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9dcd18e", icon: I("usdc") },

  { id: "near-native", vm: "near", chainId: 397, symbol: "NEAR", name: "NEAR", decimals: 24, icon: I("near"), native: true },
  { id: "near-usdt", vm: "near", chainId: 397, symbol: "USDT", name: "Tether", decimals: 6, address: "usdt.tether-token.near", icon: I("usdt") },
  { id: "near-usdc", vm: "near", chainId: 397, symbol: "USDC", name: "USD Coin", decimals: 6, address: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1", icon: I("usdc") },

  { id: "ada-native", vm: "cardano", chainId: 1815, symbol: "ADA", name: "Cardano", decimals: 6, icon: I("ada"), native: true },
  {
    id: "ada-min",
    vm: "cardano",
    chainId: 1815,
    symbol: "MIN",
    name: "Minswap",
    decimals: 6,
    address: "29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c64d494e",
    icon: I("ada"),
  },
  {
    id: "ada-djed",
    vm: "cardano",
    chainId: 1815,
    symbol: "DJED",
    name: "Djed",
    decimals: 6,
    address: "8db269c3ec630e06ae29f74bc39edd1f87c819f1056206e879a1cd61446a6564",
    icon: I("ada"),
  },
];

export function tokensFor(vm: TokenVm, chainId?: number) {
  return TOKEN_CATALOG.filter((t) => t.vm === vm && (chainId == null || t.chainId === chainId));
}

export function cardanoByUnit(unit: string) {
  const compact = unit.replace(".", "").toLowerCase();
  return TOKEN_CATALOG.find((t) => t.vm === "cardano" && t.address && t.address.toLowerCase() === compact);
}
