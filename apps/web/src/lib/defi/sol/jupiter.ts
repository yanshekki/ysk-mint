import { SOL_NATIVE_MINT } from "../../defiAddresses.ts";
import { SOL_SEEDS } from "../../dexVenues.ts";
import type { DefiProtocol, MarketRow, Quote } from "../types.ts";

export async function quoteSolMints(mints: string[]) {
  const ids = [...new Set(mints.filter(Boolean))];
  const out = new Map<string, Quote>();
  if (!ids.length) return out;
  try {
    const res = await fetch(`https://lite-api.jup.ag/price/v2?ids=${ids.join(",")}`);
    if (!res.ok) return out;
    const json = (await res.json()) as { data?: Record<string, { price?: string | number } | null> };
    for (const [mint, row] of Object.entries(json.data ?? {})) {
      const n = Number(row?.price);
      if (Number.isFinite(n) && n > 0) out.set(mint, { usdc: n, source: "jup" });
    }
  } catch {
    /* keep empty */
  }
  return out;
}

export const jupiterProtocol: DefiProtocol = {
  id: "jupiter-101",
  name: "Jupiter",
  chainId: 101,
  caps: ["markets", "quote"],
  async quoteUsd(_ctx, token) {
    const mint = token.native ? SOL_NATIVE_MINT : token.address;
    const map = await quoteSolMints([mint]);
    return map.get(mint) ?? null;
  },
  async markets() {
    const mints = SOL_SEEDS.map((s) => s.mintA);
    const jup = await quoteSolMints(mints);
    const rows: MarketRow[] = [];
    for (const s of SOL_SEEDS) {
      const q = jup.get(s.mintA);
      if (!q) continue;
      rows.push({
        pairId: `101:${s.mintA}-${s.mintB}`,
        chainId: 101,
        chainShort: "SOL",
        symbolA: s.symbolA,
        symbolB: s.symbolB,
        iconA: s.iconA,
        iconB: s.iconB,
        tokenA: s.mintA,
        tokenB: s.mintB,
        venues: [
          {
            protocolId: "jupiter-101",
            protocolName: s.dex,
            chainId: 101,
            pool: s.pool,
            feeLabel: s.dex,
            priceAinB: q.usdc,
            reserveA: 0,
            reserveB: 0,
            tvlQuote: 0,
            kind: "jup",
          },
        ],
        price: q.usdc,
        depth: 0,
        venueNames: [s.dex],
      });
    }
    return rows;
  },
};
