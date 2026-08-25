import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { parseAbiItem } from "viem";
import { useAccount, useConfig } from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { CHAINS, evmEnabledChains, featuredChains, isConfigured, type ChainDefinition } from "@ysk-mint/sdk";
import { useCardanoHoldings, useEvmHoldings, useNearHoldings, useSolanaHoldings, type HoldingRow } from "../../lib/useHoldings.ts";
import { useNativeWallets } from "../../lib/nativeWallets.ts";
import { resolvedContracts } from "../../lib/launchStack.ts";
import { useWizard } from "../wizard/store.ts";
import { useAdaHandle, useEvmName, useSolName } from "../../lib/chainNames.ts";
import { chainIcon } from "../../lib/chainIcon.ts";
import { Badge } from "../../shared/ui/TokenRow.tsx";

const launchEvent = parseAbiItem(
  "event Launch(address indexed token, address indexed deployer, bytes32 indexed salt, string name, string symbol, uint8 supplyMode)",
);

const GROUPS = featuredChains();

type LaunchRow = { token: `0x${string}`; name: string; symbol: string; chainId: number; chain: string };

function short(v: string, head = 6, tail = 4) {
  if (!v || v.length <= head + tail + 1) return v || "—";
  return `${v.slice(0, head)}…${v.slice(-tail)}`;
}

function chainOf(chainId: number): ChainDefinition | undefined {
  return Object.values(CHAINS).find((c) => c.chainId === chainId);
}

function explorerFor(chainId: number, contract?: string) {
  const chain = chainOf(chainId);
  if (!chain || !contract) return undefined;
  if (chain.vm === "solana") {
    const base = chain.explorer.split("?")[0].replace(/\/$/, "");
    const q = chain.explorer.includes("cluster=") ? `?${chain.explorer.split("?")[1]}` : "";
    return `${base}/token/${contract}${q}`;
  }
  if (chain.vm === "near") return `${chain.explorer}/token/${contract}`;
  if (chain.vm === "cardano") return `${chain.explorer}/token/${contract}`;
  return `${chain.explorer}/token/${contract}`;
}

function TokenLine({ r, loading }: { r: HoldingRow; loading: boolean }) {
  const { t } = useTranslation();
  const href = r.native ? undefined : explorerFor(r.chainId ?? 0, r.contract);
  const inner = (
    <>
      <span className="holding-ico-wrap">
        <img src={r.icon} alt="" width={36} height={36} className="holding-ico" />
        {r.chainTag ? <span className="holding-chain-tag">{r.chainTag}</span> : null}
      </span>
      <div className="holding-meta">
        <b>{r.symbol}</b>
        <span className="num">
          {r.native ? r.name || t("wallet.nativeCoin") : `${r.name}${r.contract ? ` · ${short(r.contract)}` : ""}`}
        </span>
      </div>
      <span className="num holding-amt">{loading ? "…" : r.amount}</span>
    </>
  );
  const cls = `me-token${r.raw === 0n && !loading ? " me-token-zero" : ""}`;
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {inner}
      </a>
    );
  }
  return <div className={cls}>{inner}</div>;
}

