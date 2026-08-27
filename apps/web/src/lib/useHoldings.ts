import { useEffect, useMemo, useState } from "react";
import { featuredChains } from "@ysk-mint/config";
import { syncLiveFlag, useLiveStatus } from "./liveStatus.ts";
import { erc20Abi, formatUnits, type Address } from "viem";
import { useConfig, useReadContracts } from "wagmi";
import { getBalance } from "wagmi/actions";
import { accountCache, cacheGet, cacheHash, cacheKey, POLICIES } from "./defi/cache.ts";
import { cipEpochNow, readCardanoValue, stakeFromPayment, subscribeCip } from "./cardanoCip30.ts";
import { koiosPost } from "./koios.ts";
import { nearRpc } from "./nearRpc.ts";
import { cardanoByUnit, solByMint, tokensFor, type TokenRecord } from "./tokenRegistry.ts";

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
};

const CHAIN_TAG: Record<number, string> = Object.fromEntries(featuredChains().map((c) => [c.chainId, c.short]));

const EVM_HOLD_IDS = featuredChains()
  .filter((c) => c.evm && !c.testnet)
  .map((c) => c.chainId);

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
    chainId: token.chainId,
  };
}

function sortHoldings(rows: HoldingRow[], connected: boolean) {
  const list = connected ? rows.filter((r) => r.native || r.raw > 0n) : rows.filter((r) => r.native);
  return [...list].sort((a, b) => {
    if ((a.raw > 0n) !== (b.raw > 0n)) return a.raw > 0n ? -1 : 1;
    if (a.native !== b.native) return a.native ? -1 : 1;
    return (a.chainTag ?? "").localeCompare(b.chainTag ?? "");
  });
}

const BALANCE_QUERY = { staleTime: 30_000, refetchOnWindowFocus: false as const, retry: 1 };

export function useEvmHoldings(address: Address | undefined) {
  const catalog = useMemo(() => tokensFor("evm"), []);
  const erc20s = useMemo(() => catalog.filter((t) => t.address), [catalog]);
  const natives = useMemo(() => catalog.filter((t) => t.native), [catalog]);
  const connected = Boolean(address);
  const config = useConfig();
  const [nativeByChain, setNativeByChain] = useState<Record<number, bigint>>({});
  const [nativeLoading, setNativeLoading] = useState(false);
  const contracts = useMemo(
    () =>
      erc20s.map((t) => ({
        address: t.address as Address,
        abi: erc20Abi,
        functionName: "balanceOf" as const,
        args: [(address ?? "0x0000000000000000000000000000000000000000") as Address] as const,
        chainId: t.chainId,
      })),
    [address, erc20s],
  );

  useEffect(() => {
    if (!address) {
      setNativeByChain({});
      setNativeLoading(false);
      return;
    }
    let cancelled = false;
    setNativeLoading(true);
    void (async () => {
      const next: Record<number, bigint> = {};
      let i = 0;
      const ids = EVM_HOLD_IDS;
      const workers = Array.from({ length: Math.min(3, ids.length) }, async () => {
        while (i < ids.length) {
          const id = ids[i++];
          if (id == null) break;
          useLiveStatus.getState().start(`holdings:${id}`, id, "holdings", "run");
          try {
            const value = await accountCache("hold.native", id, address, "bal", async () => {
              const b = await getBalance(config, { address, chainId: id });
              return b.value;
            });
            next[id] = value;
            useLiveStatus.getState().finish(`holdings:${id}`, true);
          } catch {
            useLiveStatus.getState().finish(`holdings:${id}`, false);
          }
        }
      });
      await Promise.all(workers);
      if (!cancelled) {
        setNativeByChain({ ...next });
        setNativeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, config]);

  const erc = useReadContracts({
    contracts,
    query: { enabled: connected && contracts.length > 0, ...BALANCE_QUERY },
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
  }, [connected, erc.data, erc20s, natives, nativeByChain]);

  const funded = rows.filter((r) => r.raw > 0n).length;
  const loading = nativeLoading || erc.isLoading;
  useEffect(() => {
    if (!connected || !erc.isLoading) return;
    for (const id of EVM_HOLD_IDS) syncLiveFlag(`holdings:${id}:erc`, id, "holdings", true);
    return () => {
      for (const id of EVM_HOLD_IDS) useLiveStatus.getState().finish(`holdings:${id}:erc`, true);
    };
  }, [connected, erc.isLoading]);
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

  useEffect(() => {
    syncLiveFlag("holdings:397", 397, "holdings", Boolean(account) && loading);
    return () => useLiveStatus.getState().finish("holdings:397", true);
  }, [account, loading]);

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

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function rowsFromCardano(
  catalog: TokenRecord[],
  ada: bigint,
  qty: Map<string, { raw: bigint; decimals: number }>,
): HoldingRow[] {
  const next: HoldingRow[] = [];
  const adaMeta = catalog.find((t) => t.native);
  if (adaMeta) next.push(row(adaMeta, ada, true));
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
        chainId: 1815,
      });
    }
  }
  for (const t of catalog) {
    if (t.native || (t.address && seen.has(t.address.toLowerCase()))) continue;
    next.push(row(t, 0n, true));
  }
  return sortHoldings(next, true);
}

