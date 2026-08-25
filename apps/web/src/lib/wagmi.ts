import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import {
  mainnet,
  avalanche,
  avalancheFuji,
  base,
  arbitrum,
  bsc,
  bscTestnet,
  sepolia,
  baseSepolia,
  arbitrumSepolia,
} from "wagmi/chains";

const projectId = import.meta.env.VITE_WC_PROJECT_ID || "ysk-mint-local";

export const appChains = [
  mainnet,
  avalanche,
  base,
  arbitrum,
  bsc,
  sepolia,
  avalancheFuji,
  baseSepolia,
  arbitrumSepolia,
  bscTestnet,
] as const;

const transports = {
  [mainnet.id]: http("https://ethereum-rpc.publicnode.com"),
  [avalanche.id]: http("https://api.avax.network/ext/bc/C/rpc"),
  [base.id]: http("https://mainnet.base.org"),
  [arbitrum.id]: http("https://arb1.arbitrum.io/rpc"),
  [bsc.id]: http("https://bsc-dataseed.binance.org"),
  [sepolia.id]: http("https://ethereum-sepolia-rpc.publicnode.com"),
  [avalancheFuji.id]: http("https://api.avax-test.network/ext/bc/C/rpc"),
  [baseSepolia.id]: http("https://sepolia.base.org"),
  [arbitrumSepolia.id]: http("https://sepolia-rollup.arbitrum.io/rpc"),
  [bscTestnet.id]: http("https://bsc-testnet-rpc.publicnode.com"),
} as const;

export const wagmiConfig = getDefaultConfig({
  appName: "ysk-mint",
  projectId,
  chains: appChains,
  transports,
  ssr: false,
});
