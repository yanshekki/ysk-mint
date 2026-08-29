import type { Quote } from "../defiQuotes.ts";
import type { LendCard } from "../lendingExtra.ts";
import type { ProtocolLine } from "../defiPositions.ts";
import { rpcOutboundFetch, rpcTry } from "../rpcPool.ts";
import { card, line, type Json } from "./shared.ts";

const ECHELON = "0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba";
function fp64(v: unknown): number {
  const s = typeof v === "object" && v && "v" in (v as Json) ? String((v as Json).v) : String(v ?? "");
  if (!/^\d+$/.test(s)) return 0;
  try {
    return Number(BigInt(s)) / 2 ** 64;
  } catch {
    return 0;
  }
}

function mantissaDecimals(raw: string): number {
  try {
    let x = BigInt(raw || "1");
    if (x <= 0n) return 8;
    let d = 0;
    while (x >= 10n && x % 10n === 0n && d < 18) {
      x /= 10n;
      d++;
    }
    return d || 8;
  } catch {
    return 8;
  }
}

async function aptosView(fn: string, args: unknown[], types: string[] = []): Promise<unknown> {
  const body = JSON.stringify({ function: fn, type_arguments: types, arguments: args });
  try {
    return await rpcTry(637, async (base, signal) => {
      const res = await rpcOutboundFetch(`${base.replace(/\/+$/, "")}/view`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        signal,
      });
      if (!res.ok) throw new Error(`aptos ${res.status}`);
      return await res.json();
    });
  } catch {
    return null;
  }
}
export async function readEchelon(user: string): Promise<LendCard | null> {
  if (!user) return null;
  const marketsRaw = await aptosView(`${ECHELON}::lending::market_objects`, []);
  const markets = (Array.isArray(marketsRaw) ? marketsRaw[0] : marketsRaw) as Array<{ inner?: string } | string> | null;
  const ids = (markets ?? [])
    .map((m) => (typeof m === "string" ? m : m?.inner))
    .filter((x): x is string => Boolean(x))
    .slice(0, 40);
  if (!ids.length) return null;
  const lines: ProtocolLine[] = [];
  await Promise.all(
    ids.map(async (market) => {
      try {
        const [coins, debt, name, mantissa, price] = await Promise.all([
          aptosView(`${ECHELON}::lending::account_coins`, [user, market]),
          aptosView(`${ECHELON}::lending::account_liability`, [user, market]),
          aptosView(`${ECHELON}::lending::market_asset_name`, [market]),
          aptosView(`${ECHELON}::lending::market_asset_mantissa`, [market]),
          aptosView(`${ECHELON}::lending::asset_price`, [market]),
        ]);
        const supply = BigInt(String(Array.isArray(coins) ? coins[0] : coins ?? "0"));
        const borrow = BigInt(String(Array.isArray(debt) ? debt[0] : debt ?? "0"));
        if (supply === 0n && borrow === 0n) return;
        const decimals = mantissaDecimals(String(Array.isArray(mantissa) ? mantissa[0] : mantissa ?? "100000000"));
        const symbol = String(Array.isArray(name) ? name[0] : name || "TKN").replace(/ Coin$/i, "") || "TKN";
        const px = fp64(Array.isArray(price) ? price[0] : price);
        const q: Quote | null = px > 0 && px < 1e7 ? { usdc: px, source: "agg" } : null;
        if (supply > 0n) lines.push(line("echelon", 637, "APT", symbol, supply, decimals, "supply", market, q));
        if (borrow > 0n) lines.push(line("echelon", 637, "APT", symbol, borrow, decimals, "borrow", market, q));
      } catch {
        /* market miss */
      }
    }),
  );
  let health = "—";
  try {
    const lend = fp64(((await aptosView(`${ECHELON}::lending::account_lend_value`, [user])) as unknown[])?.[0]);
    const liab = fp64(((await aptosView(`${ECHELON}::lending::account_liability_value`, [user])) as unknown[])?.[0]);
    if (liab > 0 && lend > 0) health = (lend / liab).toFixed(2);
  } catch {
    /* no hf */
  }
  return card("Echelon", 637, "APT", lines, health);
}
