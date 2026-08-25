import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { createConfig as createPrivyWagmiConfig } from "@privy-io/wagmi";
import {
  mainnet,
  avalanche,
  base,
  arbitrum,
  bsc,
  baseSepolia,
  arbitrumSepolia,
} from "wagmi/chains";

const projectId = import.meta.env.VITE_WC_PROJECT_ID || "ysk-mint-local";

export const appChains = [mainnet, avalanche, base, arbitrum, bsc, baseSepolia, arbitrumSepolia] as const;

const transports = {
  [mainnet.id]: http("https://ethereum-rpc.publicnode.com"),
  [avalanche.id]: http("https://api.avax.network/ext/bc/C/rpc"),
  [base.id]: http("https://mainnet.base.org"),
  [arbitrum.id]: http("https://arb1.arbitrum.io/rpc"),
  [bsc.id]: http("https://bsc-dataseed.binance.org"),
  [baseSepolia.id]: http("https://sepolia.base.org"),
  [arbitrumSepolia.id]: http("https://sepolia-rollup.arbitrum.io/rpc"),
} as const;

export const wagmiConfig = getDefaultConfig({
  appName: "ysk-mint",
  projectId,
  chains: appChains,
  transports,
  ssr: false,
});

/** Used when Privy owns connectors. */
export const privyWagmiConfig = createPrivyWagmiConfig({
  chains: appChains,
  transports,
});

export const privyAppId = import.meta.env.VITE_PRIVY_APP_ID ?? "";