export function useCardanoHoldings(
  address: string,
  extras?: { addresses?: string[]; stake?: string; sync?: number },
) {
  const catalog = useMemo(() => tokensFor("cardano", 1815), []);
  const [rows, setRows] = useState<HoldingRow[]>(() => catalog.map((t) => row(t, null, false)));
  const [loading, setLoading] = useState(false);
  const [cipTick, setCipTick] = useState(0);
  const stake = extras?.stake || (address ? stakeFromPayment(address) : "");
  const payKey = (extras?.addresses ?? []).filter(Boolean).join("|");
  const addrKey = [address, stake, extras?.sync ?? 0, payKey].join("|");

  useEffect(() => subscribeCip(() => setCipTick(cipEpochNow())), []);

  useEffect(() => {
    if (!address) {
      setRows(catalog.map((t) => row(t, null, false)));
      return;
    }
    let cancelled = false;
    setLoading(true);
    const payments = payKey ? payKey.split("|") : [];
    void (async () => {
      try {
        for (const wait of [0, 500, 1500]) {
          if (wait) await new Promise((r) => window.setTimeout(r, wait));
          if (cancelled) return;
          const cip = await readCardanoValue();
          if (!cip) continue;
          const qty = new Map<string, { raw: bigint; decimals: number }>();
          for (const [unit, raw] of cip.assets) {
            const known = cardanoByUnit(unit);
            qty.set(unit, { raw, decimals: known?.decimals ?? 0 });
          }
          if (!cancelled) setRows(rowsFromCardano(catalog, cip.ada, qty));
          return;
        }

        let ada = 0n;
        let assets: CardanoAsset[] = [];
        if (stake.startsWith("stake")) {
          const info = (await koiosPost("account_info", { _stake_addresses: [stake] })) as Array<{
            total_balance?: string;
            utxo?: string;
          }>;
          ada = BigInt(info[0]?.utxo ?? info[0]?.total_balance ?? "0");
          assets = flattenCardanoAssets(await koiosPost("account_assets", { _stake_addresses: [stake] }));
        } else {
          const addrs = Array.from(new Set([address, ...payments].filter(Boolean)));
          for (const group of chunk(addrs, 50)) {
            const info = (await koiosPost("address_info", { _addresses: group })) as Array<{ balance?: string }>;
            for (const rowInfo of info) ada += BigInt(rowInfo.balance ?? "0");
            assets.push(...flattenCardanoAssets(await koiosPost("address_assets", { _addresses: group })));
          }
        }
        const qty = new Map<string, { raw: bigint; decimals: number }>();
        for (const a of assets) {
          const unit = cardanoUnit(a);
          if (!unit) continue;
          const raw = BigInt(a.quantity ?? "0");
          const prev = qty.get(unit);
          qty.set(unit, { raw: (prev?.raw ?? 0n) + raw, decimals: a.decimals ?? prev?.decimals ?? 0 });
        }
        if (!cancelled) setRows(rowsFromCardano(catalog, ada, qty));
      } catch {
        if (!cancelled) {
          setRows((prev) => (prev.some((r) => r.raw > 0n) ? prev : catalog.map((t) => row(t, null, true))));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, addrKey, catalog, stake, payKey, cipTick]);

  const funded = rows.filter((r) => r.raw > 0n).length;
  useEffect(() => {
    syncLiveFlag("holdings:1815", 1815, "holdings", Boolean(address) && loading);
    return () => useLiveStatus.getState().finish("holdings:1815", true);
  }, [address, loading]);
  return { rows, funded, loading, catalogSize: catalog.length };
}

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
/** leorpc first: publicnode 403s getTokenAccountsByOwner from browsers. */
const SOLANA_RPCS = [
  "https://solana.leorpc.com/?api_key=FREE",
  "https://solana-rpc.publicnode.com",
  "https://solana.publicnode.com",
  "https://api.mainnet-beta.solana.com",
];

type SolTokJson = {
  result?: {
    value?: Array<{
      account?: { data?: { parsed?: { info?: { mint?: string; tokenAmount?: { amount?: string; decimals?: number } } } } };
    }>;
  };
  error?: unknown;
};

async function solMintMeta(mint: string): Promise<{ symbol: string; name: string } | null> {
  try {
    const res = await fetch(`https://lite-api.jup.ag/tokens/v1/token/${mint}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { symbol?: string; name?: string };
    if (!json.symbol) return null;
    return { symbol: json.symbol, name: json.name || json.symbol };
  } catch {
    return null;
  }
}

async function solanaCall<T>(url: string, body: unknown): Promise<T | null> {
  return cacheGet(
    {
      key: cacheKey("hold.sol", 101, cacheHash(`${url}|${JSON.stringify(body)}`)),
      policy: POLICIES.account,
    },
    async () => {
      const ctrl = new AbortController();
      const timer = window.setTimeout(() => ctrl.abort(), 10000);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        if (!res.ok) return null;
        return (await res.json()) as T;
      } catch {
        return null;
      } finally {
        window.clearTimeout(timer);
      }
    },
  );
}

function collectMints(json: SolTokJson | null, into: Map<string, { raw: bigint; decimals: number }>) {
  for (const v of json?.result?.value ?? []) {
    const info = v.account?.data?.parsed?.info;
    if (!info?.mint) continue;
    const raw = BigInt(info.tokenAmount?.amount ?? "0");
    const prev = into.get(info.mint);
    into.set(info.mint, {
      raw: (prev?.raw ?? 0n) + raw,
      decimals: info.tokenAmount?.decimals ?? prev?.decimals ?? 0,
    });
  }
}

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
        let lamports: number | null = null;
        const byMint = new Map<string, { raw: bigint; decimals: number }>();
        for (const url of SOLANA_RPCS) {
          const balJson = await solanaCall<{ result?: { value?: number }; error?: unknown }>(url, {
            jsonrpc: "2.0",
            id: 1,
            method: "getBalance",
            params: [address],
          });
          if (balJson && !balJson.error && typeof balJson.result?.value === "number") {
            lamports = balJson.result.value;
          }
          const tokenParams = (programId: string) => [address, { programId }, { encoding: "jsonParsed" as const }];
          collectMints(
            await solanaCall<SolTokJson>(url, {
              jsonrpc: "2.0",
              id: 2,
              method: "getTokenAccountsByOwner",
              params: tokenParams(TOKEN_PROGRAM),
            }),
            byMint,
          );
          collectMints(
            await solanaCall<SolTokJson>(url, {
              jsonrpc: "2.0",
              id: 3,
              method: "getTokenAccountsByOwner",
              params: tokenParams(TOKEN_2022_PROGRAM),
            }),
            byMint,
          );
          if (lamports != null && byMint.size > 0) break;
        }
        if (lamports == null && byMint.size === 0) throw new Error("solana rpc");
        if (cancelled) return;
        const next = catalog.map((t) => {
          const raw = t.native ? BigInt(lamports ?? 0) : (byMint.get(t.address ?? "")?.raw ?? 0n);
          return row(t, raw, true);
        });
        const known = new Set(catalog.map((t) => t.address).filter(Boolean));
        const extras = [...byMint.entries()].filter(([mint, bal]) => !known.has(mint) && bal.raw > 0n);
        const meta = await Promise.all(extras.map(([mint]) => solMintMeta(mint)));
        extras.forEach(([mint, bal], i) => {
          const listed = solByMint(mint);
          const info = meta[i];
          next.push({
            id: `sol-${mint}`,
            symbol: listed?.symbol || info?.symbol || mint.slice(0, 4).toUpperCase(),
            name: listed?.name || info?.name || mint,
            icon: listed?.icon || "/tokens/sol.png",
            amount: fmt(bal.raw, bal.decimals),
            raw: bal.raw,
            contract: mint,
            chainTag: "SOL",
            chainId: 101,
          });
        });
        setRows(sortHoldings(next, true));
      } catch {
        if (!cancelled) setRows(catalog.map((t) => row(t, null, true)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, catalog]);

  const funded = rows.filter((r) => r.raw > 0n).length;
  useEffect(() => {
    syncLiveFlag("holdings:101", 101, "holdings", Boolean(address) && loading);
    return () => useLiveStatus.getState().finish("holdings:101", true);
  }, [address, loading]);
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

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  return cacheGet(
    {
      key: cacheKey("hold.http", 0, cacheHash(`${url}|${typeof init?.body === "string" ? init.body : ""}`)),
      policy: POLICIES.account,
    },
    async () => {
      const r = await fetch(url, init);
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<T>;
    },
  );
}

function useJsonHoldings(
  chainId: number,
  catalog: TokenRecord[],
  connected: boolean,
  load: () => Promise<Map<string, { raw: bigint; decimals?: number; symbol?: string; name?: string; icon?: string; contract?: string }>>,
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
          const hit = t.native ? bal.get("native") : t.address ? bal.get(t.address) ?? bal.get(t.address.toLowerCase()) : undefined;
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

export function useHyperCoreHoldings(address: string | undefined) {
  const catalog = useMemo(() => tokensFor("hypercore", 998), []);
  const connected = Boolean(address);
  const load = useMemo(() => {
    const user = address;
    return async () => {
      const out = new Map<string, { raw: bigint; decimals?: number; symbol?: string; name?: string; icon?: string; contract?: string }>();
      if (!user) return out;
      const [state, meta] = await Promise.all([
        jsonFetch<{ balances?: Array<{ coin: string; total: string; token?: number }> }>("https://api.hyperliquid.xyz/info", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "spotClearinghouseState", user }),
        }),
        jsonFetch<{ tokens?: Array<{ name: string; weiDecimals: number; szDecimals: number; tokenId?: string }> }>(
          "https://api.hyperliquid.xyz/info",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ type: "spotMeta" }),
          },
        ),
      ]);
      const dec = new Map((meta.tokens ?? []).map((t) => [t.name, t.weiDecimals ?? t.szDecimals ?? 8]));
      for (const b of state.balances ?? []) {
        const decimals = dec.get(b.coin) ?? 8;
        const n = Number(b.total);
        if (!Number.isFinite(n) || n <= 0) continue;
        const raw = BigInt(Math.round(n * 10 ** Math.min(decimals, 8)));
        const rec = { raw, decimals: Math.min(decimals, 8), symbol: b.coin, name: b.coin, icon: "/tokens/hype.png", contract: b.coin };
        if (b.coin === "HYPE" || b.coin === "UBTC") out.set(b.coin === "HYPE" ? "native" : b.coin, rec);
        else out.set(b.coin, rec);
      }
      return out;
    };
  }, [address]);
  return useJsonHoldings(998, catalog, connected, load);
}

export function useTronHoldings(address: string) {
  const catalog = useMemo(() => tokensFor("tron", 728126428), []);
  const load = useMemo(() => {
    const addr = address;
    return async () => {
      const out = new Map<string, { raw: bigint; decimals?: number; symbol?: string; name?: string; icon?: string; contract?: string }>();
      if (!addr) return out;
      const json = await jsonFetch<{ data?: Array<{ balance?: number; trc20?: Array<Record<string, string>> }> }>(
        `https://api.trongrid.io/v1/accounts/${addr}`,
      );
      const acc = json.data?.[0];
      out.set("native", { raw: BigInt(acc?.balance ?? 0), decimals: 6, symbol: "TRX" });
      for (const item of acc?.trc20 ?? []) {
        for (const [contract, amount] of Object.entries(item)) {
          out.set(contract, { raw: BigInt(amount || "0"), decimals: 6, symbol: contract.slice(0, 4), contract });
        }
      }
      return out;
    };
  }, [address]);
  return useJsonHoldings(728126428, catalog, Boolean(address), load);
}

export function useSuiHoldings(address: string) {
  const catalog = useMemo(() => tokensFor("sui", 784), []);
  const load = useMemo(() => {
    const addr = address;
    return async () => {
      const out = new Map<string, { raw: bigint; decimals?: number; symbol?: string; name?: string; icon?: string; contract?: string }>();
      if (!addr) return out;
      const json = await jsonFetch<{ result?: Array<{ coinType: string; totalBalance: string }> }>("https://rpc-mainnet.suiscan.xyz", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "suix_getAllBalances", params: [addr] }),
      }).catch(() =>
        jsonFetch<{ result?: Array<{ coinType: string; totalBalance: string }> }>("https://sui-rpc.publicnode.com", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "suix_getAllBalances", params: [addr] }),
        }),
      );
      for (const b of json.result ?? []) {
        const rec = { raw: BigInt(b.totalBalance || "0"), decimals: b.coinType.includes("::sui::SUI") ? 9 : 9, symbol: b.coinType.split("::").pop(), contract: b.coinType };
        if (b.coinType.endsWith("::sui::SUI")) out.set("native", rec);
        else out.set(b.coinType, rec);
      }
      return out;
    };
  }, [address]);
  return useJsonHoldings(784, catalog, Boolean(address), load);
}

