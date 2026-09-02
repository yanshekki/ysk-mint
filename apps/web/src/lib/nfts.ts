import { useEffect, useMemo, useState } from "react";
import { CHAINS, featuredChains } from "@ysk-mint/config";
import { cacheGet, cacheKey, POLICIES } from "./defi/cache.ts";
import { DEAD_BLOCKSCOUT } from "./evmIndex.ts";
import { explorerUrl } from "./evmDiscover.ts";
import { outboundFetch } from "./outbound.ts";
import { trackLive } from "./liveStatus.ts";
import { useUserSettings } from "./userSettings.ts";

export type NftStd = "ERC-721" | "ERC-1155";

export type NftPiece = {
  id: string;
  tokenId: string;
  name: string;
  image?: string;
  qty: number;
  href: string;
};

export type NftSet = {
  id: string;
  chainId: number;
  chain: string;
  contract: string;
  name: string;
  symbol: string;
  std: NftStd;
  amount: number;
  icon?: string;
  href: string;
  pieces: NftPiece[];
  rest: number;
};

const PAGE_CAP = 8;
const PIECE_CAP = 24;
const SET_AMOUNT_CAP = 500;
const NFT_POLICY = { ...POLICIES.http, ttlMs: 120_000, staleMs: 600_000, scope: "account" as const };

type BsToken = {
  name?: string;
  symbol?: string;
  type?: string;
  address_hash?: string;
  address?: string;
  icon_url?: string | null;
};
type BsInst = {
  id?: string;
  image_url?: string | null;
  media_url?: string | null;
  animation_url?: string | null;
  value?: string;
  metadata?: { name?: string; image?: string; image_url?: string } | null;
  token?: BsToken;
};
type BsCol = { amount?: string | number; token?: BsToken; token_instances?: BsInst[] };
type BsPage<T> = { items?: T[]; next_page_params?: Record<string, unknown> | null };

function chainShort(chainId: number) {
  return Object.values(CHAINS).find((c) => c.chainId === chainId)?.short ?? String(chainId);
}

export function nftExplorerHost(chainId: number) {
  if (DEAD_BLOCKSCOUT.has(chainId) || chainId === 480) return;
  const base = explorerUrl(chainId);
  if (!base) return;
  if (base.includes("alchemy.com")) return;
  return base.replace(/\/$/, "");
}

export function nftIndexed(chainId: number) {
  return Boolean(nftExplorerHost(chainId));
}

