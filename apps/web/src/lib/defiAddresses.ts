export type Addr = `0x${string}`;

export type UsdStable = { address: Addr; decimals: number; symbol: "USDC" | "USDT" | "DAI" };

export type DexChain = {
  chainId: number;
  short: string;
  usdc: Addr;
  usdcDecimals: number;
  usdt?: Addr;
  usdtDecimals?: number;
  dai?: Addr;
  daiDecimals?: number;
  wrapped: Addr;
  v3Factory?: Addr;
  v3Npm?: Addr;
  pancakeNpm?: Addr;
  v2Factory?: Addr;
  aave?: { pool: Addr; provider: Addr; data: Addr };
};

const UNI_V3_FACTORY = "0x1F98431c8aD98523631AE4a59f267346ea31F984" as const;
const UNI_V3_NPM = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88" as const;

export const DEX: Record<number, DexChain> = {
  1: {
    chainId: 1,
    short: "ETH",
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    usdcDecimals: 6,
    usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    usdtDecimals: 6,
    dai: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    daiDecimals: 18,
    wrapped: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    v3Factory: UNI_V3_FACTORY,
    v3Npm: UNI_V3_NPM,
    v2Factory: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    aave: {
      pool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
      provider: "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e",
      data: "0x0a16f2FCC0D44FaE41cc54e079281D84A363bECD",
    },
  },
  8453: {
    chainId: 8453,
    short: "Base",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    usdcDecimals: 6,
    usdt: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    usdtDecimals: 6,
    dai: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    daiDecimals: 18,
    wrapped: "0x4200000000000000000000000000000000000006",
    v3Factory: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
    v3Npm: "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1",
    v2Factory: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6",
    aave: {
      pool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
      provider: "0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D",
      data: "0x0F43731EB8d45A581f4a36DD74F5f358bc90C73A",
    },
  },
  42161: {
    chainId: 42161,
    short: "Arb",
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    usdcDecimals: 6,
    usdt: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    usdtDecimals: 6,
    dai: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    daiDecimals: 18,
    wrapped: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    v3Factory: UNI_V3_FACTORY,
    v3Npm: UNI_V3_NPM,
    v2Factory: "0xf1D7CC64Fb4452F05c88c90C016EC5ad76098732",
    aave: {
      pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
      provider: "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb",
      data: "0x243Aa95cAC2a25651eda86e80bEe66114413c43b",
    },
  },
  56: {
    chainId: 56,
    short: "BNB",
    usdc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    usdcDecimals: 18,
    usdt: "0x55d398326f99059fF775485246999027B3197955",
    usdtDecimals: 18,
    dai: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3",
    daiDecimals: 18,
    wrapped: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    v3Factory: "0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7",
    v3Npm: "0x7b8A01B39D58278b5DE7e48c8449c9f4F5170613",
    pancakeNpm: "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364",
    v2Factory: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73",
    aave: {
      pool: "0x6807dc923806fE8Fd134338EABCA509979a7e0cB",
      provider: "0xff75B6da14FfbbfD355Daf7a2731456b3562Ba6D",
      data: "0xc90Df74A7c16245c5F5C5870327Ceb38Fe5d5328",
    },
  },
  43114: {
    chainId: 43114,
    short: "AVAX",
    usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c6dBe1",
    usdcDecimals: 6,
    usdt: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
    usdtDecimals: 6,
    dai: "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70",
    daiDecimals: 18,
    wrapped: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    v3Factory: "0x740b1c1de25031C31FF4fC9A62f554A55cdC1baD",
    v3Npm: "0x655C406EBFa14EE2006250925e54ec9AD62C71A3",
    v2Factory: "0x9Ad6C38BE94206cA50bb0d90783181662f0Cfa10",
    aave: {
      pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
      provider: "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb",
      data: "0x243Aa95cAC2a25651eda86e80bEe66114413c43b",
    },
  },
};

export const V3_FEES = [500, 3000, 100, 10000] as const;

export function usdStables(d: DexChain): UsdStable[] {
  const out: UsdStable[] = [{ address: d.usdc, decimals: d.usdcDecimals, symbol: "USDC" }];
  if (d.usdt) out.push({ address: d.usdt, decimals: d.usdtDecimals ?? 6, symbol: "USDT" });
  if (d.dai) out.push({ address: d.dai, decimals: d.daiDecimals ?? 18, symbol: "DAI" });
  return out;
}

export function isUsdStableAddress(d: DexChain, addr?: string) {
  if (!addr) return false;
  const a = addr.toLowerCase();
  return usdStables(d).some((s) => s.address.toLowerCase() === a);
}

/** Liquid-staking receipt tokens shown as a staking card, not Wallet. */
export const LST: Record<number, Record<string, { symbol: string; name: string; decimals: number; icon: string }>> = {
  1: {
    "0xae7ab96520de3a18e5e111b5eaab095312d7fe84": { symbol: "stETH", name: "Lido stETH", decimals: 18, icon: "/tokens/eth.png" },
    "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0": { symbol: "wstETH", name: "Wrapped stETH", decimals: 18, icon: "/tokens/eth.png" },
    "0xae78736cd615f374d3085123a210448e74fc6393": { symbol: "rETH", name: "Rocket Pool ETH", decimals: 18, icon: "/tokens/eth.png" },
    "0xbe9895146f7af43049ca1c1ae358b0541ea49704": { symbol: "cbETH", name: "Coinbase ETH", decimals: 18, icon: "/tokens/eth.png" },
    "0xcd5fe23c85820f7b72d0926fc9b05b43e359b7ee": { symbol: "weETH", name: "ether.fi weETH", decimals: 18, icon: "/tokens/eth.png" },
  },
  8453: {
    "0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22": { symbol: "cbETH", name: "Coinbase ETH", decimals: 18, icon: "/tokens/eth.png" },
    "0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452": { symbol: "wstETH", name: "Wrapped stETH", decimals: 18, icon: "/tokens/eth.png" },
    "0x04c0599ae5a44757c0af6f9ec3b93da8976c150a": { symbol: "weETH", name: "ether.fi weETH", decimals: 18, icon: "/tokens/eth.png" },
  },
  42161: {
    "0x5979d7b546e38e414f7e9822514be443a4800529": { symbol: "wstETH", name: "Wrapped stETH", decimals: 18, icon: "/tokens/eth.png" },
    "0xec70dcb4a1efa46b8f2d97c310c9c4790ba5ffa8": { symbol: "rETH", name: "Rocket Pool ETH", decimals: 18, icon: "/tokens/eth.png" },
    "0x35751007a407ca6feffe80b3cb397736d2cf4dbe": { symbol: "weETH", name: "ether.fi weETH", decimals: 18, icon: "/tokens/eth.png" },
  },
};

export function isLst(chainId: number, token?: string) {
  if (!token) return false;
  return Boolean(LST[chainId]?.[token.toLowerCase()]);
}

export const SOL_NATIVE_MINT = "So11111111111111111111111111111111111111112";
