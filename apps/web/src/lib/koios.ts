import { cacheGet, cacheHash, cacheKey, POLICIES } from "./defi/cache.ts";
import { rpcOutboundFetch, rpcTry } from "./rpcPool.ts";

const koiosPolicy = { ...POLICIES.account, class: "http.koios" as const };

function join(base: string, path: string) {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\//, "")}`;
}

async function readKoiosJson(res: Response, path: string): Promise<unknown> {
  if (!res.ok) throw new Error(`koios ${path} ${res.status}`);
  const text = await res.text();
  if (!text.trim() || text.trimStart().startsWith("<")) throw new Error(`koios ${path} html`);
  return JSON.parse(text);
}

async function koiosPostRaw(path: string, body: unknown): Promise<unknown> {
  return rpcTry(1815, async (base, signal) => {
    const res = await rpcOutboundFetch(join(base, path), {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    return readKoiosJson(res, path);
  });
}

export async function koiosPost(path: string, body: unknown, _tries = 3): Promise<unknown> {
  return cacheGet(
    { key: cacheKey("http.koios", 1815, "post2", path.replace(/\//g, "_"), cacheHash(body)), policy: koiosPolicy },
    () => koiosPostRaw(path, body),
  );
}

async function koiosGetRaw(path: string): Promise<unknown> {
  return rpcTry(1815, async (base, signal) => {
    const res = await rpcOutboundFetch(join(base, path), { headers: { accept: "application/json" }, signal });
    return readKoiosJson(res, path);
  });
}

export async function koiosGet(path: string, _tries = 2): Promise<unknown> {
  return cacheGet(
    { key: cacheKey("http.koios", 1815, "get", path.replace(/\//g, "_")), policy: koiosPolicy },
    () => koiosGetRaw(path),
  );
}
