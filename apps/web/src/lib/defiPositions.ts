import { erc20Abi, formatUnits, type Address, type PublicClient } from "viem";
import { accountCache } from "./defi/cache.ts";
import { DEX, LST, type Addr } from "./defiAddresses.ts";
import { quoteEvmToken, type Quote } from "./defiQuotes.ts";

const poolAbi = [
  {
    type: "function",
    name: "getUserAccountData",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "totalCollateralBase", type: "uint256" },
      { name: "totalDebtBase", type: "uint256" },
      { name: "availableBorrowsBase", type: "uint256" },
      { name: "currentLiquidationThreshold", type: "uint256" },
      { name: "ltv", type: "uint256" },
      { name: "healthFactor", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "getReservesList",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }],
  },
  {
    type: "function",
    name: "getUserConfiguration",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "data", type: "uint256" }],
  },
] as const;

const dataAbi = [
  {
    type: "function",
    name: "getUserReserveData",
    stateMutability: "view",
    inputs: [
      { name: "asset", type: "address" },
      { name: "user", type: "address" },
    ],
    outputs: [
      { name: "currentATokenBalance", type: "uint256" },
      { name: "currentStableDebt", type: "uint256" },
      { name: "currentVariableDebt", type: "uint256" },
      { name: "principalStableDebt", type: "uint256" },
      { name: "scaledVariableDebt", type: "uint256" },
      { name: "stableBorrowRate", type: "uint256" },
      { name: "liquidityRate", type: "uint256" },
      { name: "stableRateLastUpdated", type: "uint40" },
      { name: "usageAsCollateralEnabled", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "getReserveTokensAddresses",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      { name: "aTokenAddress", type: "address" },
      { name: "stableDebtTokenAddress", type: "address" },
      { name: "variableDebtTokenAddress", type: "address" },
    ],
  },
] as const;

const npmAbi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "tokenOfOwnerByIndex", stateMutability: "view", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "positions",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [
      { name: "nonce", type: "uint96" },
      { name: "operator", type: "address" },
      { name: "token0", type: "address" },
      { name: "token1", type: "address" },
      { name: "fee", type: "uint24" },
      { name: "tickLower", type: "int24" },
      { name: "tickUpper", type: "int24" },
      { name: "liquidity", type: "uint128" },
      { name: "feeGrowthInside0LastX128", type: "uint256" },
      { name: "feeGrowthInside1LastX128", type: "uint256" },
      { name: "tokensOwed0", type: "uint128" },
      { name: "tokensOwed1", type: "uint128" },
    ],
  },
] as const;

const v3FactoryAbi = [
  {
    type: "function",
    name: "getPool",
    stateMutability: "view",
    inputs: [
      { type: "address" },
      { type: "address" },
      { type: "uint24" },
    ],
    outputs: [{ type: "address" }],
  },
] as const;

const v3PoolAbi = [
  {
    type: "function",
    name: "slot0",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint160" }, { type: "int24" }, { type: "uint16" }, { type: "uint16" }, { type: "uint16" }, { type: "uint8" }, { type: "bool" }],
  },
] as const;

export type ProtocolLine = {
  id: string;
  chainId: number;
  chain: string;
  symbol: string;
  name: string;
  icon: string;
  amount: string;
  raw: bigint;
  contract?: string;
  side?: "supply" | "borrow" | "lp" | "stake";
  extra?: string;
  quote?: Quote | null;
  valueUsdc?: number | null;
};

export type AaveCard = {
  chainId: number;
  chain: string;
  health: string;
  lines: ProtocolLine[];
  aTokens: Set<string>;
};

export type UniCard = {
  chainId: number;
  chain: string;
  protocol: string;
  lines: ProtocolLine[];
};

const Q96 = 2n ** 96n;

