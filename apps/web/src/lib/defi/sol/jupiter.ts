import { SOL_NATIVE_MINT } from "../../defiAddresses.ts";
import { cacheFresh, cacheKey, cacheLastGood, cacheWrite, POLICIES } from "../cache.ts";
import { outboundFetch } from "../../outbound.ts";
import type { DefiProtocol, Quote } from "../types.ts";

const jupPolicy = { ...POLICIES.quote, keep: (q: Quote | null) => Boolean(q && q.usdc > 0) };

async function fetchJupChunk(ids: string[]): Promise<Map<string, Quote>> {
  const out = new Map<string, Quote>();
  if (!ids.length) return out;
  try {
    const res = await outboundFetch(`https://lite-api.jup.ag/price/v2?ids=${ids.join(",")}`);
    if (!res.ok) return out;
    const json = (await res.json()) as { data?: Record<string, { price?: string | number } | null> };
    for (const [mint, row] of Object.entries(json.data ?? {})) {
      const n = Number(row?.price);
      if (Number.isFinite(n) && n > 0) out.set(mint, { usdc: n, source: "jup" });
    }
  } catch {
    /* chunk miss */
  }
  return out;
}

export async function quoteSolMints(mints: string[]) {
  const ids = [...new Set(mints.filter(Boolean))];
  const out = new Map<string, Quote>();
  if (!ids.length) return out;
  const miss: string[] = [];
  for (const mint of ids) {
    const key = cacheKey("http.jup", 101, mint);
    const fresh = cacheFresh<Quote>(key);
    if (fresh) {
      out.set(mint, fresh);
      continue;
    }
    const last = cacheLastGood<Quote>(key);
    if (last) out.set(mint, last);
    miss.push(mint);
  }
  for (let i = 0; i < miss.length; i += 50) {
    const chunk = miss.slice(i, i + 50);
    const got = await fetchJupChunk(chunk);
    for (const [mint, q] of got) {
      cacheWrite(cacheKey("http.jup", 101, mint), jupPolicy, q);
      out.set(mint, q);
    }
  }
  return out;
}

export const jupiterProtocol: DefiProtocol = {
  id: "jupiter-101",
  name: "Jupiter",
  chainId: 101,
  caps: ["quote"],
  async quoteUsd(_ctx, token) {
    const mint = token.native ? SOL_NATIVE_MINT : token.address;
    const map = await quoteSolMints([mint]);
    return map.get(mint) ?? null;
  },
};
