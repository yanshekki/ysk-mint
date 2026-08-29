import { useEffect, useMemo, useState } from "react";
import { nearRpc } from "../nearRpc.ts";
import { tokensFor, type TokenRecord } from "../tokenRegistry.ts";
import { syncLiveFlag, useLiveStatus } from "../liveStatus.ts";
import { addrList, row, sortHoldings } from "./shared.ts";

async function nearBalances(account: string, catalog: TokenRecord[]): Promise<Record<string, bigint>> {
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
  return next;
}

export function useNearHoldings(account: string | string[]) {
  const catalog = useMemo(() => tokensFor("near", 397), []);
  const [balances, setBalances] = useState<Record<string, bigint>>({});
  const [loading, setLoading] = useState(false);
  const accKey = Array.isArray(account) ? account.join("|") : account;
  const accounts = useMemo(() => addrList(account), [accKey]);
  const connected = accounts.length > 0;

  useEffect(() => {
    if (!accounts.length) {
      setBalances({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const parts = await Promise.all(accounts.map((a) => nearBalances(a, catalog)));
      const next: Record<string, bigint> = {};
      for (const p of parts) {
        for (const [k, v] of Object.entries(p)) next[k] = (next[k] ?? 0n) + v;
      }
      if (!cancelled) {
        setBalances(next);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accKey, accounts, catalog]);

  useEffect(() => {
    syncLiveFlag("holdings:397", 397, "holdings", connected && loading);
    return () => useLiveStatus.getState().finish("holdings:397", true);
  }, [connected, loading]);

  const rows = useMemo(
    () => sortHoldings(catalog.map((t) => row(t, connected ? (balances[t.id] ?? 0n) : null, connected)), connected),
    [balances, catalog, connected],
  );
  return { rows, funded: rows.filter((r) => r.raw > 0n).length, loading, catalogSize: catalog.length };
}
