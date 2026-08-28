import { CHAINS } from "@ysk-mint/config";
import { DEX, isUsdStableAddress, usdStables } from "./defiAddresses.ts";
import { venuesPriceUsd, venuesTvlUsd, venueTvlInQuote } from "./defi/quote.ts";
import { canonId, sortPair } from "./pairKey.ts";
import { useUserSettings } from "./userSettings.ts";

const STABLE = new Set(
  ["USDC", "USDT", "DAI", "USDM", "USDA", "IUSD", "DJED", "USDE", "FRAX", "USD1", "USDB", "USDBC", "USDCE", "USDC.E", "USDT.E", "DAI.E"].map(
    (s) => s.toUpperCase(),
  ),
);

const GAS = new Set(
  [
    "ETH",
    "WETH",
    "WETH.E",
    "AVAX",
    "WAVAX",
    "BNB",
    "WBNB",
    "SOL",
    "WSOL",
    "POL",
    "WPOL",
    "MATIC",
    "WMATIC",
    "ARB",
    "FTM",
    "WFTM",
    "S",
    "WS",
    "BERA",
    "WBERA",
    "HYPE",
    "WHYPE",
    "CRO",
    "WCRO",
    "SEI",
    "CELO",
    "XDAI",
    "WXDAI",
    "MNT",
    "WMNT",
    "TRX",
    "SUI",
    "TON",
    "ADA",
    "NEAR",
    "APT",
    "RON",
    "WRON",
    "XDC",
    "WXDC",
    "MON",
    "XPL",
    "VIC",
    "IOTX",
    "GNO",
  ].map((s) => s.toUpperCase()),
);

export type QuoteRank = 0 | 1 | 2;

function normSymbol(symbol?: string) {
  return (symbol ?? "").replace(/\s+/g, "").toUpperCase();
}

export function quoteRank(chainId: number, address: string, symbol?: string): QuoteRank {
  const d = DEX[chainId];
  if (d && isUsdStableAddress(d, address)) return 0;
  const s = normSymbol(symbol);
  if (s && (STABLE.has(s) || /^USD[CT]E?$/.test(s) || /^USD[CT]\.E$/.test(s) || /^DAI\.E$/.test(s))) return 0;
  if (d?.wrapped && canonId(address) === canonId(d.wrapped)) return 1;
  if (s && (GAS.has(s) || /^WETH(\.E)?$/.test(s))) return 1;
  const chain = Object.values(CHAINS).find((c) => c.chainId === chainId);
  if (chain) {
    const n = chain.nativeSymbol.toUpperCase();
    if (s === n || s === `W${n}`) return 1;
  }
  return 2;
}

function preferRank(r: QuoteRank): QuoteRank {
  const pri = useUserSettings.getState().quotePriority;
  if (pri !== "gas-stable") return r;
  if (r === 0) return 1;
  if (r === 1) return 0;
  return r;
}

/** True when `b` is the quote leg (should stay on the right). */
export function isQuoteOnRight(
  chainId: number,
  a: { address: string; symbol?: string },
  b: { address: string; symbol?: string },
): boolean {
  const cfg = useUserSettings.getState();
  if (!cfg.autoOrient) return true;
  const ra = preferRank(quoteRank(chainId, a.address, a.symbol));
  const rb = preferRank(quoteRank(chainId, b.address, b.symbol));
  let keep: boolean;
  if (ra !== rb) keep = rb < ra;
  else if (ra === 1) {
    const wrap = DEX[chainId]?.wrapped;
    const w = wrap ? canonId(wrap) : "";
    if (w && canonId(b.address) === w) keep = true;
    else if (w && canonId(a.address) === w) keep = false;
    else {
      const [, y] = sortPair(a.address, b.address);
      keep = canonId(b.address) === y;
    }
  } else {
    const [, y] = sortPair(a.address, b.address);
    keep = canonId(b.address) === y;
  }
  return cfg.quoteSide === "left" ? !keep : keep;
}

export function orientPair(
  chainId: number,
  tokenA: string,
  tokenB: string,
  symbolA?: string,
  symbolB?: string,
): { base: string; quote: string; flipped: boolean } {
  const keep = isQuoteOnRight(chainId, { address: tokenA, symbol: symbolA }, { address: tokenB, symbol: symbolB });
  if (keep) return { base: tokenA, quote: tokenB, flipped: false };
  return { base: tokenB, quote: tokenA, flipped: true };
}

