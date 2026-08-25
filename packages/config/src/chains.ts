import { ChainKey } from "./enums";

export type ChainVm = "evm" | "near" | "cardano" | "solana";

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
  [ChainKey.EthereumSepolia]: evmChain({
    key: ChainKey.EthereumSepolia,
    name: "Ethereum Sepolia",
    short: "ETHSep",
    chainId: 11155111,
    eid: 40161,
    endpoint: LZ_TESTNET_ENDPOINT,
    explorer: "https://sepolia.etherscan.io",
    rpc: "https://ethereum-sepolia-rpc.publicnode.com",
    nativeSymbol: "ETH",
    enabled: true,
    testnet: true,
    featured: false,
  }),
  [ChainKey.AvalancheFuji]: evmChain({
    key: ChainKey.AvalancheFuji,
    name: "Avalanche Fuji",
    short: "Fuji",
    chainId: 43113,
    eid: 40106,
    endpoint: LZ_TESTNET_ENDPOINT,
    explorer: "https://testnet.snowtrace.io",
    rpc: "https://api.avax-test.network/ext/bc/C/rpc",
    nativeSymbol: "AVAX",
    enabled: true,
    testnet: true,
    featured: false,
  }),
  [ChainKey.BnbTestnet]: evmChain({
    key: ChainKey.BnbTestnet,
    name: "BNB Testnet",
    short: "BNBTest",
    chainId: 97,
    eid: 40102,
    endpoint: LZ_TESTNET_ENDPOINT,
    explorer: "https://testnet.bscscan.com",
    rpc: "https://bsc-testnet-rpc.publicnode.com",
    nativeSymbol: "BNB",
    enabled: true,
    testnet: true,
    featured: false,
  }),
  [ChainKey.CardanoPreprod]: {
    key: ChainKey.CardanoPreprod,
    name: "Cardano Preprod",
    short: "ADAPre",
    chainId: 18151,
    eid: 0,
    endpoint: ZERO,
    explorer: "https://preprod.cardanoscan.io",
    rpc: "https://preprod.koios.rest/api/v1",
    nativeSymbol: "ADA",
    enabled: true,
    testnet: true,
    evm: false,
    vm: "cardano",
    featured: false,
  },
  [ChainKey.NearTestnet]: {
    key: ChainKey.NearTestnet,
    name: "NEAR Testnet",
    short: "NEARTest",
    chainId: 398,
    eid: 0,
    endpoint: ZERO,
    explorer: "https://testnet.nearblocks.io",
    rpc: "https://rpc.testnet.near.org",
    nativeSymbol: "NEAR",
    enabled: true,
    testnet: true,
    evm: false,
    vm: "near",
    featured: false,
  },
  [ChainKey.Solana]: {
    key: ChainKey.Solana,
    name: "Solana",
    short: "SOL",
    /** Solana mainnet-beta cluster id. Not an EVM chain id. */
    chainId: 101,
    eid: 0,
    endpoint: ZERO,
    explorer: "https://solscan.io",
    rpc: "https://api.mainnet-beta.solana.com",
    nativeSymbol: "SOL",
    enabled: true,
    testnet: false,
    evm: false,
    vm: "solana",
    featured: true,
  },
  [ChainKey.SolanaDevnet]: {
    key: ChainKey.SolanaDevnet,
    name: "Solana Devnet",
    short: "SOLDev",
    chainId: 103,
    eid: 0,
    endpoint: ZERO,
    explorer: "https://solscan.io/?cluster=devnet",
    rpc: "https://api.devnet.solana.com",
    nativeSymbol: "SOL",
    enabled: true,
    testnet: true,
    evm: false,
    vm: "solana",
    featured: false,
  },
};

/** Product bar: ETH · AVAX · Base · Arb · ADA · NEAR · BNB · SOL */
const FEATURED_ORDER: Array<(typeof ChainKey)[keyof typeof ChainKey]> = [
  ChainKey.Ethereum,
  ChainKey.Avalanche,
  ChainKey.Base,
  ChainKey.Arbitrum,
  ChainKey.Cardano,
  ChainKey.Near,
  ChainKey.Bnb,
  ChainKey.Solana,
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

const TESTNET_ORDER: Array<(typeof ChainKey)[keyof typeof ChainKey]> = [
  ChainKey.EthereumSepolia,
  ChainKey.AvalancheFuji,
  ChainKey.BaseSepolia,
  ChainKey.ArbSepolia,
  ChainKey.CardanoPreprod,
  ChainKey.NearTestnet,
  ChainKey.BnbTestnet,
  ChainKey.SolanaDevnet,
];

export function testnetChains(): ChainDefinition[] {
  return TESTNET_ORDER.map((k) => CHAINS[k]).filter((c) => c.enabled);
}
