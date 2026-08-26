import { erc20Abi, formatUnits, type Address, type PublicClient } from "viem";
import { DEX } from "./defiAddresses.ts";
import { quoteEvmToken, type Quote } from "./defiQuotes.ts";
import { readAaveMarket, type AaveCard, type ProtocolLine } from "./defiPositions.ts";

export type LendCard = AaveCard & { protocol: string };

const comptrollerAbi = [
  { type: "function", name: "getAssetsIn", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "address[]" }] },
  {
    type: "function",
    name: "getAccountLiquidity",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
  },
] as const;

const cTokenAbi = [
  {
    type: "function",
    name: "getAccountSnapshot",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
  },
  { type: "function", name: "underlying", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

const cometAbi = [
  { type: "function", name: "baseToken", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "borrowBalanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "numAssets", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  {
    type: "function",
    name: "getAssetInfo",
    stateMutability: "view",
    inputs: [{ type: "uint8" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "offset", type: "uint8" },
          { name: "asset", type: "address" },
          { name: "priceFeed", type: "address" },
          { name: "scale", type: "uint64" },
          { name: "borrowCollateralFactor", type: "uint64" },
          { name: "liquidateCollateralFactor", type: "uint64" },
          { name: "liquidationFactor", type: "uint64" },
          { name: "supplyCap", type: "uint128" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "userCollateral",
    stateMutability: "view",
    inputs: [
      { type: "address" },
      { type: "address" },
    ],
    outputs: [{ name: "balance", type: "uint128" }, { name: "reserved", type: "uint128" }],
  },
] as const;

const morphoAbi = [
  {
    type: "function",
    name: "position",
    stateMutability: "view",
    inputs: [{ type: "bytes32" }, { type: "address" }],
    outputs: [
      { name: "supplyShares", type: "uint256" },
      { name: "borrowShares", type: "uint128" },
      { name: "collateral", type: "uint128" },
    ],
  },
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

const eulerAbi = [
  { type: "function", name: "asset", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "convertToAssets", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "debtOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const MORPHO = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb" as Address;

const COMPOUND_V2: Record<number, { comptroller: Address; nativeC?: Address; name: string }> = {
  1: { comptroller: "0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B", nativeC: "0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5", name: "Compound" },
};

const COMPOUND_FORKS: Record<number, Array<{ comptroller: Address; nativeC?: Address; name: string }>> = {
  56: [{ comptroller: "0xfD36E2c2a6789Db23113685031d7F163148ECA35", nativeC: "0xA07c5b74C9B40447a954e1466938b865b6BBea36", name: "Venus" }],
  8453: [{ comptroller: "0xfBb21d0380beE3312B33c4353c8936a0F13EF26C", name: "Moonwell" }],
  10: [{ comptroller: "0xCa889f40aae37FFf165BccF69aeF1E82b5C511B9", name: "Moonwell" }],
};

const COMETS: Record<number, Address[]> = {
  1: [
    "0xc3d688B66703497DAA19211EEdff47f25384cdc3",
    "0xA17581A9E3356d9A858b789D68B4d866e593aE94",
    "0x3Afdc9BCA9213A35503b077a6072F3D0d5AB0840",
    "0x5D409e56D886231aDAf00c8775665AD0f9897b56",
  ],
  8453: [
    "0xb125E6687d4313864e53df431d5425969c15Eb2F",
    "0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf",
    "0x46e6b214b524310239732D51387075E0e70970bf",
    "0x2c776041CCFe903071AF44aa147368a9c8EEA518",
  ],
  42161: [
    "0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf",
    "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA",
    "0xd98Be00b5D27fc98112BdE293e487f8D4cA57d07",
    "0x6f7D514bbD4aFf3BcD1140B7344b32f063dEe486",
  ],
  10: ["0x2e44e174f7D53F0212823acC11C01A11d58c5bCB", "0xE36A30D249f7761327fd973001A32010b521b6Fd"],
  137: ["0xF25212E676D1F7F89Cd72fFEe66158f541246445", "0xaeB318360f27748Acb200CE616E389A6C9409a07"],
};

const SPARK: Record<number, { pool: Address; data: Address }> = {
  1: { pool: "0xC13e21B648A5Ee794902342038FF3aDAB66BE987", data: "0xFc21d6d146E6086B8359705C8b28512a983db0cb" },
};

const MORPHO_MARKETS: Record<number, `0x${string}`[]> = {
  1: [
    "0x3a85e619751152991742810df6ec69ce473daef99e28a64ab2340d7b7ccfee49",
    "0x64d65c9a2d91c36d56fbc42d69e979335320169b3df63bf92789e2c8883fcc64",
    "0xe7e9694b754c4d4f7e21faf7223f6fa71abaeb10296a4c43a54a7977149687d2",
    "0x8eaf7b29f02ba8d8c1d7aeb587403dcb16e2e943e4e2f5f94b0963c2386406c9",
    "0x0f9563442d64ab3bd3bcb27058db0b0d4046a4c46f0acd811dacae9551d2b129",
  ],
  8453: [
    "0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836",
    "0x54cf9be57fdfa6457a660991907434ff9d295c465a603a50126ff647d50b7354",
  ],
  42161: [
    "0xfdb8221edcae73f73485d55c30e706906114bc2ff4634870c5c57e8fb83eae6a",
    "0x9e90aec7d768403dacc9dd0d8320307fda3f980eed4df43e3e52168a1c667709",
  ],
};

const EULER_VAULTS: Record<number, Address[]> = {
  1: [
    "0x9bD52F2805c6aF014132874124686e7b248c2Cbb",
    "0x7c280DBDEf569e96c7919251bD2B0edF0734C5A8",
    "0xD8b27CF359b7D15710a5BE299AF6e7Bf904984C2",
    "0x998D761eC1BAdaCeb064624cc3A1d37A46C88bA4",
    "0xbC4B4AC47582c3E38Ce5940B80Da65401F4628f1",
  ],
};

function fmtAmt(raw: bigint, decimals: number) {
  const n = Number(formatUnits(raw, decimals));
  if (!Number.isFinite(n)) return formatUnits(raw, decimals);
  if (n === 0) return "0";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function chainShort(chainId: number) {
  return DEX[chainId]?.short ?? String(chainId);
}

function qOf(quotes: Map<string, Quote>, chainId: number, token: string, native?: boolean): Quote | null {
  return quotes.get(`${chainId}:${native ? "native" : token.toLowerCase()}`) ?? null;
}

async function tokenMeta(client: PublicClient, token: Address) {
  const [symbol, decimals] = await Promise.all([
    client.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }).catch(() => "TKN"),
    client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }).catch(() => 18),
  ]);
  return { symbol: String(symbol), decimals: Number(decimals) };
}

async function lineQuote(client: PublicClient, quotes: Map<string, Quote>, chainId: number, token: Address, decimals: number, native?: boolean) {
  const hit = qOf(quotes, chainId, token, native);
  if (hit) return hit;
  return quoteEvmToken(client, chainId, native ? undefined : token, decimals, native).catch(() => null);
}

function pushLine(
  lines: ProtocolLine[],
  chainId: number,
  protocol: string,
  symbol: string,
  raw: bigint,
  decimals: number,
  side: "supply" | "borrow",
  contract: string,
  quote: Quote | null,
) {
  if (raw === 0n) return;
  const n = Number(formatUnits(raw, decimals));
  const value = quote && Number.isFinite(n) ? n * quote.usdc : null;
  lines.push({
    id: `${protocol}-${chainId}-${side}-${contract}`,
    chainId,
    chain: chainShort(chainId),
    symbol,
    name: symbol,
    icon: "/tokens/eth.png",
    amount: fmtAmt(raw, decimals),
    raw,
    contract,
    side,
    quote,
    valueUsdc: side === "borrow" && value != null ? -value : value,
  });
}

async function readComptroller(
  client: PublicClient,
  chainId: number,
  user: Address,
  quotes: Map<string, Quote>,
  cfg: { comptroller: Address; nativeC?: Address; name: string },
): Promise<LendCard | null> {
  try {
    const markets = await client.readContract({
      address: cfg.comptroller,
      abi: comptrollerAbi,
      functionName: "getAssetsIn",
      args: [user],
    });
    if (!markets.length) return null;
    const lines: ProtocolLine[] = [];
    const tokens = new Set<string>();
    await Promise.all(
      markets.map(async (cToken) => {
        try {
          tokens.add(cToken.toLowerCase());
          const snap = await client.readContract({ address: cToken, abi: cTokenAbi, functionName: "getAccountSnapshot", args: [user] });
          const cBal = snap[1];
          const borrow = snap[2];
          const rate = snap[3];
          const und = cBal === 0n ? 0n : (cBal * rate) / 10n ** 18n;
          const native = cfg.nativeC && cToken.toLowerCase() === cfg.nativeC.toLowerCase();
          let underlying: Address | undefined;
          let symbol = native ? (chainId === 56 ? "BNB" : "ETH") : "TKN";
          let decimals = native ? 18 : 18;
          if (!native) {
            underlying = await client.readContract({ address: cToken, abi: cTokenAbi, functionName: "underlying" }).catch(() => undefined);
            if (underlying) {
              const m = await tokenMeta(client, underlying);
              symbol = m.symbol;
              decimals = m.decimals;
            }
          }
          const quote = await lineQuote(client, quotes, chainId, (underlying ?? cToken) as Address, decimals, native);
          pushLine(lines, chainId, cfg.name.toLowerCase(), symbol, und, decimals, "supply", underlying ?? cToken, quote);
          pushLine(lines, chainId, cfg.name.toLowerCase(), symbol, borrow, decimals, "borrow", underlying ?? cToken, quote);
        } catch {
          /* market miss */
        }
      }),
    );
    if (!lines.length) return null;
    let health = "—";
    try {
      const liq = await client.readContract({ address: cfg.comptroller, abi: comptrollerAbi, functionName: "getAccountLiquidity", args: [user] });
      const shortfall = liq[2];
      const liquidity = liq[1];
      if (shortfall > 0n) health = "0";
      else if (liquidity > 0n) health = "—";
    } catch {
      /* no liquidity view */
    }
    return { chainId, chain: chainShort(chainId), health, lines, aTokens: tokens, protocol: cfg.name };
  } catch {
    return null;
  }
}

async function readComets(client: PublicClient, chainId: number, user: Address, quotes: Map<string, Quote>): Promise<LendCard | null> {
  const list = COMETS[chainId];
  if (!list?.length) return null;
  const lines: ProtocolLine[] = [];
  const tokens = new Set<string>();
  await Promise.all(
    list.map(async (comet) => {
      try {
        const [base, supply, borrow, nAssets] = await Promise.all([
          client.readContract({ address: comet, abi: cometAbi, functionName: "baseToken" }),
          client.readContract({ address: comet, abi: cometAbi, functionName: "balanceOf", args: [user] }),
          client.readContract({ address: comet, abi: cometAbi, functionName: "borrowBalanceOf", args: [user] }),
          client.readContract({ address: comet, abi: cometAbi, functionName: "numAssets" }),
        ]);
        tokens.add(comet.toLowerCase());
        const baseMeta = await tokenMeta(client, base);
        const quote = await lineQuote(client, quotes, chainId, base, baseMeta.decimals);
        pushLine(lines, chainId, "compound", baseMeta.symbol, supply, baseMeta.decimals, "supply", base, quote);
        pushLine(lines, chainId, "compound", baseMeta.symbol, borrow, baseMeta.decimals, "borrow", base, quote);
        const count = Math.min(Number(nAssets), 12);
        for (let i = 0; i < count; i++) {
          try {
            const info = await client.readContract({ address: comet, abi: cometAbi, functionName: "getAssetInfo", args: [i] });
            const asset = info.asset;
            const col = await client.readContract({ address: comet, abi: cometAbi, functionName: "userCollateral", args: [user, asset] });
            const raw = BigInt(col[0]);
            if (raw === 0n) continue;
            const m = await tokenMeta(client, asset);
            const q = await lineQuote(client, quotes, chainId, asset, m.decimals);
            pushLine(lines, chainId, "compound", m.symbol, raw, m.decimals, "supply", asset, q);
          } catch {
            /* collateral miss */
          }
        }
      } catch {
        /* comet miss */
      }
    }),
  );
  if (!lines.length) return null;
  return { chainId, chain: chainShort(chainId), health: "—", lines, aTokens: tokens, protocol: "Compound" };
}

async function readMorpho(client: PublicClient, chainId: number, user: Address, quotes: Map<string, Quote>): Promise<LendCard | null> {
  const ids = MORPHO_MARKETS[chainId];
  if (!ids?.length) return null;
  const lines: ProtocolLine[] = [];
  const tokens = new Set<string>();
  await Promise.all(
    ids.map(async (id) => {
      try {
        const [pos, mkt, params] = await Promise.all([
          client.readContract({ address: MORPHO, abi: morphoAbi, functionName: "position", args: [id, user] }),
          client.readContract({ address: MORPHO, abi: morphoAbi, functionName: "market", args: [id] }),
          client.readContract({ address: MORPHO, abi: morphoAbi, functionName: "idToMarketParams", args: [id] }),
        ]);
        const supplyShares = pos[0];
        const borrowShares = BigInt(pos[1]);
        const collateral = BigInt(pos[2]);
        if (supplyShares === 0n && borrowShares === 0n && collateral === 0n) return;
        const totSupA = BigInt(mkt[0]);
        const totSupS = BigInt(mkt[1]);
        const totBorA = BigInt(mkt[2]);
        const totBorS = BigInt(mkt[3]);
        const supplyAssets = totSupS === 0n ? 0n : (supplyShares * totSupA) / totSupS;
        const borrowAssets = totBorS === 0n ? 0n : (borrowShares * totBorA) / totBorS;
        const loanToken = params[0] as Address;
        const colToken = params[1] as Address;
        const loan = await tokenMeta(client, loanToken);
        const col = await tokenMeta(client, colToken);
        const loanQ = await lineQuote(client, quotes, chainId, loanToken, loan.decimals);
        const colQ = await lineQuote(client, quotes, chainId, colToken, col.decimals);
        tokens.add(loanToken.toLowerCase());
        tokens.add(colToken.toLowerCase());
        pushLine(lines, chainId, "morpho", loan.symbol, supplyAssets, loan.decimals, "supply", loanToken, loanQ);
        pushLine(lines, chainId, "morpho", loan.symbol, borrowAssets, loan.decimals, "borrow", loanToken, loanQ);
        pushLine(lines, chainId, "morpho", col.symbol, collateral, col.decimals, "supply", colToken, colQ);
      } catch {
        /* market miss */
      }
    }),
  );
  if (!lines.length) return null;
  return { chainId, chain: chainShort(chainId), health: "—", lines, aTokens: tokens, protocol: "Morpho" };
}

async function readEuler(client: PublicClient, chainId: number, user: Address, quotes: Map<string, Quote>): Promise<LendCard | null> {
  const vaults = EULER_VAULTS[chainId];
  if (!vaults?.length) return null;
  const lines: ProtocolLine[] = [];
  const tokens = new Set<string>();
  await Promise.all(
    vaults.map(async (vault) => {
      try {
        const [asset, shares, debt] = await Promise.all([
          client.readContract({ address: vault, abi: eulerAbi, functionName: "asset" }),
          client.readContract({ address: vault, abi: eulerAbi, functionName: "balanceOf", args: [user] }),
          client.readContract({ address: vault, abi: eulerAbi, functionName: "debtOf", args: [user] }).catch(() => 0n),
        ]);
        const assets = shares === 0n ? 0n : await client.readContract({ address: vault, abi: eulerAbi, functionName: "convertToAssets", args: [shares] });
        if (assets === 0n && debt === 0n) return;
        tokens.add(vault.toLowerCase());
        const m = await tokenMeta(client, asset);
        const q = await lineQuote(client, quotes, chainId, asset, m.decimals);
        pushLine(lines, chainId, "euler", m.symbol, assets, m.decimals, "supply", asset, q);
        pushLine(lines, chainId, "euler", m.symbol, debt, m.decimals, "borrow", asset, q);
      } catch {
        /* vault miss */
      }
    }),
  );
  if (!lines.length) return null;
  return { chainId, chain: chainShort(chainId), health: "—", lines, aTokens: tokens, protocol: "Euler" };
}

export async function readExtraLending(
  client: PublicClient,
  chainId: number,
  user: Address,
  quotes: Map<string, Quote>,
): Promise<LendCard[]> {
  const jobs: Array<Promise<LendCard | null>> = [];
  const v2 = COMPOUND_V2[chainId];
  if (v2) jobs.push(readComptroller(client, chainId, user, quotes, v2));
  for (const fork of COMPOUND_FORKS[chainId] ?? []) jobs.push(readComptroller(client, chainId, user, quotes, fork));
  jobs.push(readComets(client, chainId, user, quotes));
  const spark = SPARK[chainId];
  if (spark) {
    jobs.push(
      readAaveMarket(client, chainId, user, spark, chainShort(chainId), "spark").then((c) => (c ? { ...c, protocol: "Spark" } : null)),
    );
  }
  jobs.push(readMorpho(client, chainId, user, quotes));
  jobs.push(readEuler(client, chainId, user, quotes));
  const rows = await Promise.all(jobs);
  return rows.filter((c): c is LendCard => Boolean(c));
}
