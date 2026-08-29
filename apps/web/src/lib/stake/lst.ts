import { formatUnits, type Address, type PublicClient } from "viem";
import { accountCache } from "../defi/cache.ts";
import { LST } from "../defiAddresses.ts";
import { type Quote } from "../defiQuotes.ts";
import { SOL_LST, fmtAmt, type StakeLine } from "./shared.ts";
import { SAVAX, savaxAbi } from "./savax.ts";
import i18n from "../i18n.ts";

export function lstStakeLines(
  chainId: number,
  rows: Array<{ id: string; symbol: string; name: string; icon: string; amount: string; raw: bigint; contract?: string }>,
  quotes: Map<string, Quote>,
  liquidNote: string,
): StakeLine[] {
  const map = { ...(LST[chainId] ?? {}) };
  if (chainId === 101) {
    for (const [k, v] of Object.entries(SOL_LST)) {
      map[k] = { symbol: v.symbol, name: v.name, decimals: 9, icon: v.icon };
    }
  }
  if (!Object.keys(map).length) return [];
  const short = chainId === 1 ? "ETH" : chainId === 8453 ? "Base" : chainId === 42161 ? "Arb" : chainId === 397 ? "NEAR" : chainId === 101 ? "SOL" : chainId === 43114 ? "AVAX" : chainId === 56 ? "BNB" : String(chainId);
  const lines: StakeLine[] = [];
  for (const r of rows) {
    if (!r.contract || r.raw === 0n) continue;
    const meta = map[r.contract.toLowerCase()];
    if (!meta) continue;
    const q = quotes.get(`${chainId}:${r.contract.toLowerCase()}`) ?? quotes.get(`${chainId}:native`);
    const n = Number(r.amount.replace(/,/g, ""));
    lines.push({
      id: `lst-${r.id}`,
      chainId,
      chain: short,
      symbol: r.symbol,
      name: meta.name,
      icon: r.icon || meta.icon,
      amount: r.amount,
      raw: r.raw,
      contract: r.contract,
      side: "stake",
      extra: meta.name,
      quote: q ?? null,
      valueUsdc: q && Number.isFinite(n) ? n * q.usdc : null,
      status: "liquid",
      inWallet: true,
      unstakeNote: liquidNote,
    });
  }
  return lines;
}
const erc20Bal = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;
export async function readPinnedLst(client: PublicClient, chainId: number, user: Address, quotes: Map<string, Quote>, liquidNote: string): Promise<StakeLine[]> {
  return accountCache("pos.stake", chainId, user, "lst", () => readPinnedLstWork(client, chainId, user, quotes, liquidNote));
}

async function readPinnedLstWork(client: PublicClient, chainId: number, user: Address, quotes: Map<string, Quote>, liquidNote: string): Promise<StakeLine[]> {
  const map = LST[chainId];
  if (!map) return [];
  const short = chainId === 1 ? "ETH" : chainId === 8453 ? "Base" : chainId === 42161 ? "Arb" : chainId === 43114 ? "AVAX" : chainId === 56 ? "BNB" : String(chainId);
  const out: StakeLine[] = [];
  await Promise.all(
    Object.entries(map).map(async ([addr, meta]) => {
      if (!addr.startsWith("0x")) return;
      try {
        const raw = await client.readContract({ address: addr as Address, abi: erc20Bal, functionName: "balanceOf", args: [user] });
        if (raw === 0n) return;
        const n = Number(formatUnits(raw, meta.decimals));
        let q = quotes.get(`${chainId}:${addr}`) ?? quotes.get(`${chainId}:native`);
        if (addr.toLowerCase() === SAVAX.toLowerCase()) {
          try {
            const pooled = await client.readContract({ address: SAVAX, abi: savaxAbi, functionName: "getPooledAvaxByShares", args: [raw] });
            const avax = Number(formatUnits(pooled, 18));
            const avaxUsd = quotes.get("43114:native")?.usdc;
            if (avaxUsd && Number.isFinite(avax) && avax > 0) q = { usdc: (avax / n) * avaxUsd, source: "v2" };
          } catch {
            /* keep native */
          }
        }
        out.push({
          id: `lst-pin-${chainId}-${addr}`,
          chainId,
          chain: short,
          symbol: meta.symbol,
          name: meta.name,
          icon: meta.icon,
          amount: fmtAmt(raw, meta.decimals),
          raw,
          contract: addr,
          side: "stake",
          extra: meta.name,
          quote: q ?? null,
          valueUsdc: q && Number.isFinite(n) ? n * q.usdc : null,
          status: "liquid",
          inWallet: true,
          unstakeNote: addr.toLowerCase() === SAVAX.toLowerCase() ? i18n.t("stake.lstSavax") : liquidNote,
        });
      } catch {
        /* skip */
      }
    }),
  );
  return out;
}
