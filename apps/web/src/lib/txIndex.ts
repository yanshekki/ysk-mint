import { CHAINS } from "@ysk-mint/config";
import { chainIcon } from "./chainIcon.ts";
import { DEX } from "./defiAddresses.ts";

export type TxKind = "in" | "out" | "swap" | "approve" | "call" | "fail";

export type AddrTagKind = "cex" | "dex" | "token" | "outside" | "airdrop";

export type AddrTag = {
  kind: AddrTagKind;
  name: string;
};

export type TxFlow = {
  symbol: string;
  icon: string;
  amount: string;
  dir: "in" | "out";
  token?: string;
  nft?: boolean;
  counter?: string;
  tag?: AddrTag;
};

export type TxRow = {
  id: string;
  chainId: number;
  hash: string;
  ts: number;
  method: string;
  kind: TxKind;
  from: string;
  to: string;
  fromLabel?: string;
  toLabel?: string;
  fromTag?: AddrTag;
  toTag?: AddrTag;
  peer: string;
  peerLabel: string;
  peerTag?: AddrTag;
  protocol?: string;
  ours: string;
  flows: TxFlow[];
  gas?: string;
  fail?: boolean;
  risk?: boolean;
  nft?: boolean;
  spam?: boolean;
  explorer: string;
};

export const BS_TX: Partial<Record<number, string>> = {
  1: "https://eth.blockscout.com",
  10: "https://explorer.optimism.io",
  42161: "https://arbitrum.blockscout.com",
  137: "https://polygon.blockscout.com",
  100: "https://gnosis.blockscout.com",
  324: "https://zksync.blockscout.com",
  534352: "https://scroll.blockscout.com",
  42220: "https://celo.blockscout.com",
  130: "https://unichain.blockscout.com",
  1868: "https://soneium.blockscout.com",
  480: "https://worldchain-mainnet.explorer.alchemy.com",
  4663: "https://robinhoodchain.blockscout.com",
};

/** Etherscan-style account txlist. Tried in order. */
export const SCAN_TX: Partial<Record<number, string[]>> = {
  43114: [
    "https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api",
    "https://api.snowtrace.io/api",
  ],
  81457: ["https://api.routescan.io/v2/network/mainnet/evm/81457/etherscan/api"],
  5000: ["https://api.routescan.io/v2/network/mainnet/evm/5000/etherscan/api"],
};

/** JSON-RPC indexed history (Ankr / NodeReal) when Blockscout is down. */
export const INDEX_TX = new Set([56, 8453, 59144]);

const ZERO = "0x0000000000000000000000000000000000000000";

const PROTO: Record<string, string> = {};

function putProto(chainId: number, addr: string, name: string) {
  PROTO[`${chainId}:${addr.toLowerCase()}`] = name;
}

const SHARED: Array<[string, string]> = [
  ["0x3fc91a3afd70395aa83689b6b03e2f8d4596b6c2", "Uniswap"],
  ["0x3fc91a3afd70395aa83689b6b03e2f8d4596b6ce", "Uniswap"],
  ["0x66a9893cc07d91d95644aedd05d03f95e1dba8af", "Uniswap"],
  ["0xe592427a0aece92de3edee1f18e0157c05861564", "Uniswap"],
  ["0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45", "Uniswap"],
  ["0x1111111254eeb25477b68fb85ed929f73a960582", "1inch"],
  ["0x1111111254fb6c44bac0bed2854e3b80d40c459d", "1inch"],
  ["0x111111125421ca6dc452d289314280a0f8842a65", "1inch"],
  ["0x11111112542d85b3ef69ae05771c2dccff4faa26", "1inch"],
  ["0xdef1c0ded9bec7f1a16708146644d11512a32718", "0x"],
  ["0x000000000022d473030f116ddee9f6b43ac78ba3", "Permit2"],
];

const SPECIFIC: Array<[number, string, string]> = [
  [1, "0x7a250d5630b4cf539739df2c5dacb4c659f2488d", "Uniswap"],
  [1, "0x889edc2edab5f40e902b864ad4d7ade8e412f9b1", "Lido"],
  [1, "0xae7ab96520de3a18e5e111b5eaab095312d7fe84", "Lido"],
  [56, "0x10ed43c718714eb63d5aa57b78b54704e256024e", "PancakeSwap"],
  [56, "0x13f4ea83d0bd40e75c8222255bc855a974568dd4", "PancakeSwap"],
  [56, "0x1b81d678ffb9c0263b24a97847620c99d213eb14", "PancakeSwap"],
  [8453, "0xcfcf3b405b020d90d87fe6c8a743dc268589e6a1", "Aerodrome"],
  [8453, "0x420dd381b31aef6683db6b902084cb0ffece40da", "Aerodrome"],
  [8453, "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43", "Aerodrome"],
  [43114, "0x2b2c81e08f1af8835a78bb2a90ae924ace0ea4be", "BENQI"],
  [43114, "0x486af39519b4dc9a7fccd318217352830e8ad9b4", "BENQI"],
  [43114, "0x5c0401e81bc07ca70fad469b451682c0d747ef1c", "BENQI"],
  [43114, "0xb4315e873dbcf96ffd0acd8ea43f689d8c20fb30", "LFJ"],
  [43114, "0x60ae616a2155ee3d9a68541ba4544862310933d4", "Trader Joe"],
];

for (const id of [...Object.keys(BS_TX), ...Object.keys(SCAN_TX), ...INDEX_TX].map(Number)) {
  for (const [addr, name] of SHARED) putProto(id, addr, name);
}
for (const [id, addr, name] of SPECIFIC) putProto(id, addr, name);
for (const d of Object.values(DEX)) {
  if (d.aave?.pool) putProto(d.chainId, d.aave.pool, "Aave");
}