export function useTonHoldings(address: string) {
  const catalog = useMemo(() => tokensFor("ton", 607), []);
  const load = useMemo(() => {
    const addr = address;
    return async () => {
      const out = new Map<string, { raw: bigint; decimals?: number; symbol?: string; name?: string; icon?: string; contract?: string }>();
      if (!addr) return out;
      try {
        const acc = await jsonFetch<{ balance?: number | string }>(`https://tonapi.io/v2/accounts/${addr}`);
        out.set("native", { raw: BigInt(String(acc.balance ?? 0)), decimals: 9, symbol: "TON" });
      } catch {
        const acc = await jsonFetch<{ result?: string }>(`https://toncenter.com/api/v2/getAddressBalance?address=${encodeURIComponent(addr)}`);
        out.set("native", { raw: BigInt(acc.result ?? "0"), decimals: 9, symbol: "TON" });
      }
      try {
        const jets = await jsonFetch<{ balances?: Array<{ jetton?: { address?: string; symbol?: string; decimals?: number }; balance?: string }> }>(
          `https://tonapi.io/v2/accounts/${addr}/jettons`,
        );
        for (const j of jets.balances ?? []) {
          const contract = j.jetton?.address ?? "";
          if (!contract) continue;
          out.set(contract, {
            raw: BigInt(j.balance ?? "0"),
            decimals: j.jetton?.decimals ?? 9,
            symbol: j.jetton?.symbol,
            contract,
          });
        }
      } catch {
        /* jettons optional */
      }
      return out;
    };
  }, [address]);
  return useJsonHoldings(607, catalog, Boolean(address), load);
}

