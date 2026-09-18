import { DEX, SOL_NATIVE_MINT } from "../defiAddresses.ts";
import { nameLooksLikeUsEquity } from "../tokenizedEquity.ts";
import { TOKEN_CATALOG, type TokenRecord } from "../tokenRegistry.ts";

export type ScaleAsset = {
  id: string;
  symbol: string;
  name: string;
  icon: string;
  chainId: number;
  address?: string;
  native?: boolean;
  /** CoinGecko id for native circulating cap. Wrapped-token GT cap is not the chain. */
  geckoId?: string;
  geckoNetwork?: string;
};

/** Prefer L1 / canonical chain when the same native exists on many VMs. */
const NATIVE_CHAIN: Record<string, number> = {
  BTC: 833,
  ETH: 1,
  BNB: 56,
  AVAX: 43114,
  POL: 137,
  SOL: 101,
  ADA: 1815,
  NEAR: 397,
  TRX: 728126428,
  SUI: 784,
  TON: 607,
  APT: 637,
  HYPE: 999,
  MNT: 5000,
  FTM: 250,
};

const NATIVE_GECKO: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  BNB: "binancecoin",
  AVAX: "avalanche-2",
  POL: "polygon-ecosystem-token",
  SOL: "solana",
  ADA: "cardano",
  NEAR: "near",
  TRX: "tron",
  SUI: "sui",
  TON: "the-open-network",
  APT: "aptos",
  HYPE: "hyperliquid",
  MNT: "mantle",
  FTM: "fantom",
};

const GECKO_NET: Record<number, string> = {
  1: "eth",
  56: "bsc",
  8453: "base",
  42161: "arbitrum",
  10: "optimism",
  137: "polygon_pos",
  43114: "avax",
  101: "solana",
  784: "sui-network",
  637: "aptos",
  999: "hyperevm",
  250: "fantom",
  5000: "mantle",
  81457: "blast",
  59144: "linea",
  534352: "scroll",
  324: "zksync",
  146: "sonic",
  80094: "berachain",
  728126428: "tron",
  607: "ton",
  130: "unichain",
  480: "world-chain",
  1868: "soneium",
  196: "x-layer",
};

export const LADDER_IDS = ["btc", "eth", "sol", "bnb", "hype", "skr"] as const;

export const SCALE_PRESETS: Array<{ a: string; b: string }> = [
  { a: "eth", b: "btc" },
  { a: "skr", b: "sol" },
  { a: "sol", b: "eth" },
  { a: "hype", b: "sol" },
];

function slugify(raw: string) {
  const s = raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return s || "x";
}

function wrappedOf(t: TokenRecord): string | undefined {
  if (t.address) return t.address;
  if (t.chainId === 101) return SOL_NATIVE_MINT;
  return DEX[t.chainId]?.wrapped;
}

function isWrappedNative(t: TokenRecord) {
  if (t.native) return false;
  const wrap = wrappedOf({ ...t, address: undefined, native: true });
  if (!wrap || !t.address) return false;
  return wrap.toLowerCase() === t.address.toLowerCase();
}

function buildAssets(): ScaleAsset[] {
  const natives: TokenRecord[] = [];
  const seenNative = new Set<string>();
  for (const t of TOKEN_CATALOG) {
    if (!t.native) continue;
    const sym = t.symbol.toUpperCase();
    const want = NATIVE_CHAIN[sym];
    if (want != null && t.chainId !== want) continue;
    if (seenNative.has(sym)) continue;
    seenNative.add(sym);
    natives.push(t);
  }

  const usedWrap = new Set(
    natives
      .map((t) => {
        const w = wrappedOf(t);
        return w ? `${t.chainId}:${w.toLowerCase()}` : "";
      })
      .filter(Boolean),
  );

  const rest: TokenRecord[] = [];
  const equitySeen = new Set<string>();
  for (const t of TOKEN_CATALOG) {
    if (t.native) continue;
    if (isWrappedNative(t)) continue;
    const wrapKey = t.address ? `${t.chainId}:${t.address.toLowerCase()}` : "";
    if (wrapKey && usedWrap.has(wrapKey)) continue;
    if (nameLooksLikeUsEquity(t.symbol, t.name)) {
      const tick = slugify(t.symbol.replace(/x$/i, "").replace(/c$/i, ""));
      if (equitySeen.has(tick)) continue;
      equitySeen.add(tick);
    }
    rest.push(t);
  }

  const used = new Set<string>();
  const out: ScaleAsset[] = [];
  const push = (t: TokenRecord, forced?: string) => {
    let id = forced || (t.native ? slugify(t.symbol) : t.id === "sol-skr" ? "skr" : slugify(t.symbol));
    if (used.has(id)) id = `${id}-${t.chainId}`;
    if (used.has(id)) id = slugify(t.id);
    used.add(id);
    const geckoNetwork = GECKO_NET[t.chainId];
    const addr = t.native ? wrappedOf(t) : t.address;
    out.push({
      id,
      symbol: t.symbol,
      name: t.name,
      icon: t.icon,
      chainId: t.chainId,
      address: addr,
      native: t.native,
      geckoId: t.native ? NATIVE_GECKO[t.symbol.toUpperCase()] : undefined,
      geckoNetwork: geckoNetwork && addr ? geckoNetwork : undefined,
    });
  };

  for (const t of natives) push(t);
  for (const t of rest) push(t);
  return out;
}

export const SCALE_ASSETS: ScaleAsset[] = buildAssets();

const BY_ID = new Map(SCALE_ASSETS.map((a) => [a.id, a]));

export function scaleAsset(id: string | undefined): ScaleAsset | undefined {
  if (!id) return undefined;
  return BY_ID.get(id.toLowerCase());
}

export function searchScaleAssets(raw: string, limit = 12): ScaleAsset[] {
  const q = raw.trim().toLowerCase();
  if (!q) {
    const pinned = LADDER_IDS.map((id) => BY_ID.get(id)).filter((a): a is ScaleAsset => Boolean(a));
    const extra = SCALE_ASSETS.filter((a) => !LADDER_IDS.includes(a.id as (typeof LADDER_IDS)[number])).slice(0, limit);
    return [...pinned, ...extra].slice(0, limit);
  }
  const out: ScaleAsset[] = [];
  for (const a of SCALE_ASSETS) {
    const addr = (a.address ?? "").toLowerCase();
    if (
      a.id === q ||
      a.symbol.toLowerCase() === q ||
      a.symbol.toLowerCase().startsWith(q) ||
      a.name.toLowerCase().includes(q) ||
      a.id.startsWith(q) ||
      (addr && (addr === q || addr.includes(q)))
    ) {
      out.push(a);
      if (out.length >= limit) break;
    }
  }
  return out;
}