export function protocolName(chainId: number, addr?: string) {
  if (!addr) return undefined;
  return PROTO[`${chainId}:${addr.toLowerCase()}`];
}

export function nativeDecimals(chainId: number) {
  if (chainId === 101) return 9;
  if (chainId === 1815) return 6;
  if (chainId === 397) return 24;
  return 18;
}

export function chainMeta(chainId: number) {
  const c = Object.values(CHAINS).find((x) => x.chainId === chainId);
  return {
    short: c?.short ?? String(chainId),
    native: c?.nativeSymbol ?? "ETH",
    explorer: c?.explorer ?? "",
    icon: c ? chainIcon(c) : "/tokens/eth.png",
    decimals: nativeDecimals(chainId),
  };
}

export function txExplorer(chainId: number, hash: string) {
  const base = (chainMeta(chainId).explorer || "").replace(/\/$/, "");
  if (!base) return "";
  if (chainId === 101) return `${base.split("?")[0]}/tx/${hash}${base.includes("?") ? `?${base.split("?")[1]}` : ""}`;
  if (chainId === 1815) return `${base}/transaction/${hash}`;
  if (chainId === 397) return `${base}/txns/${hash}`;
  return `${base}/tx/${hash}`;
}

export function txIndexed(chainId: number) {
  return Boolean(BS_TX[chainId] || SCAN_TX[chainId] || INDEX_TX.has(chainId) || chainId === 101 || chainId === 1815 || chainId === 397);
}

export function classifyTx(opts: {
  fail?: boolean;
  method?: string;
  types?: string[];
  nativeIn: boolean;
  nativeOut: boolean;
  tokenIn: number;
  tokenOut: number;
}): TxKind {
  if (opts.fail) return "fail";
  const m = (opts.method || "").toLowerCase();
  const types = (opts.types || []).join(" ").toLowerCase();
  if (m.includes("approve") || types.includes("token_approval")) return "approve";
  if (opts.tokenIn > 0 && opts.tokenOut > 0) return "swap";
  if (opts.nativeOut && opts.tokenIn > 0) return "swap";
  if (opts.nativeIn && opts.tokenOut > 0) return "swap";
  if (opts.tokenIn + (opts.nativeIn ? 1 : 0) > 0 && opts.tokenOut + (opts.nativeOut ? 1 : 0) === 0) return "in";
  if (opts.tokenOut + (opts.nativeOut ? 1 : 0) > 0 && opts.tokenIn + (opts.nativeIn ? 1 : 0) === 0) return "out";
  return "call";
}

export function fmtAmt(raw: string | number | bigint, decimals: number) {
  let n = 0;
  try {
    const v = typeof raw === "bigint" ? raw : BigInt(String(raw || "0").split(".")[0] || "0");
    const d = Math.min(Math.max(decimals, 0), 36);
    const neg = v < 0n;
    const abs = neg ? -v : v;
    const s = abs.toString().padStart(d + 1, "0");
    const whole = s.slice(0, s.length - d) || "0";
    const frac = s.slice(s.length - d).replace(/0+$/, "");
    n = Number(frac ? `${whole}.${frac}` : whole);
    if (neg) n = -n;
  } catch {
    n = Number(raw);
  }
  if (!Number.isFinite(n) || n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (abs >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export function methodLabel(method?: string | null, fallback = "call") {
  const m = (method || "").trim();
  if (!m || m === "0x") return fallback;
  if (/^0x[0-9a-f]+$/i.test(m)) return fallback;
  if (m.includes("(")) return m.split("(")[0] || fallback;
  return m;
}

export function isZeroAddr(addr?: string) {
  return !addr || addr.toLowerCase() === ZERO;
}

export function canFollow(ours: string, addr?: string) {
  if (!addr || isZeroAddr(addr)) return false;
  return addr.toLowerCase() !== ours.toLowerCase();
}

export function addFlow(flows: TxFlow[], flow: TxFlow) {
  const k = `${flow.dir}:${(flow.token || "").toLowerCase()}:${flow.amount}:${flow.symbol}`;
  if (flows.some((f) => `${f.dir}:${(f.token || "").toLowerCase()}:${f.amount}:${f.symbol}` === k)) return;
  flows.push(flow);
}

export function retouch(row: TxRow) {
  const tokenIn = row.flows.filter((f) => f.dir === "in" && f.token).length;
  const tokenOut = row.flows.filter((f) => f.dir === "out" && f.token).length;
  const nativeIn = row.flows.some((f) => f.dir === "in" && !f.token);
  const nativeOut = row.flows.some((f) => f.dir === "out" && !f.token);
  row.kind = classifyTx({ fail: row.fail, method: row.method, nativeIn, nativeOut, tokenIn, tokenOut });
  if (!row.protocol) row.protocol = protocolName(row.chainId, row.to) || protocolName(row.chainId, row.peer);
  if (!row.peerLabel) row.peerLabel = row.protocol || row.toLabel || "";
  return row;
}

export function mergeTxRows(prev: TxRow[], extra: TxRow[]) {
  const seen = new Set(prev.map((r) => `${r.chainId}:${r.hash.toLowerCase()}`));
  const out = [...prev];
  for (const r of extra) {
    const k = `${r.chainId}:${r.hash.toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  out.sort((a, b) => b.ts - a.ts || a.hash.localeCompare(b.hash));
  return out;
}
