import { cacheGet, cacheHash, cacheKey, POLICIES } from "./defi/cache.ts";
import { rpcJsonRpc } from "./rpcPool.ts";

async function nearRpcRaw(method: string, params: unknown) {
  const result = await rpcJsonRpc<unknown>(397, method, params);
  return { result };
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