export function useAptosHoldings(address: string) {
  const catalog = useMemo(() => tokensFor("aptos", 637), []);
  const load = useMemo(() => {
    const addr = address;
    return async () => {
      const out = new Map<string, { raw: bigint; decimals?: number; symbol?: string; name?: string; icon?: string; contract?: string }>();
      if (!addr) return out;
      try {
        const apt = await jsonFetch<{ data?: { coin?: { value?: string } } }>(
          `https://fullnode.mainnet.aptoslabs.com/v1/accounts/${addr}/resource/0x1::coin::CoinStore%3C0x1::aptos_coin::AptosCoin%3E`,
        );
        out.set("native", { raw: BigInt(apt.data?.coin?.value ?? "0"), decimals: 8, symbol: "APT" });
      } catch {
        out.set("native", { raw: 0n, decimals: 8, symbol: "APT" });
      }
      try {
        const coins = await jsonFetch<Array<{ asset_type?: string; amount?: string; metadata?: { symbol?: string; decimals?: number } }>>(
          `https://api.mainnet.aptoslabs.com/v1/accounts/${addr}/fungible_asset_balances`,
        ).catch(() => [] as Array<{ asset_type?: string; amount?: string; metadata?: { symbol?: string; decimals?: number } }>);
        for (const c of coins) {
          if (!c.asset_type) continue;
          const rec = { raw: BigInt(c.amount ?? "0"), decimals: c.metadata?.decimals ?? 8, symbol: c.metadata?.symbol, contract: c.asset_type };
          if (c.asset_type.includes("aptos_coin")) out.set("native", rec);
          else out.set(c.asset_type, rec);
        }
      } catch {
        /* fa optional */
      }
      return out;
    };
  }, [address]);
  return useJsonHoldings(637, catalog, Boolean(address), load);
}

