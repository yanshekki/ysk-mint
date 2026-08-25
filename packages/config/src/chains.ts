import { ChainKey } from "./enums";

export type ChainDefinition = {
  key: (typeof ChainKey)[keyof typeof ChainKey];
  name: string;
  short: string;
  chainId: number;
  eid: number;
  endpoint: `0x${string}`;
  explorer: string;
  rpc: string;
  nativeSymbol: string;
  enabled: boolean;
  testnet: boolean;
  evm: boolean;
  featured: boolean;
};

/** LayerZero EndpointV2 is shared across these testnets. */
const LZ_TESTNET_ENDPOINT = "0x6EDCE65403992e310A62460808c4b910D972f10f" as const;
const LZ_MAINNET_ENDPOINT = "0x1a44076050125825900e736c501f859c50fE728c" as const;
const ZERO = "0x0000000000000000000000000000000000000000" as const;

export const CHAINS: Record<(typeof ChainKey)[keyof typeof ChainKey], ChainDefinition> = {
  [ChainKey.Ethereum]: {
    key: ChainKey.Ethereum,
    name: "Ethereum",
    short: "ETH",
    chainId: 1,
    eid: 30101,
    endpoint: LZ_MAINNET_ENDPOINT,
    explorer: "https://etherscan.io",
    rpc: "https://ethereum-rpc.publicnode.com",
    nativeSymbol: "ETH",
    enabled: true,
    testnet: false,
    evm: true,
    featured: true,
  },
  [ChainKey.Base]: {
    key: ChainKey.Base,
    name: "Base",
    short: "Base",
    chainId: 8453,
    eid: 30184,
    endpoint: LZ_MAINNET_ENDPOINT,
    explorer: "https://basescan.org",
    rpc: "https://mainnet.base.org",
    nativeSymbol: "ETH",
    enabled: true,
    testnet: false,
    evm: true,
    featured: true,
  },
  [ChainKey.Arbitrum]: {
    key: ChainKey.Arbitrum,
    name: "Arbitrum One",
    short: "Arb",
    chainId: 42161,
    eid: 30110,
    endpoint: LZ_MAINNET_ENDPOINT,
    explorer: "https://arbiscan.io",
    rpc: "https://arb1.arbitrum.io/rpc",
    nativeSymbol: "ETH",
    enabled: true,
    testnet: false,
    evm: true,
    featured: true,
  },
  [ChainKey.Optimism]: {
    key: ChainKey.Optimism,
    name: "Optimism",
    short: "OP",
    chainId: 10,
    eid: 30111,
    endpoint: LZ_MAINNET_ENDPOINT,
    explorer: "https://optimistic.etherscan.io",
    rpc: "https://mainnet.optimism.io",
    nativeSymbol: "ETH",
    enabled: false,
    testnet: false,
    evm: true,
    featured: false,
  },
  [ChainKey.Bnb]: {
    key: ChainKey.Bnb,
    name: "BNB Chain",
    short: "BNB",
    chainId: 56,
    eid: 30102,
    endpoint: LZ_MAINNET_ENDPOINT,
    explorer: "https://bscscan.com",
    rpc: "https://bsc-dataseed.binance.org",
    nativeSymbol: "BNB",
    enabled: true,
    testnet: false,
    evm: true,
    featured: true,
  },
  [ChainKey.BaseSepolia]: {
    key: ChainKey.BaseSepolia,
    name: "Base Sepolia",
    short: "BaseSep",
    chainId: 84532,
    eid: 40245,
    endpoint: LZ_TESTNET_ENDPOINT,
    explorer: "https://sepolia.basescan.org",
    rpc: "https://sepolia.base.org",
    nativeSymbol: "ETH",
    enabled: true,
    testnet: true,
    evm: true,
    featured: false,
  },
  [ChainKey.ArbSepolia]: {
    key: ChainKey.ArbSepolia,
    name: "Arbitrum Sepolia",
    short: "ArbSep",
    chainId: 421614,
    eid: 40231,
    endpoint: LZ_TESTNET_ENDPOINT,
    explorer: "https://sepolia.arbiscan.io",
    rpc: "https://sepolia-rollup.arbitrum.io/rpc",
    nativeSymbol: "ETH",
    enabled: true,
    testnet: true,
    evm: true,
    featured: false,
  },
  [ChainKey.Avalanche]: {
    key: ChainKey.Avalanche,
    name: "Avalanche",
    short: "AVAX",
    chainId: 43114,
    eid: 30106,
    endpoint: LZ_MAINNET_ENDPOINT,
    explorer: "https://snowtrace.io",
    rpc: "https://api.avax.network/ext/bc/C/rpc",
    nativeSymbol: "AVAX",
    enabled: true,
    testnet: false,
    evm: true,
    featured: true,
  },
  [ChainKey.Cardano]: {
    key: ChainKey.Cardano,
    name: "Cardano",
    short: "ADA",
    chainId: 0,
    eid: 0,
    endpoint: ZERO,
    explorer: "https://cardanoscan.io",
    rpc: "",
    nativeSymbol: "ADA",
    enabled: false,
    testnet: false,
    evm: false,
    featured: true,
  },
  [ChainKey.Near]: {
    key: ChainKey.Near,
    name: "NEAR (Aurora)",
    short: "NEAR",
    chainId: 1313161554,
    eid: 30211,
    endpoint: LZ_MAINNET_ENDPOINT,
    explorer: "https://explorer.aurora.dev",
    rpc: "https://mainnet.aurora.dev",
    nativeSymbol: "ETH",
    enabled: true,
    testnet: false,
    evm: true,
    featured: true,
  },
};

/** Product bar: ETH · AVAX · Base · Arb · ADA · NEAR · BNB */
const FEATURED_ORDER: Array<(typeof ChainKey)[keyof typeof ChainKey]> = [
  ChainKey.Ethereum,
  ChainKey.Avalanche,
  ChainKey.Base,
  ChainKey.Arbitrum,
  ChainKey.Cardano,
  ChainKey.Near,
  ChainKey.Bnb,
];

export function chainByChainId(chainId: number): ChainDefinition | undefined {
  return Object.values(CHAINS).find((c) => c.chainId === chainId && c.evm);
}

export function enabledChains(): ChainDefinition[] {
  return Object.values(CHAINS).filter((c) => c.enabled);
}

export function evmEnabledChains(): ChainDefinition[] {
  return Object.values(CHAINS).filter((c) => c.enabled && c.evm);
}

export function featuredChains(): ChainDefinition[] {
  return FEATURED_ORDER.map((k) => CHAINS[k]);
}

export function testnetChains(): ChainDefinition[] {
  return Object.values(CHAINS).filter((c) => c.testnet && c.enabled && c.evm);
}
