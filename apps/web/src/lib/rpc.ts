import { CHAINS } from "@ysk-mint/config";
import { custom, type Transport } from "viem";
import { useUserSettings } from "./userSettings.ts";

const FALLBACK: Record<number, string> = {
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
  324: "https://mainnet.era.zksync.io",
  146: "https://sonic-rpc.publicnode.com",
  999: "https://rpc.hyperliquid.xyz/evm",
  80094: "https://rpc.berachain.com",
  50: "https://rpc.xdc.org",
  2020: "https://api.roninchain.com/rpc",
  81457: "https://rpc.blast.io",
  1868: "https://rpc.soneium.org",
  42220: "https://forno.celo.org",
  480: "https://worldchain-mainnet.g.alchemy.com/public",
  130: "https://mainnet.unichain.org",
};

export function builtinRpc(chainId: number): string | undefined {
  const meta = Object.values(CHAINS).find((c) => c.chainId === chainId);
  return FALLBACK[chainId] ?? meta?.rpc;
}

export function rpcUrl(chainId: number): string | undefined {
  const customUrl = useUserSettings.getState().rpcByChain?.[String(chainId)]?.trim();
  if (customUrl) return customUrl;
  return builtinRpc(chainId);
}

export function parseRpc(raw: string): string | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" && u.protocol !== "http:") return undefined;
    if (!u.hostname) return undefined;
    return s;
  } catch {
    return undefined;
  }
}

export function liveTransport(chainId: number): Transport {
  return custom(
    {
      async request({ method, params }) {
        const url = rpcUrl(chainId);
        if (!url) throw new Error("no rpc");
        const ctrl = new AbortController();
        const timer = globalThis.setTimeout(() => ctrl.abort(), 25_000);
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: params ?? [] }),
            signal: ctrl.signal,
          });
          const json = (await res.json()) as { result?: unknown; error?: { message?: string; code?: number; data?: unknown } };
          if (json.error) {
            const err = new Error(json.error.message || "rpc");
            Object.assign(err, { code: json.error.code, data: json.error.data });
            throw err;
          }
          return json.result;
        } finally {
          globalThis.clearTimeout(timer);
        }
      },
    },
    { retryCount: 1 },
  );
}

export async function pingRpc(url: string, expectChainId: number): Promise<"ok" | "bad" | "mismatch"> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json()) as { result?: string };
    if (!json.result) return "bad";
    const got = Number.parseInt(json.result, 16);
    if (got !== expectChainId) return "mismatch";
    return "ok";
  } catch {
    return "bad";
  }
}
