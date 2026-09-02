import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { featuredChains, type ChainDefinition } from "@ysk-mint/config";
import { defineChain, type Chain } from "viem";
import * as wagmiChains from "wagmi/chains";
import { arbitrumSepolia, avalancheFuji, baseSepolia, bscTestnet, sepolia } from "wagmi/chains";
import { liveTransport } from "./rpc.ts";
import { rpcEndpoints } from "./rpcCatalog.ts";

const projectId = import.meta.env.VITE_WC_PROJECT_ID || "ysk-mint-local";

const known: Record<number, Chain> = {};
for (const v of Object.values(wagmiChains)) {
  if (!v || typeof v !== "object" || !("id" in v) || !("rpcUrls" in v)) continue;
  const c = v as Chain;
  if (typeof c.id === "number") known[c.id] = c;
}

function chainHttp(c: ChainDefinition): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of [c.rpc, ...rpcEndpoints(c.chainId).map((e) => e.url)]) {
    const key = url.replace(/\/+$/, "").toLowerCase();
    if (!url || seen.has(key)) continue;
    seen.add(key);
    out.push(url);
    if (out.length >= 4) break;
  }
  return out.length ? out : [c.rpc];
}

function toChain(c: ChainDefinition): Chain {
  const hit = known[c.chainId];
  const http = chainHttp(c);
  const native = {
    name: c.nativeSymbol,
    symbol: c.nativeSymbol,
    decimals: (c.nativeSymbol === "USD" ? 6 : 18) as 6 | 18,
  };
  if (hit) {
    return {
      ...hit,
      name: c.name,
      nativeCurrency: { ...hit.nativeCurrency, ...native },
      rpcUrls: { ...hit.rpcUrls, default: { http } },
      blockExplorers: {
        ...hit.blockExplorers,
        default: { ...hit.blockExplorers?.default, name: c.short, url: c.explorer },
      },
    };
  }
  return defineChain({
    id: c.chainId,
    name: c.name,
    nativeCurrency: native,
    rpcUrls: { default: { http } },
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
