import type { Quote } from "../defiQuotes.ts";
import type { LendCard } from "../lendingExtra.ts";
import type { ProtocolLine } from "../defiPositions.ts";
import { SOL_NATIVE, card, fromHuman, getJson, line } from "./shared.ts";

export async function readJupiterLend(user: string, quotes: Map<string, Quote>): Promise<LendCard | null> {
  if (!user) return null;
  const lines: ProtocolLine[] = [];
  const earn = await getJson<
    Array<{
      ownerAddress?: string;
      shares?: string;
      underlyingAssets?: string;
      underlyingBalance?: string;
      token?: { assetAddress?: string; asset?: { address?: string; symbol?: string; decimals?: number; price?: string }; symbol?: string; decimals?: number };
    }>
  >(`https://lite-api.jup.ag/lend/v1/earn/positions?users=${user}`);
  for (const p of earn ?? []) {
    if (p.ownerAddress && p.ownerAddress !== user) continue;
    const raw = BigInt(p.underlyingAssets || "0");
    if (raw === 0n) continue;
    const asset = p.token?.asset;
    const mint = p.token?.assetAddress || asset?.address || "";
    const decimals = asset?.decimals ?? p.token?.decimals ?? 6;
    const symbol = asset?.symbol || p.token?.symbol || "TKN";
    const px = Number(asset?.price ?? 0);
    const q =
      quotes.get(`101:${mint === SOL_NATIVE ? "native" : mint.toLowerCase()}`) ??
      (Number.isFinite(px) && px > 0 ? { usdc: px, source: "jup" as const } : null);
    lines.push(line("jupiter-lend", 101, "SOL", symbol, raw, decimals, "supply", mint, q));
  }
  const borrow = await getJson<
    Array<{
      owner?: string;
      ownerAddress?: string;
      supply?: string;
      borrow?: string;
      dustBorrow?: string;
      supplyToken?: { address?: string; symbol?: string; decimals?: number; price?: string };
      borrowToken?: { address?: string; symbol?: string; decimals?: number; price?: string };
    }>
  >(`https://lite-api.jup.ag/lend/v1/borrow/positions?users=${user}`, 20000);
  for (const p of borrow ?? []) {
    const owner = p.ownerAddress || p.owner;
    if (owner && owner !== user) continue;
    const addSide = (tok: { address?: string; symbol?: string; decimals?: number; price?: string } | undefined, amt: string | undefined, side: "supply" | "borrow") => {
      const n = Number(amt);
      if (!Number.isFinite(n) || n <= 0) return;
      const decimals = tok?.decimals ?? 9;
      const { raw } = fromHuman(String(n), decimals);
      const mint = tok?.address || "";
      const px = Number(tok?.price);
      const q =
        quotes.get(`101:${mint === SOL_NATIVE ? "native" : mint.toLowerCase()}`) ??
        (Number.isFinite(px) && px > 0 ? { usdc: px, source: "jup" as const } : null);
      lines.push(line("jupiter-lend", 101, "SOL", tok?.symbol || "TKN", raw || BigInt(Math.round(n * 10 ** Math.min(decimals, 9))), decimals, side, mint, q, n));
    };
    addSide(p.supplyToken, p.supply, "supply");
    addSide(p.borrowToken, p.borrow || p.dustBorrow, "borrow");
  }
  return card("Jupiter Lend", 101, "SOL", lines);
}
