import { formatUnits } from "viem";
import type { Quote } from "../defiQuotes.ts";
import type { LendCard } from "../lendingExtra.ts";
import type { ProtocolLine } from "../defiPositions.ts";
import { outboundFetch } from "../outbound.ts";
import { rpcJsonRpc } from "../rpcPool.ts";

export const RAY = 10n ** 27n;
export const SOL_NATIVE = "So11111111111111111111111111111111111111112";
export const NAVI_STORAGE_USERS = "0xabc6c3fbc89b96e3351fdbeb5730bcc5398648367260c6a4e201779e34694e04";
export const NAVI_RESERVES = "0xe6d4c6610b86ce7735ea754596d71d72d10c7980b5052fc3c8cdf8d09fea9b4b";
export const SUILEND_PKG = "0xf95b06141ed4a174f239417323bde3f209b972f5930d8521ea38a52aff3a6ddf";
export const SUILEND_CAPS = [
  `${SUILEND_PKG}::lending_market::ObligationOwnerCap<${SUILEND_PKG}::suilend::MAIN_POOL>`,
  `${SUILEND_PKG}::lending_market::ObligationOwnerCap<0x0a071f4976abae1a7f722199cf0bfcbe695ef9408a878e7d12a7ca87b7e582a6::lp_rewards::LP_REWARDS>`,
];

export type Json = Record<string, unknown>;

export function fmtAmt(raw: bigint, decimals: number) {
  const n = Number(formatUnits(raw, decimals));
  if (!Number.isFinite(n)) return formatUnits(raw, decimals);
  if (n === 0) return "0";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export function iconOf(symbol: string) {
  const s = symbol.toLowerCase();
  if (s.includes("btc")) return "/tokens/wbtc.png";
  if (s.includes("eth")) return "/tokens/eth.png";
  if (s.includes("sol")) return "/tokens/sol.png";
  if (s.includes("sui")) return "/tokens/sui.png";
  if (s.includes("apt")) return "/tokens/apt.png";
  if (s.includes("trx") || s.includes("jst")) return "/tokens/trx.png";
  if (s.includes("usd") || s.includes("dai")) return "/tokens/usdc.png";
  return "/tokens/eth.png";
}

export function fromHuman(s: string, decimals: number): { raw: bigint; n: number } {
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return { raw: 0n, n: 0 };
  const [a, b = ""] = String(s).replace(/,/g, "").split(".");
  const frac = `${b}${"0".repeat(decimals)}`.slice(0, decimals);
  try {
    return { raw: BigInt(`${a || "0"}${frac}`), n };
  } catch {
    return { raw: 0n, n };
  }
}

export function line(
  protocol: string,
  chainId: number,
  chain: string,
  symbol: string,
  raw: bigint,
  decimals: number,
  side: "supply" | "borrow",
  contract: string,
  quote: Quote | null,
  n?: number,
): ProtocolLine {
  const amt = n != null && Number.isFinite(n) ? n : Number(formatUnits(raw, decimals));
  const value = quote && Number.isFinite(amt) ? amt * quote.usdc : null;
  return {
    id: `${protocol}-${chainId}-${side}-${contract}-${symbol}`,
    chainId,
    chain,
    symbol,
    name: symbol,
    icon: iconOf(symbol),
    amount: Number.isFinite(amt) ? fmtHuman(amt) : fmtAmt(raw, decimals),
    raw,
    contract,
    side,
    quote,
    valueUsdc: side === "borrow" && value != null ? -value : value,
  };
}

export function fmtHuman(n: number) {
  if (!Number.isFinite(n) || n === 0) return "0";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export function card(protocol: string, chainId: number, chain: string, lines: ProtocolLine[], health = "—"): LendCard | null {
  if (!lines.length) return null;
  return { protocol, chainId, chain, health, lines, aTokens: new Set(lines.map((l) => (l.contract ?? "").toLowerCase()).filter(Boolean)) };
}

export async function getJson<T>(url: string, ms = 15000): Promise<T | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await outboundFetch(url, { signal: ac.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function suiRpc(method: string, params: unknown[]): Promise<unknown> {
  try {
    return await rpcJsonRpc(784, method, params);
  } catch {
    return null;
  }
}

export function fieldsOf(obj: unknown): Json {
  if (!obj || typeof obj !== "object") return {};
  const o = obj as Json;
  const data = (o.data ?? o) as Json;
  const content = ((data as Json).content ?? data) as Json;
  const fields = ((content as Json).fields ?? content) as Json;
  const value = fields.value as Json | undefined;
  if (value && typeof value === "object" && value.fields && typeof value.fields === "object") return value.fields as Json;
  return fields ?? {};
}

export function parseDecimal(x: unknown): number | null {
  if (x == null) return null;
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  if (typeof x === "string") {
    if (/^\d+$/.test(x) && x.length > 15) return Number(x) / 1e18;
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof x === "object") {
    const o = x as Json;
    if (o.fields) return parseDecimal((o.fields as Json).value);
    if ("value" in o) return parseDecimal(o.value);
  }
  return null;
}

export function typeName(x: unknown): string {
  if (typeof x === "string") return x;
  if (x && typeof x === "object") {
    const o = x as Json;
    if (typeof o.name === "string") return o.name;
    const f = o.fields as Json | undefined;
    if (f && typeof f.name === "string") return f.name;
  }
  return "";
}

export function coinSymbol(coinType: string) {
  const last = coinType.split("::").pop() ?? coinType;
  return last.replace(/^COIN$/i, coinType.slice(0, 6));
}

export function coinDecimals(coinType: string) {
  const t = coinType.toLowerCase();
  if (t.includes("::sui::sui")) return 9;
  if (t.includes("usdc") || t.includes("usdt") || t.includes("usds") || t.includes("usd1")) return 6;
  if (t.includes("wbtc") || t.includes("btc")) return 8;
  return 9;
}
