import { DEX, SOL_NATIVE_MINT, usdStables } from "../defiAddresses.ts";
import { SEED_PAIRS } from "../dexVenues.ts";
import { asAddr } from "../pairKey.ts";
import { TOKEN_CATALOG } from "../tokenRegistry.ts";
import type { TokenRef } from "./types.ts";

export function localTokenIcon(symbol?: string, fallback = "/tokens/eth.png") {
  const s = (symbol ?? "").toLowerCase().replace(/\s+/g, "");
  if (!s) return fallback;
  if (/usdc/.test(s)) return "/tokens/usdc.png";
  if (/usdt|usd₮/.test(s)) return "/tokens/usdt.png";
  if (s === "dai" || s.startsWith("dai.")) return "/tokens/dai.png";
  if (/btc/.test(s)) return "/tokens/wbtc.png";
  return fallback;
}

export function evmTokenDecimals(chainId: number, address: string, fallback = 18): number {
  const d = DEX[chainId];
  const a = address.toLowerCase();
  if (d) {
    if (a === d.wrapped.toLowerCase()) {
      const native = TOKEN_CATALOG.find((t) => t.chainId === chainId && t.native);
      return native?.decimals && native.decimals > 0 ? native.decimals : 18;
    }
    const s = usdStables(d).find((x) => x.address.toLowerCase() === a);
    if (s) return s.decimals;
  }
  const t = TOKEN_CATALOG.find((x) => x.chainId === chainId && x.address && x.address.toLowerCase() === a);
  return t?.decimals || fallback;
}

export type MarketToken = TokenRef & { icon: string; name?: string };

const SENTINEL = /^0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee$/i;

const WRAP_META: Record<number, { symbol: string; icon: string }> = {
  1: { symbol: "WETH", icon: "/tokens/eth.png" },
  8453: { symbol: "WETH", icon: "/tokens/eth.png" },
  42161: { symbol: "WETH", icon: "/tokens/eth.png" },
  56: { symbol: "WBNB", icon: "/tokens/bnb.png" },
  43114: { symbol: "WAVAX", icon: "/tokens/avax.png" },
  10: { symbol: "WETH", icon: "/tokens/eth.png" },
  137: { symbol: "WPOL", icon: "/tokens/pol.png" },
  59144: { symbol: "WETH", icon: "/tokens/eth.png" },
  534352: { symbol: "WETH", icon: "/tokens/eth.png" },
  480: { symbol: "WETH", icon: "/tokens/eth.png" },
  42220: { symbol: "CELO", icon: "/tokens/cmc-5567.png" },
  100: { symbol: "WXDAI", icon: "/tokens/eth.png" },
  324: { symbol: "WETH", icon: "/tokens/eth.png" },
  130: { symbol: "WETH", icon: "/tokens/eth.png" },
  146: { symbol: "wS", icon: "/tokens/eth.png" },
  1868: { symbol: "WETH", icon: "/tokens/eth.png" },
  999: { symbol: "WHYPE", icon: "/tokens/hype.png" },
  80094: { symbol: "WBERA", icon: "/tokens/eth.png" },
  50: { symbol: "WXDC", icon: "/tokens/eth.png" },
  2020: { symbol: "WRON", icon: "/tokens/eth.png" },
  81457: { symbol: "WETH", icon: "/tokens/eth.png" },
};

export function topCmcIds(limit = 500) {
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const t of TOKEN_CATALOG) {
    const m = /^cmc-(\d+)/.exec(t.id);
    if (!m) continue;
    const id = Number(m[1]);
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= limit) break;
  }
  return ids;
}

function nativePlaceholder(chainId: number): MarketToken | undefined {
  if (chainId === 101) {
    return { chainId, address: SOL_NATIVE_MINT, decimals: 9, symbol: "SOL", icon: "/tokens/sol.png", native: true };
  }
  if (chainId === 397) {
    return { chainId, address: "wrap.near", decimals: 24, symbol: "NEAR", icon: "/tokens/near.png", native: true };
  }
  if (chainId === 1815) {
    return { chainId, address: "lovelace", decimals: 6, symbol: "ADA", icon: "/tokens/ada.png", native: true };
  }
  return undefined;
}

export function catalogTopOn(chainId: number, limit = 500): MarketToken[] {
  const rank = new Set(topCmcIds(limit));
  const seen = new Set<string>();
  const out: MarketToken[] = [];
  const native = nativePlaceholder(chainId);
  if (native) pushToken(out, seen, native);
  for (const t of TOKEN_CATALOG) {
    if (t.chainId !== chainId) continue;
    const m = /^cmc-(\d+)/.exec(t.id);
    if (t.native) {
      if (native) continue;
      continue;
    }
    if (!m || !rank.has(Number(m[1])) || !t.address) continue;
    if (SENTINEL.test(t.address)) continue;
    pushToken(out, seen, {
      chainId,
      address: t.address,
      decimals: t.decimals || 18,
      symbol: t.symbol,
      icon: t.icon,
      name: t.name,
    });
  }
  return out;
}

