import { erc20Abi, formatUnits, type Address, type PublicClient } from "viem";
import { callMany } from "../defi/evm/client.ts";
import { DEX } from "../defiAddresses.ts";
import { DOLOMITE_MARGIN, FRAX_REG } from "../lendingExtra.ts";
import { TOKEN_CATALOG } from "../tokenRegistry.ts";
import type { LendMarketRow } from "../lendMarkets.ts";
import { row } from "./shared.ts";


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
