import { erc20Abi, formatUnits, type Address, type PublicClient } from "viem";
import { CHAINS } from "@ysk-mint/config";
import { chainIcon } from "./chainIcon.ts";
import { FRAX_REG } from "./lendingExtra.ts";
import { TOKEN_CATALOG } from "./tokenRegistry.ts";
import type { LendMarketRow } from "./lendMarkets.ts";

export const HTTP_LEND_CHAINS = [101, 397, 784, 637, 728126428];

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

export async function loadHttpLendMarkets(chainId: number): Promise<LendMarketRow[]> {
  const jobs: Array<Promise<LendMarketRow[]>> = [];
  if (chainId === 101) {
    jobs.push(kamino().catch(() => []));
    jobs.push(jupiterLend().catch(() => []));
  }
  if (chainId === 397) jobs.push(burrow().catch(() => []));
  if (chainId === 784) {
    jobs.push(navi().catch(() => []));
    jobs.push(scallop().catch(() => []));
    jobs.push(suilend().catch(() => []));
  }
  if (chainId === 728126428) jobs.push(justlend().catch(() => []));
  if (chainId === 56) jobs.push(lista().catch(() => []));
  if (!jobs.length) return [];
  const parts = await Promise.all(jobs);
  return parts.flat();
}