export function useBitcoinHoldings(address: string) {
  const catalog = useMemo(() => tokensFor("bitcoin", 833), []);
  const load = useMemo(() => {
    const addr = address;
    return async () => {
      const out = new Map<string, { raw: bigint; decimals?: number; symbol?: string; name?: string; icon?: string; contract?: string }>();
      if (!addr) return out;
      const w = window as unknown as { unisat?: { getBalance?: () => Promise<{ confirmed?: number; total?: number }> } };
      if (w.unisat?.getBalance) {
        try {
          const b = await w.unisat.getBalance();
          out.set("native", { raw: BigInt(b.total ?? b.confirmed ?? 0), decimals: 8, symbol: "BTC" });
          return out;
        } catch {
          /* mempool.space */
        }
      }
      const json = await jsonFetch<{ chain_stats?: { funded_txo_sum?: number; spent_txo_sum?: number } }>(`https://mempool.space/api/address/${addr}`);
      const s = json.chain_stats;
      out.set("native", { raw: BigInt((s?.funded_txo_sum ?? 0) - (s?.spent_txo_sum ?? 0)), decimals: 8, symbol: "BTC" });
      return out;
    };
  }, [address]);
  return useJsonHoldings(833, catalog, Boolean(address), load);
}

export function useXrplHoldings(address: string) {
  const catalog = useMemo(() => tokensFor("xrpl", 144), []);
  const load = useMemo(() => {
    const addr = address;
    return async () => {
      const out = new Map<string, { raw: bigint; decimals?: number; symbol?: string; name?: string; icon?: string; contract?: string }>();
      if (!addr) return out;
      const info = await jsonFetch<{ result?: { account_data?: { Balance?: string } } }>("https://xrplcluster.com", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method: "account_info", params: [{ account: addr, ledger_index: "validated" }] }),
      });
      out.set("native", { raw: BigInt(info.result?.account_data?.Balance ?? "0"), decimals: 6, symbol: "XRP" });
      try {
        const lines = await jsonFetch<{ result?: { lines?: Array<{ currency?: string; balance?: string; account?: string }> } }>("https://xrplcluster.com", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ method: "account_lines", params: [{ account: addr, ledger_index: "validated" }] }),
        });
        for (const l of lines.result?.lines ?? []) {
          const n = Number(l.balance);
          if (!Number.isFinite(n) || n === 0) continue;
          const raw = BigInt(Math.round(Math.abs(n) * 1e6));
          const code = l.currency && l.currency.length <= 3 ? l.currency : (l.currency ?? "IOU").slice(0, 4);
          out.set(`${l.account}:${l.currency}`, { raw, decimals: 6, symbol: code, contract: l.account });
        }
      } catch {
        /* lines optional */
      }
      return out;
    };
  }, [address]);
  return useJsonHoldings(144, catalog, Boolean(address), load);
}

