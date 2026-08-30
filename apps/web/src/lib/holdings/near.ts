import { useEffect, useMemo, useState } from "react";
import { nearRpc } from "../nearRpc.ts";
import { tokensFor, type TokenRecord } from "../tokenRegistry.ts";
import { syncLiveFlag, useLiveStatus } from "../liveStatus.ts";
import { addrList, row, sortHoldings } from "./shared.ts";

async function nearBalances(account: string, catalog: TokenRecord[]): Promise<Record<string, bigint>> {
  const next: Record<string, bigint> = {};
  const acc = await nearRpc("query", {
    request_type: "view_account",
    finality: "final",
    account_id: account,
  });
  next["near-native"] = BigInt((acc.result as { amount?: string })?.amount ?? "0");
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
      /* skip failed FT — omit key so UI shows "—" not 0 */
    }
  }
  return next;
}

export function useNearHoldings(account: string | string[]) {
  const catalog = useMemo(() => tokensFor("near", 397), []);
  const [balances, setBalances] = useState<Record<string, bigint>>({});
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const accKey = Array.isArray(account) ? account.join("|") : account;
  const accounts = useMemo(() => addrList(account), [accKey]);
  const connected = accounts.length > 0;

  useEffect(() => {
    if (!accounts.length) {
      setBalances({});
      setFailed(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    void (async () => {
      try {
        const parts = await Promise.all(accounts.map((a) => nearBalances(a, catalog)));
        const next: Record<string, bigint> = {};
        for (const p of parts) {
          for (const [k, v] of Object.entries(p)) next[k] = (next[k] ?? 0n) + v;
        }
        if (!cancelled) {
          setBalances(next);
          setFailed(false);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setBalances({});
          setFailed(true);
          setLoading(false);
        }
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
    () =>
      sortHoldings(
        catalog.map((t) => {
          if (!connected) return row(t, null, false);
          if (failed) return row(t, null, true);
          return row(t, t.id in balances ? balances[t.id] : null, true);
        }),
        connected,
      ),
    [balances, catalog, connected, failed],
  );
  return { rows, funded: rows.filter((r) => r.raw > 0n).length, loading, catalogSize: catalog.length };
}
