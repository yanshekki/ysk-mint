export type Addr = `0x${string}`;

export type UsdStable = { address: Addr; decimals: number; symbol: string };

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
    v2Factory: "0xf1D7CC64Fb4452F05c498126312eBE29f30Fbcf9",
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
    usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
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
  10: {
    chainId: 10,
    short: "OP",
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    usdcDecimals: 6,
    usdt: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
    usdtDecimals: 6,
    dai: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    daiDecimals: 18,
    wrapped: "0x4200000000000000000000000000000000000006",
    v3Factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    v3Npm: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    v2Factory: "0x0c3c1c532F1e39EdF36BE9Fe0bE1410313E074Bf",
    aave: {
      pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
      provider: "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb",
      data: "0x68100bD5345eA474D93577127C11F39FF8463e93",
    },
  },
  137: {
    chainId: 137,
    short: "POL",
    usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    usdcDecimals: 6,
    usdt: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    usdtDecimals: 6,
    dai: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
    daiDecimals: 18,
    wrapped: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    v3Factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    v3Npm: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    v2Factory: "0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C",
    aave: {
      pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
      provider: "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb",
      data: "0x66E1aBdb06e7363a618D65a910c540dfED23754f",
    },
  },
  59144: {
    chainId: 59144,
    short: "Linea",
    usdc: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",
    usdcDecimals: 6,
    wrapped: "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f",
    v3Factory: "0x31FAfd4889FA1269F7a13A66eE0fB458f27D72A9",
    v3Npm: "0x4615C383F85D0a2BbED973d83ccecf5CB7121463",
    pancakeNpm: "0x46A15B0b27311cedF172AB29E4F4766fbE7F4364",
    aave: {
      pool: "0xc47b8C00b0f69a36fa203Ffeac0334874574a8Ac",
      provider: "0x89502c3731F69DDC95B65753708A07F8Cd0373F4",
      data: "0xc851e6147dcE6A469CC33BE3121b6B2D4CaD2763",
    },
  },
  534352: {
    chainId: 534352,
    short: "SCR",
    usdc: "0x06eFdBFf2a14a7c8E0EC039C4f1e2697b23241d3",
    usdcDecimals: 6,
    wrapped: "0x5300000000000000000000000000000000000004",
    v3Factory: "0x70C62C8b8e801124A4Aa81ce07b637A3e83cb919",
    aave: {
      pool: "0x11fCfe756c05AD438e312a7fd934381537D3cFfe",
      provider: "0x69850D0B276776781C063771b161bd8894BCdD04",
      data: "0xE28E2c8d240dd5eBd0adcab86fbD79df7a052034",
    },
  },
  480: {
    chainId: 480,
    short: "World",
    usdc: "0x79A02482A880bCE3F13e09Da970dC34db4CD24d1",
    usdcDecimals: 6,
    wrapped: "0x4200000000000000000000000000000000000006",
    v3Factory: "0x7a5028BDa40e7B173C278C5342087826455ea25a",
    v3Npm: "0xec12a9F9a09f50550686363766Cc153D03c27b5e",
  },
  42220: {
    chainId: 42220,
    short: "Celo",
    usdc: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    usdcDecimals: 6,
    wrapped: "0x471EcE3750Da237f93B8E339c536989b8978a438",
    v3Factory: "0xAfE208a311B21f13EF87E33A90049fC17A7acDEc",
    v3Npm: "0x3d79EdAaBC0EaB6F08ED885C05Fc0B014290D95A",
    aave: {
      pool: "0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402",
      provider: "0x9F7Cf9417D5251C59fE94fB9147feEe1aAd9Cea5",
      data: "0xc851e6147dcE6A469CC33BE3121b6B2D4CaD2763",
    },
  },
  100: {
    chainId: 100,
    short: "GNO",
    usdc: "0x2a22f9c3b484c3629090FeED35F17Ff8F88f76F0",
    usdcDecimals: 6,
    wrapped: "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d",
    v3Factory: "0xe32F7dD7e3f098D518ff19A22d5f028e076489B1",
    aave: {
      pool: "0xb50201558B00496A145fE76f7424749556E326D8",
      provider: "0x36616cf17557639614c1cdDb356b1B83fc0B2132",
      data: "0x0C6BC4a12039788be08F87e87Cff87FEDbd1D386",
    },
  },
  324: {
    chainId: 324,
    short: "zkSync",
    usdc: "0x1D17CbCF0d6d143135ae90236593E4A2D3ffA0f0",
    usdcDecimals: 6,
    wrapped: "0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91",
    v3Factory: "0x8FdA5a7a8dCA67BBcDd10F02Fa0649A937215422",
    v3Npm: "0x0616e5762c1E7Dc3723c50663dF10a162D690a86",
    pancakeNpm: "0x46A15B0b27311cedF172AB29E4F4766fbE7F4364",
    aave: {
      pool: "0x78e30497a3c7527d953c6B1E3541b021A98Ac43c",
      provider: "0x2A3948BB219D6B2Fa83D64100006391a96bE6cb7",
      data: "0x756Ff6722543F12d25396Ea646B0F2C96dA70c3e",
    },
  },
  130: {
    chainId: 130,
    short: "UNI",
    usdc: "0x078D782b760474a361dDA0AF3839290b0EF57AD6",
    usdcDecimals: 6,
    wrapped: "0x4200000000000000000000000000000000000006",
    v3Factory: "0x1F98400000000000000000000000000000000003",
    v3Npm: "0x943e6e07a7e8e791dafc44083e54041d743c46e9",
    v2Factory: "0x1f98400000000000000000000000000000000002",
  },
  146: {
    chainId: 146,
    short: "Sonic",
    usdc: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894",
    usdcDecimals: 6,
    wrapped: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38",
    v3Factory: "0xcb2436774C3e191c85056d248EF4260ce5f27A9D",
    aave: {
      pool: "0x5362dBb1e601abF3a4c14c22ffEdA64042E5eAA3",
      provider: "0x5C2e738F6E27bCE0F7558051Bf90605dD6176900",
      data: "0xE28E2c8d240dd5eBd0adcab86fbD79df7a052034",
    },
  },
  999: {
    chainId: 999,
    short: "HyperEVM",
    usdc: "0xb88339CB7199b77E23DB6E890353E22632Ba630f",
    usdcDecimals: 6,
    wrapped: "0x5555555555555555555555555555555555555555",
  },
  1868: {
    chainId: 1868,
    short: "Soneium",
    usdc: "0xbA9986D2381edf1DA03B0B9c1f8b00dc4AacC369",
    usdcDecimals: 6,
    wrapped: "0x4200000000000000000000000000000000000006",
    v3Factory: "0x42ae7ec7ff020412639d443e245d936429fbe717",
    v3Npm: "0x56c1205b0244332011c1e866f4ea5384eb6bfa2c",
    aave: {
      pool: "0xDd3d7A7d03D9fD9ef45f3E587287922eF65CA38B",
      provider: "0x82405D1a189bd6cE4667809C35B37fBE136A4c5B",
      data: "0xc851e6147dcE6A469CC33BE3121b6B2D4CaD2763",
    },
  },
  80094: {
    chainId: 80094,
    short: "BERA",
    usdc: "0x549943e04f40284185054145c6E4e9568C1D3241",
    usdcDecimals: 6,
    wrapped: "0x6969696969696969696969696969696969696969",
    v3Factory: "0xD84CBf0B02636E7f53dB9E5e45A616E05d710990",
    v3Npm: "0xFE5E8C83FFE4d9627A75EaA7Fee864768dB989bD",
    v2Factory: "0x5e705e184d233ff2a7cb1553793464a9d0c3028f",
  },
  50: {
    chainId: 50,
    short: "XDC",
    usdc: "0xfA2958CB79b0491CC627c1557F441eF849Ca8eb1",
    usdcDecimals: 6,
    wrapped: "0x951857744785E80e2De051c32EE7b25f9c458C42",
    v2Factory: "0x347D14b13a68457186b2450bb2a6c2Fd7B38352f",
  },
  2020: {
    chainId: 2020,
    short: "RON",
    usdc: "0x0B7007c13325C48911F73A2daD5FA5dCBf808aDc",
    usdcDecimals: 6,
    wrapped: "0xe514d9DEB7966c8BE0ca922de8a064264eA6bcd4",
    v2Factory: "0xb255d6a720bb7c39fee173ce22113397119cb930",
  },
  81457: {
    chainId: 81457,
    short: "Blast",
    usdc: "0x4300000000000000000000000000000000000003",
    usdcDecimals: 18,
    wrapped: "0x4300000000000000000000000000000000000004",
    v3Factory: "0x71b08f13B3c3aF35aAdEb3949afeb1deD1016127",
    v2Factory: "0x37836821a2c03c171fB1a595767f4a16e2b93Fc4",
  },
};

