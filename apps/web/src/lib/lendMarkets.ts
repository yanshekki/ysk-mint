import { erc20Abi, formatUnits, type Address, type PublicClient } from "viem";
import { CHAINS } from "@ysk-mint/config";
import { cacheGet, cacheKey, POLICIES } from "./defi/cache.ts";
import { evmPublicClient } from "./defi/evm/client.ts";
import { quoteUsd } from "./defi/quote.ts";
import { DEX } from "./defiAddresses.ts";
import { AAVE_FORKS, COMETS, COMPOUND_FORKS, COMPOUND_V2, SPARK } from "./lendingExtra.ts";
import { TOKEN_CATALOG } from "./tokenRegistry.ts";
import { chainIcon } from "./chainIcon.ts";

export type LendMarketRow = {
  id: string;
  chainId: number;
  chainShort: string;
  protocol: string;
  symbol: string;
  icon: string;
  token: string;
  market: string;
  supplyApy: number | null;
  borrowApy: number | null;
  supplyUsd: number | null;
  borrowUsd: number | null;
};

const poolAbi = [
  { type: "function", name: "getReservesList", stateMutability: "view", inputs: [], outputs: [{ type: "address[]" }] },
] as const;

const dataAbi = [
  {
    type: "function",
    name: "getReserveData",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [
      { name: "unbacked", type: "uint256" },
      { name: "accruedToTreasuryScaled", type: "uint256" },
      { name: "totalAToken", type: "uint256" },
      { name: "totalStableDebt", type: "uint256" },
      { name: "totalVariableDebt", type: "uint256" },
      { name: "liquidityRate", type: "uint256" },
      { name: "variableBorrowRate", type: "uint256" },
      { name: "stableBorrowRate", type: "uint256" },
      { name: "averageStableBorrowRate", type: "uint256" },
      { name: "liquidityIndex", type: "uint256" },
      { name: "variableBorrowIndex", type: "uint256" },
      { name: "lastUpdateTimestamp", type: "uint40" },
    ],
  },
] as const;

const comptrollerAbi = [
  { type: "function", name: "getAllMarkets", stateMutability: "view", inputs: [], outputs: [{ type: "address[]" }] },
] as const;

