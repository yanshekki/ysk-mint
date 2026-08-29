import { CHAINS } from "@ysk-mint/config";
import { chainIcon } from "../chainIcon.ts";
import { TOKEN_CATALOG } from "../tokenRegistry.ts";
import type { LendMarketRow } from "../lendMarkets.ts";
import { outboundFetch } from "../outbound.ts";

export const HTTP_LEND_CHAINS = [101, 397, 784, 637, 728126428];
export const CURVE_LEND_CHAINS = [1, 42161, 10, 146];

export const CURVE_LEND_CHAIN: Record<number, string> = {
  1: "ethereum",
  42161: "arbitrum",
  10: "optimism",
  146: "sonic",
};

export function chainShort(chainId: number) {
  return Object.values(CHAINS).find((c) => c.chainId === chainId)?.short ?? String(chainId);
}

export function iconOf(chainId: number, symbol: string, token?: string) {
  const hit = TOKEN_CATALOG.find(
    (t) => t.chainId === chainId && (t.symbol.toLowerCase() === symbol.toLowerCase() || (token && t.address?.toLowerCase() === token.toLowerCase())),
  );
  if (hit?.icon) return hit.icon;
  const s = symbol.toLowerCase();
  if (s.includes("btc")) return "/tokens/wbtc.png";
  if (s.includes("eth")) return "/tokens/eth.png";
  if (s.includes("sol")) return "/tokens/sol.png";
  if (s.includes("sui")) return "/tokens/sui.png";
  if (s.includes("apt")) return "/tokens/apt.png";
  if (s.includes("near")) return "/tokens/near.png";
  if (s.includes("trx") || s.includes("jst")) return "/tokens/trx.png";
  if (s.includes("usd") || s.includes("dai")) return "/tokens/usdc.png";
  const c = Object.values(CHAINS).find((x) => x.chainId === chainId);
  return c ? chainIcon(c) : "/tokens/eth.png";
}

export function fracPct(x: unknown): number | null {
  const n = Number(x);
  if (!Number.isFinite(n) || n < 0) return null;
  const pct = n <= 1.5 ? n * 100 : n;
  if (pct > 100) return null;
  return pct;
}

export function bpsPct(x: unknown): number | null {
  const n = Number(x);
  if (!Number.isFinite(n) || n < 0) return null;
  const pct = n / 100;
  if (pct > 100) return null;
  return pct;
}

export function rayPct(x: unknown): number | null {
  const n = Number(x) / 1e27;
  if (!Number.isFinite(n) || n < 0) return null;
  const pct = n * 100;
  if (pct > 100) return null;
  return pct;
}

export function num(x: unknown): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

export function row(p: {
  protocol: string;
  chainId: number;
  symbol: string;
  token: string;
  market: string;
  supplyApy: number | null;
  borrowApy: number | null;
  supplyUsd: number | null;
  borrowUsd: number | null;
}): LendMarketRow {
  return {
    id: `${p.protocol}:${p.chainId}:${p.market}`,
    chainId: p.chainId,
    chainShort: chainShort(p.chainId),
    protocol: p.protocol,
    symbol: p.symbol,
    icon: iconOf(p.chainId, p.symbol, p.token),
    token: p.token,
    market: p.market,
    supplyApy: p.supplyApy,
    borrowApy: p.borrowApy,
    supplyUsd: p.supplyUsd,
    borrowUsd: p.borrowUsd,
  };
}

export async function getJson<T>(url: string, ms = 15000): Promise<T | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await outboundFetch(url, { signal: ac.signal, headers: { accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export function alreadyPct(x: unknown): number | null {
  const n = Number(x);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}
