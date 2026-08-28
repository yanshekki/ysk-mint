import { erc20Abi, formatUnits, type Address, type PublicClient } from "viem";
import { CHAINS } from "@ysk-mint/config";
import { chainIcon } from "./chainIcon.ts";
import { callMany } from "./defi/evm/client.ts";
import { DEX } from "./defiAddresses.ts";
import { DOLOMITE_MARGIN, FRAX_REG } from "./lendingExtra.ts";
import { TOKEN_CATALOG } from "./tokenRegistry.ts";
import type { LendMarketRow } from "./lendMarkets.ts";

export const HTTP_LEND_CHAINS = [101, 397, 784, 637, 728126428];
export const CURVE_LEND_CHAINS = [1, 42161, 10, 146];

const CURVE_LEND_CHAIN: Record<number, string> = {
  1: "ethereum",
  42161: "arbitrum",
  10: "optimism",
  146: "sonic",
};

function chainShort(chainId: number) {
  return Object.values(CHAINS).find((c) => c.chainId === chainId)?.short ?? String(chainId);
}

function iconOf(chainId: number, symbol: string, token?: string) {
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

function fracPct(x: unknown): number | null {
  const n = Number(x);
  if (!Number.isFinite(n) || n < 0) return null;
  const pct = n <= 1.5 ? n * 100 : n;
  if (pct > 100) return null;
  return pct;
}

function bpsPct(x: unknown): number | null {
  const n = Number(x);
  if (!Number.isFinite(n) || n < 0) return null;
  const pct = n / 100;
  if (pct > 100) return null;
  return pct;
}

function rayPct(x: unknown): number | null {
  const n = Number(x) / 1e27;
  if (!Number.isFinite(n) || n < 0) return null;
  const pct = n * 100;
  if (pct > 100) return null;
  return pct;
}

function num(x: unknown): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function row(p: {
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

async function getJson<T>(url: string, ms = 15000): Promise<T | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, { signal: ac.signal, headers: { accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function saveLend(): Promise<LendMarketRow[]> {
  const markets = await getJson<
    Array<{
      isPrimary?: boolean;
      hidden?: boolean;
      reserves?: Array<{ address?: string; liquidityToken?: { symbol?: string; mint?: string; decimals?: number } }>;
    }>
  >("https://api.solend.fi/v1/markets/configs?scope=all");
  const primary = (markets ?? []).find((m) => m.isPrimary && !m.hidden) ?? (markets ?? []).find((m) => !m.hidden);
  const meta = (primary?.reserves ?? []).filter((r) => r.address).slice(0, 40);
  if (!meta.length) return [];
  const ids = meta.map((r) => r.address as string);
  const byAddr = new Map(meta.map((r) => [r.address as string, r]));
  const stats = await getJson<{
    results?: Array<{
      reserve?: {
        liquidity?: { availableAmount?: string; borrowedAmountWads?: string; marketPrice?: string; mintDecimals?: number; mintPubkey?: string };
      };
      rates?: { supplyInterest?: string; borrowInterest?: string };
    }>;
  }>(`https://api.solend.fi/v1/reserves?ids=${ids.join(",")}`);
  const out: LendMarketRow[] = [];
  for (const item of stats?.results ?? []) {
    const liq = item.reserve?.liquidity;
    const mint = liq?.mintPubkey;
    if (!liq || !mint) continue;
    const cfg = [...byAddr.values()].find((r) => r.liquidityToken?.mint === mint || r.address === mint);
    const symbol = cfg?.liquidityToken?.symbol || "TKN";
    const dec = Number(liq.mintDecimals ?? cfg?.liquidityToken?.decimals ?? 9) || 9;
    const cash = Number(liq.availableAmount || 0) / 10 ** dec;
    const wad = Number(liq.borrowedAmountWads || 0);
    const borrowed = Number.isFinite(wad) ? wad / 1e18 / 10 ** dec : 0;
    const px = Number(liq.marketPrice || 0) / 1e18;
    const price = Number.isFinite(px) && px > 0 && px < 1e7 ? px : /usd|dai/i.test(symbol) ? 1 : null;
    const market = cfg?.address || mint;
    out.push(
      row({
        protocol: "Save",
        chainId: 101,
        symbol,
        token: mint,
        market,
        supplyApy: alreadyPct(item.rates?.supplyInterest),
        borrowApy: alreadyPct(item.rates?.borrowInterest),
        supplyUsd: price != null && Number.isFinite(cash + borrowed) ? (cash + borrowed) * price : null,
        borrowUsd: price != null && Number.isFinite(borrowed) ? borrowed * price : null,
      }),
    );
  }
  return out;
}

async function kamino(): Promise<LendMarketRow[]> {
  const markets = await getJson<Array<{ lendingMarket?: string; isPrimary?: boolean; isCurated?: boolean }>>("https://api.kamino.finance/v2/kamino-market");
  const ids = [...(markets ?? [])]
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || Number(b.isCurated) - Number(a.isCurated))
    .map((m) => m.lendingMarket)
    .filter(Boolean)
    .slice(0, 4) as string[];
  const out: LendMarketRow[] = [];
  for (const id of ids) {
    const rows = await getJson<
      Array<{
        liquidityToken?: string;
        liquidityTokenMint?: string;
        supplyApy?: string;
        borrowApy?: string;
        totalSupplyUsd?: string;
        totalBorrowUsd?: string;
      }>
    >(`https://api.kamino.finance/kamino-market/${id}/reserves/metrics`);
    for (const r of (rows ?? []).slice(0, 40)) {
      const symbol = r.liquidityToken || "TKN";
      const token = r.liquidityTokenMint || symbol;
      out.push(
        row({
          protocol: "Kamino",
          chainId: 101,
          symbol,
          token,
          market: token,
          supplyApy: fracPct(r.supplyApy),
          borrowApy: fracPct(r.borrowApy),
          supplyUsd: num(r.totalSupplyUsd),
          borrowUsd: num(r.totalBorrowUsd),
        }),
      );
    }
  }
  return out;
}

async function jupiterLend(): Promise<LendMarketRow[]> {
  const rows = await getJson<
    Array<{
      address?: string;
      uiSymbol?: string;
      symbol?: string;
      decimals?: number;
      supplyRate?: string | number;
      totalAssets?: string;
      asset?: { address?: string; symbol?: string; decimals?: number; price?: string };
    }>
  >("https://lite-api.jup.ag/lend/v1/earn/tokens");
  return (rows ?? []).map((r) => {
    const asset = r.asset;
    const symbol = asset?.symbol || r.uiSymbol || r.symbol || "TKN";
    const token = asset?.address || r.address || symbol;
    const dec = asset?.decimals ?? r.decimals ?? 6;
    const assets = Number(r.totalAssets || "0") / 10 ** dec;
    const px = num(asset?.price) ?? ( /usd/i.test(symbol) ? 1 : null);
    return row({
      protocol: "Jupiter Lend",
      chainId: 101,
      symbol,
      token,
      market: r.address || token,
      supplyApy: bpsPct(r.supplyRate),
      borrowApy: null,
      supplyUsd: px != null && Number.isFinite(assets) ? assets * px : null,
      borrowUsd: null,
    });
  });
}

async function burrow(): Promise<LendMarketRow[]> {
  const json = await getJson<{ data?: Array<{ symbol?: string; token?: string; supply_apy?: string; borrow_apy?: string; total_supplied_price?: string; total_burrow_price?: string }> }>(
    "https://api.burrow.finance/list_token_data",
  );
  return (json?.data ?? []).map((r) =>
    row({
      protocol: "Burrow",
      chainId: 397,
      symbol: r.symbol || "TKN",
      token: r.token || r.symbol || "TKN",
      market: r.token || r.symbol || "TKN",
      supplyApy: fracPct(r.supply_apy),
      borrowApy: fracPct(r.borrow_apy),
      supplyUsd: num(r.total_supplied_price),
      borrowUsd: num(r.total_burrow_price),
    }),
  );
}

async function navi(): Promise<LendMarketRow[]> {
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

async function scallop(): Promise<LendMarketRow[]> {
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
  const urls = ["https://rpc-mainnet.suiscan.xyz", "https://sui-rpc.publicnode.com"];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sui_getObject", params: [id, { showContent: true }] }),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { result?: unknown };
      if (json.result) return json.result;
    } catch {
      /* next */
    }
  }
  return null;
}

async function suilend(): Promise<LendMarketRow[]> {
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

async function justlend(): Promise<LendMarketRow[]> {
  const json = await getJson<{
    data?: {
      tokenList?: Array<{
        address?: string;
        underlyingSymbol?: string;
        underlyingAddress?: string;
        underlyingDecimal?: number;
        underlyingPriceInTrx?: string;
        supplyRate?: string;
        borrowRate?: string;
        cash?: string;
        totalBorrows?: string;
      }>;
    };
  }>("https://openapi.just.network/lend/jtoken");
  const list = json?.data?.tokenList ?? [];
  const usdt = list.find((t) => t.underlyingSymbol === "USDT");
  const trxPerUsdt = Number(usdt?.underlyingPriceInTrx);
  const trxUsd = Number.isFinite(trxPerUsdt) && trxPerUsdt > 0 ? 1 / trxPerUsdt : null;
  return list.map((t) => {
    const symbol = t.underlyingSymbol || "TKN";
    const pxTrx = Number(t.underlyingPriceInTrx);
    const px = trxUsd && Number.isFinite(pxTrx) ? pxTrx * trxUsd : /usd/i.test(symbol) ? 1 : null;
    const cash = Number(t.cash || "0");
    const bor = Number(t.totalBorrows || "0");
    return row({
      protocol: "JustLend",
      chainId: 728126428,
      symbol,
      token: t.underlyingAddress || t.address || symbol,
      market: t.address || symbol,
      supplyApy: fracPct(t.supplyRate),
      borrowApy: fracPct(t.borrowRate),
      supplyUsd: px != null && Number.isFinite(cash + bor) ? (cash + bor) * px : null,
      borrowUsd: px != null && Number.isFinite(bor) ? bor * px : null,
    });
  });
}

function alreadyPct(x: unknown): number | null {
  const n = Number(x);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

type CurveVault = {
  id?: string;
  address?: string;
  blockchainId?: string;
  usdTotal?: number;
  rates?: { lendApyPcent?: number; borrowApyPcent?: number };
  totalSupplied?: { usdTotal?: number };
  borrowed?: { usdTotal?: number };
  assets?: { borrowed?: { symbol?: string; address?: string } };
};

let curveVaultCache: Promise<CurveVault[] | null> | null = null;

async function curveVaults(): Promise<CurveVault[]> {
  if (!curveVaultCache) {
    curveVaultCache = getJson<{ data?: { lendingVaultData?: CurveVault[] } }>(
      "https://api.curve.finance/v1/getLendingVaults/all",
    ).then((j) => j?.data?.lendingVaultData ?? []);
  }
  return (await curveVaultCache) ?? [];
}

async function curveLend(chainId: number): Promise<LendMarketRow[]> {
  const chain = CURVE_LEND_CHAIN[chainId];
  if (!chain) return [];
  const list = (await curveVaults()).filter((v) => v.blockchainId === chain);
  return list
    .map((v) => {
      const sup = num(v.totalSupplied?.usdTotal ?? v.usdTotal);
      const bor = num(v.borrowed?.usdTotal);
      const symbol = v.assets?.borrowed?.symbol || "crvUSD";
      return row({
        protocol: "Curve",
        chainId,
        symbol,
        token: v.assets?.borrowed?.address || v.address || symbol,
        market: v.address || v.id || symbol,
        supplyApy: alreadyPct(v.rates?.lendApyPcent),
        borrowApy: alreadyPct(v.rates?.borrowApyPcent),
        supplyUsd: sup,
        borrowUsd: bor,
      });
    })
    .sort((a, b) => (b.supplyUsd ?? 0) - (a.supplyUsd ?? 0))
    .slice(0, 40);
}

async function lista(): Promise<LendMarketRow[]> {
  const json = await getJson<{
    data?: { list?: Array<{ address?: string; asset?: string; assetSymbol?: string; apy?: string; depositsUsd?: string; utilization?: string }> };
  }>("https://api.lista.org/api/moolah/vault/list?page=1&pageSize=50&chain=bsc");
  return (json?.data?.list ?? []).map((v) => {
    const usd = num(v.depositsUsd);
    const util = num(v.utilization);
    return row({
      protocol: "Lista",
      chainId: 56,
      symbol: v.assetSymbol || "TKN",
      token: v.asset || v.address || "TKN",
      market: v.address || v.asset || "TKN",
      supplyApy: fracPct(v.apy),
      borrowApy: null,
      supplyUsd: usd,
      borrowUsd: usd != null && util != null && util >= 0 && util <= 1 ? usd * util : null,
    });
  });
}

const fraxPairAbi = [
  { type: "function", name: "asset", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  {
    type: "function",
    name: "totalAsset",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "amount", type: "uint128" },
      { name: "shares", type: "uint128" },
    ],
  },
  {
    type: "function",
    name: "totalBorrow",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "amount", type: "uint128" },
      { name: "shares", type: "uint128" },
    ],
  },
] as const;

const fraxRegAbi = [{ type: "function", name: "getAllPairAddresses", stateMutability: "view", inputs: [], outputs: [{ type: "address[]" }] }] as const;

export async function readFraxlendMarkets(client: PublicClient, chainId: number): Promise<LendMarketRow[]> {
  const regs = FRAX_REG[chainId];
  if (!regs?.length) return [];
  const pairs: Address[] = [];
  const seen = new Set<string>();
  for (const reg of regs) {
    try {
      const all = await client.readContract({ address: reg, abi: fraxRegAbi, functionName: "getAllPairAddresses" });
      for (const p of all.slice(0, 30)) {
        const k = p.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        pairs.push(p);
      }
    } catch {
      /* registry miss */
    }
  }
  const out: LendMarketRow[] = [];
  await Promise.all(
    pairs.map(async (pair) => {
      try {
        const [asset, totA, totB] = await Promise.all([
          client.readContract({ address: pair, abi: fraxPairAbi, functionName: "asset" }),
          client.readContract({ address: pair, abi: fraxPairAbi, functionName: "totalAsset" }),
          client.readContract({ address: pair, abi: fraxPairAbi, functionName: "totalBorrow" }).catch(() => null),
        ]);
        const asAmt = (x: unknown) => {
          if (x && typeof x === "object" && "amount" in (x as object)) return BigInt((x as { amount: bigint }).amount);
          if (Array.isArray(x)) return BigInt(x[0] ?? 0n);
          try {
            return BigInt(x as bigint);
          } catch {
            return 0n;
          }
        };
        const amount = asAmt(totA);
        const borrow = totB == null ? 0n : asAmt(totB);
        if (amount === 0n && borrow === 0n) return;
        const [symbol, decimals] = await Promise.all([
          client.readContract({ address: asset, abi: erc20Abi, functionName: "symbol" }).catch(() => "TKN"),
          client.readContract({ address: asset, abi: erc20Abi, functionName: "decimals" }).catch(() => 18),
        ]);
        const dec = Number(decimals) || 18;
        const sym = String(symbol);
        const supN = Number(formatUnits(amount, dec));
        const borN = Number(formatUnits(borrow, dec));
        const px = /usd|dai|frax/i.test(sym) ? 1 : null;
        out.push(
          row({
            protocol: "Fraxlend",
            chainId,
            symbol: sym,
            token: asset,
            market: pair,
            supplyApy: null,
            borrowApy: null,
            supplyUsd: px != null && Number.isFinite(supN) ? supN * px : null,
            borrowUsd: px != null && Number.isFinite(borN) ? borN * px : null,
          }),
        );
      } catch {
        /* pair miss */
      }
    }),
  );
  return out;
}

const dolomiteMarketAbi = [
  { type: "function", name: "getNumMarkets", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getMarketTokenAddress", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] },
  {
    type: "function",
    name: "getMarketTotalPar",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [
      { name: "borrow", type: "uint128" },
      { name: "supply", type: "uint128" },
    ],
  },
  {
    type: "function",
    name: "getMarketCurrentIndex",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [
      { name: "borrow", type: "uint96" },
      { name: "supply", type: "uint96" },
      { name: "lastUpdate", type: "uint32" },
    ],
  },
  {
    type: "function",
    name: "getMarketPrice",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [{ name: "value", type: "uint256" }],
  },
] as const;

function tupleAmt(x: unknown, i: number): bigint {
  if (Array.isArray(x)) return BigInt(x[i] ?? 0n);
  if (x && typeof x === "object") {
    const o = x as { borrow?: bigint; supply?: bigint; value?: bigint };
    if (i === 0 && o.borrow != null) return BigInt(o.borrow);
    if (i === 1 && o.supply != null) return BigInt(o.supply);
    if (o.value != null) return BigInt(o.value);
  }
  return 0n;
}

function cleanSym(sym: string) {
  const s = sym.replace(/₮/g, "T").trim();
  if (/^usd[tT]0?$/i.test(s) || /^usdt\.e$/i.test(s)) return "USDT";
  if (/^usdc\.e$/i.test(s) || /^usdbc$/i.test(s)) return "USDC";
  return s || "TKN";
}

function catalogMeta(chainId: number, token: string): { symbol: string; decimals: number } | null {
  const hit = TOKEN_CATALOG.find((t) => t.chainId === chainId && t.address?.toLowerCase() === token.toLowerCase());
  if (hit) return { symbol: cleanSym(hit.symbol), decimals: hit.decimals };
  const d = DEX[chainId];
  if (!d) return null;
  const addr = token.toLowerCase();
  if (d.wrapped.toLowerCase() === addr) return { symbol: "WETH", decimals: 18 };
  if (d.usdc.toLowerCase() === addr) return { symbol: "USDC", decimals: d.usdcDecimals };
  if (d.usdt && d.usdt.toLowerCase() === addr) return { symbol: "USDT", decimals: d.usdtDecimals ?? 6 };
  if (d.dai && d.dai.toLowerCase() === addr) return { symbol: "DAI", decimals: d.daiDecimals ?? 18 };
  return null;
}

export async function readDolomiteMarkets(client: PublicClient, chainId: number): Promise<LendMarketRow[]> {
  const margin = DOLOMITE_MARGIN[chainId];
  if (!margin) return [];
  const n = Number(await client.readContract({ address: margin, abi: dolomiteMarketAbi, functionName: "getNumMarkets" }));
  if (!Number.isFinite(n) || n <= 0) return [];
  const max = Math.min(n, 40);
  type Snap = { i: number; token: Address; supplyWei: bigint; borrowWei: bigint; priceWad: bigint };
  const snaps: Snap[] = [];
  const CHUNK = 8;
  for (let start = 0; start < max; start += CHUNK) {
    const ids = Array.from({ length: Math.min(CHUNK, max - start) }, (_, j) => BigInt(start + j));
    const packed = await callMany(
      client,
      ids.flatMap((id) => [
        { address: margin, abi: dolomiteMarketAbi, functionName: "getMarketTokenAddress", args: [id] },
        { address: margin, abi: dolomiteMarketAbi, functionName: "getMarketTotalPar", args: [id] },
        { address: margin, abi: dolomiteMarketAbi, functionName: "getMarketCurrentIndex", args: [id] },
        { address: margin, abi: dolomiteMarketAbi, functionName: "getMarketPrice", args: [id] },
      ]),
    );
    for (let j = 0; j < ids.length; j++) {
      const i = start + j;
      const tokenRes = packed[j * 4];
      const parRes = packed[j * 4 + 1];
      const idxRes = packed[j * 4 + 2];
      const priceRes = packed[j * 4 + 3];
      if (tokenRes?.status !== "success" || parRes?.status !== "success" || idxRes?.status !== "success") continue;
      const token = tokenRes.result as Address;
      const borrowPar = tupleAmt(parRes.result, 0);
      const supplyPar = tupleAmt(parRes.result, 1);
      const borrowIdx = tupleAmt(idxRes.result, 0) || 10n ** 18n;
      const supplyIdx = tupleAmt(idxRes.result, 1) || 10n ** 18n;
      const supplyWei = (supplyPar * supplyIdx) / 10n ** 18n;
      const borrowWei = (borrowPar * borrowIdx) / 10n ** 18n;
      if (supplyWei === 0n && borrowWei === 0n) continue;
      const priceWad =
        priceRes?.status === "success"
          ? typeof priceRes.result === "bigint"
            ? priceRes.result
            : tupleAmt(priceRes.result, 0)
          : 0n;
      snaps.push({ i, token, supplyWei, borrowWei, priceWad });
    }
  }
  const uniq = [...new Set(snaps.map((s) => s.token.toLowerCase()))] as Address[];
  const meta = new Map<string, { symbol: string; decimals: number }>();
  for (const token of uniq) {
    const cat = catalogMeta(chainId, token);
    if (cat) meta.set(token.toLowerCase(), cat);
  }
  const missing = uniq.filter((t) => !meta.has(t.toLowerCase()));
  for (let i = 0; i < missing.length; i += 16) {
    const part = missing.slice(i, i + 16);
    const metaPacked = await callMany(
      client,
      part.flatMap((token) => [
        { address: token, abi: erc20Abi, functionName: "symbol" },
        { address: token, abi: erc20Abi, functionName: "decimals" },
      ]),
    );
    part.forEach((token, j) => {
      const symRes = metaPacked[j * 2];
      const decRes = metaPacked[j * 2 + 1];
      const symbol = symRes?.status === "success" ? cleanSym(String(symRes.result)) : "";
      const decimals = decRes?.status === "success" ? Number(decRes.result) || 18 : 18;
      if (symbol && symbol !== "TKN") meta.set(token.toLowerCase(), { symbol, decimals });
      else if (!meta.has(token.toLowerCase())) meta.set(token.toLowerCase(), { symbol: `0x${token.slice(2, 6)}`, decimals });
    });
  }
  const out: LendMarketRow[] = [];
  for (const s of snaps) {
    const m = meta.get(s.token.toLowerCase()) ?? { symbol: `0x${s.token.slice(2, 6)}`, decimals: 18 };
    const px = Number(s.priceWad) / 10 ** (36 - m.decimals);
    const priceUsd = Number.isFinite(px) && px > 0 && px < 1e7 ? px : /usd|dai/i.test(m.symbol) ? 1 : null;
    const supN = Number(formatUnits(s.supplyWei, m.decimals));
    const borN = Number(formatUnits(s.borrowWei, m.decimals));
    out.push(
      row({
        protocol: "Dolomite",
        chainId,
        symbol: m.symbol,
        token: s.token,
        market: `${margin}:${s.i}`,
        supplyApy: null,
        borrowApy: null,
        supplyUsd: priceUsd != null && Number.isFinite(supN) ? supN * priceUsd : null,
        borrowUsd: priceUsd != null && Number.isFinite(borN) ? borN * priceUsd : null,
      }),
    );
  }
  return out;
}

const ECHELON = "0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba";
const APTOS = "https://fullnode.mainnet.aptoslabs.com/v1";

async function aptosView(fn: string, args: unknown[]): Promise<unknown> {
  try {
    const res = await fetch(`${APTOS}/view`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ function: fn, type_arguments: [], arguments: args }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function aptosResource(addr: string, typ: string): Promise<Json | null> {
  try {
    const res = await fetch(`${APTOS}/accounts/${addr}/resource/${encodeURIComponent(typ)}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: Json };
    return json.data ?? null;
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

async function echelon(): Promise<LendMarketRow[]> {
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

export async function loadHttpLendMarkets(chainId: number): Promise<LendMarketRow[]> {
  const jobs: Array<Promise<LendMarketRow[]>> = [];
  if (chainId === 101) {
    jobs.push(kamino().catch(() => []));
    jobs.push(jupiterLend().catch(() => []));
    jobs.push(saveLend().catch(() => []));
  }
  if (chainId === 397) jobs.push(burrow().catch(() => []));
  if (chainId === 784) {
    jobs.push(navi().catch(() => []));
    jobs.push(scallop().catch(() => []));
    jobs.push(suilend().catch(() => []));
  }
  if (chainId === 728126428) jobs.push(justlend().catch(() => []));
  if (chainId === 56) jobs.push(lista().catch(() => []));
  if (chainId === 637) jobs.push(echelon().catch(() => []));
  if (CURVE_LEND_CHAIN[chainId]) jobs.push(curveLend(chainId).catch(() => []));
  if (!jobs.length) return [];
  const parts = await Promise.all(jobs);
  return parts.flat();
}
