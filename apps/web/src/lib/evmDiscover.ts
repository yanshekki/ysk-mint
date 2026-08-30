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
};

const EXPLORER: Partial<Record<number, string>> = {
  1: "https://eth.blockscout.com",
  10: "https://explorer.optimism.io",
  8453: "https://base.blockscout.com",
  42161: "https://arbitrum.blockscout.com",
  137: "https://polygon.blockscout.com",
  100: "https://gnosis.blockscout.com",
  324: "https://zksync.blockscout.com",
  534352: "https://scroll.blockscout.com",
  81457: "https://blast.blockscout.com",
  42220: "https://celo.blockscout.com",
  56: "https://bsc.blockscout.com",
  59144: "https://explorer.linea.build",
  130: "https://unichain.blockscout.com",
  1868: "https://soneium.blockscout.com",
  5000: "https://explorer.mantle.xyz",
  480: "https://worldchain-mainnet.explorer.alchemy.com",
};

type BsTok = {
  value?: string;
  token?: {
    address_hash?: string;
    address?: string;
    decimals?: string | number;
    symbol?: string;
    name?: string;
    type?: string;
    exchange_rate?: string | null;
    holders_count?: string | number;
    reputation?: string;
  };
};

const DISC_POLICY = { ...POLICIES.http, ttlMs: 120_000, staleMs: 600_000 };

export function explorerChains() {
  return Object.keys(EXPLORER).map(Number);
}

export function explorerUrl(chainId: number) {
  return EXPLORER[chainId];
}

const PAGE_CAP = 20;

type BsPage = { items: BsTok[]; next?: Record<string, unknown> };

function asBsPage(json: unknown): BsPage {
  if (Array.isArray(json)) return { items: json as BsTok[] };
  if (json && typeof json === "object") {
    const o = json as { items?: BsTok[]; next_page_params?: Record<string, unknown> | null };
    if (Array.isArray(o.items)) return { items: o.items, next: o.next_page_params ?? undefined };
  }
  throw new Error("explorer shape");
}

function parseTok(chainId: number, item: BsTok): DiscoveredErc20 | null {
  const tok = item.token;
  if (!tok) return null;
  const typ = (tok.type || "ERC-20").toUpperCase();
  if (typ.includes("721") || typ.includes("1155")) return null;
  if (typ && !typ.includes("ERC-20") && typ !== "ERC20") return null;
  const contract = (tok.address_hash || tok.address || "").toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(contract)) return null;
  let raw = 0n;
  try {
    raw = BigInt(item.value || "0");
  } catch {
    return null;
  }
  if (raw <= 0n) return null;
  const decimals = Math.min(36, Math.max(0, Number(tok.decimals ?? 18) || 18));
  const amt = Number(raw) / 10 ** decimals;
  const px = tok.exchange_rate != null && tok.exchange_rate !== "" ? Number(tok.exchange_rate) : NaN;
  const usdHint = Number.isFinite(amt) && Number.isFinite(px) ? amt * px : null;
  return {
    chainId,
    address: contract as Address,
    symbol: (tok.symbol || "TOKEN").slice(0, 24),
    name: (tok.name || tok.symbol || "Token").slice(0, 48),
    decimals,
    raw,
    usdHint,
  };
}

async function fetchExplorer(chainId: number, address: string): Promise<DiscoveredErc20[]> {
  const base = EXPLORER[chainId];
  if (!base) return [];
  return cacheGet(
    { key: cacheKey("hold.disc", chainId, address), policy: { ...DISC_POLICY, account: address.toLowerCase() } },
    async () => {
      const out: DiscoveredErc20[] = [];
      let query = "";
      for (let page = 0; page < PAGE_CAP; page++) {
        const ctrl = new AbortController();
        const timer = globalThis.setTimeout(() => ctrl.abort(), 25000);
        try {
          const res = await outboundFetch(`${base}/api/v2/addresses/${address}/token-balances${query}`, { signal: ctrl.signal });
          if (!res.ok) throw new Error(`explorer ${chainId} ${res.status}`);
          const { items, next } = asBsPage(await res.json());
          for (const item of items) {
            const row = parseTok(chainId, item);
            if (row) out.push(row);
          }
          if (!next || !Object.keys(next).length) break;
          const qs = new URLSearchParams();
          for (const [k, v] of Object.entries(next)) {
            if (v == null) continue;
            qs.set(k, String(v));
          }
          query = `?${qs.toString()}`;
        } finally {
          globalThis.clearTimeout(timer);
        }
      }
      return out;
    },
  );
}

function keepDisc(d: DiscoveredErc20, catalog: Set<string>) {
  const k = `${d.chainId}:${d.address.toLowerCase()}`;
  if (catalog.has(k)) return true;
  if (d.usdHint != null && d.usdHint >= 1) return true;
  return false;
}

/** Explorer-indexed ERC-20s this address actually holds. Dust / NFT spam dropped. */
export async function discoverEvmTokens(
  chainIds: number[],
  addresses: string[],
  catalogKeys: Set<string>,
): Promise<{ tokens: DiscoveredErc20[]; failed: number[] }> {
  const jobs: Array<{ chainId: number; run: Promise<DiscoveredErc20[]> }> = [];
  for (const addr of addresses) {
    for (const id of chainIds) {
      if (!EXPLORER[id]) continue;
      jobs.push({ chainId: id, run: fetchExplorer(id, addr) });
    }
  }
  const failed = new Set<number>();
  const parts: DiscoveredErc20[][] = [];
  const settled = await Promise.allSettled(jobs.map((j) => j.run));
  settled.forEach((s, i) => {
    const id = jobs[i]?.chainId;
    if (s.status === "fulfilled") parts.push(s.value);
    else if (id != null) failed.add(id);
  });
  const by = new Map<string, DiscoveredErc20>();
  for (const list of parts) {
    for (const d of list) {
      if (!keepDisc(d, catalogKeys)) continue;
      const k = `${d.chainId}:${d.address.toLowerCase()}`;
      const prev = by.get(k);
      if (!prev) by.set(k, { ...d });
      else by.set(k, { ...prev, raw: prev.raw + d.raw, usdHint: (prev.usdHint ?? 0) + (d.usdHint ?? 0) });
    }
  }
  const merged = [...by.values()];
  merged.sort((a, b) => (b.usdHint ?? 0) - (a.usdHint ?? 0));
  const per = new Map<number, number>();
  const capped: DiscoveredErc20[] = [];
  for (const d of merged) {
    const n = per.get(d.chainId) ?? 0;
    if (n >= 80 && !catalogKeys.has(`${d.chainId}:${d.address.toLowerCase()}`)) continue;
    per.set(d.chainId, n + 1);
    capped.push(d);
  }
  return { tokens: capped, failed: [...failed] };
}
