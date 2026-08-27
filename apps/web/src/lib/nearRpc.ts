import { cacheGet, cacheHash, cacheKey, POLICIES } from "./defi/cache.ts";

const RPCS = [
  "https://free.rpc.fastnear.com",
  "https://near.lava.build",
  "https://near.drpc.org",
  "https://rpc.mainnet.near.org",
];

async function nearRpcRaw(method: string, params: unknown) {
  let last: unknown;
  for (const url of RPCS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "ysk", method, params }),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { result?: unknown; error?: unknown };
      if (json.error) {
        last = (json.error as { message?: string }).message ?? json.error;
        continue;
      }
      return json;
    } catch (e) {
      last = e;
    }
  }
  throw new Error(typeof last === "string" ? last : "near rpc");
}

export async function nearRpc(method: string, params: unknown) {
  return cacheGet(
    {
      key: cacheKey("http.near", 397, method, cacheHash(params)),
      policy: { ...POLICIES.account, class: "http.near" },
    },
    () => nearRpcRaw(method, params),
  );
}

export async function nearView<T>(accountId: string, method: string, args: unknown = {}): Promise<T> {
  const bytes = new TextEncoder().encode(JSON.stringify(args));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const args_base64 = btoa(bin);
  const json = await nearRpc("query", {
    request_type: "call_function",
    finality: "optimistic",
    account_id: accountId,
    method_name: method,
    args_base64,
  });
  const out = new Uint8Array((json.result as { result?: number[] })?.result ?? []);
  const text = new TextDecoder().decode(out);
  if (!text) throw new Error(`empty view ${accountId}.${method}`);
  return JSON.parse(text) as T;
}