function pushToken(out: MarketToken[], seen: Set<string>, t: MarketToken) {
  const address = t.address.startsWith("0x") || t.address.startsWith("0X") ? asAddr(t.address) : t.address;
  const k = address.toLowerCase();
  if (!k || seen.has(k)) return;
  seen.add(k);
  out.push({ ...t, address });
}

export function chainTokenIcon(chainId: number) {
  return (WRAP_META[chainId] ?? { icon: "/tokens/eth.png" }).icon;
}

export function marketTokensOn(chainId: number, extra: MarketToken[] = []): MarketToken[] {
  const d = DEX[chainId];
  if (!d) return [];
  const seen = new Set<string>();
  const out: MarketToken[] = [];
  const wrap = WRAP_META[chainId] ?? { symbol: "WETH", icon: "/tokens/eth.png" };
  pushToken(out, seen, {
    chainId,
    address: d.wrapped,
    decimals: evmTokenDecimals(chainId, d.wrapped, 18),
    symbol: wrap.symbol,
    icon: wrap.icon,
    native: true,
  });
  for (const s of usdStables(d)) {
    pushToken(out, seen, {
      chainId,
      address: s.address,
      decimals: s.decimals,
      symbol: s.symbol,
      icon: localTokenIcon(s.symbol),
    });
  }
  for (const t of TOKEN_CATALOG) {
    if (t.chainId !== chainId || !t.address) continue;
    if (!t.address.startsWith("0x") && !t.address.startsWith("0X")) continue;
    const address = SENTINEL.test(t.address) ? d.wrapped : t.address;
    if (SENTINEL.test(address)) continue;
    pushToken(out, seen, {
      chainId,
      address,
      decimals: t.decimals || 18,
      symbol: t.symbol,
      icon: t.icon,
      native: t.native || SENTINEL.test(t.address),
      name: t.name,
    });
  }
  for (const t of extra) pushToken(out, seen, t);
  return out;
}

export function tokensFromMarketRows(
  rows: Array<{ chainId: number; tokenA: string; tokenB: string; symbolA: string; symbolB: string; iconA: string; iconB: string }>,
): MarketToken[] {
  const out: MarketToken[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    pushToken(out, seen, {
      chainId: r.chainId,
      address: r.tokenA,
      decimals: evmTokenDecimals(r.chainId, r.tokenA),
      symbol: r.symbolA,
      icon: r.iconA || localTokenIcon(r.symbolA),
    });
    pushToken(out, seen, {
      chainId: r.chainId,
      address: r.tokenB,
      decimals: evmTokenDecimals(r.chainId, r.tokenB),
      symbol: r.symbolB,
      icon: r.iconB || localTokenIcon(r.symbolB),
    });
  }
  return out;
}

export function candidatePairs(chainId: number, extra: MarketToken[] = []): Array<{ a: MarketToken; b: MarketToken }> {
  const d = DEX[chainId];
  if (!d) return [];
  const tokens = marketTokensOn(chainId, extra);
  const stable = new Set(usdStables(d).map((s) => s.address.toLowerCase()));
  const wrap = d.wrapped.toLowerCase();
  const quotes = tokens.filter((t) => stable.has(t.address.toLowerCase()) || t.address.toLowerCase() === wrap);
  const pairs: Array<{ a: MarketToken; b: MarketToken }> = [];
  const seen = new Set<string>();
  const add = (a: MarketToken, b: MarketToken) => {
    const aa = a.address.startsWith("0x") || a.address.startsWith("0X") ? { ...a, address: asAddr(a.address) } : a;
    const bb = b.address.startsWith("0x") || b.address.startsWith("0X") ? { ...b, address: asAddr(b.address) } : b;
    if (aa.address.toLowerCase() === bb.address.toLowerCase()) return;
    const key = `${aa.address.toLowerCase()}:${bb.address.toLowerCase()}`;
    const rev = `${bb.address.toLowerCase()}:${aa.address.toLowerCase()}`;
    if (seen.has(key) || seen.has(rev)) return;
    seen.add(key);
    pairs.push({ a: aa, b: bb });
  };

  for (const t of tokens) {
    const addr = t.address.toLowerCase();
    if (stable.has(addr)) {
      for (const q of quotes) {
        if (!stable.has(q.address.toLowerCase())) continue;
        if (addr < q.address.toLowerCase()) add(t, q);
      }
      continue;
    }
    if (addr === wrap) {
      for (const q of quotes) {
        if (stable.has(q.address.toLowerCase())) add(t, q);
      }
      continue;
    }
    for (const q of quotes) add(t, q);
  }
  for (const s of SEED_PAIRS) {
    if (s.chainId !== chainId) continue;
    add(
      { chainId, address: s.a.address, decimals: s.a.decimals, symbol: s.a.symbol, icon: s.a.icon },
      { chainId, address: s.b.address, decimals: s.b.decimals, symbol: s.b.symbol, icon: s.b.icon },
    );
  }
  return pairs;
}
