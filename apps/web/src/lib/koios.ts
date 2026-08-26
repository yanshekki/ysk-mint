const BASE = "https://api.koios.rest/api/v1";

function sleep(ms: number) {
  return new Promise((r) => window.setTimeout(r, ms));
}

export async function koiosPost(path: string, body: unknown, tries = 3): Promise<unknown> {
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

export async function koiosGet(path: string, tries = 2): Promise<unknown> {
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
