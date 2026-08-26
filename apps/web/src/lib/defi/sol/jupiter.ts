import { SOL_NATIVE_MINT } from "../../defiAddresses.ts";
import { catalogTopOn } from "../universe.ts";
import type { DefiProtocol, MarketRow, Quote } from "../types.ts";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

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
  caps: ["markets", "quote"],
  async quoteUsd(_ctx, token) {
    const mint = token.native ? SOL_NATIVE_MINT : token.address;
    const map = await quoteSolMints([mint]);
    return map.get(mint) ?? null;
  },
  async markets() {
    const tokens = catalogTopOn(101);
    const jup = await quoteSolMints(tokens.map((t) => t.address));
    const rows: MarketRow[] = [];
    for (const t of tokens) {
      if (t.address === USDC) continue;
      const q = jup.get(t.address);
      if (!q) continue;
      rows.push({
        pairId: `101:${t.address}-${USDC}`,
        chainId: 101,
        chainShort: "SOL",
        symbolA: t.symbol ?? "SOL",
        symbolB: "USDC",
        iconA: t.icon ?? "/tokens/sol.png",
        iconB: "/tokens/usdc.png",
        tokenA: t.address,
        tokenB: USDC,
        venues: [
          {
            protocolId: "jupiter-101",
            protocolName: "Jupiter",
            chainId: 101,
            pool: t.address,
            feeLabel: "Jupiter",
            priceAinB: q.usdc,
            reserveA: 0,
            reserveB: 0,
            tvlQuote: 0,
            kind: "jup",
          },
        ],
        price: q.usdc,
        depth: 0,
        venueNames: ["Jupiter"],
      });
    }
    return rows;
  },
};
