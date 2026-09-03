import { type Address, type PublicClient } from "viem";
import { SOL_NATIVE_MINT } from "./defiAddresses.ts";
import { quoteUsd } from "./defi/quote.ts";
import { quoteSolMints as jupQuote } from "./defi/sol/jupiter.ts";
import { priceFromSqrtPriceX96 } from "./defi/evm/math.ts";
import type { Quote } from "./defi/types.ts";

export type { Quote };
export { priceFromSqrtPriceX96 };
export { quoteHoldsForUnknown, DISC_MIN_DEPTH_USD, DISC_MAX_POOL_SHARE } from "./defi/quote.ts";

export async function quoteEvmToken(
  client: PublicClient,
  chainId: number,
  token: Address | undefined,
  decimals: number,
  native?: boolean,
): Promise<Quote | null> {
  return quoteUsd({ evm: client }, chainId, token, decimals, native);
}

export async function quoteEvmMany(
  client: PublicClient,
  items: Array<{ id: string; chainId: number; token?: string; decimals: number; native?: boolean }>,
) {
  const out = new Map<string, Quote>();
  const unique = new Map<string, (typeof items)[number]>();
  for (const it of items) {
    const key = `${it.chainId}:${(it.native ? "native" : it.token || "").toLowerCase()}`;
    if (!unique.has(key)) unique.set(key, it);
  }
  await Promise.all(
    [...unique.entries()].map(async ([key, it]) => {
      const q = await quoteEvmToken(client, it.chainId, it.token as Address | undefined, it.decimals, it.native).catch(() => null);
      if (q) out.set(key, q);
    }),
  );
  return out;
}

export async function quoteSolMints(mints: string[]) {
  return jupQuote(mints);
}

export function quoteKey(chainId: number, token?: string, native?: boolean) {
  return `${chainId}:${(native ? "native" : token || "").toLowerCase()}`;
}

export function solQuoteKey(mint?: string, native?: boolean) {
  return native ? SOL_NATIVE_MINT : mint || "";
}

export function fmtUsdc(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 0.01) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export function fmtCompact(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${sign}${abs >= 1e12 ? (abs / 1e12).toFixed(2) + "T" : (abs / 1e9).toFixed(2) + "B"}`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1000) return `${sign}${abs.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (abs >= 1) return `${sign}${abs.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
  if (abs === 0) return "0";
  return `${sign}${abs.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
}

/** Pair / markets quote column: enough fraction digits, never `0.3`. */
export function fmtQuoteUsd(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1) return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  if (n >= 0.01) return n.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 });
  return n.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 10 });
}

/** Base-token reserve: no 2-dp compact. */
export function fmtReserveAmt(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(3)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(3)}M`;
  if (abs >= 1000) return `${sign}${abs.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
  if (abs >= 1) return `${sign}${abs.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 6 })}`;
  if (abs === 0) return "0";
  return `${sign}${abs.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 8 })}`;
}

/** Depth USD: thousand separators, no T/B that hide bad units. */
export function fmtDepthUsd(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1) return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  return n.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}
