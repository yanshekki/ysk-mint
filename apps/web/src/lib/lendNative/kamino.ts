import type { Quote } from "../defiQuotes.ts";
import type { LendCard } from "../lendingExtra.ts";
import type { ProtocolLine } from "../defiPositions.ts";
import { SOL_NATIVE, card, fromHuman, getJson, line } from "./shared.ts";

export async function readKamino(user: string, quotes: Map<string, Quote>): Promise<LendCard | null> {
  if (!user) return null;
  const markets = await getJson<Array<{ lendingMarket?: string; isPrimary?: boolean }>>("https://api.kamino.finance/v2/kamino-market");
  const ids = [...(markets ?? [])].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)).map((m) => m.lendingMarket).filter(Boolean) as string[];
  const lines: ProtocolLine[] = [];
  let health = "—";
  await Promise.all(
    ids.slice(0, 8).map(async (market) => {
      const obs = await getJson<Array<{ obligationAddress?: string }>>(`https://api.kamino.finance/kamino-market/${market}/users/${user}/obligations`);
      for (const ob of (obs ?? []).slice(0, 4)) {
        const pk = ob.obligationAddress;
        if (!pk) continue;
        const loan = await getJson<{
          loanInfo?: {
            currentLtv?: number;
            liquidationLtv?: number;
            collateral?: { deposits?: Array<{ tokenMint?: string; tokenName?: string; tokenAmount?: string; tokenValue?: string; tokenPrice?: number }> };
            debt?: { borrows?: Array<{ tokenMint?: string; tokenName?: string; tokenAmount?: string; tokenValue?: string; tokenPrice?: number }> };
          };
        }>(`https://api.kamino.finance/klend/loans/${pk}`);
        const info = loan?.loanInfo;
        if (!info) continue;
        if (info.currentLtv && info.liquidationLtv) {
          const hf = info.currentLtv > 0 ? info.liquidationLtv / info.currentLtv : 0;
          if (Number.isFinite(hf) && hf > 0) health = hf.toFixed(2);
        }
        const add = async (rows: Array<{ tokenMint?: string; tokenName?: string; tokenAmount?: string; tokenValue?: string; tokenPrice?: number }> | undefined, side: "supply" | "borrow") => {
          for (const r of rows ?? []) {
            const mint = r.tokenMint || "";
            const { raw, n } = fromHuman(r.tokenAmount || "0", mint === SOL_NATIVE || (r.tokenName || "").includes("SOL") ? 9 : 6);
            if (n <= 0) continue;
            const px = Number(r.tokenPrice ?? r.tokenValue) / (n || 1);
            const q: Quote | null =
              quotes.get(`101:${mint === SOL_NATIVE ? "native" : mint.toLowerCase()}`) ??
              (Number.isFinite(Number(r.tokenPrice)) && Number(r.tokenPrice) > 0
                ? { usdc: Number(r.tokenPrice), source: "jup" }
                : Number.isFinite(px) && px > 0
                  ? { usdc: px, source: "jup" }
                  : null);
            const usd = Number(r.tokenValue);
            const lineRow = line("kamino", 101, "SOL", r.tokenName || "TKN", raw, 9, side, mint, q, n);
            if (Number.isFinite(usd) && usd > 0) lineRow.valueUsdc = side === "borrow" ? -usd : usd;
            lines.push(lineRow);
          }
        };
        await add(info.collateral?.deposits, "supply");
        await add(info.debt?.borrows, "borrow");
      }
    }),
  );
  return card("Kamino", 101, "SOL", lines, health);
}