export function useStellarHoldings(address: string) {
  const catalog = useMemo(() => tokensFor("stellar", 148), []);
  const load = useMemo(() => {
    const addr = address;
    return async () => {
      const out = new Map<string, { raw: bigint; decimals?: number; symbol?: string; name?: string; icon?: string; contract?: string }>();
      if (!addr) return out;
      const res = await fetch(`https://horizon.stellar.org/accounts/${addr}`);
      if (res.status === 404) {
        out.set("native", { raw: 0n, decimals: 7, symbol: "XLM" });
        return out;
      }
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { balances?: Array<{ asset_type?: string; asset_code?: string; asset_issuer?: string; balance?: string }> };
      for (const b of json.balances ?? []) {
        const n = Number(b.balance);
        if (!Number.isFinite(n)) continue;
        if (b.asset_type === "native") {
          out.set("native", { raw: BigInt(Math.round(n * 1e7)), decimals: 7, symbol: "XLM" });
        } else if (n > 0) {
          const code = b.asset_code ?? "TOKEN";
          out.set(`${code}:${b.asset_issuer}`, { raw: BigInt(Math.round(n * 1e7)), decimals: 7, symbol: code, contract: b.asset_issuer });
        }
      }
      return out;
    };
  }, [address]);
  return useJsonHoldings(148, catalog, Boolean(address), load);
}