function mediaUrl(raw?: string | null) {
  if (!raw) return;
  const s = raw.trim();
  if (!s) return;
  if (s.startsWith("data:")) return s.length > 180_000 ? undefined : s;
  if (s.startsWith("ipfs://")) {
    const path = s.slice(7).replace(/^ipfs\//, "");
    return path ? `https://ipfs.io/ipfs/${path}` : undefined;
  }
  if (s.startsWith("ar://")) return `https://arweave.net/${s.slice(5)}`;
  if (/^https?:\/\//i.test(s)) return s.startsWith("http://") ? `https://${s.slice(7)}` : s;
  return;
}

function instImage(inst: BsInst) {
  return mediaUrl(inst.image_url) || mediaUrl(inst.media_url) || mediaUrl(inst.metadata?.image_url) || mediaUrl(inst.metadata?.image);
}

function tokenAddr(tok?: BsToken) {
  const a = (tok?.address_hash || tok?.address || "").toLowerCase();
  return /^0x[a-f0-9]{40}$/.test(a) ? a : "";
}

function asStd(raw?: string): NftStd | undefined {
  const t = (raw || "").toUpperCase();
  if (t.includes("721")) return "ERC-721";
  if (t.includes("1155")) return "ERC-1155";
  return;
}

function explorerToken(chainId: number, contract: string, tokenId?: string) {
  const host = nftExplorerHost(chainId);
  if (!host) return `https://eth.blockscout.com/token/${contract}`;
  if (tokenId) return `${host}/token/${contract}/instance/${encodeURIComponent(tokenId)}`;
  return `${host}/token/${contract}`;
}

async function pageJson<T>(url: string, signal: AbortSignal): Promise<BsPage<T>> {
  const res = await outboundFetch(url, { signal, headers: { accept: "application/json" } });
  if (res.status === 404) return { items: [] };
  if (!res.ok) throw new Error(`nft ${res.status}`);
  return (await res.json()) as BsPage<T>;
}

function parseSet(chainId: number, col: BsCol): NftSet | null {
  const tok = col.token;
  const contract = tokenAddr(tok);
  const std = asStd(tok?.type);
  if (!contract || !std) return null;
  let amount = Number(col.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) amount = col.token_instances?.length ?? 0;
  if (amount <= 0 || amount > SET_AMOUNT_CAP) return null;
  const inst = col.token_instances ?? [];
  const pieces: NftPiece[] = [];
  for (const it of inst) {
    if (pieces.length >= PIECE_CAP) break;
    const tokenId = String(it.id ?? "");
    if (!tokenId) continue;
    const qty = Number(it.value || 1);
    const name = (it.metadata?.name || "").trim() || `#${tokenId.length > 12 ? `${tokenId.slice(0, 6)}…` : tokenId}`;
    pieces.push({
      id: `${chainId}:${contract}:${tokenId}`,
      tokenId,
      name,
      image: instImage(it),
      qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
      href: explorerToken(chainId, contract, tokenId),
    });
  }
  const name = (tok?.name || tok?.symbol || "NFT").slice(0, 64);
  return {
    id: `${chainId}:${contract}`,
    chainId,
    chain: chainShort(chainId),
    contract,
    name,
    symbol: (tok?.symbol || "").slice(0, 24),
    std,
    amount: Math.max(amount, pieces.length),
    icon: mediaUrl(tok?.icon_url) || pieces.find((p) => p.image)?.image,
    href: explorerToken(chainId, contract),
    pieces,
    rest: Math.max(0, Math.floor(amount) - pieces.length),
  };
}

const NFT_FIRST = [1, 10, 42161, 137];

async function fetchChainNfts(chainId: number, user: string, onPartial?: (sets: NftSet[]) => void): Promise<NftSet[]> {
  const host = nftExplorerHost(chainId);
  if (!host) return [];
  const addr = user.toLowerCase();
  return cacheGet(
    { key: cacheKey("hold.nft", chainId, addr, "col"), policy: { ...NFT_POLICY, account: addr } },
    async () => {
      const out: NftSet[] = [];
      let query = "?type=ERC-721,ERC-1155";
      for (let i = 0; i < PAGE_CAP; i++) {
        const ctrl = new AbortController();
        const timer = globalThis.setTimeout(() => ctrl.abort(), 22000);
        try {
          const page = await pageJson<BsCol>(`${host}/api/v2/addresses/${addr}/nft/collections${query}`, ctrl.signal);
          for (const col of page.items ?? []) {
            const set = parseSet(chainId, col);
            if (set) out.push(set);
          }
          onPartial?.(out);
          const next = page.next_page_params;
          if (!next || !Object.keys(next).length) break;
          const qs = new URLSearchParams();
          qs.set("type", "ERC-721,ERC-1155");
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

export function useAddressNfts(addresses: string[], enabled: boolean) {
  const addrKey = addresses.filter(Boolean).join("|").toLowerCase();
  const addrs = useMemo(() => addresses.filter((a) => /^0x[a-fA-F0-9]{40}$/.test(a)), [addrKey]);
  const disabledChains = useUserSettings((s) => s.disabledChains);
  const chainIds = useMemo(() => {
    const rank = (id: number) => {
      const i = NFT_FIRST.indexOf(id);
      return i < 0 ? 50 + id : i;
    };
    return featuredChains()
      .filter((c) => c.evm && !c.testnet && nftIndexed(c.chainId) && !disabledChains.includes(c.chainId))
      .map((c) => c.chainId)
      .sort((a, b) => rank(a) - rank(b));
  }, [disabledChains]);
  const [sets, setSets] = useState<NftSet[]>([]);
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSets([]);
    setFailed(new Set());
  }, [addrKey]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (!addrs.length || !chainIds.length) {
      setSets([]);
      setFailed(new Set());
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const next: NftSet[] = [];
    const fail = new Set<number>();
    const publish = () => {
      if (cancelled) return;
      next.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
      setSets([...next]);
      setFailed(new Set(fail));
    };
    const scan = (id: number) =>
      trackLive(`nft:${id}`, id, "nft", async () => {
        const snap = new Map<string, NftSet[]>();
        const flush = () => {
          const by = new Map<string, NftSet>();
          for (const list of snap.values()) {
            for (const s of list) {
              const prev = by.get(s.id);
              if (!prev) by.set(s.id, { ...s, pieces: [...s.pieces] });
              else {
                prev.amount += s.amount;
                prev.rest += s.rest;
                const seen = new Set(prev.pieces.map((p) => p.id));
                for (const p of s.pieces) {
                  if (seen.has(p.id) || prev.pieces.length >= PIECE_CAP) continue;
                  prev.pieces.push(p);
                  seen.add(p.id);
                }
              }
            }
          }
          for (let i = next.length - 1; i >= 0; i--) if (next[i]!.chainId === id) next.splice(i, 1);
          next.push(...by.values());
          publish();
        };
        const parts = await Promise.all(
          addrs.map(async (a) => {
            try {
              const list = await fetchChainNfts(id, a, (partial) => {
                snap.set(a, partial.map((s) => ({ ...s, pieces: [...s.pieces] })));
                flush();
              });
              snap.set(a, list.map((s) => ({ ...s, pieces: [...s.pieces] })));
              flush();
              return list;
            } catch {
              return null;
            }
          }),
        );
        if (parts.every((p) => p == null)) throw new Error("nft fail");
      }).catch(() => {
        fail.add(id);
        publish();
      });

    void (async () => {
      const head = chainIds.filter((id) => NFT_FIRST.includes(id));
      const tail = chainIds.filter((id) => !NFT_FIRST.includes(id));
      await Promise.all([
        ...head.map(scan),
        (async () => {
          if (!tail.length) return;
          await new Promise((r) => globalThis.setTimeout(r, 600));
          if (!cancelled) await Promise.all(tail.map(scan));
        })(),
      ]);
      if (cancelled) return;
      publish();
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, addrKey, addrs, chainIds]);

  const pieceCount = (chainId: number | "all") => {
    const list = chainId === "all" ? sets : sets.filter((s) => s.chainId === chainId);
    return list.reduce((n, s) => n + s.amount, 0);
  };
  const setCount = (chainId: number | "all") => (chainId === "all" ? sets.length : sets.filter((s) => s.chainId === chainId).length);

  return { sets, loading, failed, pieceCount, setCount };
}
