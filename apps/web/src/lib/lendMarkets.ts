import { erc20Abi, formatUnits, type Address, type PublicClient } from "viem";
import { CHAINS } from "@ysk-mint/config";
import { cacheGet, cacheKey, POLICIES } from "./defi/cache.ts";
import { evmPublicClient } from "./defi/evm/client.ts";
import { quoteUsd } from "./defi/quote.ts";
import { DEX } from "./defiAddresses.ts";
import {
  AAVE_FORKS,
  COMETS,
  COMPOUND_FORKS,
  COMPOUND_V2,
  DOLOMITE_MARGIN,
  EULER_VAULTS,
  FLUID_CHAINS,
  FLUID_LEND,
  MORPHO,
  MORPHO_MARKETS,
  SILO_FACTORY,
  SPARK,
} from "./lendingExtra.ts";
import { HTTP_LEND_CHAINS, loadHttpLendMarkets, readDolomiteMarkets, readFraxlendMarkets } from "./lendMarketsHttp.ts";
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
  { type: "function", name: "supplyRatePerTimestamp", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "borrowRatePerTimestamp", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
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

const vaultAbi = [
  { type: "function", name: "asset", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "totalAssets", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalBorrows", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const;

const morphoBlueAbi = [
  {
    type: "function",
    name: "market",
    stateMutability: "view",
    inputs: [{ type: "bytes32" }],
    outputs: [
      { name: "totalSupplyAssets", type: "uint128" },
      { name: "totalSupplyShares", type: "uint128" },
      { name: "totalBorrowAssets", type: "uint128" },
      { name: "totalBorrowShares", type: "uint128" },
      { name: "lastUpdate", type: "uint128" },
      { name: "fee", type: "uint128" },
    ],
  },
  {
    type: "function",
    name: "idToMarketParams",
    stateMutability: "view",
    inputs: [{ type: "bytes32" }],
    outputs: [
      { name: "loanToken", type: "address" },
      { name: "collateralToken", type: "address" },
      { name: "oracle", type: "address" },
      { name: "irm", type: "address" },
      { name: "lltv", type: "uint256" },
    ],
  },
] as const;

const fluidLendAbi = [{ type: "function", name: "getAllFTokens", stateMutability: "view", inputs: [], outputs: [{ type: "address[]" }] }] as const;

const siloFactoryAbi = [
  { type: "function", name: "getNextSiloId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "idToSiloConfig", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] },
] as const;

const siloConfigAbi = [
  { type: "function", name: "getSilos", stateMutability: "view", inputs: [], outputs: [{ type: "address" }, { type: "address" }] },
] as const;

export const LEND_CACHE = "lend8";

const FLUID_NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const ZERO = "0x0000000000000000000000000000000000000000";

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

function rateOk(row: { status: string; result?: unknown }): bigint | null {
  if (row.status !== "success") return null;
  try {
    return BigInt(row.result as bigint);
  } catch {
    return null;
  }
}

function cTokenApys(
  pack: Array<{ status: string; result?: unknown }>,
  chainId: number,
): { supplyApy: number | null; borrowApy: number | null } | null {
  const tsS = rateOk(pack[0]);
  const tsB = rateOk(pack[1]);
  if (tsS != null || tsB != null) {
    return { supplyApy: tsS != null ? perSecondApy(tsS) : null, borrowApy: tsB != null ? perSecondApy(tsB) : null };
  }
  const blkS = rateOk(pack[2]);
  const blkB = rateOk(pack[3]);
  if (blkS == null && blkB == null) return null;
  const by = blocksYear(chainId);
  return { supplyApy: blkS != null ? perBlockApy(blkS, by) : null, borrowApy: blkB != null ? perBlockApy(blkB, by) : null };
}

async function readComptroller(
  client: PublicClient,
  chainId: number,
  cfg: { comptroller: Address; nativeC?: Address; name: string },
): Promise<LendMarketRow[]> {
  const markets = await client.readContract({ address: cfg.comptroller, abi: comptrollerAbi, functionName: "getAllMarkets" });
  const list = markets.slice(0, 40);
  const short = chainShort(chainId);
  const rows = await mapLimit(list, 8, async (cTok) => {
    try {
      const pack = await client.multicall({
        contracts: [
          { address: cTok, abi: cTokenAbi, functionName: "supplyRatePerTimestamp" as const },
          { address: cTok, abi: cTokenAbi, functionName: "borrowRatePerTimestamp" as const },
          { address: cTok, abi: cTokenAbi, functionName: "supplyRatePerBlock" as const },
          { address: cTok, abi: cTokenAbi, functionName: "borrowRatePerBlock" as const },
          { address: cTok, abi: cTokenAbi, functionName: "getCash" as const },
          { address: cTok, abi: cTokenAbi, functionName: "totalBorrows" as const },
          { address: cTok, abi: cTokenAbi, functionName: "symbol" as const },
        ],
        allowFailure: true,
      });
      const apys = cTokenApys(pack, chainId);
      if (!apys) return null;
      if (pack[4].status !== "success" || pack[5].status !== "success") return null;
      const cash = pack[4].result as bigint;
      const borrows = pack[5].result as bigint;
      const symbol = pack[6].status === "success" ? String(pack[6].result) : "cTKN";
      const native = Boolean(cfg.nativeC && cTok.toLowerCase() === cfg.nativeC.toLowerCase());
      let underlying: Address | undefined;
      let decimals = 18;
      let display = String(symbol).replace(/^c/, "").replace(/^v/, "").replace(/^qi/i, "").replace(/^m/, "");
      if (!native) {
        underlying = await client.readContract({ address: cTok, abi: cTokenAbi, functionName: "underlying" }).catch(() => undefined);
        if (underlying) {
          decimals = Number(await client.readContract({ address: underlying, abi: erc20Abi, functionName: "decimals" }).catch(() => 18));
          display = String(await client.readContract({ address: underlying, abi: erc20Abi, functionName: "symbol" }).catch(() => display));
        }
      } else if (chainId === 43114) display = "AVAX";
      else if (chainId === 56) display = "BNB";
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
        supplyApy: apys.supplyApy,
        borrowApy: apys.borrowApy,
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

function fracApy(x: unknown): number | null {
  const n = Number(x);
  if (!Number.isFinite(n) || n < 0) return null;
  const pct = n * 100;
  if (pct > 100) return null;
  return pct;
}

async function fetchJson<T>(url: string, init?: RequestInit, ms = 12000): Promise<T | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: ac.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

type MorphoGql = {
  data?: {
    markets?: {
      items?: Array<{
        marketId?: string;
        loanAsset?: { address?: string; symbol?: string };
        state?: { supplyApy?: number; borrowApy?: number; supplyAssetsUsd?: number; borrowAssetsUsd?: number };
      }>;
    };
  };
};

async function readMorphoOnChain(client: PublicClient, chainId: number): Promise<LendMarketRow[]> {
  const ids = MORPHO_MARKETS[chainId];
  if (!ids?.length) return [];
  const short = chainShort(chainId);
  const rows = await mapLimit(ids, 4, async (id) => {
    try {
      const [mkt, params] = await Promise.all([
        client.readContract({ address: MORPHO, abi: morphoBlueAbi, functionName: "market", args: [id] }),
        client.readContract({ address: MORPHO, abi: morphoBlueAbi, functionName: "idToMarketParams", args: [id] }),
      ]);
      const totSup = BigInt(mkt[0]);
      const totBor = BigInt(mkt[2]);
      if (totSup === 0n) return null;
      if (totBor * 100n > totSup * 98n) return null;
      const loan = params[0] as Address;
      const meta = tokenMeta(chainId, loan, "TKN");
      const dec = meta.decimals;
      const supN = Number(formatUnits(totSup, dec));
      const borN = Number(formatUnits(totBor, dec));
      const price = await usd(client, chainId, loan, dec, false, meta.symbol);
      return {
        id: `Morpho:${chainId}:${id}`,
        chainId,
        chainShort: short,
        protocol: "Morpho",
        symbol: meta.symbol,
        icon: meta.icon,
        token: loan,
        market: id,
        supplyApy: null,
        borrowApy: null,
        supplyUsd: price != null && Number.isFinite(supN) ? supN * price : null,
        borrowUsd: price != null && Number.isFinite(borN) ? borN * price : null,
      } satisfies LendMarketRow;
    } catch {
      return null;
    }
  });
  return rows.filter((r) => r != null) as LendMarketRow[];
}

async function readMorphoMarkets(client: PublicClient, chainId: number): Promise<LendMarketRow[]> {
  const short = chainShort(chainId);
  const gql = await fetchJson<MorphoGql>("https://api.morpho.org/graphql", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: `{ markets(first: 40, orderBy: SupplyAssetsUsd, orderDirection: Desc, where: { chainId_in: [${chainId}], listed: true }) { items { marketId loanAsset { address symbol } state { supplyApy borrowApy supplyAssetsUsd borrowAssetsUsd } } } }`,
    }),
  });
  const items = gql?.data?.markets?.items ?? [];
  const out: LendMarketRow[] = [];
  for (const it of items) {
    const id = it.marketId;
    const loan = it.loanAsset?.address;
    if (!id || !loan) continue;
    const meta = tokenMeta(chainId, loan, it.loanAsset?.symbol || "TKN");
    const supUsd = Number(it.state?.supplyAssetsUsd);
    const borUsd = Number(it.state?.borrowAssetsUsd);
    out.push({
      id: `Morpho:${chainId}:${id}`,
      chainId,
      chainShort: short,
      protocol: "Morpho",
      symbol: meta.symbol,
      icon: meta.icon,
      token: loan,
      market: id,
      supplyApy: fracApy(it.state?.supplyApy),
      borrowApy: fracApy(it.state?.borrowApy),
      supplyUsd: Number.isFinite(supUsd) ? supUsd : null,
      borrowUsd: Number.isFinite(borUsd) ? borUsd : null,
    });
  }
  if (out.length) return out;
  return readMorphoOnChain(client, chainId);
}

async function readFluidMarkets(client: PublicClient, chainId: number): Promise<LendMarketRow[]> {
  if (!FLUID_CHAINS.has(chainId)) return [];
  const list = await client.readContract({ address: FLUID_LEND, abi: fluidLendAbi, functionName: "getAllFTokens" });
  const fts = list.slice(0, 24);
  const short = chainShort(chainId);
  const rows = await mapLimit(fts, 6, async (ft) => {
    try {
      const [asset, total] = await Promise.all([
        client.readContract({ address: ft, abi: vaultAbi, functionName: "asset" }),
        client.readContract({ address: ft, abi: vaultAbi, functionName: "totalAssets" }),
      ]);
      if (total === 0n) return null;
      const native = asset.toLowerCase() === FLUID_NATIVE.toLowerCase();
      const token = native ? "native" : asset;
      let decimals = 18;
      let display = native ? (chainId === 56 ? "BNB" : chainId === 137 ? "POL" : "ETH") : "TKN";
      if (!native) {
        decimals = Number(await client.readContract({ address: asset, abi: erc20Abi, functionName: "decimals" }).catch(() => 18));
        display = String(await client.readContract({ address: asset, abi: erc20Abi, functionName: "symbol" }).catch(() => display));
      }
      const n = Number(formatUnits(total, decimals));
      if (!Number.isFinite(n) || n <= 0) return null;
      const price = await usd(client, chainId, native ? undefined : asset, decimals, native, display);
      const meta = tokenMeta(chainId, token, display);
      return {
        id: `Fluid:${chainId}:${ft}`,
        chainId,
        chainShort: short,
        protocol: "Fluid",
        symbol: meta.symbol,
        icon: meta.icon,
        token,
        market: ft,
        supplyApy: null,
        borrowApy: null,
        supplyUsd: price != null ? n * price : null,
        borrowUsd: null,
      } satisfies LendMarketRow;
    } catch {
      return null;
    }
  });
  return rows.filter((r) => r != null) as LendMarketRow[];
}

async function readEulerMarkets(client: PublicClient, chainId: number): Promise<LendMarketRow[]> {
  const vaults = EULER_VAULTS[chainId];
  if (!vaults?.length) return [];
  const short = chainShort(chainId);
  const rows = await Promise.all(
    vaults.map(async (vault) => {
      try {
        const [asset, total, borrows] = await Promise.all([
          client.readContract({ address: vault, abi: vaultAbi, functionName: "asset" }),
          client.readContract({ address: vault, abi: vaultAbi, functionName: "totalAssets" }),
          client.readContract({ address: vault, abi: vaultAbi, functionName: "totalBorrows" }).catch(() => 0n),
        ]);
        if (total === 0n && borrows === 0n) return null;
        const meta0 = tokenMeta(chainId, asset, "TKN");
        const decimals = Number(await client.readContract({ address: asset, abi: erc20Abi, functionName: "decimals" }).catch(() => meta0.decimals));
        const display = String(await client.readContract({ address: asset, abi: erc20Abi, functionName: "symbol" }).catch(() => meta0.symbol));
        const supN = Number(formatUnits(total, decimals));
        const borN = Number(formatUnits(borrows, decimals));
        const price = await usd(client, chainId, asset, decimals, false, display);
        const meta = tokenMeta(chainId, asset, display);
        return {
          id: `Euler:${chainId}:${vault}`,
          chainId,
          chainShort: short,
          protocol: "Euler",
          symbol: meta.symbol,
          icon: meta.icon,
          token: asset,
          market: vault,
          supplyApy: null,
          borrowApy: null,
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

async function readSiloMarkets(client: PublicClient, chainId: number): Promise<LendMarketRow[]> {
  const factories = SILO_FACTORY[chainId];
  if (!factories?.length) return [];
  const short = chainShort(chainId);
  const silos: Address[] = [];
  const seen = new Set<string>();
  for (const factory of factories) {
    try {
      const next = await client.readContract({ address: factory, abi: siloFactoryAbi, functionName: "getNextSiloId" });
      const max = Math.min(Number(next), 21);
      const found = await mapLimit(Array.from({ length: Math.max(0, max - 1) }, (_, i) => i + 1), 6, async (i) => {
        try {
          const cfg = await client.readContract({ address: factory, abi: siloFactoryAbi, functionName: "idToSiloConfig", args: [BigInt(i)] });
          if (!cfg || cfg.toLowerCase() === ZERO) return [] as Address[];
          const pair = await client.readContract({ address: cfg, abi: siloConfigAbi, functionName: "getSilos" });
          return [pair[0], pair[1]].filter((s): s is Address => Boolean(s && s.toLowerCase() !== ZERO));
        } catch {
          return [] as Address[];
        }
      });
      for (const s of found.flat()) {
        const k = s.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        silos.push(s);
      }
    } catch {
      /* factory miss */
    }
  }
  const rows = await mapLimit(silos.slice(0, 24), 6, async (silo) => {
    try {
      const [asset, total] = await Promise.all([
        client.readContract({ address: silo, abi: vaultAbi, functionName: "asset" }),
        client.readContract({ address: silo, abi: vaultAbi, functionName: "totalAssets" }),
      ]);
      if (total === 0n) return null;
      const meta0 = tokenMeta(chainId, asset, "TKN");
      const decimals = Number(await client.readContract({ address: asset, abi: erc20Abi, functionName: "decimals" }).catch(() => meta0.decimals));
      const display = String(await client.readContract({ address: asset, abi: erc20Abi, functionName: "symbol" }).catch(() => meta0.symbol));
      const n = Number(formatUnits(total, decimals));
      if (!Number.isFinite(n) || n <= 0) return null;
      const price = await usd(client, chainId, asset, decimals, false, display);
      const meta = tokenMeta(chainId, asset, display);
      return {
        id: `Silo:${chainId}:${silo}`,
        chainId,
        chainShort: short,
        protocol: "Silo",
        symbol: meta.symbol,
        icon: meta.icon,
        token: asset,
        market: silo,
        supplyApy: null,
        borrowApy: null,
        supplyUsd: price != null ? n * price : null,
        borrowUsd: null,
      } satisfies LendMarketRow;
    } catch {
      return null;
    }
  });
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
  for (const id of Object.keys(MORPHO_MARKETS)) ids.add(Number(id));
  for (const id of FLUID_CHAINS) ids.add(id);
  for (const id of Object.keys(EULER_VAULTS)) ids.add(Number(id));
  for (const id of Object.keys(SILO_FACTORY)) ids.add(Number(id));
  for (const id of Object.keys(DOLOMITE_MARGIN)) ids.add(Number(id));
  for (const id of HTTP_LEND_CHAINS) ids.add(id);
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
  return cacheGet(
    { key: cacheKey(LEND_CACHE, chainId), policy: { ...POLICIES.markets, keep: (rows: LendMarketRow[]) => rows.length > 0 } },
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
      if (!client) {
        await loadHttpLendMarkets(chainId).then(add).catch(() => {});
        return acc;
      }
      const core: Array<Promise<void>> = [];
      const extra: Array<Promise<void>> = [];
      const aave = DEX[chainId]?.aave;
      if (aave) core.push(readAaveStyle(client, chainId, "Aave", { pool: aave.pool, data: aave.data }, add).then(() => {}).catch(() => {}));
      const spark = SPARK[chainId];
      if (spark) core.push(readAaveStyle(client, chainId, "Spark", spark, add).then(() => {}).catch(() => {}));
      for (const fork of AAVE_FORKS[chainId] ?? []) {
        core.push(readAaveStyle(client, chainId, fork.name, { pool: fork.pool, data: fork.data }, add).then(() => {}).catch(() => {}));
      }
      const v2 = COMPOUND_V2[chainId];
      if (v2) core.push(readComptroller(client, chainId, v2).then(add).catch(() => {}));
      for (const fork of COMPOUND_FORKS[chainId] ?? []) {
        core.push(readComptroller(client, chainId, fork).then(add).catch(() => {}));
      }
      core.push(readComets(client, chainId).then(add).catch(() => {}));
      extra.push(readMorphoMarkets(client, chainId).then(add).catch(() => {}));
      extra.push(loadHttpLendMarkets(chainId).then(add).catch(() => {}));
      await Promise.all(core);
      extra.push(readFluidMarkets(client, chainId).then(add).catch(() => {}));
      extra.push(readEulerMarkets(client, chainId).then(add).catch(() => {}));
      extra.push(readSiloMarkets(client, chainId).then(add).catch(() => {}));
      extra.push(readFraxlendMarkets(client, chainId).then(add).catch(() => {}));
      extra.push(readDolomiteMarkets(client, chainId).then(add).catch(() => {}));
      await Promise.all(extra);
      return acc;
    },
  );
}
