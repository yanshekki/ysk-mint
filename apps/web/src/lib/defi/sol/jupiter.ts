import { SOL_NATIVE_MINT } from "../../defiAddresses.ts";
import { cacheFresh, cacheKey, cacheLastGood, cacheWrite, POLICIES } from "../cache.ts";
import { outboundFetch } from "../../outbound.ts";
import type { DefiProtocol, Quote } from "../types.ts";

const jupPolicy = { ...POLICIES.quote, keep: (q: Quote | null) => Boolean(q && q.usdc > 0) };

function jupQuote(mint: string, row: unknown): Quote | null {
  if (!mint || !row || typeof row !== "object" || Array.isArray(row)) return null;
  const rec = row as { usdPrice?: unknown; price?: unknown; liquidity?: unknown };
  const n = Number(rec.usdPrice ?? rec.price);
  if (!(Number.isFinite(n) && n > 0)) return null;
  const depth = Number(rec.liquidity);
  const q: Quote = { usdc: n, source: "jup" };
  if (Number.isFinite(depth) && depth > 0) q.depth = depth;
  return q;
}

async function fetchJupChunk(ids: string[]): Promise<Map<string, Quote>> {
  const out = new Map<string, Quote>();
  if (!ids.length) return out;
  try {
    const res = await outboundFetch(`https://lite-api.jup.ag/price/v3?ids=${ids.join(",")}`);
    if (!res.ok) return out;
    const json = (await res.json()) as unknown;
    if (!json || typeof json !== "object" || Array.isArray(json)) return out;
    const body = json as Record<string, unknown>;
    const rows =
      body.data && typeof body.data === "object" && !Array.isArray(body.data)
        ? (body.data as Record<string, unknown>)
        : body;
    const byMint = new Map<string, Quote>();
    for (const [mint, row] of Object.entries(rows)) {
      const q = jupQuote(mint, row);
      if (q) byMint.set(mint, q);
    }
    for (const mint of ids) {
      const q = byMint.get(mint) ?? [...byMint.entries()].find(([k]) => k.toLowerCase() === mint.toLowerCase())?.[1];
      if (q) out.set(mint, q);
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
