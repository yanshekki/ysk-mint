import type { Address } from "viem";
import { cacheGet, cacheKey, POLICIES } from "./defi/cache.ts";
import { outboundFetch } from "./outbound.ts";

export type DiscoveredErc20 = {
  chainId: number;
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  raw: bigint;
  usdHint: number | null;
  nft?: boolean;
};

/** Chains whose per-instance Blockscout REST is dead or unusable. */
export const DEAD_BLOCKSCOUT = new Set([56, 8453, 59144, 81457, 5000]);

export const ANKR_NAME: Partial<Record<number, string>> = {
  1: "eth",
  10: "optimism",
  14: "flare",
  56: "bsc",
  100: "gnosis",
  137: "polygon",
  250: "fantom",
  8453: "base",
  42161: "arbitrum",
  43114: "avalanche",
  59144: "linea",
  534352: "scroll",
};

/**
 * NodeReal documented public MegaNode keys (shareable starter endpoints).
 * `nr_getTokenHoldings` is ETH + BSC only; Base/Linea stay Ankr then catalog RPC.
 */
export const NODEREAL: Partial<Record<number, string>> = {
  1: "https://eth-mainnet.nodereal.io/v1/1659dfb40aa24bbb8153a677b98064d7",
  56: "https://bsc-mainnet.nodereal.io/v1/64a9df0874fb4a93b9d0a3849de012d3",
  137: "https://polygon-mainnet.nodereal.io/v1/f510fc4d083b49d1ab383d25246cc7de",
};

const ANKR = "https://rpc.ankr.com/multichain";
const INDEX_POLICY = { ...POLICIES.http, ttlMs: 120_000, staleMs: 600_000 };

export function indexedHoldingsChains() {
  return [...new Set([...Object.keys(ANKR_NAME), ...Object.keys(NODEREAL)].map(Number))].filter((id) => DEAD_BLOCKSCOUT.has(id));
}

export function hexToBig(raw?: string | number) {
  if (raw == null || raw === "") return 0n;
  const s = String(raw);
  try {
    return BigInt(s.startsWith("0x") || s.startsWith("0X") ? s : `0x${s}`);
  } catch {
    try {
      return BigInt(s);
    } catch {
      return 0n;
    }
  }
}

async function rpcPost<T>(url: string, body: unknown, timeoutMs = 22000): Promise<T> {
  return cacheGet(
    { key: cacheKey("idx.rpc", 0, JSON.stringify({ url, body })), policy: INDEX_POLICY },
    async () => {
      const ctrl = new AbortController();
      const timer = globalThis.setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await outboundFetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`rpc ${res.status}`);
        const json = (await res.json()) as { result?: T; error?: { message?: string } };
        if (json.error) throw new Error(json.error.message || "rpc error");
        if (json.result === undefined) throw new Error("rpc empty");
        return json.result;
      } finally {
        globalThis.clearTimeout(timer);
      }
    },
  );
}

type AnkrAsset = {
  blockchain?: string;
  tokenType?: string;
  contractAddress?: string;
  tokenSymbol?: string;
  tokenName?: string;
  tokenDecimals?: number;
  balanceRawInteger?: string;
  balanceUsd?: string;
};

async function fetchAnkrHoldings(chainId: number, address: string): Promise<DiscoveredErc20[]> {
  const chain = ANKR_NAME[chainId];
  if (!chain) throw new Error(`ankr chain ${chainId}`);
  const result = await rpcPost<{ assets?: AnkrAsset[] }>(ANKR, {
    jsonrpc: "2.0",
    id: 1,
    method: "ankr_getAccountBalance",
    params: { blockchain: chain, walletAddress: address, onlyWhitelisted: false, nativeFirst: true },
  });
  const out: DiscoveredErc20[] = [];
  for (const a of result.assets ?? []) {
    const typ = (a.tokenType || "").toUpperCase();
    if (typ.includes("721") || typ.includes("1155") || typ === "NATIVE") continue;
    const contract = (a.contractAddress || "").toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(contract)) continue;
    let raw = 0n;
    try {
      raw = BigInt(a.balanceRawInteger || "0");
    } catch {
      continue;
    }
    if (raw <= 0n) continue;
    const usd = Number(a.balanceUsd);
    const dec = Number(a.tokenDecimals);
    out.push({
      chainId,
      address: contract as Address,
      symbol: (a.tokenSymbol || "TOKEN").slice(0, 24),
      name: (a.tokenName || a.tokenSymbol || "Token").slice(0, 48),
      decimals: Number.isFinite(dec) ? Math.min(36, Math.max(0, dec)) : 18,
      raw,
      usdHint: Number.isFinite(usd) && usd > 0 ? usd : null,
    });
  }
  return out;
}

