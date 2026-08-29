import { useEffect, useMemo, useState } from "react";
import { featuredChains } from "@ysk-mint/config";
import { erc20Abi, type Address } from "viem";
import { useConfig, useReadContracts } from "wagmi";
import { getBalance, readContract } from "wagmi/actions";
import { accountCache } from "../defi/cache.ts";
import { useUserSettings } from "../userSettings.ts";
import { TOKEN_CATALOG, tokensFor, type TokenRecord } from "../tokenRegistry.ts";
import { discoverEvmTokens, explorerChains, type DiscoveredErc20 } from "../evmDiscover.ts";
import { syncLiveFlag, useLiveStatus } from "../liveStatus.ts";
import { addrList, row, sortHoldings, type HoldingRow } from "./shared.ts";

const EVM_HOLD_IDS = featuredChains()
  .filter((c) => c.evm && !c.testnet)
  .map((c) => c.chainId);

const SENTINEL_ERC = /^0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee$/i;
const SCAN_ALWAYS = new Set(["WBTC", "CBBTC", "WETH", "STETH", "WSTETH", "USDC", "USDT", "DAI", "USDE"]);
const BALANCE_QUERY = { staleTime: 30_000, refetchOnWindowFocus: false as const, retry: 1 };

export function useEvmHoldings(address: Address | Address[] | undefined) {
  const addrKey = Array.isArray(address) ? address.filter(Boolean).join("|") : (address ?? "");
  const addrs = useMemo(() => addrList(address) as Address[], [addrKey]);
  const catalog = useMemo(() => tokensFor("evm"), []);
  const disabledChains = useUserSettings((s) => s.disabledChains);
  const off = useMemo(() => new Set(disabledChains), [disabledChains]);
  const explore = useMemo(() => new Set(explorerChains()), []);
  const erc20s = useMemo(
    () => catalog.filter((t) => t.address && !t.native && !SENTINEL_ERC.test(t.address) && !off.has(t.chainId)),
    [catalog, off],
  );
  const scanErc20s = useMemo(
    () => erc20s.filter((t) => !explore.has(t.chainId) || SCAN_ALWAYS.has(t.symbol.toUpperCase())),
    [erc20s, explore],
  );
  const natives = useMemo(() => catalog.filter((t) => t.native && !off.has(t.chainId)), [catalog, off]);
  const connected = addrs.length > 0;
  const single = addrs.length === 1 ? addrs[0] : undefined;
  const config = useConfig();
  const [nativeByChain, setNativeByChain] = useState<Record<number, bigint>>({});
  const [ercById, setErcById] = useState<Record<string, bigint>>({});
  const [nativeLoading, setNativeLoading] = useState(false);
  const [ercLoading, setErcLoading] = useState(false);
  const [disc, setDisc] = useState<DiscoveredErc20[]>([]);
  const [discRaw, setDiscRaw] = useState<Record<string, bigint>>({});
  const [discLoading, setDiscLoading] = useState(false);
  const catalogKeys = useMemo(
    () => new Set(erc20s.map((t) => `${t.chainId}:${(t.address ?? "").toLowerCase()}`)),
    [erc20s],
  );
  const contracts = useMemo(
    () =>
      scanErc20s.map((t) => ({
        address: t.address as Address,
        abi: erc20Abi,
        functionName: "balanceOf" as const,
        args: [(single ?? "0x0000000000000000000000000000000000000000") as Address] as const,
        chainId: t.chainId,
      })),
    [single, scanErc20s],
  );

  useEffect(() => {
    if (!addrs.length) {
      setNativeByChain({});
      setNativeLoading(false);
      return;
    }
    let cancelled = false;
    setNativeLoading(true);
    void (async () => {
      const next: Record<number, bigint> = {};
      let i = 0;
      const ids = EVM_HOLD_IDS.filter((id) => !off.has(id));
      const workers = Array.from({ length: Math.min(3, ids.length) }, async () => {
        while (i < ids.length) {
          const id = ids[i++];
          if (id == null) break;
          useLiveStatus.getState().start(`holdings:${id}`, id, "holdings", "run");
          try {
            let sum = 0n;
            for (const address of addrs) {
              const value = await accountCache("hold.native", id, address, "bal", async () => {
                const b = await getBalance(config, { address, chainId: id });
                return b.value;
              });
              sum += value;
            }
            next[id] = sum;
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
  }, [addrKey, addrs, config, off]);

  const erc = useReadContracts({
    contracts,
    query: { enabled: Boolean(single) && contracts.length > 0, ...BALANCE_QUERY },
    allowFailure: true,
  });

  useEffect(() => {
    if (single || !addrs.length) {
      setErcById({});
      setErcLoading(false);
      return;
    }
    let cancelled = false;
    setErcLoading(true);
    void (async () => {
      const next: Record<string, bigint> = {};
      let i = 0;
      const jobs = scanErc20s;
      const workers = Array.from({ length: Math.min(3, jobs.length || 1) }, async () => {
        while (i < jobs.length) {
          const t = jobs[i++];
          if (!t?.address) continue;
          let sum = 0n;
          for (const address of addrs) {
            try {
              const value = await accountCache("hold.erc20", t.chainId, address, t.address, async () =>
                readContract(config, {
                  address: t.address as Address,
                  abi: erc20Abi,
                  functionName: "balanceOf",
                  args: [address],
                  chainId: t.chainId,
                }),
              );
              if (typeof value === "bigint") sum += value;
            } catch {
              /* skip */
            }
          }
          next[t.id] = sum;
        }
      });
      await Promise.all(workers);
      if (!cancelled) {
        setErcById(next);
        setErcLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addrKey, addrs, config, scanErc20s, single]);

  useEffect(() => {
    if (!addrs.length) {
      setDisc([]);
      setDiscLoading(false);
      return;
    }
    let cancelled = false;
    setDiscLoading(true);
    const chains = EVM_HOLD_IDS.filter((id) => !off.has(id) && explorerChains().includes(id));
    void discoverEvmTokens(chains, addrs, catalogKeys)
      .then((list) => {
        if (!cancelled) setDisc(list);
      })
      .finally(() => {
        if (!cancelled) setDiscLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addrKey, addrs, catalogKeys, off]);

  useEffect(() => {
    if (!disc.length || !addrs.length) {
      setDiscRaw({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const next: Record<string, bigint> = {};
      let i = 0;
      const workers = Array.from({ length: Math.min(3, disc.length) }, async () => {
        while (i < disc.length) {
          const d = disc[i++];
          if (!d) break;
          let sum = 0n;
          let ok = false;
          for (const address of addrs) {
            try {
              const value = await accountCache("hold.erc20", d.chainId, address, d.address, async () =>
                readContract(config, {
                  address: d.address,
                  abi: erc20Abi,
                  functionName: "balanceOf",
                  args: [address as Address],
                  chainId: d.chainId,
                }),
              );
              if (typeof value === "bigint") {
                sum += value;
                ok = true;
              }
            } catch {
              /* explorer fallback */
            }
          }
          next[`${d.chainId}:${d.address}`] = ok ? sum : d.raw;
        }
      });
      await Promise.all(workers);
      if (!cancelled) setDiscRaw(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [addrs, config, disc]);

  const rows = useMemo(() => {
    const out: HoldingRow[] = [];
    const seen = new Set<string>();
    for (const t of natives) {
      const raw = connected ? (nativeByChain[t.chainId] ?? null) : null;
      out.push(row(t, raw, connected));
    }
    scanErc20s.forEach((t, i) => {
      let raw: bigint | null = null;
      const ck = `${t.chainId}:${(t.address ?? "").toLowerCase()}`;
      if (connected) {
        if (single) {
          const r = erc.data?.[i];
          raw = r?.status === "success" && typeof r.result === "bigint" ? r.result : (discRaw[ck] ?? 0n);
        } else {
          raw = ercById[t.id] ?? discRaw[ck] ?? 0n;
        }
      }
      seen.add(ck);
      out.push(row(t, raw, connected));
    });
    for (const d of disc) {
      const ck = `${d.chainId}:${d.address}`;
      if (seen.has(ck)) continue;
      seen.add(ck);
      const raw = connected ? (discRaw[ck] ?? d.raw) : null;
      const known = TOKEN_CATALOG.find((t) => t.chainId === d.chainId && (t.address ?? "").toLowerCase() === d.address);
      const rec: TokenRecord = {
        id: `disc-${d.chainId}-${d.address}`,
        vm: "evm",
        chainId: d.chainId,
        symbol: known?.symbol || d.symbol,
        name: known?.name || d.name,
        decimals: d.decimals,
        address: d.address,
        icon: known?.icon || "/tokens/eth.png",
      };
      out.push(row(rec, raw, connected));
    }
    return sortHoldings(out, connected);
  }, [connected, disc, discRaw, erc.data, scanErc20s, ercById, natives, nativeByChain, single]);

  const funded = rows.filter((r) => r.raw > 0n).length;
  const loading = nativeLoading || discLoading || (single ? erc.isLoading : ercLoading);
  useEffect(() => {
    if (!connected || !(single ? erc.isLoading : ercLoading)) return;
    for (const id of EVM_HOLD_IDS) syncLiveFlag(`holdings:${id}:erc`, id, "holdings", true);
    return () => {
      for (const id of EVM_HOLD_IDS) useLiveStatus.getState().finish(`holdings:${id}:erc`, true);
    };
  }, [connected, erc.isLoading, ercLoading, single]);
  return { rows, funded, loading, catalogSize: catalog.length };
}
