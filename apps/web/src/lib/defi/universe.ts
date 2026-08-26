import { DEX, usdStables } from "../defiAddresses.ts";
import { TOKEN_CATALOG } from "../tokenRegistry.ts";
import type { TokenRef } from "./types.ts";

export type MarketToken = TokenRef & { icon: string; name?: string };

const SENTINEL = /^0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee$/i;

const WRAP_META: Record<number, { symbol: string; icon: string }> = {
  1: { symbol: "WETH", icon: "/tokens/eth.png" },
  8453: { symbol: "WETH", icon: "/tokens/eth.png" },
  42161: { symbol: "WETH", icon: "/tokens/eth.png" },
  56: { symbol: "WBNB", icon: "/tokens/bnb.png" },
  43114: { symbol: "WAVAX", icon: "/tokens/avax.png" },
};

export function topCmcIds(limit = 100) {
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

function pushToken(out: MarketToken[], seen: Set<string>, t: MarketToken) {
  const k = t.address.toLowerCase();
  if (!k || seen.has(k)) return;
  seen.add(k);
  out.push(t);
}

export function marketTokensOn(chainId: number, limit = 100): MarketToken[] {
  const d = DEX[chainId];
  if (!d) return [];
  const rank = new Set(topCmcIds(limit));
  const seen = new Set<string>();
  const out: MarketToken[] = [];
  const wrap = WRAP_META[chainId] ?? { symbol: "WETH", icon: "/tokens/eth.png" };
  pushToken(out, seen, {
    chainId,
    address: d.wrapped,
    decimals: 18,
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
      icon: `/tokens/${s.symbol.toLowerCase()}.png`,
    });
  }
  for (const t of TOKEN_CATALOG) {
    if (t.chainId !== chainId || !t.address) continue;
    const m = /^cmc-(\d+)/.exec(t.id);
    if (!m || !rank.has(Number(m[1]))) continue;
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
  return out;
}

export function candidatePairs(chainId: number): Array<{ a: MarketToken; b: MarketToken }> {
  const d = DEX[chainId];
  if (!d) return [];
  const tokens = marketTokensOn(chainId);
  const stable = new Set(usdStables(d).map((s) => s.address.toLowerCase()));
  const wrap = d.wrapped.toLowerCase();
  const quotes = tokens.filter((t) => stable.has(t.address.toLowerCase()) || t.address.toLowerCase() === wrap);
  const pairs: Array<{ a: MarketToken; b: MarketToken }> = [];
  const seen = new Set<string>();
  const add = (a: MarketToken, b: MarketToken) => {
    if (a.address.toLowerCase() === b.address.toLowerCase()) return;
    const key = `${a.address.toLowerCase()}:${b.address.toLowerCase()}`;
    const rev = `${b.address.toLowerCase()}:${a.address.toLowerCase()}`;
    if (seen.has(key) || seen.has(rev)) return;
    seen.add(key);
    pairs.push({ a, b });
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
  return pairs;
}
