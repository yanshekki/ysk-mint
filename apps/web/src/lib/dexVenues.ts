import type { Addr } from "./pairKey.ts";

export type VenueKind = "v2" | "v3" | "aero";

export type Venue = {
  id: string;
  name: string;
  chainId: number;
  kind: VenueKind;
  factory: Addr;
  npm?: Addr;
  fees?: number[];
};

export type SeedToken = { address: Addr; symbol: string; decimals: number; icon: string };

export type SeedPair = {
  chainId: number;
  a: SeedToken;
  b: SeedToken;
};

const UNI_V3_FACTORY = "0x1F98431c8aD98523631AE4a59f267346ea31F984" as Addr;
const UNI_V3_NPM = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88" as Addr;
const CAKE_V3_FACTORY = "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865" as Addr;
const CAKE_V3_NPM = "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364" as Addr;
const V3_FEES = [100, 500, 2500, 3000, 10000];

const I = (s: string) => `/tokens/${s}.png`;

const WETH_ETH: SeedToken = { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH", decimals: 18, icon: I("eth") };
const USDC_ETH: SeedToken = { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6, icon: I("usdc") };
const USDT_ETH: SeedToken = { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT", decimals: 6, icon: I("usdt") };
const WBTC_ETH: SeedToken = { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", symbol: "WBTC", decimals: 8, icon: I("wbtc") };
const DAI_ETH: SeedToken = { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", symbol: "DAI", decimals: 18, icon: I("dai") };

const WETH_BASE: SeedToken = { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18, icon: I("eth") };
const USDC_BASE: SeedToken = { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6, icon: I("usdc") };
const USDT_BASE: SeedToken = { address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", symbol: "USDT", decimals: 6, icon: I("usdt") };
const AERO: SeedToken = { address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631", symbol: "AERO", decimals: 18, icon: I("aero") };
const CBBTC: SeedToken = { address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", symbol: "cbBTC", decimals: 8, icon: I("cbbtc") };

const WETH_ARB: SeedToken = { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", symbol: "WETH", decimals: 18, icon: I("eth") };
const USDC_ARB: SeedToken = { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC", decimals: 6, icon: I("usdc") };
const USDT_ARB: SeedToken = { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", symbol: "USDT", decimals: 6, icon: I("usdt") };
const WBTC_ARB: SeedToken = { address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", symbol: "WBTC", decimals: 8, icon: I("wbtc") };
const ARB: SeedToken = { address: "0x912CE59144191C1204E64559FE8253a0e49E6548", symbol: "ARB", decimals: 18, icon: I("arb") };

const WBNB: SeedToken = { address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", symbol: "WBNB", decimals: 18, icon: I("bnb") };
const USDC_BNB: SeedToken = { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", symbol: "USDC", decimals: 18, icon: I("usdc") };
const USDT_BNB: SeedToken = { address: "0x55d398326f99059fF775485246999027B3197955", symbol: "USDT", decimals: 18, icon: I("usdt") };
const CAKE: SeedToken = { address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", symbol: "CAKE", decimals: 18, icon: I("cake") };
const BTCB: SeedToken = { address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", symbol: "BTCB", decimals: 18, icon: I("wbtc") };

const WAVAX: SeedToken = { address: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", symbol: "WAVAX", decimals: 18, icon: I("avax") };
const USDC_AVAX: SeedToken = { address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c6dBe1", symbol: "USDC", decimals: 6, icon: I("usdc") };
const USDT_AVAX: SeedToken = { address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", symbol: "USDT", decimals: 6, icon: I("usdt") };

const WETH_OP: SeedToken = { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18, icon: I("eth") };
const USDC_OP: SeedToken = { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", symbol: "USDC", decimals: 6, icon: I("usdc") };
const USDT_OP: SeedToken = { address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", symbol: "USDT", decimals: 6, icon: I("usdt") };

const WPOL: SeedToken = { address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", symbol: "WPOL", decimals: 18, icon: I("pol") };
const WETH_POL: SeedToken = { address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", symbol: "WETH", decimals: 18, icon: I("eth") };
const USDC_POL: SeedToken = { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", symbol: "USDC", decimals: 6, icon: I("usdc") };
const USDCE_POL: SeedToken = { address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", symbol: "USDC", decimals: 6, icon: I("usdc") };
const USDT_POL: SeedToken = { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", symbol: "USDT", decimals: 6, icon: I("usdt") };

const WETH_LINEA: SeedToken = { address: "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f", symbol: "WETH", decimals: 18, icon: I("eth") };
const USDC_LINEA: SeedToken = { address: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff", symbol: "USDC", decimals: 6, icon: I("usdc") };

export const VENUES: Venue[] = [
  { id: "uni-v3-1", name: "Uniswap V3", chainId: 1, kind: "v3", factory: UNI_V3_FACTORY, npm: UNI_V3_NPM, fees: V3_FEES },
  { id: "uni-v2-1", name: "Uniswap V2", chainId: 1, kind: "v2", factory: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f" },
  { id: "cake-v3-1", name: "Pancake V3", chainId: 1, kind: "v3", factory: CAKE_V3_FACTORY, npm: CAKE_V3_NPM, fees: V3_FEES },
  { id: "sushi-v2-1", name: "Sushi V2", chainId: 1, kind: "v2", factory: "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac" },

  { id: "aero-v2-8453", name: "Aerodrome", chainId: 8453, kind: "aero", factory: "0x420DD381b31aEf6683db6B902084cB0FFECe40Da" },
  { id: "aero-cl-8453", name: "Slipstream", chainId: 8453, kind: "v3", factory: "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A", npm: "0x827922686190790b37229fd06084350E74485b72", fees: V3_FEES },
  { id: "uni-v3-8453", name: "Uniswap V3", chainId: 8453, kind: "v3", factory: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD", npm: "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1", fees: V3_FEES },
  { id: "cake-v3-8453", name: "Pancake V3", chainId: 8453, kind: "v3", factory: CAKE_V3_FACTORY, npm: CAKE_V3_NPM, fees: V3_FEES },

  { id: "uni-v3-42161", name: "Uniswap V3", chainId: 42161, kind: "v3", factory: UNI_V3_FACTORY, npm: UNI_V3_NPM, fees: V3_FEES },
  { id: "camelot-v2-42161", name: "Camelot V2", chainId: 42161, kind: "v2", factory: "0x6EcCab9c1451EA7fAb3BdC15d17D3A4CE035a8dB" },
  { id: "cake-v3-42161", name: "Pancake V3", chainId: 42161, kind: "v3", factory: CAKE_V3_FACTORY, npm: CAKE_V3_NPM, fees: V3_FEES },
  { id: "sushi-v2-42161", name: "Sushi V2", chainId: 42161, kind: "v2", factory: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4" },

  { id: "cake-v2-56", name: "Pancake V2", chainId: 56, kind: "v2", factory: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73" },
  { id: "cake-v3-56", name: "Pancake V3", chainId: 56, kind: "v3", factory: CAKE_V3_FACTORY, npm: CAKE_V3_NPM, fees: V3_FEES },
  { id: "uni-v3-56", name: "Uniswap V3", chainId: 56, kind: "v3", factory: "0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7", npm: "0x7b8A01B39D58278b5DE7e48c8449c9f4F5170613", fees: V3_FEES },

  { id: "joe-v1-43114", name: "Trader Joe", chainId: 43114, kind: "v2", factory: "0x9Ad6C38BE94206cA50bb0d90783181662f0Cfa10" },
  { id: "pangolin-43114", name: "Pangolin", chainId: 43114, kind: "v2", factory: "0xefa94DE7a4656D787667C749f7E69713D5aa241B" },
  { id: "uni-v3-43114", name: "Uniswap V3", chainId: 43114, kind: "v3", factory: "0x740b1c1de25031C31FF4fC9A62f554A55cdC1baD", npm: "0x655C406EBFa14EE2006250925e54ec9AD62C71A3", fees: V3_FEES },

  { id: "uni-v3-10", name: "Uniswap V3", chainId: 10, kind: "v3", factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984", npm: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88", fees: V3_FEES },
  { id: "uni-v2-10", name: "Uniswap V2", chainId: 10, kind: "v2", factory: "0x0c3c1c532F1e39EdF36BE9Fe0bE1410313E074Bf" },
  { id: "velo-v2-10", name: "Velodrome", chainId: 10, kind: "aero", factory: "0xF104d3C995D3275efe009325247ffF80F90C141E" },
  { id: "velo-cl-10", name: "Velodrome CL", chainId: 10, kind: "v3", factory: "0xCc0bDDB707055e04e497aB22a59c2aF4391cd12F", npm: "0x416b433906b1B72FA758e166e239c43d68dC6F29", fees: V3_FEES },

  { id: "uni-v3-137", name: "Uniswap V3", chainId: 137, kind: "v3", factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984", npm: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88", fees: V3_FEES },
  { id: "uni-v2-137", name: "Uniswap V2", chainId: 137, kind: "v2", factory: "0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C" },
  { id: "quick-v2-137", name: "QuickSwap V2", chainId: 137, kind: "v2", factory: "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32" },
  { id: "sushi-v2-137", name: "Sushi V2", chainId: 137, kind: "v2", factory: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4" },

  { id: "uni-v3-59144", name: "Uniswap V3", chainId: 59144, kind: "v3", factory: "0x31FAfd4889FA1269F7a13A66eE0fB458f27D72A9", npm: "0x4615C383F85D0a2BbED973d83ccecf5CB7121463", fees: V3_FEES },
  { id: "cake-v3-59144", name: "Pancake V3", chainId: 59144, kind: "v3", factory: CAKE_V3_FACTORY, npm: CAKE_V3_NPM, fees: V3_FEES },

  { id: "uni-v3-534352", name: "Uniswap V3", chainId: 534352, kind: "v3", factory: "0x70C62C8b8e801124A4Aa81ce07b637A3e83cb919", fees: V3_FEES },

  { id: "uni-v3-480", name: "Uniswap V3", chainId: 480, kind: "v3", factory: "0x7a5028BDa40e7B173C278C5342087826455ea25a", npm: "0xec12a9F9a09f50550686363766Cc153D03c27b5e", fees: V3_FEES },

  { id: "uni-v3-42220", name: "Uniswap V3", chainId: 42220, kind: "v3", factory: "0xAfE208a311B21f13EF87E33A90049fC17A7acDEc", npm: "0x3d79EdAaBC0EaB6F08ED885C05Fc0B014290D95A", fees: V3_FEES },

  { id: "uni-v3-100", name: "Uniswap V3", chainId: 100, kind: "v3", factory: "0xe32F7dD7e3f098D518ff19A22d5f028e076489B1", fees: V3_FEES },

  { id: "uni-v3-324", name: "Uniswap V3", chainId: 324, kind: "v3", factory: "0x8FdA5a7a8dCA67BBcDd10F02Fa0649A937215422", npm: "0x0616e5762c1E7Dc3723c50663dF10a162D690a86", fees: V3_FEES },
  { id: "cake-v3-324", name: "Pancake V3", chainId: 324, kind: "v3", factory: CAKE_V3_FACTORY, npm: CAKE_V3_NPM, fees: V3_FEES },

  { id: "uni-v3-130", name: "Uniswap V3", chainId: 130, kind: "v3", factory: "0x1F98400000000000000000000000000000000003", npm: "0x943e6e07a7e8e791dafc44083e54041d743c46e9", fees: V3_FEES },
  { id: "uni-v2-130", name: "Uniswap V2", chainId: 130, kind: "v2", factory: "0x1f98400000000000000000000000000000000002" },

  { id: "uni-v3-146", name: "Uniswap V3", chainId: 146, kind: "v3", factory: "0xcb2436774C3e191c85056d248EF4260ce5f27A9D", fees: V3_FEES },

  { id: "uni-v3-1868", name: "Uniswap V3", chainId: 1868, kind: "v3", factory: "0x42ae7ec7ff020412639d443e245d936429fbe717", npm: "0x56c1205b0244332011c1e866f4ea5384eb6bfa2c", fees: V3_FEES },
];

function pair(chainId: number, a: SeedToken, b: SeedToken): SeedPair {
  return { chainId, a, b };
}

export const SEED_PAIRS: SeedPair[] = [
  pair(1, WETH_ETH, USDC_ETH),
  pair(1, WETH_ETH, USDT_ETH),
  pair(1, WBTC_ETH, WETH_ETH),
  pair(1, WETH_ETH, DAI_ETH),
  pair(1, USDC_ETH, USDT_ETH),

  pair(8453, WETH_BASE, USDC_BASE),
  pair(8453, WETH_BASE, USDT_BASE),
  pair(8453, AERO, WETH_BASE),
  pair(8453, CBBTC, WETH_BASE),
  pair(8453, AERO, USDC_BASE),

  pair(42161, WETH_ARB, USDC_ARB),
  pair(42161, WETH_ARB, USDT_ARB),
  pair(42161, WBTC_ARB, WETH_ARB),
  pair(42161, ARB, WETH_ARB),

  pair(56, WBNB, USDT_BNB),
  pair(56, WBNB, USDC_BNB),
  pair(56, CAKE, WBNB),
  pair(56, BTCB, WBNB),

  pair(43114, WAVAX, USDC_AVAX),
  pair(43114, WAVAX, USDT_AVAX),

  pair(10, WETH_OP, USDC_OP),
  pair(10, WETH_OP, USDT_OP),
  pair(137, WPOL, USDC_POL),
  pair(137, WPOL, USDT_POL),
  pair(137, WPOL, USDCE_POL),
  pair(137, WETH_POL, USDCE_POL),
  pair(137, WETH_POL, USDC_POL),
  pair(137, WETH_POL, WPOL),
  pair(59144, WETH_LINEA, USDC_LINEA),
];

export const SOL_SEEDS = [
  {
    chainId: 101,
    symbolA: "SOL",
    symbolB: "USDC",
    mintA: "So11111111111111111111111111111111111111112",
    mintB: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    iconA: I("sol"),
    iconB: I("usdc"),
    pool: "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwatnfv1FW",
    dex: "Raydium",
  },
];

export function venuesOn(chainId: number) {
  return VENUES.filter((v) => v.chainId === chainId);
}

export function seedToken(chainId: number, address: string) {
  const a = address.toLowerCase();
  for (const p of SEED_PAIRS) {
    if (p.chainId !== chainId) continue;
    if (p.a.address.toLowerCase() === a) return p.a;
    if (p.b.address.toLowerCase() === a) return p.b;
  }
  return undefined;
}

export function isStable(symbol: string) {
  return symbol === "USDC" || symbol === "USDT" || symbol === "USDt" || symbol === "DAI" || symbol === "USDM" || symbol === "USDA" || symbol === "iUSD" || symbol === "DJED";
}
