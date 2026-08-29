import { useEffect, useState } from "react";
import { featuredChains } from "@ysk-mint/config";
import { formatUnits } from "viem";
import { syncLiveFlag, useLiveStatus } from "../liveStatus.ts";
import type { TokenRecord } from "../tokenRegistry.ts";

export type HoldingRow = {
  id: string;
  symbol: string;
  name: string;
  icon: string;
  amount: string;
  raw: bigint;
  contract?: string;
  native?: boolean;
  chainTag?: string;
  chainId?: number;
  decimals?: number;
};

export type BalHit = { raw: bigint; decimals?: number; symbol?: string; name?: string; icon?: string; contract?: string };

export const CHAIN_TAG: Record<number, string> = Object.fromEntries(featuredChains().map((c) => [c.chainId, c.short]));

export function fmt(raw: bigint, decimals: number) {
  const n = Number(formatUnits(raw, decimals));
  if (!Number.isFinite(n)) return formatUnits(raw, decimals);
  if (n === 0) return "0";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export function row(token: TokenRecord, raw: bigint | null, connected: boolean): HoldingRow {
  return {
    id: token.id,
    symbol: token.symbol,
    name: token.name,
    icon: token.icon,
    amount: !connected || raw == null ? "—" : fmt(raw, token.decimals),
    raw: raw ?? 0n,
    contract: token.address,
    native: token.native,
    chainTag: CHAIN_TAG[token.chainId],
    chainId: token.chainId,
    decimals: token.decimals,
  };
}

export function sortHoldings(rows: HoldingRow[], connected: boolean) {
  const list = connected ? rows.filter((r) => r.native || r.raw > 0n) : rows.filter((r) => r.native);
  return [...list].sort((a, b) => {
    if ((a.raw > 0n) !== (b.raw > 0n)) return a.raw > 0n ? -1 : 1;
    if (a.native !== b.native) return a.native ? -1 : 1;
    return (a.chainTag ?? "").localeCompare(b.chainTag ?? "");
  });
}

export function addrList(v: string | string[] | undefined | null): string[] {
  if (!v) return [];
  const arr = Array.isArray(v) ? v : [v];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of arr) {
    const s = raw.trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

export function mergeBals(maps: Array<Map<string, BalHit>>): Map<string, BalHit> {
  const out = new Map<string, BalHit>();
  for (const m of maps) {
    for (const [k, v] of m) {
      const prev = out.get(k);
      if (!prev) out.set(k, { ...v });
      else out.set(k, { ...prev, raw: prev.raw + v.raw });
    }
  }
  return out;
}

export function hexAscii(hex: string) {
  if (!hex || hex.length % 2) return "";
  try {
    const chars = hex.match(/.{2}/g)?.map((b) => String.fromCharCode(Number.parseInt(b, 16))) ?? [];
    const s = chars.join("");
    return /^[A-Za-z0-9._-]{1,32}$/.test(s) ? s : "";
  } catch {
    return "";
  }
}

export function useJsonHoldings(
  chainId: number,
  catalog: TokenRecord[],
  connected: boolean,
  load: () => Promise<Map<string, BalHit>>,
) {
  const [rows, setRows] = useState<HoldingRow[]>(() => catalog.map((t) => row(t, null, false)));
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!connected) {
      setRows(catalog.map((t) => row(t, null, false)));
      return;
    }
    let cancelled = false;
    setLoading(true);
    void load()
      .then((bal) => {
        if (cancelled) return;
        const next: HoldingRow[] = [];
        const seen = new Set<string>();
        for (const t of catalog) {
          const hit = t.native ? bal.get("native") : t.address ? (bal.get(t.address) ?? bal.get(t.address.toLowerCase())) : undefined;
          if (t.address) seen.add(t.address);
          next.push(row(t, hit?.raw ?? 0n, true));
        }
        for (const [k, v] of bal) {
          if (k === "native" || seen.has(k) || seen.has(k.toLowerCase()) || v.raw === 0n) continue;
          next.push({
            id: `${chainId}-${k}`,
            symbol: v.symbol || k.slice(0, 6).toUpperCase(),
            name: v.name || v.symbol || k,
            icon: v.icon || catalog[0]?.icon || "/tokens/eth.png",
            amount: fmt(v.raw, v.decimals ?? 0),
            raw: v.raw,
            contract: v.contract ?? k,
            chainTag: CHAIN_TAG[chainId],
            chainId,
          });
        }
        setRows(sortHoldings(next, true));
      })
      .catch(() => {
        if (!cancelled) setRows(catalog.map((t) => row(t, null, true)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [catalog, chainId, connected, load]);
  useEffect(() => {
    syncLiveFlag(`holdings:${chainId}`, chainId, "holdings", connected && loading);
    return () => useLiveStatus.getState().finish(`holdings:${chainId}`, true);
  }, [chainId, connected, loading]);
  return { rows, funded: rows.filter((r) => r.raw > 0n).length, loading, catalogSize: catalog.length };
}
