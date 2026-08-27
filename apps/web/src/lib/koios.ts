import { cacheGet, cacheHash, cacheKey, POLICIES } from "./defi/cache.ts";

const BASE = "https://api.koios.rest/api/v1";
const koiosPolicy = { ...POLICIES.account, class: "http.koios" as const };

function sleep(ms: number) {
  return new Promise((r) => window.setTimeout(r, ms));
}

async function koiosPostRaw(path: string, body: unknown, tries = 3): Promise<unknown> {
  let last = new Error(`koios ${path}`);
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${BASE}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 429 || res.status >= 500) {
        last = new Error(`koios ${path} ${res.status}`);
        await sleep(400 * (i + 1));
        continue;
      }
      if (!res.ok) throw new Error(`koios ${path} ${res.status}`);
      return await res.json();
    } catch (e) {
      last = e instanceof Error ? e : last;
      if (i + 1 < tries) await sleep(400 * (i + 1));
    }
  }
  throw last;
}

export async function koiosPost(path: string, body: unknown, tries = 3): Promise<unknown> {
  return cacheGet(
    { key: cacheKey("http.koios", 1815, "post", path.replace(/\//g, "_"), cacheHash(body)), policy: koiosPolicy },
    () => koiosPostRaw(path, body, tries),
  );
}

async function koiosGetRaw(path: string, tries = 2): Promise<unknown> {
  let last = new Error(`koios ${path}`);
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${BASE}/${path}`, { headers: { accept: "application/json" } });
      if (res.status === 429 || res.status >= 500) {
        last = new Error(`koios ${path} ${res.status}`);
        await sleep(400 * (i + 1));
        continue;
      }
      if (!res.ok) throw new Error(`koios ${path} ${res.status}`);
      return await res.json();
    } catch (e) {
      last = e instanceof Error ? e : last;
      if (i + 1 < tries) await sleep(400 * (i + 1));
    }
  }
  throw last;
}

export async function koiosGet(path: string, tries = 2): Promise<unknown> {
  return cacheGet(
    { key: cacheKey("http.koios", 1815, "get", path.replace(/\//g, "_")), policy: koiosPolicy },
    () => koiosGetRaw(path, tries),
  );
}