function tickToSqrtPriceX96(tick: number): bigint {
  const absTick = tick < 0 ? -tick : tick;
  let ratio = (absTick & 0x1) !== 0 ? 0xfffcb933bd6fad37aa2d162d1a594001n : 0x100000000000000000000000000000000n;
  if (absTick & 0x2) ratio = (ratio * 0xfff97272373d413259a46990580e213an) >> 128n;
  if (absTick & 0x4) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdccn) >> 128n;
  if (absTick & 0x8) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0n) >> 128n;
  if (absTick & 0x10) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644n) >> 128n;
  if (absTick & 0x20) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0n) >> 128n;
  if (absTick & 0x40) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861n) >> 128n;
  if (absTick & 0x80) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053n) >> 128n;
  if (absTick & 0x100) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4n) >> 128n;
  if (absTick & 0x200) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54n) >> 128n;
  if (absTick & 0x400) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3n) >> 128n;
  if (absTick & 0x800) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9n) >> 128n;
  if (absTick & 0x1000) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825n) >> 128n;
  if (absTick & 0x2000) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5n) >> 128n;
  if (absTick & 0x4000) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7n) >> 128n;
  if (absTick & 0x8000) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6n) >> 128n;
  if (absTick & 0x10000) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9n) >> 128n;
  if (absTick & 0x20000) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604n) >> 128n;
  if (absTick & 0x40000) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98n) >> 128n;
  if (absTick & 0x80000) ratio = (ratio * 0x48a170391f7dc42444e8fa2n) >> 128n;
  if (tick > 0) ratio = (2n ** 256n - 1n) / ratio;
  return (ratio >> 32n) + (ratio % (1n << 32n) === 0n ? 0n : 1n);
}

function mulDiv(a: bigint, b: bigint, den: bigint) {
  return den === 0n ? 0n : (a * b) / den;
}

function amountsForLiquidity(liquidity: bigint, sqrtP: bigint, tickLower: number, tickUpper: number) {
  const sqrtA = tickToSqrtPriceX96(tickLower);
  const sqrtB = tickToSqrtPriceX96(tickUpper);
  let amount0 = 0n;
  let amount1 = 0n;
  if (sqrtP <= sqrtA) {
    amount0 = mulDiv(liquidity << 96n, sqrtB - sqrtA, sqrtB) / sqrtA;
  } else if (sqrtP < sqrtB) {
    amount0 = mulDiv(liquidity << 96n, sqrtB - sqrtP, sqrtB) / sqrtP;
    amount1 = mulDiv(liquidity, sqrtP - sqrtA, Q96);
  } else {
    amount1 = mulDiv(liquidity, sqrtB - sqrtA, Q96);
  }
  return { amount0, amount1 };
}

function fmtAmt(raw: bigint, decimals: number) {
  const n = Number(formatUnits(raw, decimals));
  if (!Number.isFinite(n)) return formatUnits(raw, decimals);
  if (n === 0) return "0";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function usingReserve(data: bigint, index: number) {
  return ((data >> BigInt(index * 2)) & 3n) !== 0n;
}

async function meta(client: PublicClient, token: Address) {
  const [symbol, decimals] = await Promise.all([
    client.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }).catch(() => "TKN"),
    client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }).catch(() => 18),
  ]);
  return { symbol: String(symbol), decimals: Number(decimals) };
}

