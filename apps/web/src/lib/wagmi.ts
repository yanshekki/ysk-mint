import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { arbitrumSepolia, baseSepolia } from "wagmi/chains";

const projectId = import.meta.env.VITE_WC_PROJECT_ID || "ysk-mint-local";

export const wagmiConfig = getDefaultConfig({
  appName: "ysk-mint",
  projectId,
  chains: [baseSepolia, arbitrumSepolia],
  transports: {
    [baseSepolia.id]: http("https://sepolia.base.org"),
    [arbitrumSepolia.id]: http("https://sepolia-rollup.arbitrum.io/rpc"),
  },
  ssr: false,
});
