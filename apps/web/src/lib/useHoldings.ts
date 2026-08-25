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
  chainTag?: string;
};

const CHAIN_TAG: Record<number, string> = {
  1: "ETH",
  8453: "Base",
  42161: "Arb",
  56: "BNB",
  43114: "AVAX",
  397: "NEAR",
  1815: "ADA",
  101: "SOL",
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
    chainTag: CHAIN_TAG[token.chainId],
  };
}

function sortHoldings(rows: HoldingRow[], connected: boolean) {
  if (!connected) return rows;
  return [...rows].sort((a, b) => {
    if ((a.raw > 0n) !== (b.raw > 0n)) return a.raw > 0n ? -1 : 1;
    if (a.native !== b.native) return a.native ? -1 : 1;
    return (a.chainTag ?? "").localeCompare(b.chainTag ?? "");
  });
}

export function useEvmHoldings(address: Address | undefined) {
  const catalog = useMemo(() => tokensFor("evm"), []);
  const erc20s = catalog.filter((t) => t.address);
  const natives = catalog.filter((t) => t.native);
  const connected = Boolean(address);

  const eth = useBalance({ address, chainId: 1, query: { enabled: connected } });
  const base = useBalance({ address, chainId: 8453, query: { enabled: connected } });
  const arb = useBalance({ address, chainId: 42161, query: { enabled: connected } });
  const bnb = useBalance({ address, chainId: 56, query: { enabled: connected } });
  const avax = useBalance({ address, chainId: 43114, query: { enabled: connected } });

  const nativeByChain: Record<number, bigint | undefined> = {
    1: eth.data?.value,
    8453: base.data?.value,
    42161: arb.data?.value,
    56: bnb.data?.value,
    43114: avax.data?.value,
  };

  const erc = useReadContracts({
    contracts: erc20s.map((t) => ({
      address: t.address as Address,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: [address as Address],
      chainId: t.chainId,
    })),
    query: { enabled: connected && erc20s.length > 0 },
    allowFailure: true,
  });

  const rows = useMemo(() => {
    const out: HoldingRow[] = [];
    for (const t of natives) {
      const raw = connected ? (nativeByChain[t.chainId] ?? null) : null;
      out.push(row(t, raw, connected));
    }
    erc20s.forEach((t, i) => {
      const r = erc.data?.[i];
      const raw = r?.status === "success" && typeof r.result === "bigint" ? r.result : connected ? 0n : null;
      out.push(row(t, raw, connected));
    });
    return sortHoldings(out, connected);
  }, [catalog, connected, erc.data, erc20s, natives, eth.data?.value, base.data?.value, arb.data?.value, bnb.data?.value, avax.data?.value]);

  const funded = rows.filter((r) => r.raw > 0n).length;
  const loading = eth.isLoading || base.isLoading || arb.isLoading || bnb.isLoading || avax.isLoading || erc.isLoading;
  return { rows, funded, loading, catalogSize: catalog.length };
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

type CardanoAsset = {
  policy_id?: string;
  asset_policy?: string;
  asset_name?: string;
  quantity?: string;
  decimals?: number;
  asset_list?: CardanoAsset[];
};

function flattenCardanoAssets(raw: unknown): CardanoAsset[] {
  if (!Array.isArray(raw)) return [];
  const out: CardanoAsset[] = [];
  for (const item of raw as CardanoAsset[]) {
    if (Array.isArray(item.asset_list)) out.push(...item.asset_list);
    else out.push(item);
  }
  return out;
}

function cardanoUnit(a: CardanoAsset) {
  return `${a.policy_id ?? a.asset_policy ?? ""}${a.asset_name ?? ""}`.toLowerCase();
}

async function koiosPost(path: string, body: unknown) {
  const res = await fetch(`https://api.koios.rest/api/v1/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`koios ${path}`);
  return res.json() as Promise<unknown>;
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function useCardanoHoldings(address: string, extras?: { addresses?: string[]; stake?: string }) {
  const catalog = useMemo(() => tokensFor("cardano", 1815), []);
  const [rows, setRows] = useState<HoldingRow[]>(() => catalog.map((t) => row(t, null, false)));
  const [loading, setLoading] = useState(false);
  const stake = extras?.stake ?? "";
  const payments = extras?.addresses?.filter(Boolean) ?? [];
  const addrKey = [address, stake, ...payments].join("|");

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
        let ada = 0n;
        let assets: CardanoAsset[] = [];
        if (stake.startsWith("stake")) {
          const info = (await koiosPost("account_info", { _stake_addresses: [stake] })) as Array<{
            total_balance?: string;
            utxo?: string;
          }>;
          ada = BigInt(info[0]?.total_balance ?? info[0]?.utxo ?? "0");
          assets = flattenCardanoAssets(await koiosPost("account_assets", { _stake_addresses: [stake] }));
        } else {
          const addrs = Array.from(new Set([address, ...payments].filter(Boolean)));
          for (const group of chunk(addrs, 50)) {
            const info = (await koiosPost("address_info", { _addresses: group })) as Array<{ balance?: string }>;
            for (const rowInfo of info) ada += BigInt(rowInfo.balance ?? "0");
            assets.push(...flattenCardanoAssets(await koiosPost("address_assets", { _addresses: group })));
          }
        }

        const adaMeta = catalog.find((t) => t.native);
        if (adaMeta) next.push(row(adaMeta, ada, true));

        const qty = new Map<string, { raw: bigint; decimals: number }>();
        for (const a of assets) {
          const unit = cardanoUnit(a);
          if (!unit) continue;
          const raw = BigInt(a.quantity ?? "0");
          const prev = qty.get(unit);
          qty.set(unit, { raw: (prev?.raw ?? 0n) + raw, decimals: a.decimals ?? prev?.decimals ?? 0 });
        }

        const seen = new Set<string>();
        for (const [unit, bal] of qty) {
          seen.add(unit);
          const known = cardanoByUnit(unit);
          if (known) {
            next.push(row(known, bal.raw, true));
          } else {
            const ticker = hexAscii(unit.slice(56)) || unit.slice(0, 8).toUpperCase();
            next.push({
              id: `ada-${unit}`,
              symbol: ticker,
              name: ticker,
              icon: "/tokens/ada.png",
              amount: fmt(bal.raw, bal.decimals),
              raw: bal.raw,
              contract: unit,
              chainTag: "ADA",
            });
          }
        }
        for (const t of catalog) {
          if (t.native || (t.address && seen.has(t.address.toLowerCase()))) continue;
          next.push(row(t, 0n, true));
        }
      } catch {
        if (!cancelled) {
          setRows(catalog.map((t) => row(t, 0n, true)));
          setLoading(false);
        }
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
  }, [address, addrKey, catalog]);

  const funded = rows.filter((r) => r.raw > 0n).length;
  return { rows, funded, loading, catalogSize: catalog.length };
}

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

export function useSolanaHoldings(address: string) {
  const catalog = useMemo(() => tokensFor("solana", 101), []);
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
      try {
        const tokenReq = (id: number, programId: string) =>
          fetch("https://api.mainnet-beta.solana.com", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id,
              method: "getTokenAccountsByOwner",
              params: [address, { programId }, { encoding: "jsonParsed" }],
            }),
          });
        const [balRes, tokRes, tok2022Res] = await Promise.all([
          fetch("https://api.mainnet-beta.solana.com", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [address] }),
          }),
          tokenReq(2, TOKEN_PROGRAM),
          tokenReq(3, TOKEN_2022_PROGRAM),
        ]);
        const balJson = (await balRes.json()) as { result?: { value?: number } };
        type TokJson = {
          result?: { value?: Array<{ account?: { data?: { parsed?: { info?: { mint?: string; tokenAmount?: { amount?: string } } } } } }> };
        };
        const tokJson = (await tokRes.json()) as TokJson;
        const tok2022Json = (await tok2022Res.json()) as TokJson;
        const byMint = new Map<string, bigint>();
        for (const v of [...(tokJson.result?.value ?? []), ...(tok2022Json.result?.value ?? [])]) {
          const info = v.account?.data?.parsed?.info;
          if (!info?.mint) continue;
          byMint.set(info.mint, (byMint.get(info.mint) ?? 0n) + BigInt(info.tokenAmount?.amount ?? "0"));
        }
        if (cancelled) return;
        setRows(
          sortHoldings(
            catalog.map((t) => {
              const raw = t.native ? BigInt(balJson.result?.value ?? 0) : (byMint.get(t.address ?? "") ?? 0n);
              return row(t, raw, true);
            }),
            true,
          ),
        );
      } catch {
        if (!cancelled) setRows(catalog.map((t) => row(t, 0n, true)));
      } finally {
        if (!cancelled) setLoading(false);
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