export async function readAaveMarket(
  client: PublicClient,
  chainId: number,
  user: Address,
  cfg: { pool: Address; data: Address },
  chain: string,
  idPrefix: string,
): Promise<AaveCard | null> {
  try {
    const [account, list, userCfg] = await Promise.all([
      client.readContract({ address: cfg.pool, abi: poolAbi, functionName: "getUserAccountData", args: [user] }),
      client.readContract({ address: cfg.pool, abi: poolAbi, functionName: "getReservesList" }),
      client.readContract({ address: cfg.pool, abi: poolAbi, functionName: "getUserConfiguration", args: [user] }),
    ]);
    const acc = account as unknown as {
      totalCollateralBase: bigint;
      totalDebtBase: bigint;
      healthFactor: bigint;
    } & readonly [bigint, bigint, bigint, bigint, bigint, bigint];
    const healthRaw = typeof acc.healthFactor === "bigint" ? acc.healthFactor : acc[5];
    const collateral = typeof acc.totalCollateralBase === "bigint" ? acc.totalCollateralBase : acc[0];
    const debtBase = typeof acc.totalDebtBase === "bigint" ? acc.totalDebtBase : acc[1];
    if (healthRaw === 0n && collateral === 0n && debtBase === 0n) return null;
    const cfgData = typeof userCfg === "bigint" ? userCfg : (userCfg as { data: bigint }).data;
    const used = list.map((asset, i) => ({ asset, i })).filter((x) => usingReserve(cfgData, x.i));
    if (!used.length) return null;
    const rows = await client.multicall({
      contracts: used.flatMap((u) => [
        { address: cfg.data, abi: dataAbi, functionName: "getUserReserveData" as const, args: [u.asset, user] },
        { address: cfg.data, abi: dataAbi, functionName: "getReserveTokensAddresses" as const, args: [u.asset] },
      ]),
      allowFailure: true,
    });
    const aTokens = new Set<string>();
    const lines: ProtocolLine[] = [];
    for (let i = 0; i < used.length; i++) {
      const r = rows[i * 2];
      const t = rows[i * 2 + 1];
      if (r.status !== "success") continue;
      const row = r.result as unknown;
      let aBal = 0n;
      let stable = 0n;
      let variable = 0n;
      if (Array.isArray(row)) {
        aBal = row[0] as bigint;
        stable = row[1] as bigint;
        variable = row[2] as bigint;
      } else {
        const o = row as { currentATokenBalance: bigint; currentStableDebt: bigint; currentVariableDebt: bigint };
        aBal = o.currentATokenBalance;
        stable = o.currentStableDebt;
        variable = o.currentVariableDebt;
      }
      if (t.status === "success") {
        const tok = t.result as unknown;
        const aTok = Array.isArray(tok) ? (tok[0] as Address) : (tok as { aTokenAddress: Address }).aTokenAddress;
        aTokens.add(aTok.toLowerCase());
      }
      const debt = stable + variable;
      if (aBal === 0n && debt === 0n) continue;
      const info = await meta(client, used[i].asset);
      const quote = await quoteEvmToken(client, chainId, used[i].asset, info.decimals).catch(() => null);
      if (aBal > 0n) {
        const n = Number(formatUnits(aBal, info.decimals));
        lines.push({
          id: `${idPrefix}-${chainId}-s-${used[i].asset}`,
          chainId,
          chain,
          symbol: info.symbol,
          name: info.symbol,
          icon: "/tokens/eth.png",
          amount: fmtAmt(aBal, info.decimals),
          raw: aBal,
          contract: used[i].asset,
          side: "supply",
          quote,
          valueUsdc: quote ? n * quote.usdc : null,
        });
      }
      if (debt > 0n) {
        const n = Number(formatUnits(debt, info.decimals));
        lines.push({
          id: `${idPrefix}-${chainId}-b-${used[i].asset}`,
          chainId,
          chain,
          symbol: info.symbol,
          name: info.symbol,
          icon: "/tokens/eth.png",
          amount: fmtAmt(debt, info.decimals),
          raw: debt,
          contract: used[i].asset,
          side: "borrow",
          quote,
          valueUsdc: quote ? -(n * quote.usdc) : null,
        });
      }
    }
    if (!lines.length) return null;
    const hf = Number(formatUnits(healthRaw, 18));
    const health = !Number.isFinite(hf) || hf > 1e10 ? "—" : hf.toFixed(2);
    return { chainId, chain, health, lines, aTokens };
  } catch {
    return null;
  }
}

export async function readAave(client: PublicClient, chainId: number, user: Address): Promise<AaveCard | null> {
  const d = DEX[chainId];
  if (!d?.aave) return null;
  return accountCache("pos.lend", chainId, user, "aave", () => readAaveMarket(client, chainId, user, d.aave!, d.short, "aave"));
}

