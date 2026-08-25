import { ChainKey } from "./enums";

export type ChainDefinition = {
  key: (typeof ChainKey)[keyof typeof ChainKey];
  name: string;
  chainId: number;
  eid: number;
  endpoint: `0x${string}`;
  explorer: string;
  rpc: string;
  nativeSymbol: string;
  enabled: boolean;
  testnet: boolean;
};

/** LayerZero EndpointV2 is shared across these testnets. */
const LZ_TESTNET_ENDPOINT = "0x6EDCE65403992e310A62460808c4b910D972f10f" as const;
const LZ_MAINNET_ENDPOINT = "0x1a44076050125825900e736c501f859c50fE728c" as const;

export const CHAINS: Record<(typeof ChainKey)[keyof typeof ChainKey], ChainDefinition> = {
  [ChainKey.Ethereum]: {
    key: ChainKey.Ethereum,
    name: "Ethereum",
    chainId: 1,
    eid: 30101,
    endpoint: LZ_MAINNET_ENDPOINT,
    explorer: "https://etherscan.io",
    rpc: "https://ethereum-rpc.publicnode.com",
    nativeSymbol: "ETH",
    enabled: false,
    testnet: false,
  },
  [ChainKey.Base]: {
    key: ChainKey.Base,
    name: "Base",
    chainId: 8453,
    eid: 30184,
    endpoint: LZ_MAINNET_ENDPOINT,
    explorer: "https://basescan.org",
    rpc: "https://mainnet.base.org",
    nativeSymbol: "ETH",
    enabled: false,
    testnet: false,
  },
  [ChainKey.Arbitrum]: {
    key: ChainKey.Arbitrum,
    name: "Arbitrum One",
    chainId: 42161,
    eid: 30110,
    endpoint: LZ_MAINNET_ENDPOINT,
    explorer: "https://arbiscan.io",
    rpc: "https://arb1.arbitrum.io/rpc",
    nativeSymbol: "ETH",
    enabled: false,
    testnet: false,
  },
  [ChainKey.Optimism]: {
    key: ChainKey.Optimism,
    name: "Optimism",
    chainId: 10,
    eid: 30111,
    endpoint: LZ_MAINNET_ENDPOINT,
    explorer: "https://optimistic.etherscan.io",
    rpc: "https://mainnet.optimism.io",
    nativeSymbol: "ETH",
    enabled: false,
    testnet: false,
  },
  [ChainKey.Bnb]: {
    key: ChainKey.Bnb,
    name: "BNB Chain",
    chainId: 56,
    eid: 30102,
    endpoint: LZ_MAINNET_ENDPOINT,
    explorer: "https://bscscan.com",
    rpc: "https://bsc-dataseed.binance.org",
    nativeSymbol: "BNB",
    enabled: false,
    testnet: false,
  },
  [ChainKey.BaseSepolia]: {
    key: ChainKey.BaseSepolia,
    name: "Base Sepolia",
    chainId: 84532,
    eid: 40245,
    endpoint: LZ_TESTNET_ENDPOINT,
    explorer: "https://sepolia.basescan.org",
    rpc: "https://sepolia.base.org",
    nativeSymbol: "ETH",
    enabled: true,
    testnet: true,
  },
  [ChainKey.ArbSepolia]: {
    key: ChainKey.ArbSepolia,
    name: "Arbitrum Sepolia",
    chainId: 421614,
    eid: 40231,
    endpoint: LZ_TESTNET_ENDPOINT,
    explorer: "https://sepolia.arbiscan.io",
    rpc: "https://sepolia-rollup.arbitrum.io/rpc",
    nativeSymbol: "ETH",
    enabled: true,
    testnet: true,
  },
};

export function chainByChainId(chainId: number): ChainDefinition | undefined {
  return Object.values(CHAINS).find((c) => c.chainId === chainId);
}

export function enabledChains(): ChainDefinition[] {
  return Object.values(CHAINS).filter((c) => c.enabled);
}
