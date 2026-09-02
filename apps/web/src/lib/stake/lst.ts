import { formatUnits, type Address, type PublicClient } from "viem";
import { accountCache } from "../defi/cache.ts";
import { LST } from "../defiAddresses.ts";
import { type Quote } from "../defiQuotes.ts";
import { SOL_LST, fmtAmt, lstUnderlyingFromQuotes, type StakeLine } from "./shared.ts";
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
  const short = chainId === 1 ? "ETH" : chainId === 8453 ? "Base" : chainId === 42161 ? "Arb" : chainId === 397 ? "NEAR" : chainId === 101 ? "SOL" : chainId === 43114 ? "AVAX" : chainId === 56 ? "BNB" : chainId === 999 ? "HyperEVM" : String(chainId);
  const lines: StakeLine[] = [];
  for (const r of rows) {
    if (!r.contract || r.raw === 0n) continue;
    const meta = map[r.contract.toLowerCase()];
    if (!meta) continue;
    const q = quotes.get(`${chainId}:${r.contract.toLowerCase()}`) ?? quotes.get(`${chainId}:native`);
    const n = Number(r.amount.replace(/,/g, ""));
    const under = lstUnderlyingFromQuotes(chainId, r.symbol, r.amount, quotes, r.contract);
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
      underlyingSymbol: under?.underlyingSymbol,
      underlyingAmount: under?.underlyingAmount,
    });
  }
  return lines;
}
const erc20Bal = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const lstRateAbi = [
  { type: "function", name: "stEthPerToken", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getStETHByWstETH", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getExchangeRate", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getRate", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "exchangeRate", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "convertToAssets", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "kHYPEToHYPE", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "kmHYPEToHYPE", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint256" }] },
] as const;

const HYPE_ACCT: Record<string, Address> = {
  "0xfd739d4e423301ce9385c1fb8850539d657c296d": "0x9209648Ec9D448EF57116B73A2f081835643dc7A",
  "0x360c140e5344a1a0593d44b4ea6fc7c3daf0c473": "0x5901e744759561C63309865Ef8822aBb041655E2",
};

async function protocolUnderlying(
  client: PublicClient,
  addr: Address,
  symbol: string,
  raw: bigint,
  decimals: number,
): Promise<{ underlyingSymbol: string; underlyingAmount: string } | undefined> {
  const n = Number(formatUnits(raw, decimals));
  if (!Number.isFinite(n) || n <= 0) return;
  if (/^stETH$/i.test(symbol)) return { underlyingSymbol: "ETH", underlyingAmount: fmtAmt(raw, decimals) };
  if (/^stkAAVE$/i.test(symbol)) return { underlyingSymbol: "AAVE", underlyingAmount: fmtAmt(raw, decimals) };
  try {
    if (addr.toLowerCase() === SAVAX.toLowerCase()) {
      const pooled = await client.readContract({ address: SAVAX, abi: savaxAbi, functionName: "getPooledAvaxByShares", args: [raw] });
      return { underlyingSymbol: "AVAX", underlyingAmount: fmtAmt(pooled, 18) };
    }
    const acct = HYPE_ACCT[addr.toLowerCase()];
    if (acct) {
      const triesHype: Array<() => Promise<bigint>> = [
        () => client.readContract({ address: acct, abi: lstRateAbi, functionName: "kHYPEToHYPE", args: [raw] }),
        () => client.readContract({ address: acct, abi: lstRateAbi, functionName: "kmHYPEToHYPE", args: [raw] }),
      ];
      for (const fn of triesHype) {
        try {
          const pooled = await fn();
          if (pooled > 0n) return { underlyingSymbol: "HYPE", underlyingAmount: fmtAmt(pooled, 18) };
        } catch {
          /* next */
        }
      }
    }
    const native = /hype/i.test(symbol) ? "HYPE" : /eth/i.test(symbol) ? "ETH" : undefined;
    if (!native) return;
    const tries: Array<() => Promise<bigint>> = [
      () => client.readContract({ address: addr, abi: lstRateAbi, functionName: "convertToAssets", args: [raw] }),
      () => client.readContract({ address: addr, abi: lstRateAbi, functionName: "getStETHByWstETH", args: [raw] }),
      () => client.readContract({ address: addr, abi: lstRateAbi, functionName: "stEthPerToken" }).then((r) => (raw * r) / 10n ** 18n),
      () => client.readContract({ address: addr, abi: lstRateAbi, functionName: "getExchangeRate" }).then((r) => (raw * r) / 10n ** 18n),
      () => client.readContract({ address: addr, abi: lstRateAbi, functionName: "getRate" }).then((r) => (raw * r) / 10n ** 18n),
      () => client.readContract({ address: addr, abi: lstRateAbi, functionName: "exchangeRate" }).then((r) => (raw * r) / 10n ** 18n),
    ];
    for (const fn of tries) {
      try {
        const pooled = await fn();
        if (pooled > 0n) return { underlyingSymbol: native, underlyingAmount: fmtAmt(pooled, decimals) };
      } catch {
        /* next view */
      }
    }
  } catch {
    /* skip */
  }
  return;
}
export async function readPinnedLst(client: PublicClient, chainId: number, user: Address, quotes: Map<string, Quote>, liquidNote: string): Promise<StakeLine[]> {
  return accountCache("pos.stake", chainId, user, "lst", () => readPinnedLstWork(client, chainId, user, quotes, liquidNote));
}

async function readPinnedLstWork(client: PublicClient, chainId: number, user: Address, quotes: Map<string, Quote>, liquidNote: string): Promise<StakeLine[]> {
  const map = LST[chainId];
  if (!map) return [];
  const short = chainId === 1 ? "ETH" : chainId === 8453 ? "Base" : chainId === 42161 ? "Arb" : chainId === 43114 ? "AVAX" : chainId === 56 ? "BNB" : chainId === 999 ? "HyperEVM" : String(chainId);
  const out: StakeLine[] = [];
  await Promise.all(
    Object.entries(map).map(async ([addr, meta]) => {
      if (!addr.startsWith("0x")) return;
      try {
        const raw = await client.readContract({ address: addr as Address, abi: erc20Bal, functionName: "balanceOf", args: [user] });
        if (raw === 0n) return;
        const n = Number(formatUnits(raw, meta.decimals));
        let q = quotes.get(`${chainId}:${addr}`) ?? quotes.get(`${chainId}:native`);
        const proto = await protocolUnderlying(client, addr as Address, meta.symbol, raw, meta.decimals);
        if (proto && n > 0) {
          const underN = Number(proto.underlyingAmount.replace(/,/g, ""));
          const natUsd =
            proto.underlyingSymbol === "AVAX"
              ? quotes.get("43114:native")?.usdc
              : proto.underlyingSymbol === "HYPE"
                ? quotes.get("999:native")?.usdc
                : proto.underlyingSymbol === "AAVE"
                  ? quotes.get("1:0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9")?.usdc
                  : undefined;
          if (natUsd && Number.isFinite(underN) && underN > 0) q = { usdc: (underN / n) * natUsd, source: "v2" };
        }
        const under = proto ?? lstUnderlyingFromQuotes(chainId, meta.symbol, fmtAmt(raw, meta.decimals), quotes, addr);
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
          underlyingSymbol: under?.underlyingSymbol,
          underlyingAmount: under?.underlyingAmount,
        });
      } catch {
        /* skip */
      }
    }),
  );
  return out;
}
