import { CHAINS } from "@ysk-mint/config";
import { chainIcon } from "./chainIcon.ts";
import { SOL_NATIVE_MINT } from "./defiAddresses.ts";
import { localTokenIcon } from "./defi/universe.ts";
import { SOL_SEEDS, seedToken } from "./dexVenues.ts";
import { displayStableSymbol } from "./pairOrient.ts";
import { catalogToken } from "./tokenRegistry.ts";

const SOL_USDC = "epjfwdd5aufqssqem2qn1xzybapc8g4weggkzwytdt1v";
const SOL_USDT = "es9vmfrzacermjfrf4h2fyd4kconky11mcce8benwnyb";

export type TokenMeta = { symbol: string; decimals: number; icon: string };

export function looksLikeContractLabel(s: string) {
  const t = (s ?? "").trim();
  if (!t || t === "TKN" || t === "…") return true;
  if (t.includes("…") || t.includes("...")) return true;
  if (/^0x[a-fA-F0-9]{6,}$/i.test(t)) return true;
  if (t.length >= 10 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(t) && /[0-9]/.test(t) && /[A-Z]/.test(t) && /[a-z]/.test(t)) return true;
  return false;
}

function chainFallbackIcon(chainId: number) {
  const chain = Object.values(CHAINS).find((c) => c.chainId === chainId);
  return chain ? chainIcon(chain) : "/tokens/eth.png";
}

function knownNative(chainId: number, address: string): TokenMeta | undefined {
  const a = address.toLowerCase();
  if (chainId === 101) {
    if (a === SOL_NATIVE_MINT.toLowerCase()) return { symbol: "SOL", decimals: 9, icon: "/tokens/sol.png" };
    if (a === SOL_USDC) return { symbol: "USDC", decimals: 6, icon: "/tokens/usdc.png" };
    if (a === SOL_USDT) return { symbol: "USDT", decimals: 6, icon: "/tokens/usdt.png" };
  }
  if (chainId === 784) {
    if (a.includes("::sui::sui")) return { symbol: "SUI", decimals: 9, icon: "/tokens/sui.png" };
    if (a.includes("::usdc::")) return { symbol: "USDC", decimals: 6, icon: "/tokens/usdc.png" };
    if (a.includes("::usdt::")) return { symbol: "USDT", decimals: 6, icon: "/tokens/usdt.png" };
    if (a.includes("::usde::")) return { symbol: "USDE", decimals: 6, icon: "/tokens/usdc.png" };
  }
  if (chainId === 607) {
    if (a.startsWith("eqaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaam9c")) return { symbol: "TON", decimals: 9, icon: "/tokens/ton.png" };
  }
  for (const p of SOL_SEEDS) {
    if (p.chainId !== chainId) continue;
    if (p.mintA.toLowerCase() === a) return { symbol: p.symbolA, decimals: 9, icon: p.iconA };
    if (p.mintB.toLowerCase() === a) return { symbol: p.symbolB, decimals: 6, icon: p.iconB };
  }
  return undefined;
}

function pickSymbol(...cands: Array<string | undefined>) {
  for (const s of cands) {
    const t = String(s ?? "").trim();
    if (t && !looksLikeContractLabel(t)) return t;
  }
  return "";
}

export function resolveTokenMeta(
  chainId: number,
  address: string,
  hint?: { symbol?: string; decimals?: number; icon?: string },
): TokenMeta {
  const cat = catalogToken(chainId, address);
  const seed = seedToken(chainId, address);
  const known = knownNative(chainId, address);
  const fallbackIco = chainFallbackIcon(chainId);
  const symbol = displayStableSymbol(
    chainId,
    address,
    pickSymbol(hint?.symbol, known?.symbol, cat?.symbol, seed?.symbol) || hint?.symbol || known?.symbol || cat?.symbol || seed?.symbol || "",
  );
  const decimals = hint?.decimals ?? known?.decimals ?? cat?.decimals ?? seed?.decimals ?? (chainId === 101 || chainId === 784 ? 9 : 18);
  const icon =
    (hint?.icon && !hint.icon.endsWith("/eth.png") ? hint.icon : undefined) ??
    known?.icon ??
    cat?.icon ??
    seed?.icon ??
    localTokenIcon(symbol, fallbackIco);
  const shown = pickSymbol(symbol, hint?.symbol, known?.symbol, cat?.symbol, seed?.symbol);
  return {
    symbol: shown || symbol || "Token",
    decimals: decimals && decimals > 0 ? decimals : 18,
    icon: icon || fallbackIco,
  };
}