export function MePage() {
  const { t } = useTranslation();
  const { address, isConnected } = useAccount();
  const native = useNativeWallets();
  const config = useConfig();
  const w = useWizard();
  const evm = useEvmHoldings(address);
  const near = useNearHoldings(native.nearAccount);
  const ada = useCardanoHoldings(native.cardanoAddress, {
    addresses: native.cardanoAddresses,
    stake: native.cardanoStake,
    sync: native.cardanoSync,
  });
  const sol = useSolanaHoldings(native.solanaAddress);
  const evmName = useEvmName(address);
  const adaName = useAdaHandle(native.cardanoAddress, native.cardanoStake);
  const solName = useSolName(native.solanaAddress);
  const [filter, setFilter] = useState<number | "all">("all");
  const [launched, setLaunched] = useState<LaunchRow[]>([]);

  const anyWallet = isConnected || Boolean(native.nearAccount || native.cardanoAddress || native.solanaAddress);

  const liveFactories = useMemo(() => evmEnabledChains().filter((c) => isConfigured(resolvedContracts(c))), []);

  useEffect(() => {
    let cancelled = false;
    const extras = (): LaunchRow[] => {
      const extra: LaunchRow[] = [];
      for (const [key, v] of Object.entries(w.perChain)) {
        if (!v.token) continue;
        const chain = evmEnabledChains().find((c) => c.key === Number(key));
        if (!chain) continue;
        extra.push({
          token: v.token,
          name: w.name,
          symbol: w.symbol,
          chainId: chain.chainId,
          chain: chain.short,
        });
      }
      return extra;
    };
    if (!address) {
      setLaunched(extras());
      return;
    }
    void Promise.all(
      liveFactories.map(async (c) => {
        const contracts = resolvedContracts(c);
        if (!isConfigured(contracts)) return [];
        const client = getPublicClient(config, { chainId: c.chainId });
        if (!client) return [];
        try {
          const logs = await client.getLogs({
            address: contracts.factory,
            event: launchEvent,
            args: { deployer: address },
            fromBlock: 0n,
            toBlock: "latest",
          });
          return logs.map((l) => ({
            token: l.args.token as `0x${string}`,
            name: l.args.name ?? "",
            symbol: l.args.symbol ?? "",
            chainId: c.chainId,
            chain: c.short,
          }));
        } catch {
          return [];
        }
      }),
    ).then((parts) => {
      if (cancelled) return;
      const fromLogs = parts.flat();
      const seen = new Set(fromLogs.map((r) => `${r.chainId}:${r.token.toLowerCase()}`));
      setLaunched([...extras().filter((r) => !seen.has(`${r.chainId}:${r.token.toLowerCase()}`)), ...fromLogs]);
    });
    return () => {
      cancelled = true;
    };
  }, [address, config, liveFactories, w.name, w.perChain, w.symbol]);

  const buckets = useMemo(() => {
    const map = new Map<number, HoldingRow[]>();
    const add = (rows: HoldingRow[], connected: boolean) => {
      if (!connected) return;
      for (const r of rows) {
        if (r.chainId == null) continue;
        if (!r.native && r.raw === 0n) continue;
        const list = map.get(r.chainId) ?? [];
        list.push(r);
        map.set(r.chainId, list);
      }
    };
    add(evm.rows, isConnected);
    add(ada.rows, Boolean(native.cardanoAddress));
    add(near.rows, Boolean(native.nearAccount));
    add(sol.rows, Boolean(native.solanaAddress));
    return GROUPS.map((c) => {
      const connected =
        c.vm === "cardano"
          ? Boolean(native.cardanoAddress)
          : c.vm === "near"
            ? Boolean(native.nearAccount)
            : c.vm === "solana"
              ? Boolean(native.solanaAddress)
              : isConnected;
      const rows = map.get(c.chainId) ?? [];
      return {
        id: c.chainId,
        label: c.short,
        name: c.name,
        icon: chainIcon(c),
        rows,
        funded: rows.filter((r) => r.raw > 0n).length,
        loading:
          c.vm === "cardano" ? ada.loading : c.vm === "near" ? near.loading : c.vm === "solana" ? sol.loading : evm.loading,
        connected,
      };
    }).filter((g) => g.connected);
  }, [ada.loading, ada.rows, evm.loading, evm.rows, isConnected, native.cardanoAddress, native.nearAccount, native.solanaAddress, near.loading, near.rows, sol.loading, sol.rows]);

  const visible = filter === "all" ? buckets : buckets.filter((g) => g.id === filter);
  const visibleLaunched = filter === "all" ? launched : launched.filter((r) => r.chainId === filter);
  const funded = buckets.reduce((n, g) => n + g.funded, 0);

  return (
    <section className="workspace">
      <div className="workspace-head">
        <div>
          <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-text-muted">Portfolio</p>
          <h1>{t("me.title")}</h1>
          <p className="mt-1 text-[15px] text-text-sub">{t("me.body")}</p>
        </div>
        {anyWallet ? (
          <div className="me-summary">
            <b>{t("me.funded", { n: funded })}</b>
            <span>{t("me.chainCount", { n: buckets.length })}</span>
          </div>
        ) : null}
      </div>
      <div className="workspace-scroll">
        <div className="me-desk">
          {!anyWallet ? (
            <p className="field-note">{t("me.needWallet")}</p>
          ) : (
            <>
              <div className="me-ids">
                {isConnected && address ? (
                  <div className="me-id">
                    <img src="/tokens/eth.png" alt="" width={28} height={28} />
                    <div>
                      <b>{evmName || "EVM"}</b>
                      <span className="num">{short(address)}</span>
                    </div>
                  </div>
                ) : null}
                {native.nearAccount ? (
                  <div className="me-id">
                    <img src="/tokens/near.png" alt="" width={28} height={28} />
                    <div>
                      <b>{native.nearAccount}</b>
                      <span className="num">NEAR</span>
                    </div>
                  </div>
                ) : null}
                {native.cardanoAddress ? (
                  <div className="me-id">
                    <img src="/tokens/ada.png" alt="" width={28} height={28} />
                    <div>
                      <b>{adaName || "ADA"}</b>
                      <span className="num">{short(native.cardanoAddress, 10, 6)}</span>
                    </div>
                  </div>
                ) : null}
                {native.solanaAddress ? (
                  <div className="me-id">
                    <img src="/tokens/sol.png" alt="" width={28} height={28} />
                    <div>
                      <b>{solName || "SOL"}</b>
                      <span className="num">{short(native.solanaAddress, 4, 4)}</span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="me-chips">
                <button
                  type="button"
                  className={`me-chip ${filter === "all" ? "me-chip-on" : ""}`}
                  onClick={() => setFilter("all")}
                >
                  {t("me.all")}
                  <span className="me-count">{funded}</span>
                </button>
                {buckets.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className={`me-chip ${filter === g.id ? "me-chip-on" : ""}`}
                    onClick={() => setFilter(g.id)}
                  >
                    <img src={g.icon} alt="" width={20} height={20} />
                    {g.label}
                    <span className="me-count">{g.funded}</span>
                  </button>
                ))}
              </div>

              {visible.map((g) => (
                <section key={g.id} className="me-card">
                  <div className="me-card-head">
                    <img src={g.icon} alt="" width={22} height={22} />
                    <b>{g.name}</b>
                    <span className="me-count">{g.funded}</span>
                  </div>
                  <div className="me-cols">
                    <span>{t("me.token")}</span>
                    <span>{t("me.amount")}</span>
                  </div>
                  {g.rows.length === 0 ? (
                    <p className="me-card-empty">{t("me.emptyChain")}</p>
                  ) : (
                    <div className="me-list">
                      {g.rows.map((r) => (
                        <TokenLine key={r.id} r={r} loading={g.loading} />
                      ))}
                    </div>
                  )}
                </section>
              ))}

              {visibleLaunched.length ? (
                <section className="me-card">
                  <div className="me-card-head">
                    <span className="me-oft-mark">OFT</span>
                    <b>{t("me.launched")}</b>
                    <span className="me-count">{visibleLaunched.length}</span>
                  </div>
                  <div className="me-cols">
                    <span>{t("me.token")}</span>
                    <span>{t("me.amount")}</span>
                  </div>
                  <div className="me-list">
                    {visibleLaunched.map((r) => (
                      <Link key={`${r.chainId}-${r.token}`} to={`/token/${r.chainId}/${r.token}`} className="me-token">
                        <span className="holding-ico-wrap">
                          <span className="holding-ico me-oft-mark">{(r.symbol || "OFT").slice(0, 2)}</span>
                        </span>
                        <div className="holding-meta">
                          <b>
                            {r.symbol || "OFT"} <Badge kind="info">OFT</Badge>
                          </b>
                          <span className="num">
                            {r.chain} · {short(r.token)}
                          </span>
                        </div>
                        <span className="num holding-amt">{r.name}</span>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
