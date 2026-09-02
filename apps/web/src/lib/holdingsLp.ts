import { formatUnits, type Address, type PublicClient } from "viem";
import { accountCache, mapChunk } from "./defi/cache.ts";
import { discoveredPools, loadEvmMarkets } from "./defi/markets.ts";
import { jsonGet } from "./domainNames/http.ts";
import { quoteEvmToken, type Quote } from "./defiQuotes.ts";
import { erc20BalAbi, v2PairAbi } from "./dexPools.ts";
import { TOKEN_CATALOG } from "./tokenRegistry.ts";
import { chainIcon } from "./chainIcon.ts";
import { nearMyLp } from "./nearDex.ts";
import { adaMyLp } from "./adaDex.ts";
import type { ProtocolLine, UniCard } from "./defiPositions.ts";
import { CHAINS } from "@ysk-mint/config";

function fmtAmt(raw: bigint, decimals: number) {
  const n = Number(formatUnits(raw, decimals));
  if (!Number.isFinite(n)) return formatUnits(raw, decimals);
  if (n === 0) return "0";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function fmtNum(n: number) {
  if (!Number.isFinite(n)) return "";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function chainShort(chainId: number) {
  return Object.values(CHAINS).find((c) => c.chainId === chainId)?.short ?? String(chainId);
}

function tokenIcon(chainId: number, symbol: string) {
  const hit = TOKEN_CATALOG.find((t) => t.chainId === chainId && t.symbol?.toLowerCase() === symbol.toLowerCase());
  if (hit?.icon) return hit.icon;
  const chain = Object.values(CHAINS).find((c) => c.chainId === chainId);
  return chain ? chainIcon(chain) : "/tokens/eth.png";
}

function lpLine(
  protocol: string,
  chainId: number,
  pair: string,
  amount: string,
  raw: bigint,
  contract: string,
  extra: string | undefined,
  valueUsdc: number | null,
  icon?: string,
): ProtocolLine {
  return {
    id: `lp-${protocol}-${chainId}-${contract}-${pair}`,
    chainId,
    chain: chainShort(chainId),
    symbol: pair.replace(" / ", "/"),
    name: pair.includes("/") ? pair.replace("/", " / ") : pair,
    icon: icon || tokenIcon(chainId, pair.split(/[/\s]/)[0] || ""),
    amount,
    raw,
    contract,
    side: "lp",
    extra,
    quote: valueUsdc != null && valueUsdc > 0 ? { usdc: valueUsdc, source: "v2" } : null,
    valueUsdc,
  };
}

function cardsFrom(protocol: string, chainId: number, lines: ProtocolLine[]): UniCard[] {
  if (!lines.length) return [];
  return [{ chainId, chain: chainShort(chainId), protocol, lines }];
}

const pairMetaAbi = [
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const;

async function evmMeta(client: PublicClient, token: Address) {
  const [symbol, decimals] = await Promise.all([
    client.readContract({ address: token, abi: pairMetaAbi, functionName: "symbol" }).catch(() => "TKN"),
    client.readContract({ address: token, abi: pairMetaAbi, functionName: "decimals" }).catch(() => 18),
  ]);
  return { symbol: String(symbol), decimals: Number(decimals) };
}

export async function readEvmV2HoldingsLp(
  client: PublicClient,
  chainId: number,
  user: Address,
  quotes: Map<string, Quote>,
): Promise<UniCard[]> {
  return accountCache("pos.lp", chainId, user, "v2", () => readEvmV2HoldingsLpWork(client, chainId, user, quotes));
}

async function readEvmV2HoldingsLpWork(
  client: PublicClient,
  chainId: number,
  user: Address,
  quotes: Map<string, Quote>,
): Promise<UniCard[]> {
  await loadEvmMarkets(chainId).catch(() => []);
  const pools = discoveredPools(chainId);
  if (!pools.length) return [];
  const byProto = new Map<string, ProtocolLine[]>();
  const seen = new Set<string>();
  await mapChunk(pools, 24, async (p) => {
    const id = p.pool.toLowerCase();
    if (seen.has(id)) return null;
    seen.add(id);
    try {
      const bal = await client.readContract({
        address: p.pool as Address,
        abi: erc20BalAbi,
        functionName: "balanceOf",
        args: [user],
      });
      if (bal === 0n) return null;
      const [reserves, supply, token0] = await Promise.all([
        client.readContract({ address: p.pool as Address, abi: v2PairAbi, functionName: "getReserves" }),
        client.readContract({ address: p.pool as Address, abi: v2PairAbi, functionName: "totalSupply" }),
        client.readContract({ address: p.pool as Address, abi: v2PairAbi, functionName: "token0" }),
      ]);
      if (supply === 0n) return null;
      const t0 = token0.toLowerCase();
      const aIs0 = p.tokenA.toLowerCase() === t0;
      const raw0 = aIs0 ? reserves[0] : reserves[1];
      const raw1 = aIs0 ? reserves[1] : reserves[0];
      const amt0 = (raw0 * bal) / supply;
      const amt1 = (raw1 * bal) / supply;
      const [m0, m1] = await Promise.all([evmMeta(client, p.tokenA as Address), evmMeta(client, p.tokenB as Address)]);
      const q0 =
        quotes.get(`${chainId}:${p.tokenA.toLowerCase()}`) ??
        (await quoteEvmToken(client, chainId, p.tokenA as Address, m0.decimals).catch(() => null));
      const q1 =
        quotes.get(`${chainId}:${p.tokenB.toLowerCase()}`) ??
        (await quoteEvmToken(client, chainId, p.tokenB as Address, m1.decimals).catch(() => null));
      const n0 = Number(formatUnits(amt0, m0.decimals));
      const n1 = Number(formatUnits(amt1, m1.decimals));
      const usd = (q0 && Number.isFinite(n0) ? n0 * q0.usdc : 0) + (q1 && Number.isFinite(n1) ? n1 * q1.usdc : 0);
      const value = q0 || q1 ? usd : null;
      const line = lpLine(
        p.protocolName,
        chainId,
        `${m0.symbol}/${m1.symbol}`,
        `${fmtAmt(amt0, m0.decimals)} + ${fmtAmt(amt1, m1.decimals)}`,
        bal,
        p.pool,
        p.protocolName,
        value,
      );
      const list = byProto.get(p.protocolName) ?? [];
      list.push(line);
      byProto.set(p.protocolName, list);
    } catch {
      /* skip pool */
    }
    return null;
  });
  return [...byProto.entries()].flatMap(([protocol, lines]) => cardsFrom(protocol, chainId, lines));
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v != null ? String(v) : "";
}

function pairFrom(row: Record<string, unknown>): string {
  const a = str(row.symbolA || row.mintASymbol || row.token0Symbol || row.tokenXSymbol || (row.token_x as { symbol?: string } | undefined)?.symbol || (row.tokenA as { symbol?: string } | undefined)?.symbol);
  const b = str(row.symbolB || row.mintBSymbol || row.token1Symbol || row.tokenYSymbol || (row.token_y as { symbol?: string } | undefined)?.symbol || (row.tokenB as { symbol?: string } | undefined)?.symbol);
  if (a && b) return `${a}/${b}`;
  const name = str(row.poolName || row.name || row.pool_name);
  const m = name.match(/([A-Za-z0-9.]+)\s*[-/]\s*([A-Za-z0-9.]+)/);
  return m ? `${m[1]}/${m[2]}` : "";
}

function usdFrom(row: Record<string, unknown>): number | null {
  return (
    num(row.positionUsd) ??
    num(row.totalUsd) ??
    num(row.valueUsd) ??
    num(row.usdValue) ??
    num(row.tvlUsd) ??
    num(row.total_balance_usd) ??
    num(row.balanceUsd) ??
    num(row.value) ??
    num(row.usd) ??
    num(row.tvl)
  );
}

function poolOf(row: Record<string, unknown>): string {
  return str(row.poolId || row.pool || row.pool_address || row.address || row.id || row.lpMint || row.positionAddress);
}

function walkRows(json: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const seen = new Set<unknown>();
  const walk = (v: unknown, depth: number) => {
    if (v == null || depth > 6 || seen.has(v)) return;
    if (Array.isArray(v)) {
      seen.add(v);
      for (const x of v) walk(x, depth + 1);
      return;
    }
    if (typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if (pairFrom(o) || usdFrom(o) != null) out.push(o);
    seen.add(v);
    for (const x of Object.values(o)) walk(x, depth + 1);
  };
  walk(json, 0);
  return out;
}

function solLines(protocol: string, rows: Record<string, unknown>[]): ProtocolLine[] {
  const lines: ProtocolLine[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const pair = pairFrom(row);
    if (!pair) continue;
    const pool = poolOf(row) || pair;
    const key = `${protocol}:${pool}:${pair}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const usd = usdFrom(row);
    const a = num(row.amountA ?? row.tokenAmountA ?? row.amount_x);
    const b = num(row.amountB ?? row.tokenAmountB ?? row.amount_y);
    const amount = a != null && b != null ? `${fmtNum(a)} + ${fmtNum(b)}` : usd != null ? fmtNum(usd) : "LP";
    const raw = usd != null ? BigInt(Math.round(usd * 1e6)) : 1n;
    lines.push(lpLine(protocol, 101, pair, amount, raw, pool, protocol, usd, "/tokens/sol.png"));
  }
  return lines;
}

async function raydiumLp(owner: string): Promise<ProtocolLine[]> {
  const urls = [
    `https://owner-v1.raydium.io/position/stake/${owner}`,
    `https://owner-v1.raydium.io/position/clmm/${owner}`,
    `https://api-v3.raydium.io/position/clmm?owner=${encodeURIComponent(owner)}`,
    `https://api-v3.raydium.io/positions/clmm?wallet=${encodeURIComponent(owner)}`,
  ];
  const lines: ProtocolLine[] = [];
  for (const url of urls) {
    const json = await jsonGet<unknown>(url);
    if (!json) continue;
    lines.push(...solLines("Raydium", walkRows(json)));
  }
  return lines;
}

async function meteoraLp(owner: string): Promise<ProtocolLine[]> {
  const json = await jsonGet<unknown>(`https://dlmm.datapi.meteora.ag/portfolio/open?user=${encodeURIComponent(owner)}&page=1&page_size=50`);
  if (!json) return [];
  return solLines("Meteora", walkRows(json));
}

async function orcaLp(owner: string): Promise<ProtocolLine[]> {
  const urls = [
    `https://api.orca.so/v2/solana/positions?wallet=${encodeURIComponent(owner)}`,
    `https://api.orca.so/v2/solana/user/${encodeURIComponent(owner)}/positions`,
  ];
  const lines: ProtocolLine[] = [];
  for (const url of urls) {
    const json = await jsonGet<unknown>(url);
    if (!json) continue;
    lines.push(...solLines("Orca", walkRows(json)));
  }
  return lines;
}

export async function readSolHoldingsLp(owner: string): Promise<UniCard[]> {
  if (!owner) return [];
  return accountCache("pos.lp", 101, owner, "http", async () => {
    const [ray, met, orc] = await Promise.all([
      raydiumLp(owner).catch(() => [] as ProtocolLine[]),
      meteoraLp(owner).catch(() => [] as ProtocolLine[]),
      orcaLp(owner).catch(() => [] as ProtocolLine[]),
    ]);
    return [
      ...cardsFrom("Raydium", 101, ray),
      ...cardsFrom("Meteora", 101, met),
      ...cardsFrom("Orca", 101, orc),
    ];
  });
}

export async function readNearHoldingsLp(account: string): Promise<UniCard[]> {
  if (!account) return [];
  return accountCache("pos.lp", 397, account, "ref", async () => {
    const hits = await nearMyLp(account).catch(() => []);
    const lines: ProtocolLine[] = hits.map((h) => {
      const usd = Number(h.valueHint);
      const value = Number.isFinite(usd) && usd > 0 ? usd : null;
      return lpLine(
        h.venueNames[0] || "Rhea",
        397,
        `${h.symbolA}/${h.symbolB}`,
        "LP",
        value != null ? BigInt(Math.round(value * 1e6)) : 1n,
        h.tokenA,
        h.venueNames[0],
        value,
        h.iconA,
      );
    });
    const by = new Map<string, ProtocolLine[]>();
    for (const l of lines) {
      const p = l.extra || "Rhea";
      const list = by.get(p) ?? [];
      list.push(l);
      by.set(p, list);
    }
    return [...by.entries()].flatMap(([protocol, ls]) => cardsFrom(protocol, 397, ls));
  });
}

export async function readAdaHoldingsLp(units: string[]): Promise<UniCard[]> {
  if (!units.length) return [];
  const key = units.slice().sort().join("|");
  return accountCache("pos.lp", 1815, key.slice(0, 64), "minswap", async () => {
    const hits = await adaMyLp(units).catch(() => []);
    const lines: ProtocolLine[] = hits.map((h) =>
      lpLine(
        h.venueNames[0] || "Minswap",
        1815,
        `${h.symbolA}/${h.symbolB}`,
        "LP",
        1n,
        h.tokenA,
        h.venueNames[0],
        null,
        h.iconA,
      ),
    );
    const by = new Map<string, ProtocolLine[]>();
    for (const l of lines) {
      const p = l.extra || "Minswap";
      const list = by.get(p) ?? [];
      list.push(l);
      by.set(p, list);
    }
    return [...by.entries()].flatMap(([protocol, ls]) => cardsFrom(protocol, 1815, ls));
  });
}