export const V3_FEES = [500, 3000, 100, 10000] as const;

export function usdStables(d: DexChain): UsdStable[] {
  const out: UsdStable[] = [{ address: d.usdc, decimals: d.usdcDecimals, symbol: "USDC" }];
  if (d.usdt) out.push({ address: d.usdt, decimals: d.usdtDecimals ?? 6, symbol: "USDT" });
  if (d.dai) out.push({ address: d.dai, decimals: d.daiDecimals ?? 18, symbol: "DAI" });
  if (d.chainId === 43114) {
    out.push({ address: "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664", decimals: 6, symbol: "USDC.e" });
  }
  if (d.chainId === 42161) {
    out.push({ address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", decimals: 6, symbol: "USDC.e" });
  }
  if (d.chainId === 137) {
    out.push({ address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", decimals: 6, symbol: "USDC.e" });
  }
  if (d.chainId === 10) {
    out.push({ address: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607", decimals: 6, symbol: "USDC.e" });
  }
  if (d.chainId === 324) {
    out.push({ address: "0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4", decimals: 6, symbol: "USDC.e" });
  }
  if (d.chainId === 534352) {
    out.push({ address: "0xf55BEC9cafDbE3c1369a6CF5303e593DbeD00E27", decimals: 6, symbol: "USDT" });
  }
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
  397: {
    "linear-protocol.near": { symbol: "LINEAR", name: "LiNEAR", decimals: 24, icon: "/tokens/near.png" },
    "meta-pool.near": { symbol: "stNEAR", name: "Meta Pool stNEAR", decimals: 24, icon: "/tokens/near.png" },
  },
  43114: {
    "0x2b2c81e08f1af8835a78bb2a90ae924ace0ea4be": { symbol: "sAVAX", name: "BENQI sAVAX", decimals: 18, icon: "/tokens/avax.png" },
  },
  56: {
    "0xa2e3356610840701bdf5611a53974510ae27e2e1": { symbol: "wBETH", name: "Wrapped Beacon ETH", decimals: 18, icon: "/tokens/eth.png" },
  },
  101: {
    msolzycxhdygdzu16g5qsh3i5k3z3kzk7ytfqcjm7so: { symbol: "mSOL", name: "Marinade mSOL", decimals: 9, icon: "/tokens/sol.png" },
    j1toso1uck3rlmjorhttrvwy9hj7x8v9yyac6y7kgcpn: { symbol: "jitoSOL", name: "Jito SOL", decimals: 9, icon: "/tokens/sol.png" },
    bso13r4tkie4kuml71lshtppl2euvfxqecgmod7hgak: { symbol: "bSOL", name: "Blaze bSOL", decimals: 9, icon: "/tokens/sol.png" },
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
