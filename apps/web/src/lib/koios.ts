import { cacheGet, cacheHash, cacheKey, POLICIES } from "./defi/cache.ts";

const KOIOS_BASES = ["https://api.koios.rest/api/v1"];
const koiosPolicy = { ...POLICIES.account, class: "http.koios" as const };

function sleep(ms: number) {
  return new Promise((r) => window.setTimeout(r, ms));
}

function koiosBases() {
  const local =
    typeof location !== "undefined" && (location.hostname === "localhost" || location.hostname === "127.0.0.1");
  return local ? ["/koios", ...KOIOS_BASES] : KOIOS_BASES;
}

async function koiosPostRaw(path: string, body: unknown, tries = 3): Promise<unknown> {
  let last = new Error(`koios ${path}`);
  const bases = koiosBases();
  for (const base of bases) {
    for (let i = 0; i < tries; i++) {
      try {
        const ctrl = new AbortController();
        const timer = window.setTimeout(() => ctrl.abort(), 20000);
        const res = await fetch(`${base}/${path}`, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        window.clearTimeout(timer);
        if (res.status === 429 || res.status >= 500) {
          last = new Error(`koios ${path} ${res.status}`);
          await sleep(400 * (i + 1));
          continue;
        }
        if (!res.ok) {
          last = new Error(`koios ${path} ${res.status}`);
          break;
        }
        return await res.json();
      } catch (e) {
        last = e instanceof Error ? e : last;
        if (i + 1 < tries) await sleep(400 * (i + 1));
      }
    }
  }
  throw last;
}

export async function koiosPost(path: string, body: unknown, tries = 3): Promise<unknown> {
  return cacheGet(
    { key: cacheKey("http.koios", 1815, "post2", path.replace(/\//g, "_"), cacheHash(body)), policy: koiosPolicy },
    () => koiosPostRaw(path, body, tries),
  );
}

async function koiosGetRaw(path: string, tries = 2): Promise<unknown> {
  let last = new Error(`koios ${path}`);
  for (const base of koiosBases()) {
    for (let i = 0; i < tries; i++) {
      try {
        const res = await fetch(`${base}/${path}`, { headers: { accept: "application/json" } });
        if (res.status === 429 || res.status >= 500) {
          last = new Error(`koios ${path} ${res.status}`);
          await sleep(400 * (i + 1));
          continue;
        }
        if (!res.ok) {
          last = new Error(`koios ${path} ${res.status}`);
          break;
        }
        return await res.json();
      } catch (e) {
        last = e instanceof Error ? e : last;
        if (i + 1 < tries) await sleep(400 * (i + 1));
      }
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
