import { fracPct, getJson, num, rayPct, row } from "./shared.ts";
import type { LendMarketRow } from "../lendMarkets.ts";
import { rpcJsonRpc } from "../rpcPool.ts";

export async function navi(): Promise<LendMarketRow[]> {
  const json = await getJson<{
    data?: Array<{
      id?: number;
      isDeprecated?: boolean;
      coinType?: string;
      currentSupplyRate?: string;
      currentBorrowRate?: string;
      totalSupplyAmount?: string;
      borrowedAmount?: string;
      token?: { symbol?: string; decimals?: number; price?: number; coinType?: string };
    }>;
  }>("https://open-api.naviprotocol.io/api/navi/pools");
  const out: LendMarketRow[] = [];
  for (const r of json?.data ?? []) {
    if (r.isDeprecated) continue;
    const token = r.token;
    const symbol = token?.symbol || "TKN";
    const dec = token?.decimals ?? 9;
    const mint = token?.coinType || r.coinType || String(r.id);
    const px = num(token?.price);
    const sup = Number(r.totalSupplyAmount || "0") / 10 ** dec;
    const bor = Number(r.borrowedAmount || "0") / 10 ** dec;
    out.push(
      row({
        protocol: "NAVI",
        chainId: 784,
        symbol,
        token: mint,
        market: String(r.id ?? mint),
        supplyApy: rayPct(r.currentSupplyRate),
        borrowApy: rayPct(r.currentBorrowRate),
        supplyUsd: px != null && Number.isFinite(sup) ? sup * px : null,
        borrowUsd: px != null && Number.isFinite(bor) ? bor * px : null,
      }),
    );
  }
  return out;
}

export async function scallop(): Promise<LendMarketRow[]> {
  const json = await getJson<{
    pools?: Array<{
      symbol?: string;
      coinType?: string;
      coinPrice?: number;
      supplyApy?: number;
      borrowApy?: number;
      supplyCoin?: number;
      borrowCoin?: number;
    }>;
  }>("https://sdk.api.scallop.io/api/market");
  return (json?.pools ?? []).map((r) => {
    const px = num(r.coinPrice);
    const sup = num(r.supplyCoin);
    const bor = num(r.borrowCoin);
    return row({
      protocol: "Scallop",
      chainId: 784,
      symbol: r.symbol || "TKN",
      token: r.coinType || r.symbol || "TKN",
      market: r.coinType || r.symbol || "TKN",
      supplyApy: fracPct(r.supplyApy),
      borrowApy: fracPct(r.borrowApy),
      supplyUsd: px != null && sup != null ? sup * px : null,
      borrowUsd: px != null && bor != null ? bor * px : null,
    });
  });
}

type Json = Record<string, unknown>;

function fieldsOf(obj: unknown): Json {
  if (!obj || typeof obj !== "object") return {};
  const o = obj as Json;
  const data = (o.data ?? o) as Json;
  const content = ((data as Json).content ?? data) as Json;
  const fields = ((content as Json).fields ?? content) as Json;
  return fields ?? {};
}

function parseDec(x: unknown): number | null {
  if (x == null) return null;
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  if (typeof x === "string") {
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof x === "object") {
    const o = x as Json;
    if (o.fields) return parseDec((o.fields as Json).value ?? o.fields);
    if ("value" in o) return parseDec(o.value);
  }
  return null;
}

function coinName(x: unknown): string {
  if (typeof x === "string") return x;
  if (x && typeof x === "object") {
    const o = x as Json;
    const f = (o.fields ?? o) as Json;
    if (typeof f.name === "string") return f.name;
    if (typeof o.name === "string") return o.name;
  }
  return "";
}

async function suiGetObject(id: string): Promise<unknown> {
  try {
    return await rpcJsonRpc(784, "sui_getObject", [id, { showContent: true }]);
  } catch {
    return null;
  }
}

export async function suilend(): Promise<LendMarketRow[]> {
  const markets = await getJson<Array<{ id?: string; isHidden?: boolean }>>("https://api.suilend.fi/markets");
  const ids = (markets ?? []).filter((m) => !m.isHidden && m.id).slice(0, 3).map((m) => m.id!) ;
  const out: LendMarketRow[] = [];
  for (const id of ids) {
    const obj = await suiGetObject(id);
    const reserves = (fieldsOf(obj).reserves as unknown[]) ?? [];
    for (const raw of reserves.slice(0, 40)) {
      const f = fieldsOf(raw);
      const coin = coinName(f.coin_type);
      const symbol = (coin.split("::").pop() || "TKN").replace(/^COIN$/i, "SUI");
      const dec = Number(f.mint_decimals ?? 9) || 9;
      const wad = 1e18;
      const avail = Number(f.available_amount ?? 0) / 10 ** dec;
      const borrowedRaw = parseDec(f.borrowed_amount);
      const borrowed = borrowedRaw != null ? borrowedRaw / wad / 10 ** dec : 0;
      const pxRaw = parseDec(f.price) ?? parseDec(f.smoothed_price);
      const price = pxRaw != null ? pxRaw / wad : null;
      const supplyUsd = price != null && Number.isFinite(avail + borrowed) ? (avail + borrowed) * price : null;
      const borrowUsd = price != null && Number.isFinite(borrowed) ? borrowed * price : null;
      if (supplyUsd != null && supplyUsd > 5e9) continue;
      out.push(
        row({
          protocol: "Suilend",
          chainId: 784,
          symbol,
          token: coin || symbol,
          market: coin || `${id}:${symbol}`,
          supplyApy: null,
          borrowApy: null,
          supplyUsd,
          borrowUsd: borrowUsd != null && borrowUsd > 1e12 ? null : borrowUsd,
        }),
      );
    }
  }
  return out;
}

