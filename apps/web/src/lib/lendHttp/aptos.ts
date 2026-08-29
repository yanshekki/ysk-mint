import type { LendMarketRow } from "../lendMarkets.ts";
import { rpcOutboundFetch, rpcTry } from "../rpcPool.ts";
import { row } from "./shared.ts";

type Json = Record<string, unknown>;

const ECHELON = "0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba";

async function aptosView(fn: string, args: unknown[]): Promise<unknown> {
  try {
    return await rpcTry(637, async (base, signal) => {
      const res = await rpcOutboundFetch(`${base.replace(/\/+$/, "")}/view`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ function: fn, type_arguments: [], arguments: args }),
        signal,
      });
      if (!res.ok) throw new Error(`aptos ${res.status}`);
      return await res.json();
    });
  } catch {
    return null;
  }
}

async function aptosResource(addr: string, typ: string): Promise<Json | null> {
  try {
    return await rpcTry(637, async (base, signal) => {
      const res = await rpcOutboundFetch(`${base.replace(/\/+$/, "")}/accounts/${addr}/resource/${encodeURIComponent(typ)}`, { signal });
      if (!res.ok) throw new Error(`aptos ${res.status}`);
      const json = (await res.json()) as { data?: Json };
      return json.data ?? null;
    });
  } catch {
    return null;
  }
}

function fp64(v: unknown): number {
  const s = typeof v === "object" && v && "v" in (v as Json) ? String((v as Json).v) : String(v ?? "");
  if (!/^\d+$/.test(s)) return 0;
  try {
    return Number(BigInt(s)) / 2 ** 64;
  } catch {
    return 0;
  }
}

export async function echelon(): Promise<LendMarketRow[]> {
  const raw = await aptosView(`${ECHELON}::lending::market_objects`, []);
  const list = (Array.isArray(raw) ? raw[0] : raw) as Array<{ inner?: string } | string> | null;
  const ids = (list ?? [])
    .map((m) => (typeof m === "string" ? m : m?.inner))
    .filter((x): x is string => Boolean(x))
    .slice(0, 40);
  const out: LendMarketRow[] = [];
  for (let i = 0; i < ids.length; i += 8) {
    const part = ids.slice(i, i + 8);
    await Promise.all(
      part.map(async (id) => {
        try {
          const [mkt, priceRaw] = await Promise.all([
            aptosResource(id, `${ECHELON}::lending::Market`),
            aptosView(`${ECHELON}::lending::asset_price`, [id]),
          ]);
          if (!mkt) return;
          const rawName = String(mkt.asset_name || "TKN").replace(/ Coin$/i, "").trim() || "TKN";
          const name =
            /^(tether usd|tether)$/i.test(rawName) ? "USDT"
            : /^(usd coin)$/i.test(rawName) ? "USDC"
            : /^aptos$/i.test(rawName) ? "APT"
            : /^(wrapped ether|weth)$/i.test(rawName) ? "WETH"
            : /^(wrapped btc|wbtc)$/i.test(rawName) ? "WBTC"
            : rawName;
          const mantissa = Number(mkt.asset_mantissa || 1e8) || 1e8;
          const dec = Math.round(Math.log10(mantissa)) || 8;
          const cash = Number(mkt.total_cash || 0) / 10 ** dec;
          const liab = Number(mkt.total_liability || 0) / 10 ** dec;
          if ((!Number.isFinite(cash) || cash === 0) && (!Number.isFinite(liab) || liab === 0)) return;
          const px = fp64(Array.isArray(priceRaw) ? priceRaw[0] : priceRaw);
          const price = px > 0 && px < 1e7 ? px : /usd|dai/i.test(name) ? 1 : null;
          out.push(
            row({
              protocol: "Echelon",
              chainId: 637,
              symbol: name,
              token: String(mkt.asset_type ?? id),
              market: id,
              supplyApy: null,
              borrowApy: null,
              supplyUsd: price != null && Number.isFinite(cash + liab) ? (cash + liab) * price : null,
              borrowUsd: price != null && Number.isFinite(liab) ? liab * price : null,
            }),
          );
        } catch {
          /* market miss */
        }
      }),
    );
  }
  return out;
}