type NrHolding = {
  tokenAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenDecimals?: string;
  tokenBalance?: string;
};

async function fetchNodeRealHoldings(chainId: number, address: string): Promise<DiscoveredErc20[]> {
  const url = NODEREAL[chainId];
  if (!url) throw new Error(`nodereal chain ${chainId}`);
  const out: DiscoveredErc20[] = [];
  for (let page = 1; page <= 8; page++) {
    const result = await rpcPost<{ totalCount?: string; details?: NrHolding[] }>(url, {
      jsonrpc: "2.0",
      id: 1,
      method: "nr_getTokenHoldings",
      params: [address, `0x${page.toString(16)}`, "0x64"],
    });
    const rows = result.details ?? [];
    for (const t of rows) {
      const contract = (t.tokenAddress || "").toLowerCase();
      if (!/^0x[a-f0-9]{40}$/.test(contract)) continue;
      const raw = hexToBig(t.tokenBalance);
      if (raw <= 0n) continue;
      const decimals = Math.min(36, Math.max(0, Number(hexToBig(t.tokenDecimals || "0x12")) || 18));
      out.push({
        chainId,
        address: contract as Address,
        symbol: (t.tokenSymbol || "TOKEN").slice(0, 24),
        name: (t.tokenName || t.tokenSymbol || "Token").slice(0, 48),
        decimals,
        raw,
        usdHint: null,
      });
    }
    const total = Number(hexToBig(result.totalCount || "0x0"));
    if (rows.length === 0 || out.length >= total || page * 100 >= total) break;
  }
  return out;
}

