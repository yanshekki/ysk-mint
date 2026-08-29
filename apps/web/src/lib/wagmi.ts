import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { featuredChains, type ChainDefinition } from "@ysk-mint/config";
import { defineChain, type Chain } from "viem";
import * as wagmiChains from "wagmi/chains";
import { arbitrumSepolia, avalancheFuji, baseSepolia, bscTestnet, sepolia } from "wagmi/chains";
import { liveTransport } from "./rpc.ts";

const projectId = import.meta.env.VITE_WC_PROJECT_ID || "ysk-mint-local";

const known: Record<number, Chain> = {};
for (const v of Object.values(wagmiChains)) {
  if (!v || typeof v !== "object" || !("id" in v) || !("rpcUrls" in v)) continue;
  const c = v as Chain;
  if (typeof c.id === "number") known[c.id] = c;
}

function toChain(c: ChainDefinition): Chain {
  const hit = known[c.chainId];
  if (hit) return hit;
  return defineChain({
    id: c.chainId,
    name: c.name,
    nativeCurrency: { name: c.nativeSymbol, symbol: c.nativeSymbol, decimals: c.nativeSymbol === "USD" ? 6 : 18 },
    rpcUrls: { default: { http: [c.rpc] } },
    blockExplorers: { default: { name: c.short, url: c.explorer } },
  });
}

const featuredEvm = featuredChains().filter((c) => c.evm && !c.testnet).map(toChain);
const tests = [sepolia, avalancheFuji, baseSepolia, arbitrumSepolia, bscTestnet];
const seen = new Set<number>();
export const appChains = [...featuredEvm, ...tests].filter((c) => {
  if (seen.has(c.id)) return false;
  seen.add(c.id);
  return true;
}) as unknown as [Chain, ...Chain[]];

const transports = Object.fromEntries(appChains.map((c) => [c.id, liveTransport(c.id)]));

export const wagmiConfig = getDefaultConfig({
  appName: "YSK Mint",
  projectId,
  chains: appChains,
  transports,
  ssr: false,
});