async function readNpm(client: PublicClient, chainId: number, user: Address, npm: Addr, factory: Addr, protocol: string): Promise<UniCard | null> {
  const d = DEX[chainId];
  if (!d) return null;
  try {
    const n = await client.readContract({ address: npm, abi: npmAbi, functionName: "balanceOf", args: [user] });
    const count = Number(n);
    if (!count) return null;
    const ids = await client.multicall({
      contracts: Array.from({ length: Math.min(count, 40) }, (_, i) => ({
        address: npm,
        abi: npmAbi,
        functionName: "tokenOfOwnerByIndex" as const,
        args: [user, BigInt(i)],
      })),
      allowFailure: true,
    });
    const tokenIds = ids.filter((x) => x.status === "success").map((x) => x.result as bigint);
    if (!tokenIds.length) return null;
    const pos = await client.multicall({
      contracts: tokenIds.map((id) => ({ address: npm, abi: npmAbi, functionName: "positions" as const, args: [id] })),
      allowFailure: true,
    });
    const lines: ProtocolLine[] = [];
    for (let i = 0; i < tokenIds.length; i++) {
      const p = pos[i];
      if (p.status !== "success") continue;
      const posn = p.result as unknown as {
        token0: Address;
        token1: Address;
        fee: number;
        tickLower: number;
        tickUpper: number;
        liquidity: bigint;
        tokensOwed0: bigint;
        tokensOwed1: bigint;
      };
      const token0 = posn.token0;
      const token1 = posn.token1;
      const fee = posn.fee;
      const tickLower = posn.tickLower;
      const tickUpper = posn.tickUpper;
      const liquidity = posn.liquidity;
      const owed0 = posn.tokensOwed0;
      const owed1 = posn.tokensOwed1;
      if (liquidity === 0n && owed0 === 0n && owed1 === 0n) continue;
      const pool = await client.readContract({
        address: factory,
        abi: v3FactoryAbi,
        functionName: "getPool",
        args: [token0, token1, fee],
      });
      const slot = await client.readContract({ address: pool, abi: v3PoolAbi, functionName: "slot0" }).catch(() => null);
      if (!slot) continue;
      const sqrtP = slot[0];
      const tick = Number(slot[1]);
      const { amount0, amount1 } = amountsForLiquidity(liquidity, sqrtP, Number(tickLower), Number(tickUpper));
      const [m0, m1] = await Promise.all([meta(client, token0), meta(client, token1)]);
      const q0 = await quoteEvmToken(client, chainId, token0, m0.decimals).catch(() => null);
      const q1 = await quoteEvmToken(client, chainId, token1, m1.decimals).catch(() => null);
      const n0 = Number(formatUnits(amount0 + owed0, m0.decimals));
      const n1 = Number(formatUnits(amount1 + owed1, m1.decimals));
      const value = (q0 ? n0 * q0.usdc : 0) + (q1 ? n1 * q1.usdc : 0);
      const inRange = tick >= Number(tickLower) && tick < Number(tickUpper);
      lines.push({
        id: `uni-${chainId}-${protocol}-${tokenIds[i]}`,
        chainId,
        chain: d.short,
        symbol: `${m0.symbol}/${m1.symbol}`,
        name: `${m0.symbol} / ${m1.symbol}`,
        icon: "/tokens/eth.png",
        amount: `${fmtAmt(amount0 + owed0, m0.decimals)} + ${fmtAmt(amount1 + owed1, m1.decimals)}`,
        raw: liquidity,
        contract: pool,
        side: "lp",
        extra: `${Number(fee) / 10000}%`,
        quote: value ? { usdc: value / Math.max(n0 + n1, 1e-12), source: q0?.source ?? q1?.source ?? "v3" } : null,
        valueUsdc: q0 || q1 ? value : null,
      });
      lines[lines.length - 1].extra = `${Number(fee) / 10000}% · ${inRange ? "in" : "out"}`;
    }
    if (!lines.length) return null;
    return { chainId, chain: d.short, protocol, lines };
  } catch {
    return null;
  }
}

export async function readUniV3(client: PublicClient, chainId: number, user: Address): Promise<UniCard[]> {
  return accountCache("pos.lp", chainId, user, "npm", () => readUniV3Uncached(client, chainId, user));
}

async function readUniV3Uncached(client: PublicClient, chainId: number, user: Address): Promise<UniCard[]> {
  const d = DEX[chainId];
  if (!d?.v3Factory) return [];
  const out: UniCard[] = [];
  if (d.v3Npm) {
    const card = await readNpm(client, chainId, user, d.v3Npm, d.v3Factory, "Uniswap V3");
    if (card) out.push(card);
  }
  if (d.pancakeNpm) {
    const cakeFactory = "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865" as Addr;
    const card = await readNpm(client, chainId, user, d.pancakeNpm, cakeFactory, "Pancake V3");
    if (card) out.push(card);
  }
  return out;
}

export function stakingLines(
  chainId: number,
  rows: Array<{ id: string; symbol: string; name: string; icon: string; amount: string; raw: bigint; contract?: string; native?: boolean }>,
  quotes: Map<string, Quote>,
): ProtocolLine[] {
  const map = LST[chainId];
  if (!map) return [];
  const short = DEX[chainId]?.short ?? String(chainId);
  const lines: ProtocolLine[] = [];
  for (const r of rows) {
    if (!r.contract || r.raw === 0n) continue;
    const meta = map[r.contract.toLowerCase()];
    if (!meta) continue;
    const q = quotes.get(`${chainId}:${r.contract.toLowerCase()}`);
    const n = Number(r.amount.replace(/,/g, ""));
    lines.push({
      id: `lst-${r.id}`,
      chainId,
      chain: short,
      symbol: r.symbol,
      name: meta.name,
      icon: r.icon || meta.icon,
      amount: r.amount,
      raw: r.raw,
      contract: r.contract,
      side: "stake",
      quote: q ?? null,
      valueUsdc: q && Number.isFinite(n) ? n * q.usdc : null,
    });
  }
  return lines;
}
