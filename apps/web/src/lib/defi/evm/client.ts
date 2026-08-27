import { createPublicClient, defineChain, http, type Chain, type PublicClient } from "viem";
import * as viemChains from "viem/chains";
import { CHAINS } from "@ysk-mint/config";
import { asAddr } from "../../pairKey.ts";

const RPC_FALLBACK: Record<number, string> = {
  1: "https://ethereum-rpc.publicnode.com",
  8453: "https://base.publicnode.com",
  42161: "https://arbitrum-one-rpc.publicnode.com",
  56: "https://bsc-rpc.publicnode.com",
  43114: "https://avalanche-c-chain-rpc.publicnode.com",
  10: "https://optimism-rpc.publicnode.com",
  137: "https://polygon-bor-rpc.publicnode.com",
  59144: "https://linea-rpc.publicnode.com",
  534352: "https://scroll-rpc.publicnode.com",
  100: "https://gnosis-rpc.publicnode.com",
  324: "https://zksync-era-rpc.publicnode.com",
  146: "https://sonic-rpc.publicnode.com",
  999: "https://rpc.hyperliquid.xyz/evm",
  80094: "https://rpc.berachain.com",
  50: "https://rpc.xdc.org",
  2020: "https://api.roninchain.com/rpc",
  81457: "https://rpc.blast.io",
};

const MULTICALL3 = "0xca11bde05977b3631167028862be2a173976ca11" as const;

const known: Record<number, Chain> = {};
for (const v of Object.values(viemChains)) {
  if (!v || typeof v !== "object" || !("id" in v) || !("rpcUrls" in v)) continue;
  const c = v as Chain;
  if (typeof c.id === "number") known[c.id] = c;
}

export function evmPublicClient(chainId: number): PublicClient | undefined {
  const meta = Object.values(CHAINS).find((c) => c.chainId === chainId);
  const url = RPC_FALLBACK[chainId] ?? meta?.rpc;
  if (!url) return undefined;
  const base =
    known[chainId] ??
    defineChain({
      id: chainId,
      name: meta?.name ?? String(chainId),
      nativeCurrency: { name: meta?.nativeSymbol ?? "ETH", symbol: meta?.nativeSymbol ?? "ETH", decimals: 18 },
      rpcUrls: { default: { http: [url] } },
      contracts: { multicall3: { address: MULTICALL3, blockCreated: 0 } },
    });
  const chain: Chain = {
    ...base,
    rpcUrls: { ...base.rpcUrls, default: { http: [url] } },
    contracts: {
      ...base.contracts,
      multicall3: base.contracts?.multicall3 ?? { address: MULTICALL3, blockCreated: 0 },
    },
  };
  return createPublicClient({ chain, transport: http(url, { timeout: 25_000 }) });
}

type Call = {
  address: `0x${string}`;
  abi: readonly unknown[] | unknown[];
  functionName: string;
  args?: readonly unknown[];
};

/** viem multicall needs a configured chain. If the RPC still rejects it, fall back to eth_call. */
function normCall(c: Call): Call {
  return {
    ...c,
    address: asAddr(c.address),
    args: c.args?.map((x) => (typeof x === "string" && x.startsWith("0x") ? asAddr(x) : x)),
  };
}

export async function callMany(client: PublicClient, contracts: readonly Call[]) {
  if (!contracts.length) return [];
  const calls = contracts.map(normCall);
  try {
    return await client.multicall({ contracts: calls as never, allowFailure: true });
  } catch {
    const out: Array<{ status: "success"; result: unknown } | { status: "failure"; error: Error }> = [];
    for (let i = 0; i < calls.length; i += 8) {
      const part = await Promise.all(
        calls.slice(i, i + 8).map(async (c) => {
          try {
            const result = await client.readContract({
              address: c.address,
              abi: c.abi as never,
              functionName: c.functionName as never,
              args: c.args as never,
            });
            return { status: "success" as const, result };
          } catch (error) {
            return { status: "failure" as const, error: error instanceof Error ? error : new Error("call") };
          }
        }),
      );
      out.push(...part);
    }
    return out;
  }
}
