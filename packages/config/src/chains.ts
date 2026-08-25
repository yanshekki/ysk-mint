import { ChainKey } from "./enums";

export type ChainVm = "evm" | "near" | "cardano";

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
  vm: ChainVm;
  featured: boolean;
};

/** LayerZero EndpointV2 is shared across these testnets. */
const LZ_TESTNET_ENDPOINT = "0x6EDCE65403992e310A62460808c4b910D972f10f" as const;
const LZ_MAINNET_ENDPOINT = "0x1a44076050125825900e736c501f859c50fE728c" as const;
const ZERO = "0x0000000000000000000000000000000000000000" as const;

function evmChain(
  partial: Omit<ChainDefinition, "evm" | "vm">,
): ChainDefinition {
  return { ...partial, evm: true, vm: "evm" };
}

export const CHAINS: Record<(typeof ChainKey)[keyof typeof ChainKey], ChainDefinition> = {
  [ChainKey.Ethereum]: evmChain({
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
    featured: true,
  }),
  [ChainKey.Base]: evmChain({
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
    featured: true,
  }),
  [ChainKey.Arbitrum]: evmChain({
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
    featured: true,
  }),
  [ChainKey.Optimism]: evmChain({
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
    featured: false,
  }),
  [ChainKey.Bnb]: evmChain({
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
    featured: true,
  }),
  [ChainKey.BaseSepolia]: evmChain({
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
    featured: false,
  }),
  [ChainKey.ArbSepolia]: evmChain({
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
    featured: false,
  }),
  [ChainKey.Avalanche]: evmChain({
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
    featured: true,
  }),
  [ChainKey.Cardano]: {
    key: ChainKey.Cardano,
    name: "Cardano",
    short: "ADA",
    /** BIP44 coin type. Not an EVM chain id. */
    chainId: 1815,
    eid: 0,
    endpoint: ZERO,
    explorer: "https://cardanoscan.io",
    rpc: "https://api.koios.rest/api/v1",
    nativeSymbol: "ADA",
    enabled: true,
    testnet: false,
    evm: false,
    vm: "cardano",
    featured: true,
  },
  [ChainKey.Near]: {
    key: ChainKey.Near,
    name: "NEAR",
    short: "NEAR",
    /** CAIP / WalletConnect numeric id for NEAR mainnet. Not Aurora. */
    chainId: 397,
    eid: 0,
    endpoint: ZERO,
    explorer: "https://nearblocks.io",
    rpc: "https://rpc.mainnet.near.org",
    nativeSymbol: "NEAR",
    enabled: true,
    testnet: false,
    evm: false,
    vm: "near",
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

export function nativeChains(): ChainDefinition[] {
  return Object.values(CHAINS).filter((c) => c.enabled && !c.evm);
}

export function featuredChains(): ChainDefinition[] {
  return FEATURED_ORDER.map((k) => CHAINS[k]);
}

export function testnetChains(): ChainDefinition[] {
  return Object.values(CHAINS).filter((c) => c.testnet && c.enabled && c.evm);
}