/** Token inventory when Blockscout is down. Ankr first, NodeReal MegaNode next. */
export async function fetchIndexedHoldings(chainId: number, address: string): Promise<DiscoveredErc20[]> {
  const errors: string[] = [];
  if (ANKR_NAME[chainId]) {
    try {
      return await fetchAnkrHoldings(chainId, address);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  if (NODEREAL[chainId]) {
    try {
      return await fetchNodeRealHoldings(chainId, address);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  throw new Error(`index holdings ${chainId} ${errors.join("; ") || "no source"}`);
}

export type IndexedTransfer = {
  hash: string;
  from: string;
  to: string;
  value: bigint;
  asset?: string;
  contract?: string;
  decimals: number;
  ts: number;
  fail: boolean;
  gasPrice?: bigint;
  gasUsed?: bigint;
  category?: string;
};

export async function fetchIndexedTransfers(chainId: number, address: string): Promise<IndexedTransfer[]> {
  const errors: string[] = [];
  if (ANKR_NAME[chainId]) {
    try {
      return await fetchAnkrTransfers(chainId, address);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  if (NODEREAL[chainId]) {
    try {
      return await fetchNodeRealTransfers(chainId, address);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  throw new Error(`index txs ${chainId} ${errors.join("; ") || "no source"}`);
}

type AnkrTx = {
  hash?: string;
  from?: string;
  to?: string;
  value?: string;
  timestamp?: number;
  status?: string;
  gasPrice?: string;
  gasUsed?: string;
};

async function fetchAnkrTransfers(chainId: number, address: string): Promise<IndexedTransfer[]> {
  const chain = ANKR_NAME[chainId];
  if (!chain) throw new Error(`ankr chain ${chainId}`);
  const out: IndexedTransfer[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 6; page++) {
    const result = await rpcPost<{ transactions?: AnkrTx[]; nextPageToken?: string }>(ANKR, {
      jsonrpc: "2.0",
      id: 1,
      method: "ankr_getTransactionsByAddress",
      params: {
        blockchain: chain,
        address,
        descOrder: true,
        includeLogs: false,
        pageSize: 40,
        ...(pageToken ? { pageToken } : {}),
      },
    });
    for (const t of result.transactions ?? []) {
      if (!t.hash) continue;
      out.push({
        hash: t.hash,
        from: t.from || "",
        to: t.to || "",
        value: hexToBig(t.value),
        decimals: 18,
        ts: Number(t.timestamp) || 0,
        fail: t.status === "0" || t.status === "false",
        gasPrice: t.gasPrice ? hexToBig(t.gasPrice) : undefined,
        gasUsed: t.gasUsed ? hexToBig(t.gasUsed) : undefined,
        category: "external",
      });
    }
    pageToken = result.nextPageToken;
    if (!pageToken || out.length >= 80) break;
  }
  return out;
}

type NrTx = {
  hash?: string;
  from?: string;
  to?: string;
  value?: string;
  asset?: string;
  contractAddress?: string;
  decimal?: string;
  blockTimeStamp?: number;
  receiptsStatus?: number;
  gasPrice?: number | string;
  gasUsed?: number | string;
  category?: string;
};

async function fetchNodeRealTransfers(chainId: number, address: string): Promise<IndexedTransfer[]> {
  const url = NODEREAL[chainId];
  if (!url) throw new Error(`nodereal chain ${chainId}`);
  const headHex = await rpcPost<string>(url, { jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] });
  const latest = Number(hexToBig(headHex));
  const head = Math.max(0, latest - 128);
  const WINDOW = 50_000;
  const out: IndexedTransfer[] = [];
  const seen = new Set<string>();
  for (let w = 0; w < 16 && out.length < 80; w++) {
    const to = head - w * WINDOW;
    const from = Math.max(0, to - WINDOW);
    if (to <= 0) break;
    let pageKey: string | undefined;
    for (let page = 0; page < 4 && out.length < 80; page++) {
      const result = await rpcPost<{ transfers?: NrTx[]; pageKey?: string }>(url, {
        jsonrpc: "2.0",
        id: 1,
        method: "nr_getTransactionByAddress",
        params: [
          {
            category: ["external", "20"],
            address,
            fromBlock: `0x${from.toString(16)}`,
            toBlock: `0x${to.toString(16)}`,
            order: "desc",
            maxCount: "0x28",
            excludeZeroValue: false,
            ...(pageKey ? { pageKey } : {}),
          },
        ],
      });
      for (const t of result.transfers ?? []) {
        if (!t.hash) continue;
        const k = `${t.hash.toLowerCase()}:${(t.contractAddress || "").toLowerCase()}:${t.value || "0"}`;
        if (seen.has(k)) continue;
        seen.add(k);
        const contract = (t.contractAddress || "").toLowerCase();
        const isToken = Boolean(contract && contract !== "0x0000000000000000000000000000000000000000");
        out.push({
          hash: t.hash,
          from: t.from || "",
          to: t.to || "",
          value: hexToBig(t.value),
          asset: t.asset,
          contract: isToken ? contract : undefined,
          decimals: isToken ? Math.min(36, Math.max(0, Number(hexToBig(t.decimal || "0x12")) || 18)) : 18,
          ts: Number(t.blockTimeStamp) || 0,
          fail: t.receiptsStatus === 0,
          gasPrice: t.gasPrice != null ? hexToBig(String(t.gasPrice)) : undefined,
          gasUsed: t.gasUsed != null ? hexToBig(String(t.gasUsed)) : undefined,
          category: t.category,
        });
      }
      pageKey = result.pageKey;
      if (!pageKey) break;
    }
  }
  return out;
}