const cTokenAbi = [
  { type: "function", name: "supplyRatePerBlock", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "borrowRatePerBlock", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getCash", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalBorrows", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "underlying", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;

const cometAbi = [
  { type: "function", name: "baseToken", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalBorrow", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getUtilization", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getSupplyRate", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint64" }] },
  { type: "function", name: "getBorrowRate", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint64" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const;

const BENQI: Array<{ cToken: Address; symbol: string; underlying?: Address; dec: number }> = [
  { cToken: "0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c", symbol: "AVAX", dec: 18 },
  { cToken: "0xF362feA9659cf036792c9cb02f8ff8198E21B4cB", symbol: "sAVAX", underlying: "0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE", dec: 18 },
  { cToken: "0xBEb5d47A3f720Ec0a390d04b4d41ED7d9688bC7F", symbol: "USDC", underlying: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c6dBe1", dec: 6 },
  { cToken: "0xc9e5999b8e75C3fEB117F6f73E664b9f3C8ca65C", symbol: "USDT.e", underlying: "0xc7198437980c041c805A1EDcbA50c1Ce5db95118", dec: 6 },
  { cToken: "0xB715808a78F6041E46d61Cb123C9B4A27056AE9C", symbol: "USDC.e", underlying: "0xA7D7079b0FEaD91F3e65f86E304CbC559FfF1a7d", dec: 6 },
  { cToken: "0xd8fcDa6ec4Bdc547C0827B8804e89aCd817d56EF", symbol: "USDT", underlying: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", dec: 6 },
  { cToken: "0x835866d37AFB8CB8F8334dCCdaf66cf01832Ff5D", symbol: "DAI", underlying: "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70", dec: 18 },
];

const YEAR = 365.25 * 24 * 3600;
const RAY = 1e27;

function chainShort(chainId: number) {
  return Object.values(CHAINS).find((c) => c.chainId === chainId)?.short ?? String(chainId);
}

function tokenMeta(chainId: number, address: string, fallback: string) {
  const hit = TOKEN_CATALOG.find(
    (t) => t.chainId === chainId && ((t.native && address === "native") || t.address?.toLowerCase() === address.toLowerCase()),
  );
  const chain = Object.values(CHAINS).find((c) => c.chainId === chainId);
  return {
    symbol: hit?.symbol || fallback,
    icon: hit?.icon || (chain ? chainIcon(chain) : "/tokens/eth.png"),
    decimals: hit?.decimals ?? 18,
  };
}

function rayApy(rate: bigint): number | null {
  const apr = Number(rate) / RAY;
  if (!Number.isFinite(apr) || apr < 0) return null;
  if (apr === 0) return 0;
  if (apr > 2) return null;
  const apy = (1 + apr / YEAR) ** YEAR - 1;
  if (!Number.isFinite(apy) || apy < 0 || apy > 5) return apr * 100;
  return apy * 100;
}

function perBlockApy(rate: bigint, blocksYear: number): number | null {
  const r = Number(rate) / 1e18;
  if (!Number.isFinite(r) || r < 0) return null;
  if (r === 0) return 0;
  const apy = (1 + r) ** blocksYear - 1;
  if (!Number.isFinite(apy) || apy < 0 || apy > 10) {
    const apr = r * blocksYear;
    return Number.isFinite(apr) && apr >= 0 && apr <= 10 ? apr * 100 : null;
  }
  return apy * 100;
}

function perSecondApy(rate: bigint): number | null {
  const r = Number(rate) / 1e18;
  if (!Number.isFinite(r) || r < 0) return null;
  const apy = (1 + r) ** YEAR - 1;
  if (!Number.isFinite(apy) || apy < 0 || apy > 10) {
    const apr = r * YEAR;
    return Number.isFinite(apr) && apr >= 0 && apr <= 10 ? apr * 100 : null;
  }
  return apy * 100;
}

function blocksYear(chainId: number) {
  if (chainId === 56) return 10_512_000;
  if (chainId === 43114) return 15_768_000;
  if (chainId === 137) return 15_768_000;
  return 2_628_000;
}

async function mapLimit<T, R>(items: T[], n: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    }),
  );
  return out;
}

function isStable(symbol: string) {
  return /^(W?USDC|W?USDT|DAI|USDS|GHO|PYUSD|USDBC|USDM|USDA|FRAX|LUSD|CRVUSD|GUSD|TUSD|FDUSD|USDP|USD1)(\.E)?$/i.test(symbol.trim());
}

async function usd(client: PublicClient, chainId: number, token: Address | undefined, decimals: number, native?: boolean, symbol?: string) {
  if (symbol && isStable(symbol)) return 1;
  const q = await Promise.race([
    quoteUsd({ evm: client }, chainId, token, decimals, native).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
  ]);
  return q?.usdc ?? null;
}

async function readAaveStyle(
  client: PublicClient,
  chainId: number,
  protocol: string,
  cfg: { pool: Address; data: Address },
  onRows?: (rows: LendMarketRow[]) => void,
): Promise<LendMarketRow[]> {
  const list = await client.readContract({ address: cfg.pool, abi: poolAbi, functionName: "getReservesList" });
  const assets = list.slice(0, 40);
  const pack = await client.multicall({
    contracts: assets.flatMap((asset) => [
      { address: cfg.data, abi: dataAbi, functionName: "getReserveData" as const, args: [asset] },
      { address: asset, abi: erc20Abi, functionName: "symbol" as const },
      { address: asset, abi: erc20Abi, functionName: "decimals" as const },
    ]),
    allowFailure: true,
  });
  const short = chainShort(chainId);
  const drafts: Array<{
    asset: Address;
    symbol: string;
    decimals: number;
    totalA: bigint;
    totalDebt: bigint;
    liq: bigint;
    brw: bigint;
  }> = [];
  for (let i = 0; i < assets.length; i++) {
    const d = pack[i * 3];
    const s = pack[i * 3 + 1];
    const dec = pack[i * 3 + 2];
    if (d.status !== "success") continue;
    const row = d.result as unknown;
    let totalA = 0n;
    let totalDebt = 0n;
    let liq = 0n;
    let brw = 0n;
    if (Array.isArray(row)) {
      totalA = row[2] as bigint;
      totalDebt = (row[3] as bigint) + (row[4] as bigint);
      liq = row[5] as bigint;
      brw = row[6] as bigint;
    } else {
      const o = row as { totalAToken: bigint; totalStableDebt: bigint; totalVariableDebt: bigint; liquidityRate: bigint; variableBorrowRate: bigint };
      totalA = o.totalAToken;
      totalDebt = o.totalStableDebt + o.totalVariableDebt;
      liq = o.liquidityRate;
      brw = o.variableBorrowRate;
    }
    if (totalA === 0n && totalDebt === 0n) continue;
    drafts.push({
      asset: assets[i],
      symbol: s.status === "success" ? String(s.result) : "TKN",
      decimals: dec.status === "success" ? Number(dec.result) : 18,
      totalA,
      totalDebt,
      liq,
      brw,
    });
  }
  const rows = drafts.map((d) => {
    const meta = tokenMeta(chainId, d.asset, d.symbol);
    const supplyN = Number(formatUnits(d.totalA, d.decimals));
    const borrowN = Number(formatUnits(d.totalDebt, d.decimals));
    const stable = isStable(meta.symbol) ? 1 : null;
    return {
      id: `${protocol}:${chainId}:${d.asset}`,
      chainId,
      chainShort: short,
      protocol,
      symbol: meta.symbol,
      icon: meta.icon,
      token: d.asset,
      market: cfg.pool,
      supplyApy: rayApy(d.liq),
      borrowApy: rayApy(d.brw),
      supplyUsd: stable != null && Number.isFinite(supplyN) ? supplyN * stable : null,
      borrowUsd: stable != null && Number.isFinite(borrowN) ? borrowN * stable : null,
      _decimals: d.decimals,
      _supplyN: supplyN,
      _borrowN: borrowN,
    };
  });
  onRows?.(rows.map(({ _decimals, _supplyN, _borrowN, ...r }) => r));
  const need = rows.filter((r) => r.supplyUsd == null && r.borrowUsd == null);
  await mapLimit(need, 8, async (r) => {
    const price = await usd(client, chainId, r.token as Address, r._decimals, false, r.symbol);
    if (price == null) return r;
    r.supplyUsd = Number.isFinite(r._supplyN) ? r._supplyN * price : null;
    r.borrowUsd = Number.isFinite(r._borrowN) ? r._borrowN * price : null;
    return r;
  });
  const out = rows.map(({ _decimals, _supplyN, _borrowN, ...r }) => r);
  onRows?.(out);
  return out;
}

async function readComptroller(
  client: PublicClient,
  chainId: number,
  cfg: { comptroller: Address; nativeC?: Address; name: string },
): Promise<LendMarketRow[]> {
  const markets = await client.readContract({ address: cfg.comptroller, abi: comptrollerAbi, functionName: "getAllMarkets" });
  const list = markets.slice(0, 24);
  const short = chainShort(chainId);
  const by = blocksYear(chainId);
  const rows = await mapLimit(list, 6, async (cTok) => {
    try {
      const [sup, brw, cash, borrows, symbol] = await Promise.all([
        client.readContract({ address: cTok, abi: cTokenAbi, functionName: "supplyRatePerBlock" }),
        client.readContract({ address: cTok, abi: cTokenAbi, functionName: "borrowRatePerBlock" }),
        client.readContract({ address: cTok, abi: cTokenAbi, functionName: "getCash" }),
        client.readContract({ address: cTok, abi: cTokenAbi, functionName: "totalBorrows" }),
        client.readContract({ address: cTok, abi: cTokenAbi, functionName: "symbol" }).catch(() => "cTKN"),
      ]);
      const native = Boolean(cfg.nativeC && cTok.toLowerCase() === cfg.nativeC.toLowerCase());
      let underlying: Address | undefined;
      let decimals = 18;
      let display = String(symbol).replace(/^c/, "");
      if (!native) {
        underlying = await client.readContract({ address: cTok, abi: cTokenAbi, functionName: "underlying" }).catch(() => undefined);
        if (underlying) {
          decimals = Number(await client.readContract({ address: underlying, abi: erc20Abi, functionName: "decimals" }).catch(() => 18));
          display = String(await client.readContract({ address: underlying, abi: erc20Abi, functionName: "symbol" }).catch(() => display));
        }
      }
      const cashN = Number(formatUnits(cash, decimals));
      const borN = Number(formatUnits(borrows, decimals));
      if ((!Number.isFinite(cashN) || cashN === 0) && (!Number.isFinite(borN) || borN === 0)) return null;
      const price = await usd(client, chainId, underlying, decimals, native, display);
      const meta = tokenMeta(chainId, native ? "native" : underlying || cTok, display);
      return {
        id: `${cfg.name}:${chainId}:${cTok}`,
        chainId,
        chainShort: short,
        protocol: cfg.name,
        symbol: meta.symbol,
        icon: meta.icon,
        token: native ? "native" : underlying || cTok,
        market: cTok,
        supplyApy: perBlockApy(sup, by),
        borrowApy: perBlockApy(brw, by),
        supplyUsd: price != null && Number.isFinite(cashN + borN) ? (cashN + borN) * price : null,
        borrowUsd: price != null && Number.isFinite(borN) ? borN * price : null,
      } satisfies LendMarketRow;
    } catch {
      return null;
    }
  });
  return rows.filter((r) => r != null) as LendMarketRow[];
}

async function readComets(client: PublicClient, chainId: number): Promise<LendMarketRow[]> {
  const list = COMETS[chainId];
  if (!list) return [];
  const short = chainShort(chainId);
  const rows = await Promise.all(
    list.map(async (comet) => {
      try {
        const [base, supply, borrow, util] = await Promise.all([
          client.readContract({ address: comet, abi: cometAbi, functionName: "baseToken" }),
          client.readContract({ address: comet, abi: cometAbi, functionName: "totalSupply" }),
          client.readContract({ address: comet, abi: cometAbi, functionName: "totalBorrow" }),
          client.readContract({ address: comet, abi: cometAbi, functionName: "getUtilization" }),
        ]);
        const [sRate, bRate, decimals] = await Promise.all([
          client.readContract({ address: comet, abi: cometAbi, functionName: "getSupplyRate", args: [util] }),
          client.readContract({ address: comet, abi: cometAbi, functionName: "getBorrowRate", args: [util] }),
          client.readContract({ address: comet, abi: cometAbi, functionName: "decimals" }).catch(() => 6),
        ]);
        const dec = Number(decimals) || 6;
        const supN = Number(formatUnits(supply, dec));
        const borN = Number(formatUnits(borrow, dec));
        if (supN === 0 && borN === 0) return null;
        const meta = tokenMeta(chainId, base, "USDC");
        const price = await usd(client, chainId, base, dec, false, meta.symbol);
        return {
          id: `Compound III:${chainId}:${comet}`,
          chainId,
          chainShort: short,
          protocol: "Compound III",
          symbol: meta.symbol,
          icon: meta.icon,
          token: base,
          market: comet,
          supplyApy: perSecondApy(BigInt(sRate)),
          borrowApy: perSecondApy(BigInt(bRate)),
          supplyUsd: price != null && Number.isFinite(supN) ? supN * price : null,
          borrowUsd: price != null && Number.isFinite(borN) ? borN * price : null,
        } satisfies LendMarketRow;
      } catch {
        return null;
      }
    }),
  );
  return rows.filter((r) => r != null) as LendMarketRow[];
}

async function readBenqi(client: PublicClient): Promise<LendMarketRow[]> {
  const short = "AVAX";
  const by = blocksYear(43114);
  const rows = await Promise.all(
    BENQI.map(async (m) => {
      try {
        const [sup, brw, cash, borrows] = await Promise.all([
          client.readContract({ address: m.cToken, abi: cTokenAbi, functionName: "supplyRatePerBlock" }),
          client.readContract({ address: m.cToken, abi: cTokenAbi, functionName: "borrowRatePerBlock" }),
          client.readContract({ address: m.cToken, abi: cTokenAbi, functionName: "getCash" }),
          client.readContract({ address: m.cToken, abi: cTokenAbi, functionName: "totalBorrows" }),
        ]);
        const native = !m.underlying;
        const cashN = Number(formatUnits(cash, m.dec));
        const borN = Number(formatUnits(borrows, m.dec));
        const price = await usd(client, 43114, m.underlying, m.dec, native, m.symbol);
        const meta = tokenMeta(43114, native ? "native" : m.underlying!, m.symbol);
        return {
          id: `BENQI:43114:${m.cToken}`,
          chainId: 43114,
          chainShort: short,
          protocol: "BENQI",
          symbol: meta.symbol,
          icon: meta.icon,
          token: native ? "native" : m.underlying!,
          market: m.cToken,
          supplyApy: perBlockApy(sup, by),
          borrowApy: perBlockApy(brw, by),
          supplyUsd: price != null ? (cashN + borN) * price : null,
          borrowUsd: price != null ? borN * price : null,
        } satisfies LendMarketRow;
      } catch {
        return null;
      }
    }),
  );
  return rows.filter((r) => r != null) as LendMarketRow[];
}

export function lendChainIds(filter: number | "all", disabled: number[]) {
  const ids = new Set<number>();
  for (const d of Object.values(DEX)) if (d.aave) ids.add(d.chainId);
  for (const id of Object.keys(SPARK)) ids.add(Number(id));
  for (const id of Object.keys(AAVE_FORKS)) ids.add(Number(id));
  for (const id of Object.keys(COMPOUND_V2)) ids.add(Number(id));
  for (const id of Object.keys(COMPOUND_FORKS)) ids.add(Number(id));
  for (const id of Object.keys(COMETS)) ids.add(Number(id));
  ids.add(43114);
  const off = new Set(disabled);
  const all = [...ids].filter((id) => !off.has(id));
  if (filter === "all") return all;
  return all.includes(filter) ? [filter] : [];
}

function keepMarket(r: LendMarketRow) {
  if (r.supplyUsd == null && r.borrowUsd == null) return (r.supplyApy ?? 0) > 0 || (r.borrowApy ?? 0) > 0;
  return Math.max(r.supplyUsd ?? 0, r.borrowUsd ?? 0) >= 1000;
}

export type LendAssetRow = {
  id: string;
  chainId: number;
  chainShort: string;
  chainNames: string[];
  symbol: string;
  icon: string;
  token: string;
  venues: LendMarketRow[];
  venueNames: string[];
  supplyApy: number | null;
  borrowApy: number | null;
  supplyApyMin: number | null;
  supplyApyMax: number | null;
  borrowApyMin: number | null;
  borrowApyMax: number | null;
  supplyUsd: number | null;
  borrowUsd: number | null;
};

export function lendSymbolSlug(symbol: string) {
  return symbol.trim().toLowerCase().replace(/₮/g, "t").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
}

export function sameLendSymbol(a: string, b: string) {
  return lendSymbolSlug(a) === lendSymbolSlug(b);
}

function wavg(rows: LendMarketRow[], apy: "supplyApy" | "borrowApy", weight: "supplyUsd" | "borrowUsd") {
  let num = 0;
  let den = 0;
  for (const r of rows) {
    const a = r[apy];
    const m = r[weight];
    if (a == null || !Number.isFinite(a) || m == null || !Number.isFinite(m) || m <= 0) continue;
    num += a * m;
    den += m;
  }
  if (den > 0) return num / den;
  const hit = rows.find((r) => r[apy] != null && Number.isFinite(r[apy] as number));
  return hit?.[apy] ?? null;
}

function apySpan(rows: LendMarketRow[], key: "supplyApy" | "borrowApy") {
  let min: number | null = null;
  let max: number | null = null;
  for (const r of rows) {
    const a = r[key];
    if (a == null || !Number.isFinite(a)) continue;
    if (min == null || a < min) min = a;
    if (max == null || a > max) max = a;
  }
  return { min, max };
}

function sumField(rows: LendMarketRow[], key: "supplyUsd" | "borrowUsd") {
  let n = 0;
  let any = false;
  for (const r of rows) {
    const v = r[key];
    if (v == null || !Number.isFinite(v)) continue;
    n += v;
    any = true;
  }
  return any ? n : null;
}

function assetFromVenues(id: string, venues: LendMarketRow[]): LendAssetRow {
  const sorted = [...venues].sort((a, b) => (b.supplyUsd ?? 0) - (a.supplyUsd ?? 0));
  const head = sorted[0];
  const names: string[] = [];
  for (const v of sorted) if (!names.includes(v.protocol)) names.push(v.protocol);
  const chainNames: string[] = [];
  for (const v of sorted) if (!chainNames.includes(v.chainShort)) chainNames.push(v.chainShort);
  const supply = apySpan(sorted, "supplyApy");
  const borrow = apySpan(sorted, "borrowApy");
  return {
    id,
    chainId: head.chainId,
    chainShort: chainNames.join(" · "),
    chainNames,
    symbol: head.symbol,
    icon: head.icon,
    token: head.token,
    venues: sorted,
    venueNames: names,
    supplyApy: wavg(sorted, "supplyApy", "supplyUsd"),
    borrowApy: wavg(sorted, "borrowApy", "borrowUsd"),
    supplyApyMin: supply.min,
    supplyApyMax: supply.max,
    borrowApyMin: borrow.min,
    borrowApyMax: borrow.max,
    supplyUsd: sumField(sorted, "supplyUsd"),
    borrowUsd: sumField(sorted, "borrowUsd"),
  };
}

export function groupLendAssets(rows: LendMarketRow[]): LendAssetRow[] {
  const m = new Map<string, LendMarketRow[]>();
  for (const r of rows) {
    const key = lendSymbolSlug(r.symbol);
    const list = m.get(key);
    if (list) list.push(r);
    else m.set(key, [r]);
  }
  return [...m.entries()].map(([id, venues]) => assetFromVenues(id, venues)).sort((a, b) => (b.supplyUsd ?? 0) - (a.supplyUsd ?? 0));
}

export function groupLendByChain(rows: LendMarketRow[]): Array<{ chainId: number; chainShort: string; venues: LendMarketRow[]; supplyUsd: number | null }> {
  const m = new Map<number, LendMarketRow[]>();
  for (const r of rows) {
    const list = m.get(r.chainId);
    if (list) list.push(r);
    else m.set(r.chainId, [r]);
  }
  const out = [...m.entries()].map(([chainId, venues]) => {
    const sorted = [...venues].sort((a, b) => (b.supplyUsd ?? 0) - (a.supplyUsd ?? 0));
    return {
      chainId,
      chainShort: sorted[0]?.chainShort ?? String(chainId),
      venues: sorted,
      supplyUsd: sumField(sorted, "supplyUsd"),
    };
  });
  out.sort((a, b) => (b.supplyUsd ?? 0) - (a.supplyUsd ?? 0));
  return out;
}

export async function loadLendMarkets(chainId: number, onPart?: (rows: LendMarketRow[]) => void): Promise<LendMarketRow[]> {
  const client = evmPublicClient(chainId);
  if (!client) return [];
  return cacheGet(
    { key: cacheKey("lend", chainId), policy: { ...POLICIES.markets, keep: (rows: LendMarketRow[]) => rows.length > 0 } },
    async () => {
      const acc: LendMarketRow[] = [];
      const add = (rows: LendMarketRow[]) => {
        const kept = rows.filter(keepMarket);
        if (!kept.length) return;
        const by = new Map(acc.map((r) => [r.id, r]));
        for (const r of kept) by.set(r.id, r);
        acc.length = 0;
        acc.push(...by.values());
        onPart?.(acc.slice());
      };
      const jobs: Array<Promise<void>> = [];
      const aave = DEX[chainId]?.aave;
      if (aave) jobs.push(readAaveStyle(client, chainId, "Aave", { pool: aave.pool, data: aave.data }, add).then(() => {}).catch(() => {}));
      const spark = SPARK[chainId];
      if (spark) jobs.push(readAaveStyle(client, chainId, "Spark", spark, add).then(() => {}).catch(() => {}));
      for (const fork of AAVE_FORKS[chainId] ?? []) {
        jobs.push(readAaveStyle(client, chainId, fork.name, { pool: fork.pool, data: fork.data }, add).then(() => {}).catch(() => {}));
      }
      const v2 = COMPOUND_V2[chainId];
      if (v2) jobs.push(readComptroller(client, chainId, v2).then(add).catch(() => {}));
      for (const fork of COMPOUND_FORKS[chainId] ?? []) {
        jobs.push(readComptroller(client, chainId, fork).then(add).catch(() => {}));
      }
      jobs.push(readComets(client, chainId).then(add).catch(() => {}));
      if (chainId === 43114) jobs.push(readBenqi(client).then(add).catch(() => {}));
      await Promise.all(jobs);
      return acc;
    },
  );
}