function useCosmosLcd(chainId: number, lcd: string, denom: string, symbol: string, address: string) {
  const catalog = useMemo(() => tokensFor("cosmos", chainId), [chainId]);
  const load = useMemo(() => {
    const addr = address;
    return async () => {
      const out = new Map<string, { raw: bigint; decimals?: number; symbol?: string; name?: string; icon?: string; contract?: string }>();
      if (!addr) return out;
      const json = await jsonFetch<{ balances?: Array<{ denom?: string; amount?: string }> }>(`${lcd}/cosmos/bank/v1beta1/balances/${addr}`);
      for (const b of json.balances ?? []) {
        const raw = BigInt(b.amount ?? "0");
        if (b.denom === denom) out.set("native", { raw, decimals: 6, symbol });
        else if (raw > 0n) out.set(b.denom ?? "coin", { raw, decimals: 6, symbol: (b.denom ?? "COIN").replace("u", "").toUpperCase().slice(0, 6), contract: b.denom });
      }
      return out;
    };
  }, [address, denom, lcd, symbol]);
  return useJsonHoldings(chainId, catalog, Boolean(address), load);
}

export function useCosmosHoldings(address: string) {
  return useCosmosLcd(118, "https://rest.cosmos.directory/cosmoshub", "uatom", "ATOM", address);
}

export function useOsmosisHoldings(address: string) {
  return useCosmosLcd(100001, "https://rest.cosmos.directory/osmosis", "uosmo", "OSMO", address);
}

export function useCelestiaHoldings(address: string) {
  return useCosmosLcd(100002, "https://rest.cosmos.directory/celestia", "utia", "TIA", address);
}

const STRK = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
const STRK_ETH = "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";
const BALANCE_OF = "0x2e4263afad30923c891518314bc6c76fb0d7785f8041c2b491b3c0c5afb690";

async function starknetBalance(contract: string, owner: string) {
  const felt = owner.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const json = await jsonFetch<{ result?: string[] }>("https://starknet-mainnet.public.blastapi.io", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "starknet_call",
      params: [{ contract_address: contract, entry_point_selector: BALANCE_OF, calldata: [`0x${felt}`] }, "latest"],
    }),
  });
  const low = BigInt(json.result?.[0] ?? "0");
  const high = BigInt(json.result?.[1] ?? "0");
  return low + (high << 128n);
}

export function useStarknetHoldings(address: string) {
  const catalog = useMemo(() => tokensFor("starknet", 100003), []);
  const load = useMemo(() => {
    const addr = address;
    return async () => {
      const out = new Map<string, { raw: bigint; decimals?: number; symbol?: string; name?: string; icon?: string; contract?: string }>();
      if (!addr) return out;
      const [strk, eth] = await Promise.all([starknetBalance(STRK, addr).catch(() => 0n), starknetBalance(STRK_ETH, addr).catch(() => 0n)]);
      out.set("native", { raw: strk, decimals: 18, symbol: "STRK" });
      if (eth > 0n) out.set(STRK_ETH, { raw: eth, decimals: 18, symbol: "ETH", contract: STRK_ETH, icon: "/tokens/eth.png" });
      return out;
    };
  }, [address]);
  return useJsonHoldings(100003, catalog, Boolean(address), load);
}


