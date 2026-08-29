import { chainByChainId } from "@ysk-mint/config";
import { custom, type Transport } from "viem";
import { outboundFetch } from "./outbound.ts";
import { rpcJsonRpc, rpcOrderedEndpoints } from "./rpcPool.ts";

export { parseRpc } from "./rpcCatalog.ts";
export { rpcEndpoints } from "./rpcCatalog.ts";
export { rpcActiveLabel, rpcOrder, rpcOrderedEndpoints } from "./rpcPool.ts";

export function builtinRpc(chainId: number): string | undefined {
  return rpcOrderedEndpoints(chainId)[0]?.url ?? chainByChainId(chainId)?.rpc;
}

export function rpcUrl(chainId: number): string | undefined {
  return rpcOrderedEndpoints(chainId)[0]?.url;
}

export function liveTransport(chainId: number): Transport {
  return custom(
    {
      async request({ method, params }) {
        return rpcJsonRpc(chainId, method, params ?? []);
      },
    },
    { retryCount: 0 },
  );
}

export async function pingRpc(url: string, expectChainId: number): Promise<"ok" | "bad" | "mismatch"> {
  const chain = chainByChainId(expectChainId);
  try {
    if (!chain || chain.evm || chain.vm === "evm") {
      const res = await outboundFetch(url, {
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
    }
    if (chain.vm === "solana") {
      const res = await outboundFetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth", params: [] }),
        signal: AbortSignal.timeout(8000),
      });
      return res.ok ? "ok" : "bad";
    }
    if (chain.vm === "near") {
      const res = await outboundFetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "ysk", method: "status", params: [] }),
        signal: AbortSignal.timeout(8000),
      });
      return res.ok ? "ok" : "bad";
    }
    if (chain.vm === "sui") {
      const res = await outboundFetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sui_getLatestCheckpointSequenceNumber", params: [] }),
        signal: AbortSignal.timeout(8000),
      });
      return res.ok ? "ok" : "bad";
    }
    const res = await outboundFetch(url, { method: "GET", signal: AbortSignal.timeout(8000) });
    return res.ok || res.status === 405 ? "ok" : "bad";
  } catch {
    return "bad";
  }
}
