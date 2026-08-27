import { SOL_NATIVE_MINT } from "../../defiAddresses.ts";
import type { DefiProtocol, Quote } from "../types.ts";

export async function quoteSolMints(mints: string[]) {
  const ids = [...new Set(mints.filter(Boolean))];
  const out = new Map<string, Quote>();
  if (!ids.length) return out;
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    try {
      const res = await fetch(`https://lite-api.jup.ag/price/v2?ids=${chunk.join(",")}`);
      if (!res.ok) continue;
      const json = (await res.json()) as { data?: Record<string, { price?: string | number } | null> };
      for (const [mint, row] of Object.entries(json.data ?? {})) {
        const n = Number(row?.price);
        if (Number.isFinite(n) && n > 0) out.set(mint, { usdc: n, source: "jup" });
      }
    } catch {
      /* chunk miss */
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
