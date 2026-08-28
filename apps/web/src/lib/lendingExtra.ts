import { decodeAbiParameters, encodeFunctionData, erc20Abi, formatUnits, type Address, type PublicClient } from "viem";
import { accountCache } from "./defi/cache.ts";
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

export const COMPOUND_V2: Record<number, { comptroller: Address; nativeC?: Address; name: string }> = {
  1: { comptroller: "0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B", nativeC: "0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5", name: "Compound" },
};

export const COMPOUND_FORKS: Record<number, Array<{ comptroller: Address; nativeC?: Address; name: string }>> = {
  56: [{ comptroller: "0xfD36E2c2a6789Db23113685031d7F163148ECA35", nativeC: "0xA07c5b74C9B40447a954e1466938b865b6BBea36", name: "Venus" }],
  8453: [{ comptroller: "0xfBb21d0380beE3312B33c4353c8936a0F13EF26C", name: "Moonwell" }],
  10: [{ comptroller: "0xCa889f40aae37FFf165BccF69aeF1E82b5C511B9", name: "Moonwell" }],
};

export const COMETS: Record<number, Address[]> = {
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

export const SPARK: Record<number, { pool: Address; data: Address }> = {
  1: { pool: "0xC13e21B648A5Ee794902342038FF3aDAB66BE987", data: "0xFc21d6d146E6086B8359705C8b28512a983db0cb" },
};

export const AAVE_FORKS: Record<number, Array<{ pool: Address; data: Address; name: string; slug: string }>> = {
  999: [
    {
      pool: "0x00A89d7a5A02160f20150EbEA7a2b5E4879A1A8b",
      data: "0x4f4d4cA1e0a8A21FE0B460613bEbe917f2eb4326",
      name: "HyperLend",
      slug: "hyperlend",
    },
  ],
  324: [
    {
      pool: "0x4d9429246EA989C9CeE203B43F6d1C7D83e3B8F8",
      data: "0xB73550bC1393207960A385fC8b34790e5133175E",
      name: "ZeroLend",
      slug: "zerolend",
    },
  ],
  59144: [
    {
      pool: "0x2f9bB73a8e98793e26Cb2F6C4ad037BDf1C6B269",
      data: "0x67f93E36792c49a4493652B91ad4bD59f428AD15",
      name: "ZeroLend",
      slug: "zerolend",
    },
  ],
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

const erc4626Abi = [
  { type: "function", name: "asset", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "convertToAssets", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint256" }] },
] as const;

const siloConvertAbi = [
  {
    type: "function",
    name: "convertToAssets",
    stateMutability: "view",
    inputs: [
      { type: "uint256" },
      { type: "uint8" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

const siloFactoryAbi = [
  { type: "function", name: "getNextSiloId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "idToSiloConfig", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] },
] as const;

const siloConfigAbi = [
  {
    type: "function",
    name: "getSilos",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }, { type: "address" }],
  },
  {
    type: "function",
    name: "getShareTokens",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "address" }, { type: "address" }, { type: "address" }],
  },
] as const;

const fraxRegAbi = [
  { type: "function", name: "getAllPairAddresses", stateMutability: "view", inputs: [], outputs: [{ type: "address[]" }] },
] as const;

const fraxPairAbi = [
  {
    type: "function",
    name: "getUserSnapshot",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
  },
  { type: "function", name: "toAssetAmount", stateMutability: "view", inputs: [{ type: "uint256" }, { type: "bool" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "toBorrowAmount", stateMutability: "view", inputs: [{ type: "uint256" }, { type: "bool" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "asset", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "collateralContract", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

const fluidLendAbi = [
  { type: "function", name: "getAllFTokens", stateMutability: "view", inputs: [], outputs: [{ type: "address[]" }] },
] as const;

const fluidVaultAbi = [
  { type: "function", name: "positionsNftIdOfUser", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256[]" }] },
  { type: "function", name: "vaultByNftId", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] },
  { type: "function", name: "positionByNftId", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [] },
] as const;

const fluidConstAbi = [
  {
    type: "function",
    name: "constantsView",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "liquidity", type: "address" },
          { name: "factory", type: "address" },
          { name: "operateImplementation", type: "address" },
          { name: "adminImplementation", type: "address" },
          { name: "secondaryImplementation", type: "address" },
          { name: "deployer", type: "address" },
          { name: "supply", type: "address" },
          { name: "borrow", type: "address" },
          {
            name: "supplyToken",
            type: "tuple",
            components: [
              { name: "token0", type: "address" },
              { name: "token1", type: "address" },
            ],
          },
          {
            name: "borrowToken",
            type: "tuple",
            components: [
              { name: "token0", type: "address" },
              { name: "token1", type: "address" },
            ],
          },
          { name: "vaultId", type: "uint256" },
          { name: "vaultType", type: "uint256" },
          { name: "supplyExchangePriceSlot", type: "bytes32" },
          { name: "borrowExchangePriceSlot", type: "bytes32" },
          { name: "userSupplySlot", type: "bytes32" },
          { name: "userBorrowSlot", type: "bytes32" },
        ],
      },
    ],
  },
] as const;

const USER_POS = [
  {
    type: "tuple",
    components: [
      { name: "nftId", type: "uint256" },
      { name: "owner", type: "address" },
      { name: "isLiquidated", type: "bool" },
      { name: "isSupplyPosition", type: "bool" },
      { name: "tick", type: "int256" },
      { name: "tickId", type: "uint256" },
      { name: "beforeSupply", type: "uint256" },
      { name: "beforeBorrow", type: "uint256" },
      { name: "beforeDustBorrow", type: "uint256" },
      { name: "supply", type: "uint256" },
      { name: "borrow", type: "uint256" },
      { name: "dustBorrow", type: "uint256" },
    ],
  },
] as const;

const FLUID_NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const FLUID_LEND = "0x48D32f49aFeAEC7AE66ad7B9264f446fc11a1569" as Address;
const FLUID_VAULT = "0xA5C3E16523eeeDDcC34706b0E6bE88b4c6EA95cC" as Address;
const FLUID_CHAINS = new Set([1, 8453, 42161, 137, 56]);

const SILO_FACTORY: Record<number, Address[]> = {
  1: ["0x22a3cF6149bFa611bAFc89Fd721918EC3Cf7b581"],
  42161: ["0x384DC7759d35313F0b567D42bf2f611B285B657C"],
  146: ["0xa42001d6d2237d2c74108fe360403c4b796b7170", "0x4e9dE3a64c911A37f7EB2fCb06D1e68c3cBe9203"],
  43114: ["0x92cECB67Ed267FF98026F814D813fDF3054C6Ff9"],
};

const FRAX_REG: Record<number, Address[]> = {
  1: [
    "0xD6E9D27C75Afd88ad24Cd5EdccdC76fd2fc3A751",
    "0x5d6e79Bcf90140585CE88c7119b7E43CAaA67044",
    "0x7769ee42787edbd1c189e07a279e11e2196e84ec",
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

function isNativeAsset(token: string) {
  return token.toLowerCase() === FLUID_NATIVE.toLowerCase();
}

function isZero(token: string) {
  return token.toLowerCase() === ZERO_ADDR;
}

async function quoteAsset(
  client: PublicClient,
  quotes: Map<string, Quote>,
  chainId: number,
  token: Address,
) {
  const native = isNativeAsset(token);
  if (native) {
    const quote = await lineQuote(client, quotes, chainId, (DEX[chainId]?.wrapped as Address) ?? token, 18, true);
    const symbol = chainId === 137 ? "POL" : chainId === 56 ? "BNB" : "ETH";
    return { symbol, decimals: 18, quote, native: true as const };
  }
  const m = await tokenMeta(client, token);
  const quote = await lineQuote(client, quotes, chainId, token, m.decimals);
  return { symbol: m.symbol, decimals: m.decimals, quote, native: false as const };
}

async function readFluid(client: PublicClient, chainId: number, user: Address, quotes: Map<string, Quote>): Promise<LendCard | null> {
  if (!FLUID_CHAINS.has(chainId)) return null;
  const lines: ProtocolLine[] = [];
  const tokens = new Set<string>();
  try {
    const fTokens = await client.readContract({ address: FLUID_LEND, abi: fluidLendAbi, functionName: "getAllFTokens" });
    const list = fTokens.slice(0, 40);
    const bals = await client.multicall({
      contracts: list.map((ft) => ({ address: ft, abi: erc4626Abi, functionName: "balanceOf" as const, args: [user] })),
      allowFailure: true,
    });
    await Promise.all(
      list.map(async (ft, i) => {
        const row = bals[i];
        if (row.status !== "success" || row.result === 0n) return;
        try {
          const [asset, assets] = await Promise.all([
            client.readContract({ address: ft, abi: erc4626Abi, functionName: "asset" }),
            client.readContract({ address: ft, abi: erc4626Abi, functionName: "convertToAssets", args: [row.result] }),
          ]);
          if (assets === 0n) return;
          const q = await quoteAsset(client, quotes, chainId, asset);
          tokens.add(ft.toLowerCase());
          pushLine(lines, chainId, "fluid", q.symbol, assets, q.decimals, "supply", q.native ? "native" : asset, q.quote);
        } catch {
          /* fToken miss */
        }
      }),
    );
  } catch {
    /* resolver miss */
  }
  try {
    const nfts = await client.readContract({
      address: FLUID_VAULT,
      abi: fluidVaultAbi,
      functionName: "positionsNftIdOfUser",
      args: [user],
    });
    await Promise.all(
      nfts.slice(0, 20).map(async (nftId) => {
        try {
          const vault = await client.readContract({
            address: FLUID_VAULT,
            abi: fluidVaultAbi,
            functionName: "vaultByNftId",
            args: [nftId],
          });
          if (!vault || isZero(vault)) return;
          const c = await client.readContract({ address: vault, abi: fluidConstAbi, functionName: "constantsView" });
          if (!isZero(c.supplyToken.token1) || !isZero(c.borrowToken.token1)) return;
          const data = encodeFunctionData({ abi: fluidVaultAbi, functionName: "positionByNftId", args: [nftId] });
          const raw = await client.call({ to: FLUID_VAULT, data });
          if (!raw.data) return;
          const [pos] = decodeAbiParameters(USER_POS, raw.data);
          const supply = pos.supply;
          const borrow = pos.borrow;
          if (supply === 0n && borrow === 0n) return;
          tokens.add(vault.toLowerCase());
          if (supply > 0n) {
            const q = await quoteAsset(client, quotes, chainId, c.supplyToken.token0);
            pushLine(lines, chainId, "fluid", q.symbol, supply, q.decimals, "supply", q.native ? "native" : c.supplyToken.token0, q.quote);
          }
          if (borrow > 0n) {
            const q = await quoteAsset(client, quotes, chainId, c.borrowToken.token0);
            pushLine(lines, chainId, "fluid", q.symbol, borrow, q.decimals, "borrow", q.native ? "native" : c.borrowToken.token0, q.quote);
          }
        } catch {
          /* nft miss */
        }
      }),
    );
  } catch {
    /* vault resolver miss */
  }
  if (!lines.length) return null;
  return { chainId, chain: chainShort(chainId), health: "—", lines, aTokens: tokens, protocol: "Fluid" };
}

async function siloMarkets(client: PublicClient, factory: Address): Promise<Array<{ silo: Address; config: Address }>> {
  const next = await client.readContract({ address: factory, abi: siloFactoryAbi, functionName: "getNextSiloId" });
  const max = Math.min(Number(next), 49);
  if (max <= 1) return [];
  const out: Array<{ silo: Address; config: Address }> = [];
  const ids = Array.from({ length: max - 1 }, (_, i) => BigInt(i + 1));
  await Promise.all(
    ids.map(async (id) => {
      try {
        const cfg = await client.readContract({ address: factory, abi: siloFactoryAbi, functionName: "idToSiloConfig", args: [id] });
        if (!cfg || isZero(cfg)) return;
        const pair = await client.readContract({ address: cfg, abi: siloConfigAbi, functionName: "getSilos" });
        if (pair[0] && !isZero(pair[0])) out.push({ silo: pair[0], config: cfg });
        if (pair[1] && !isZero(pair[1])) out.push({ silo: pair[1], config: cfg });
      } catch {
        /* id gap */
      }
    }),
  );
  return out;
}

async function readSilo(client: PublicClient, chainId: number, user: Address, quotes: Map<string, Quote>): Promise<LendCard | null> {
  const factories = SILO_FACTORY[chainId];
  if (!factories?.length) return null;
  const lines: ProtocolLine[] = [];
  const tokens = new Set<string>();
  const seen = new Set<string>();
  const markets: Array<{ silo: Address; config: Address }> = [];
  for (const factory of factories) {
    try {
      for (const m of await siloMarkets(client, factory)) {
        const k = m.silo.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        markets.push(m);
      }
    } catch {
      /* factory miss */
    }
  }
  await Promise.all(
    markets.map(async ({ silo, config }) => {
      try {
        const [asset, shares, shareTok] = await Promise.all([
          client.readContract({ address: silo, abi: erc4626Abi, functionName: "asset" }),
          client.readContract({ address: silo, abi: erc4626Abi, functionName: "balanceOf", args: [user] }),
          client.readContract({ address: config, abi: siloConfigAbi, functionName: "getShareTokens", args: [silo] }),
        ]);
        const [pBal, dBal] = await Promise.all([
          client.readContract({ address: shareTok[0], abi: erc20Abi, functionName: "balanceOf", args: [user] }).catch(() => 0n),
          client.readContract({ address: shareTok[2], abi: erc20Abi, functionName: "balanceOf", args: [user] }).catch(() => 0n),
        ]);
        const coll = shares === 0n ? 0n : await client.readContract({ address: silo, abi: erc4626Abi, functionName: "convertToAssets", args: [shares] });
        const protectedRaw =
          pBal === 0n ? 0n : await client.readContract({ address: silo, abi: siloConvertAbi, functionName: "convertToAssets", args: [pBal, 0] }).catch(() => 0n);
        const debtRaw =
          dBal === 0n ? 0n : await client.readContract({ address: silo, abi: siloConvertAbi, functionName: "convertToAssets", args: [dBal, 2] }).catch(() => 0n);
        if (coll === 0n && protectedRaw === 0n && debtRaw === 0n) return;
        tokens.add(silo.toLowerCase());
        const m = await tokenMeta(client, asset);
        const q = await lineQuote(client, quotes, chainId, asset, m.decimals);
        pushLine(lines, chainId, "silo", m.symbol, coll, m.decimals, "supply", asset, q);
        pushLine(lines, chainId, "silo", m.symbol, protectedRaw, m.decimals, "supply", asset, q);
        pushLine(lines, chainId, "silo", m.symbol, debtRaw, m.decimals, "borrow", asset, q);
      } catch {
        /* silo miss */
      }
    }),
  );
  if (!lines.length) return null;
  return { chainId, chain: chainShort(chainId), health: "—", lines, aTokens: tokens, protocol: "Silo" };
}

async function readFraxlend(client: PublicClient, chainId: number, user: Address, quotes: Map<string, Quote>): Promise<LendCard | null> {
  const regs = FRAX_REG[chainId];
  if (!regs?.length) return null;
  const pairs: Address[] = [];
  const seen = new Set<string>();
  for (const reg of regs) {
    try {
      const all = await client.readContract({ address: reg, abi: fraxRegAbi, functionName: "getAllPairAddresses" });
      for (const p of all.slice(0, 40)) {
        const k = p.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        pairs.push(p);
      }
    } catch {
      /* registry miss */
    }
  }
  if (!pairs.length) return null;
  const lines: ProtocolLine[] = [];
  const tokens = new Set<string>();
  await Promise.all(
    pairs.map(async (pair) => {
      try {
        const snap = await client.readContract({ address: pair, abi: fraxPairAbi, functionName: "getUserSnapshot", args: [user] });
        const assetShares = snap[0];
        const borrowShares = snap[1];
        const collateral = snap[2];
        if (assetShares === 0n && borrowShares === 0n && collateral === 0n) return;
        const [asset, collTok, supplyAmt, borrowAmt] = await Promise.all([
          client.readContract({ address: pair, abi: fraxPairAbi, functionName: "asset" }),
          client.readContract({ address: pair, abi: fraxPairAbi, functionName: "collateralContract" }),
          assetShares === 0n
            ? Promise.resolve(0n)
            : client.readContract({ address: pair, abi: fraxPairAbi, functionName: "toAssetAmount", args: [assetShares, false] }),
          borrowShares === 0n
            ? Promise.resolve(0n)
            : client.readContract({ address: pair, abi: fraxPairAbi, functionName: "toBorrowAmount", args: [borrowShares, false] }),
        ]);
        tokens.add(pair.toLowerCase());
        const loan = await tokenMeta(client, asset);
        const col = await tokenMeta(client, collTok);
        const loanQ = await lineQuote(client, quotes, chainId, asset, loan.decimals);
        const colQ = await lineQuote(client, quotes, chainId, collTok, col.decimals);
        pushLine(lines, chainId, "fraxlend", loan.symbol, supplyAmt, loan.decimals, "supply", asset, loanQ);
        pushLine(lines, chainId, "fraxlend", loan.symbol, borrowAmt, loan.decimals, "borrow", asset, loanQ);
        pushLine(lines, chainId, "fraxlend", col.symbol, collateral, col.decimals, "supply", collTok, colQ);
      } catch {
        /* pair miss */
      }
    }),
  );
  if (!lines.length) return null;
  return { chainId, chain: chainShort(chainId), health: "—", lines, aTokens: tokens, protocol: "Fraxlend" };
}

const providerAbi = [
  { type: "function", name: "getPoolDataProvider", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

const SEAMLESS_POOL = "0x8F44Fd754285aa6A2b8B9B97739B79746e0475a7" as Address;
const SEAMLESS_PROVIDER = "0x0E02EB705be325407707662C6f6d3466E939f3a0" as Address;
const SEAMLESS_DATA = "0x2A0979257105834789bC6b9E1B00446DFbA8dFBa" as Address;
const SEAMLESS_VAULTS: Address[] = [
  "0x616a4E1db48e22028f6bbf20444Cd3b8e3273738",
  "0x5a47C803488FE2BB0A0EAaf346b420e4dF22F3C7",
  "0x27d8c7273fd3fcc6956a0b370ce5fd4a7fc65c18",
];

const DOLOMITE_MARGIN: Record<number, Address> = {
  42161: "0x6Bd780E7fDf01D77e4d475c821f1e7AE05409072",
  8453: "0x003Ca23Fd5F0ca87D01F6eC6CD14A8AE60c2b97D",
  1: "0x003Ca23Fd5F0ca87D01F6eC6CD14A8AE60c2b97D",
};

const dolomiteAbi = [
  {
    type: "function",
    name: "getAccountNumberOfMarketsWithBalances",
    stateMutability: "view",
    inputs: [{ type: "tuple", components: [{ name: "owner", type: "address" }, { name: "number", type: "uint256" }] }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getAccountBalances",
    stateMutability: "view",
    inputs: [{ type: "tuple", components: [{ name: "owner", type: "address" }, { name: "number", type: "uint256" }] }],
    outputs: [
      { type: "uint256[]" },
      { type: "address[]" },
      { type: "tuple[]", components: [{ name: "sign", type: "bool" }, { name: "value", type: "uint128" }] },
      { type: "tuple[]", components: [{ name: "sign", type: "bool" }, { name: "value", type: "uint256" }] },
    ],
  },
  {
    type: "function",
    name: "getAccountValues",
    stateMutability: "view",
    inputs: [{ type: "tuple", components: [{ name: "owner", type: "address" }, { name: "number", type: "uint256" }] }],
    outputs: [
      { type: "tuple", components: [{ name: "value", type: "uint256" }] },
      { type: "tuple", components: [{ name: "value", type: "uint256" }] },
    ],
  },
] as const;

const MOOLAH = "0x8F73b65B4caAf64FBA2aF91cC5D4a2A1318E5D8C" as Address;
const LISTA_INTERACTION = "0xB68443Ee3e828baD1526b3e0Bdf2Dfc6b1975ec4" as Address;
const LISTA_VAULTS_FALLBACK: Address[] = [
  "0x57134a64B7cD9F9eb72F8255A671F5Bf2fe3E2d0",
  "0xfa27f172e0b6ebcEF9c51ABf817E2cb142FbE627",
  "0x9A17Fd5Cb8EFc25d11567e713aE795A89775a759",
  "0xe03d86e5baa3509ac4a059a41737baa8169b6529",
  "0x6d6783C146F2B0B2774C1725297f1845dc502525",
  "0xE46b8E65006e6450bdd8cb7D3274AB4F76f4C705",
  "0xEB4F6FFB1038E1cCa701e7d53083B37ec5b6Ba33",
  "0x4109415de2271097fb5fa16af8a753aab8c46d6f",
];
const LISTA_CDP: Address[] = [
  "0xB0b84D294e0C75A6abe60171b70edEb2EFd14A1B",
  "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
  "0xa2E3356610840701BDf5611a53974510Ae27E2e1",
  "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
  "0x55d398326f99059fF775485246999027B3197955",
  "0x8d0D000Ee44948FC98c9B98A4fA4921476f08B0d",
  "0xc5f0f7bD48de13CE11B94120688484b19e183454",
  "0x4aae823a6a0b376De6A78e74eCC5b079d38cBCf7",
  "0x26c5e01524d2E6280A48F2c475Ff3eB9B4dc3d76",
  "0x0782b6d8c4551B9760e74c0545A9bCD90bdc41E5",
];

const listaCdpAbi = [
  { type: "function", name: "locked", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "borrowed", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

async function readErc4626Vaults(
  client: PublicClient,
  chainId: number,
  user: Address,
  quotes: Map<string, Quote>,
  vaults: Address[],
  slug: string,
): Promise<{ lines: ProtocolLine[]; tokens: Set<string> }> {
  const lines: ProtocolLine[] = [];
  const tokens = new Set<string>();
  const list = vaults.slice(0, 40);
  const bals = await client.multicall({
    contracts: list.map((v) => ({ address: v, abi: erc4626Abi, functionName: "balanceOf" as const, args: [user] })),
    allowFailure: true,
  });
  await Promise.all(
    list.map(async (vault, i) => {
      const row = bals[i];
      if (row.status !== "success" || row.result === 0n) return;
      try {
        const [asset, assets] = await Promise.all([
          client.readContract({ address: vault, abi: erc4626Abi, functionName: "asset" }),
          client.readContract({ address: vault, abi: erc4626Abi, functionName: "convertToAssets", args: [row.result] }),
        ]);
        if (assets === 0n) return;
        const m = await tokenMeta(client, asset);
        const q = await lineQuote(client, quotes, chainId, asset, m.decimals);
        tokens.add(vault.toLowerCase());
        pushLine(lines, chainId, slug, m.symbol, assets, m.decimals, "supply", asset, q);
      } catch {
        /* vault miss */
      }
    }),
  );
  return { lines, tokens };
}

async function readSeamless(client: PublicClient, chainId: number, user: Address, quotes: Map<string, Quote>): Promise<LendCard | null> {
  if (chainId !== 8453) return null;
  const lines: ProtocolLine[] = [];
  const tokens = new Set<string>();
  try {
    const data =
      ((await client.readContract({ address: SEAMLESS_PROVIDER, abi: providerAbi, functionName: "getPoolDataProvider" }).catch(() => SEAMLESS_DATA)) as Address) ||
      SEAMLESS_DATA;
    const leftover = await readAaveMarket(client, chainId, user, { pool: SEAMLESS_POOL, data }, chainShort(chainId), "seamless");
    if (leftover) {
      lines.push(...leftover.lines);
      for (const t of leftover.aTokens) tokens.add(t);
    }
  } catch {
    /* leftover miss */
  }
  const vaults = await readErc4626Vaults(client, chainId, user, quotes, SEAMLESS_VAULTS, "seamless");
  lines.push(...vaults.lines);
  for (const t of vaults.tokens) tokens.add(t);
  if (!lines.length) return null;
  return { chainId, chain: chainShort(chainId), health: "—", lines, aTokens: tokens, protocol: "Seamless" };
}

async function readDolomite(client: PublicClient, chainId: number, user: Address, quotes: Map<string, Quote>): Promise<LendCard | null> {
  const margin = DOLOMITE_MARGIN[chainId];
  if (!margin) return null;
  const lines: ProtocolLine[] = [];
  const tokens = new Set<string>();
  let suppliedUsd = 0n;
  let borrowedUsd = 0n;
  const nums = Array.from({ length: 12 }, (_, i) => BigInt(i));
  await Promise.all(
    nums.map(async (number) => {
      const account = { owner: user, number } as const;
      try {
        const n = await client.readContract({
          address: margin,
          abi: dolomiteAbi,
          functionName: "getAccountNumberOfMarketsWithBalances",
          args: [account],
        });
        if (n === 0n) return;
        const [ids, addrs, , weis] = await client.readContract({
          address: margin,
          abi: dolomiteAbi,
          functionName: "getAccountBalances",
          args: [account],
        });
        await Promise.all(
          addrs.map(async (token, i) => {
            const wei = weis[i];
            const raw = BigInt(wei.value);
            if (raw === 0n) return;
            const side: "supply" | "borrow" = wei.sign ? "supply" : "borrow";
            const m = await tokenMeta(client, token);
            const q = await lineQuote(client, quotes, chainId, token, m.decimals);
            tokens.add(token.toLowerCase());
            pushLine(lines, chainId, "dolomite", m.symbol, raw, m.decimals, side, token, q);
          }),
        );
        const vals = await client.readContract({ address: margin, abi: dolomiteAbi, functionName: "getAccountValues", args: [account] }).catch(() => null);
        if (vals) {
          suppliedUsd += BigInt(vals[0].value);
          borrowedUsd += BigInt(vals[1].value);
        }
        void ids;
      } catch {
        /* account miss */
      }
    }),
  );
  if (!lines.length) return null;
  let health = "—";
  if (borrowedUsd > 0n) {
    const hf = Number(suppliedUsd) / Number(borrowedUsd);
    if (Number.isFinite(hf) && hf > 0) health = hf.toFixed(2);
  }
  return { chainId, chain: chainShort(chainId), health, lines, aTokens: tokens, protocol: "Dolomite" };
}

async function listaMarketIds(user: Address): Promise<`0x${string}`[]> {
  const urls = [
    `https://api.lista.org/api/moolah/borrow/userMarketList?address=${user}&chain=bsc`,
    `https://api.lista.org/api/moolah/borrow/userPositions?address=${user}&chain=bsc`,
  ];
  const out: `0x${string}`[] = [];
  const seen = new Set<string>();
  const take = (data: unknown) => {
    const rows = Array.isArray(data) ? data : Array.isArray((data as { list?: unknown[] } | null)?.list) ? (data as { list: unknown[] }).list : [];
    for (const row of rows) {
      const id = typeof row === "string" ? row : (row as { marketId?: string })?.marketId;
      if (!id || !id.startsWith("0x") || id.length !== 66) continue;
      const k = id.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(id as `0x${string}`);
    }
  };
  await Promise.all(
    urls.map(async (url) => {
      try {
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), 12000);
        const res = await fetch(url, { signal: ac.signal });
        clearTimeout(t);
        if (!res.ok) return;
        const json = (await res.json()) as { data?: unknown };
        take(json.data);
      } catch {
        /* api miss */
      }
    }),
  );
  return out.slice(0, 40);
}

async function listaVaults(): Promise<Address[]> {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 12000);
    const res = await fetch("https://api.lista.org/api/moolah/vault/list?page=1&pageSize=50&chain=bsc", { signal: ac.signal });
    clearTimeout(t);
    if (!res.ok) return LISTA_VAULTS_FALLBACK;
    const json = (await res.json()) as { data?: { list?: Array<{ address?: string }> } };
    const list = (json.data?.list ?? []).map((v) => v.address).filter((a): a is string => Boolean(a && a.startsWith("0x")));
    return (list.length ? list : LISTA_VAULTS_FALLBACK) as Address[];
  } catch {
    return LISTA_VAULTS_FALLBACK;
  }
}

async function readLista(client: PublicClient, chainId: number, user: Address, quotes: Map<string, Quote>): Promise<LendCard | null> {
  if (chainId !== 56) return null;
  const lines: ProtocolLine[] = [];
  const tokens = new Set<string>();
  const vaults = await readErc4626Vaults(client, chainId, user, quotes, await listaVaults(), "lista");
  lines.push(...vaults.lines);
  for (const t of vaults.tokens) tokens.add(t);
  const ids = await listaMarketIds(user);
  await Promise.all(
    ids.map(async (id) => {
      try {
        const [pos, mkt, params] = await Promise.all([
          client.readContract({ address: MOOLAH, abi: morphoAbi, functionName: "position", args: [id, user] }),
          client.readContract({ address: MOOLAH, abi: morphoAbi, functionName: "market", args: [id] }),
          client.readContract({ address: MOOLAH, abi: morphoAbi, functionName: "idToMarketParams", args: [id] }),
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
        pushLine(lines, chainId, "lista", loan.symbol, supplyAssets, loan.decimals, "supply", loanToken, loanQ);
        pushLine(lines, chainId, "lista", loan.symbol, borrowAssets, loan.decimals, "borrow", loanToken, loanQ);
        pushLine(lines, chainId, "lista", col.symbol, collateral, col.decimals, "supply", colToken, colQ);
      } catch {
        /* market miss */
      }
    }),
  );
  await Promise.all(
    LISTA_CDP.map(async (token) => {
      try {
        const [locked, borrowed] = await Promise.all([
          client.readContract({ address: LISTA_INTERACTION, abi: listaCdpAbi, functionName: "locked", args: [token, user] }),
          client.readContract({ address: LISTA_INTERACTION, abi: listaCdpAbi, functionName: "borrowed", args: [token, user] }),
        ]);
        if (locked === 0n && borrowed === 0n) return;
        const m = await tokenMeta(client, token);
        const q = await lineQuote(client, quotes, chainId, token, m.decimals);
        tokens.add(token.toLowerCase());
        pushLine(lines, chainId, "lista", m.symbol, locked, m.decimals, "supply", token, q);
        if (borrowed > 0n) {
          const lisQ = await lineQuote(client, quotes, chainId, "0x0782b6d8c4551B9760e74c0545A9bCD90bdc41E5", 18);
          pushLine(lines, chainId, "lista", "lisUSD", borrowed, 18, "borrow", "0x0782b6d8c4551B9760e74c0545A9bCD90bdc41E5", lisQ);
        }
      } catch {
        /* cdp miss */
      }
    }),
  );
  if (!lines.length) return null;
  return { chainId, chain: chainShort(chainId), health: "—", lines, aTokens: tokens, protocol: "Lista" };
}

export async function readExtraLending(
  client: PublicClient,
  chainId: number,
  user: Address,
  quotes: Map<string, Quote>,
): Promise<LendCard[]> {
  return accountCache("pos.lend", chainId, user, "extra", () => readExtraLendingUncached(client, chainId, user, quotes));
}

async function readExtraLendingUncached(
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
  jobs.push(readFluid(client, chainId, user, quotes));
  jobs.push(readSilo(client, chainId, user, quotes));
  jobs.push(readFraxlend(client, chainId, user, quotes));
  jobs.push(readSeamless(client, chainId, user, quotes));
  jobs.push(readDolomite(client, chainId, user, quotes));
  jobs.push(readLista(client, chainId, user, quotes));
  for (const fork of AAVE_FORKS[chainId] ?? []) {
    jobs.push(
      readAaveMarket(client, chainId, user, fork, chainShort(chainId), fork.slug).then((c) => (c ? { ...c, protocol: fork.name } : null)),
    );
  }
  const rows = await Promise.all(jobs);
  return rows.filter((c): c is LendCard => Boolean(c));
}