export function invertPrice(price: number) {
  if (!price || !Number.isFinite(price)) return price;
  return 1 / price;
}

export function invertVenue<T extends { priceAinB: number; reserveA: number; reserveB: number; tvlQuote?: number }>(v: T): T {
  const priceAinB = invertPrice(v.priceAinB);
  const reserveA = v.reserveB;
  const reserveB = v.reserveA;
  const tvlQuote = reserveA > 0 && priceAinB > 0 ? reserveA * priceAinB + reserveB : v.tvlQuote;
  return { ...v, priceAinB, reserveA, reserveB, ...(tvlQuote != null ? { tvlQuote } : {}) };
}

export function displayStableSymbol(chainId: number, address: string, fallback: string) {
  const d = DEX[chainId];
  if (!d) return fallback;
  const hit = usdStables(d).find((s) => s.address.toLowerCase() === address.toLowerCase());
  return hit?.symbol ?? fallback;
}

type Marketish<V extends { priceAinB: number; reserveA: number; reserveB: number; protocolId?: string; pool?: string }> = {
  pairId: string;
  chainId: number;
  tokenA: string;
  tokenB: string;
  symbolA: string;
  symbolB: string;
  iconA: string;
  iconB: string;
  venues: V[];
  venueNames: string[];
  price: number | null;
  depth: number;
};

export function orientMarketRow<V extends { priceAinB: number; reserveA: number; reserveB: number; protocolId?: string; pool?: string }>(
  row: Marketish<V>,
): Marketish<V> {
  const keep = isQuoteOnRight(
    row.chainId,
    { address: row.tokenA, symbol: row.symbolA },
    { address: row.tokenB, symbol: row.symbolB },
  );
  const symbolA = displayStableSymbol(row.chainId, row.tokenA, row.symbolA);
  const symbolB = displayStableSymbol(row.chainId, row.tokenB, row.symbolB);
  if (keep) return { ...row, symbolA, symbolB };
  const venues = row.venues.map(invertVenue);
  const quote = row.tokenA;
  const price = venuesPriceUsd(venues, quote, row.chainId, null);
  const depth = venuesTvlUsd(venues, quote, row.chainId, null);
  return {
    ...row,
    tokenA: row.tokenB,
    tokenB: row.tokenA,
    symbolA: displayStableSymbol(row.chainId, row.tokenB, row.symbolB),
    symbolB: displayStableSymbol(row.chainId, row.tokenA, row.symbolA),
    iconA: row.iconB,
    iconB: row.iconA,
    venues,
    price,
    depth: depth > 0 ? depth : venues.reduce((n, v) => n + venueTvlInQuote(v), 0),
  };
}

export function mergeOriented<V extends { priceAinB: number; reserveA: number; reserveB: number; protocolId?: string; pool?: string }>(
  rows: Array<Marketish<V>>,
): Array<Marketish<V>> {
  const by = new Map<string, Marketish<V>>();
  for (const raw of rows) {
    const row = orientMarketRow(raw);
    const prev = by.get(row.pairId);
    if (!prev) {
      by.set(row.pairId, row);
      continue;
    }
    const venueKey = (v: V) => {
      const id = (v as { protocolId?: string; venue?: { id?: string } }).protocolId ?? (v as { venue?: { id?: string } }).venue?.id ?? "";
      return `${id}:${(v.pool ?? "").toLowerCase()}`;
    };
    const venues = [...prev.venues];
    const seen = new Set(venues.map(venueKey));
    for (const v of row.venues) {
      const k = venueKey(v);
      if (seen.has(k)) continue;
      seen.add(k);
      venues.push(v);
    }
    const names = [...new Set([...prev.venueNames, ...row.venueNames])];
    const price = venuesPriceUsd(venues, row.tokenB, row.chainId, null);
    const depthUsd = venuesTvlUsd(venues, row.tokenB, row.chainId, null);
    by.set(row.pairId, {
      ...prev,
      venues,
      venueNames: names,
      price: price ?? prev.price ?? row.price,
      depth: depthUsd > 0 ? depthUsd : venues.reduce((n, v) => n + venueTvlInQuote(v), 0),
    });
  }
  return [...by.values()];
}
