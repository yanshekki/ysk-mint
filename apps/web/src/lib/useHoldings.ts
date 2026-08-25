import { useEffect, useMemo, useState } from "react";
import { erc20Abi, formatUnits, type Address } from "viem";
import { useBalance, useReadContracts } from "wagmi";
import { cardanoByUnit, tokensFor, type TokenRecord } from "./tokenRegistry.ts";

export type HoldingRow = {
  id: string;
  symbol: string;
  name: string;
  icon: string;
  amount: string;
  raw: bigint;
  contract?: string;
  native?: boolean;
};

function fmt(raw: bigint, decimals: number) {
  const n = Number(formatUnits(raw, decimals));
  if (!Number.isFinite(n)) return formatUnits(raw, decimals);
  if (n === 0) return "0";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function row(token: TokenRecord, raw: bigint | null, connected: boolean): HoldingRow {
  return {
    id: token.id,
    symbol: token.symbol,
    name: token.name,
    icon: token.icon,
    amount: !connected || raw == null ? "—" : fmt(raw, token.decimals),
    raw: raw ?? 0n,
    contract: token.address,
    native: token.native,
  };
}

function sortHoldings(rows: HoldingRow[], connected: boolean) {
  if (!connected) return rows;
  return [...rows].sort((a, b) => {
    if (a.native !== b.native) return a.native ? -1 : 1;
    if ((a.raw > 0n) !== (b.raw > 0n)) return a.raw > 0n ? -1 : 1;
    return 0;
  });
}

export function useEvmHoldings(address: Address | undefined, chainId: number) {
  const catalog = useMemo(() => tokensFor("evm", chainId), [chainId]);
  const erc20s = catalog.filter((t) => t.address);
  const nativeMeta = catalog.find((t) => t.native);
  const connected = Boolean(address);

  const native = useBalance({
    address,
    chainId,
    query: { enabled: connected },
  });

  const erc = useReadContracts({
    contracts: erc20s.map((t) => ({
      address: t.address as Address,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: [address as Address],
      chainId,
    })),
    query: { enabled: connected && erc20s.length > 0 },
    allowFailure: true,
  });

  const rows = useMemo(() => {
    const out: HoldingRow[] = [];
    if (nativeMeta) {
      out.push(row(nativeMeta, connected ? (native.data?.value ?? null) : null, connected));
    }
    erc20s.forEach((t, i) => {
      const r = erc.data?.[i];
      const raw = r?.status === "success" && typeof r.result === "bigint" ? r.result : connected ? 0n : null;
      out.push(row(t, raw, connected));
    });
    return sortHoldings(out, connected);
  }, [catalog, connected, erc.data, erc20s, native.data?.value, nativeMeta]);

  const funded = rows.filter((r) => r.raw > 0n).length;
  return { rows, funded, loading: native.isLoading || erc.isLoading, catalogSize: catalog.length };
}

export function useNearHoldings(account: string) {
  const catalog = useMemo(() => tokensFor("near", 397), []);
  const [balances, setBalances] = useState<Record<string, bigint>>({});
  const [loading, setLoading] = useState(false);
  const connected = Boolean(account);

  useEffect(() => {
    if (!account) {
      setBalances({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const next: Record<string, bigint> = {};
      try {
        const acc = await nearRpc("query", {
          request_type: "view_account",
          finality: "final",
          account_id: account,
        });
        next["near-native"] = BigInt((acc.result as { amount?: string })?.amount ?? "0");
      } catch {
        next["near-native"] = 0n;
      }
      for (const t of catalog.filter((x) => x.address)) {
        try {
          const args = btoa(JSON.stringify({ account_id: account }));
          const res = await nearRpc("query", {
            request_type: "call_function",
            finality: "final",
            account_id: t.address,
            method_name: "ft_balance_of",
            args_base64: args,
          });
          const bytes = new Uint8Array((res.result as { result?: number[] })?.result ?? []);
          const text = new TextDecoder().decode(bytes).replace(/"/g, "");
          next[t.id] = BigInt(text || "0");
        } catch {
          next[t.id] = 0n;
        }
      }
      if (!cancelled) {
        setBalances(next);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [account, catalog]);

  const rows = useMemo(
    () => sortHoldings(catalog.map((t) => row(t, connected ? (balances[t.id] ?? 0n) : null, connected)), connected),
    [balances, catalog, connected],
  );
  return { rows, funded: rows.filter((r) => r.raw > 0n).length, loading, catalogSize: catalog.length };
}

export function useCardanoHoldings(address: string) {
  const catalog = useMemo(() => tokensFor("cardano", 1815), []);
  const [rows, setRows] = useState<HoldingRow[]>(() => catalog.map((t) => row(t, null, false)));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setRows(catalog.map((t) => row(t, null, false)));
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const next: HoldingRow[] = [];
      try {
        const infoRes = await fetch("https://api.koios.rest/api/v1/address_info", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ _addresses: [address] }),
        });
        const info = (await infoRes.json()) as Array<{ balance?: string }>;
        const ada = BigInt(info[0]?.balance ?? "0");
        const adaMeta = catalog.find((t) => t.native);
        if (adaMeta) next.push(row(adaMeta, ada, true));

        const assetRes = await fetch("https://api.koios.rest/api/v1/address_assets", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ _addresses: [address] }),
        });
        const assets = (await assetRes.json()) as Array<{
          policy_id?: string;
          asset_name?: string;
          quantity?: string;
          decimals?: number;
        }>;
        const seen = new Set<string>();
        for (const a of assets) {
          const unit = `${a.policy_id ?? ""}${a.asset_name ?? ""}`.toLowerCase();
          if (!unit) continue;
          seen.add(unit);
          const known = cardanoByUnit(unit);
          const raw = BigInt(a.quantity ?? "0");
          if (known) {
            next.push(row(known, raw, true));
          } else {
            const ticker = hexAscii(a.asset_name ?? "") || unit.slice(0, 8).toUpperCase();
            next.push({
              id: `ada-${unit}`,
              symbol: ticker,
              name: ticker,
              icon: "/tokens/ada.png",
              amount: fmt(raw, a.decimals ?? 0),
              raw,
              contract: unit,
            });
          }
        }
        for (const t of catalog) {
          if (t.native || (t.address && seen.has(t.address.toLowerCase()))) continue;
          next.push(row(t, 0n, true));
        }
      } catch {
        setRows(catalog.map((t) => row(t, 0n, true)));
        setLoading(false);
        return;
      }
      if (!cancelled) {
        setRows(sortHoldings(next, true));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, catalog]);

  const funded = rows.filter((r) => r.raw > 0n).length;
  return { rows, funded, loading, catalogSize: catalog.length };
}

function hexAscii(hex: string) {
  if (!hex || hex.length % 2) return "";
  try {
    const chars = hex.match(/.{2}/g)?.map((b) => String.fromCharCode(Number.parseInt(b, 16))) ?? [];
    const s = chars.join("");
    return /^[A-Za-z0-9._-]{1,32}$/.test(s) ? s : "";
  } catch {
    return "";
  }
}

async function nearRpc(method: string, params: unknown) {
  const res = await fetch("https://rpc.mainnet.near.org", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "1", method, params }),
  });
  return (await res.json()) as { result?: unknown };
}
