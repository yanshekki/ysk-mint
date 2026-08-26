import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { formatUnits, parseAbiItem, type Address } from "viem";
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
import { TOKEN_CATALOG } from "../../lib/tokenRegistry.ts";
import { DEX, isLst, SOL_NATIVE_MINT } from "../../lib/defiAddresses.ts";
import { fmtUsdc, quoteKey, quoteSolMints, type Quote } from "../../lib/defiQuotes.ts";
import { oracleTokenUsdc } from "../../lib/oracle.ts";
import { readAave, readUniV3, type AaveCard, type UniCard } from "../../lib/defiPositions.ts";
import { readBurrow } from "../../lib/nearDex.ts";
import {
  lstStakeLines,
  readAdaStake,
  readBenqiMarkets,
  readLidoQueue,
  readNearStake,
  readPinnedLst,
  readSavaxUnlocks,
  readSolStake,
  stakeBadge,
  stakeSubtitle,
  type StakeLine,
} from "../../lib/stakingPositions.ts";

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

function rowDecimals(r: HoldingRow) {
  if (r.native) {
    if (r.chainId === 397) return 24;
    if (r.chainId === 1815) return 6;
    if (r.chainId === 101) return 9;
    return 18;
  }
  return TOKEN_CATALOG.find((t) => t.id === r.id)?.decimals ?? 18;
}

function valued(raw: bigint, decimals: number, q?: Quote | null) {
  if (!q) return null;
  const n = Number(formatUnits(raw, decimals));
  return Number.isFinite(n) ? n * q.usdc : null;
}

type LineProps = {
  icon: string;
  tag?: string;
  title: string;
  subtitle: string;
  amount: string;
  price?: string;
  value?: string;
  zero?: boolean;
  href?: string;
  internal?: boolean;
  badge?: string;
  note?: boolean;
};

function Line(p: LineProps) {
  const inner = (
    <>
      <span className="holding-ico-wrap">
        {p.icon.startsWith("/") ? <img src={p.icon} alt="" width={36} height={36} className="holding-ico" /> : <span className="holding-ico me-oft-mark">{p.icon}</span>}
        {p.tag ? <span className="holding-chain-tag">{p.tag}</span> : null}
      </span>
      <div className="holding-meta">
        <b>
          {p.title}
          {p.badge ? <Badge kind="info">{p.badge}</Badge> : null}
        </b>
        <span className={`num${p.note ? " me-note" : ""}`}>{p.subtitle}</span>
      </div>
      <span className="num me-price">{p.price ?? "—"}</span>
      <span className="num holding-amt">{p.amount}</span>
      <span className="num me-value">{p.value ?? "—"}</span>
    </>
  );
  const cls = `me-token me-token-5${p.zero ? " me-token-zero" : ""}`;
  if (p.internal && p.href) return <Link to={p.href} className={cls}>{inner}</Link>;
  if (p.href) {
    return (
      <a href={p.href} target="_blank" rel="noreferrer" className={cls}>
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
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());
  const [aave, setAave] = useState<AaveCard[]>([]);
  const [burrow, setBurrow] = useState<AaveCard[]>([]);
  const [benqi, setBenqi] = useState<AaveCard[]>([]);
  const [uni, setUni] = useState<UniCard[]>([]);
  const [aTokens, setATokens] = useState<Set<string>>(new Set());
  const [stakeExtra, setStakeExtra] = useState<StakeLine[]>([]);

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
        extra.push({ token: v.token, name: w.name, symbol: w.symbol, chainId: chain.chainId, chain: chain.short });
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

  useEffect(() => {
    if (!anyWallet) {
      setQuotes(new Map());
      setAave([]);
      setBurrow([]);
      setBenqi([]);
      setUni([]);
      setATokens(new Set());
      setStakeExtra([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const next = new Map<string, Quote>();
      const funded = buckets.flatMap((g) => g.rows.filter((r) => r.raw > 0n || r.native));
      const evmRows = funded.filter((r) => r.chainId != null && DEX[r.chainId]);
      const clients = new Map<number, NonNullable<ReturnType<typeof getPublicClient>>>();
      for (const id of new Set(evmRows.map((r) => r.chainId!))) {
        const c = getPublicClient(config, { chainId: id });
        if (c) clients.set(id, c);
      }
      if (address) {
        for (const id of [1, 8453, 42161, 56, 43114]) {
          if (clients.has(id)) continue;
          const c = getPublicClient(config, { chainId: id });
          if (c) clients.set(id, c);
        }
      }
      await Promise.all(
        evmRows.map(async (r) => {
          const client = clients.get(r.chainId!);
          if (!client) return;
          const q = await oracleTokenUsdc(client, r.chainId!, r.contract as Address | undefined, rowDecimals(r), r.native).catch(() => null);
          if (q) next.set(quoteKey(r.chainId!, r.contract, r.native), q);
        }),
      );
      const solMints = funded.filter((r) => r.chainId === 101).map((r) => (r.native ? SOL_NATIVE_MINT : r.contract || ""));
      const jup = await quoteSolMints(solMints);
      for (const [mint, q] of jup) next.set(`101:${mint === SOL_NATIVE_MINT ? "native" : mint.toLowerCase()}`, q);

      await Promise.all(
        funded
          .filter((r) => r.chainId === 397 || r.chainId === 1815)
          .map(async (r) => {
            const q = await oracleTokenUsdc(undefined, r.chainId!, r.contract, rowDecimals(r), r.native).catch(() => null);
            if (q) next.set(quoteKey(r.chainId!, r.contract, r.native), q);
          }),
      );

      if (native.nearAccount) {
        const b = await readBurrow(native.nearAccount).catch(() => null);
        if (!cancelled) setBurrow(b ? [b] : []);
      } else if (!cancelled) {
        setBurrow([]);
      }

      if (address) {
        const aaveCards: AaveCard[] = [];
        const uniCards: UniCard[] = [];
        const tokens = new Set<string>();
        await Promise.all(
          [...clients.entries()].map(async ([id, client]) => {
            const a = await readAave(client, id, address);
            if (a) {
              aaveCards.push(a);
              for (const x of a.aTokens) tokens.add(x);
            }
            const u = await readUniV3(client, id, address);
            uniCards.push(...u);
          }),
        );
        if (!cancelled) {
          setAave(aaveCards);
          setUni(uniCards);
          setATokens(tokens);
        }
      } else if (!cancelled) {
        setAave([]);
        setUni([]);
        setATokens(new Set());
      }
      const extra: StakeLine[] = [];
      const liquid = t("me.unstakeLiquid");
      const ethClient = clients.get(1);
      const ethUsd = next.get(quoteKey(1, undefined, true))?.usdc ?? next.get("1:native")?.usdc;
      if (ethClient && address) extra.push(...(await readLidoQueue(ethClient, address, ethUsd).catch(() => [])));
      if (native.cardanoStake) extra.push(...(await readAdaStake(native.cardanoStake).catch(() => [])));
      if (native.nearAccount) extra.push(...(await readNearStake(native.nearAccount).catch(() => [])));
      const solUsd = next.get(`101:native`)?.usdc;
      if (native.solanaAddress) extra.push(...(await readSolStake(native.solanaAddress, solUsd).catch(() => [])));
      if (address) {
        await Promise.all(
          [...clients.entries()].map(async ([id, client]) => {
            extra.push(...(await readPinnedLst(client, id, address, next, liquid).catch(() => [])));
          }),
        );
        const avax = clients.get(43114);
        if (avax) {
          extra.push(...(await readSavaxUnlocks(avax, address, next.get("43114:native")?.usdc).catch(() => [])));
          const b = await readBenqiMarkets(avax, address, next).catch(() => null);
          if (!cancelled) setBenqi(b ? [b] : []);
        } else if (!cancelled) setBenqi([]);
      } else if (!cancelled) setBenqi([]);
      if (!cancelled) {
        setStakeExtra(extra);
        setQuotes(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, anyWallet, buckets, config, native.nearAccount, native.cardanoStake, native.solanaAddress]);

  const walletRows = useMemo(() => {
    const rows = buckets.flatMap((g) =>
      g.rows.filter((r) => {
        if (r.chainId != null && isLst(r.chainId, r.contract)) return false;
        if (r.contract && aTokens.has(r.contract.toLowerCase())) return false;
        if (r.contract && benqi.some((c) => c.aTokens.has(r.contract!.toLowerCase()))) return false;
        return true;
      }),
    );
    return filter === "all" ? rows : rows.filter((r) => r.chainId === filter);
  }, [aTokens, benqi, buckets, filter]);

  const stakeAll = useMemo(() => {
    const lst = buckets.flatMap((g) => lstStakeLines(g.id, g.rows, quotes, t("me.unstakeLiquid")));
    const merged = new Map<string, StakeLine>();
    for (const l of [...lst, ...stakeExtra]) {
      const k =
        l.id.includes("unlock") || l.id.includes("unstk") || l.id.includes("lido-q") || l.id.includes("rew")
          ? l.id
          : `${l.chainId}:${(l.contract || l.id).toLowerCase()}:${l.status}`;
      if (!merged.has(k)) merged.set(k, l);
    }
    return [...merged.values()];
  }, [buckets, quotes, stakeExtra, t]);
  const stake = filter === "all" ? stakeAll : stakeAll.filter((l) => l.chainId === filter);

  const aaveCards = filter === "all" ? aave : aave.filter((c) => c.chainId === filter);
  const burrowCards = filter === "all" ? burrow : burrow.filter((c) => c.chainId === filter);
  const benqiCards = filter === "all" ? benqi : benqi.filter((c) => c.chainId === filter);
  const uniCards = filter === "all" ? uni : uni.filter((c) => c.chainId === filter);
  const visibleLaunched = filter === "all" ? launched : launched.filter((r) => r.chainId === filter);

  const allValues: Array<number | null> = [];
  for (const r of walletRows) {
    if (r.raw === 0n && r.native) continue;
    allValues.push(valued(r.raw, rowDecimals(r), quotes.get(quoteKey(r.chainId ?? 0, r.contract, r.native))));
  }
  for (const c of aaveCards) for (const l of c.lines) allValues.push(l.valueUsdc ?? null);
  for (const c of burrowCards) for (const l of c.lines) allValues.push(l.valueUsdc ?? null);
  for (const c of benqiCards) for (const l of c.lines) allValues.push(l.valueUsdc ?? null);
  for (const c of uniCards) for (const l of c.lines) allValues.push(l.valueUsdc ?? null);
  for (const l of stake) if (!l.inWallet) allValues.push(l.valueUsdc ?? null);
  const quoted = allValues.filter((v): v is number => v != null);
  const unquoted = allValues.filter((v) => v == null).length;
  const total = quoted.reduce((a, b) => a + b, 0);

  const chipCount = (id: number | "all") => {
    const rows = id === "all" ? buckets.flatMap((g) => g.rows) : (buckets.find((g) => g.id === id)?.rows ?? []);
    const nWallet = rows.filter((r) => r.raw > 0n && !isLst(r.chainId ?? 0, r.contract) && !(r.contract && aTokens.has(r.contract.toLowerCase()))).length;
    const nAave = (id === "all" ? aave : aave.filter((c) => c.chainId === id)).reduce((n, c) => n + c.lines.length, 0);
    const nBurrow = (id === "all" ? burrow : burrow.filter((c) => c.chainId === id)).reduce((n, c) => n + c.lines.length, 0);
    const nBenqi = (id === "all" ? benqi : benqi.filter((c) => c.chainId === id)).reduce((n, c) => n + c.lines.length, 0);
    const nUni = (id === "all" ? uni : uni.filter((c) => c.chainId === id)).reduce((n, c) => n + c.lines.length, 0);
    const nStake = id === "all" ? stakeAll.length : stakeAll.filter((l) => l.chainId === id).length;
    return nWallet + nAave + nBurrow + nBenqi + nUni + nStake;
  };

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
            <b>{t("me.about", { n: fmtUsdc(total) })}</b>
            <span>{unquoted ? t("me.unquoted", { n: unquoted }) : t("me.dexNote")}</span>
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
                <button type="button" className={`me-chip ${filter === "all" ? "me-chip-on" : ""}`} onClick={() => setFilter("all")}>
                  {t("me.all")}
                  <span className="me-count">{chipCount("all")}</span>
                </button>
                {buckets.map((g) => (
                  <button key={g.id} type="button" className={`me-chip ${filter === g.id ? "me-chip-on" : ""}`} onClick={() => setFilter(g.id)}>
                    <img src={g.icon} alt="" width={20} height={20} />
                    {g.label}
                    <span className="me-count">{chipCount(g.id)}</span>
                  </button>
                ))}
              </div>

              <section className="me-card">
                <div className="me-card-head">
                  <b>{t("me.wallet")}</b>
                  <span className="me-count">{fmtUsdc(walletRows.reduce((n, r) => n + (valued(r.raw, rowDecimals(r), quotes.get(quoteKey(r.chainId ?? 0, r.contract, r.native))) ?? 0), 0))}</span>
                </div>
                <div className="me-cols me-cols-5">
                  <span>{t("me.token")}</span>
                  <span>{t("me.quote")}</span>
                  <span>{t("me.amount")}</span>
                  <span>{t("me.value")}</span>
                </div>
                {walletRows.length === 0 ? (
                  <p className="me-card-empty">{t("me.emptyChain")}</p>
                ) : (
                  <div className="me-list">
                    {walletRows.map((r) => {
                      const q = quotes.get(quoteKey(r.chainId ?? 0, r.contract, r.native));
                      const v = valued(r.raw, rowDecimals(r), q);
                      const loading = buckets.find((g) => g.id === r.chainId)?.loading;
                      return (
                        <Line
                          key={r.id}
                          icon={r.icon}
                          tag={r.chainTag}
                          title={r.symbol}
                          subtitle={r.native ? r.name || t("wallet.nativeCoin") : `${r.name}${r.contract ? ` · ${short(r.contract)}` : ""}`}
                          amount={loading ? "…" : r.amount}
                          price={q ? fmtUsdc(q.usdc) : "—"}
                          value={v == null ? "—" : fmtUsdc(v)}
                          zero={r.raw === 0n && !loading}
                          href={r.native ? undefined : explorerFor(r.chainId ?? 0, r.contract)}
                        />
                      );
                    })}
                  </div>
                )}
              </section>

              {burrowCards.map((c) => (
                <section key={`burrow-${c.chainId}`} className="me-card">
                  <div className="me-card-head">
                    <b>
                      {t("me.burrow")} · {c.chain}
                    </b>
                    <span className="me-count">
                      {t("me.health")} {c.health}
                    </span>
                  </div>
                  <div className="me-cols me-cols-5">
                    <span>{t("me.token")}</span>
                    <span>{t("me.quote")}</span>
                    <span>{t("me.amount")}</span>
                    <span>{t("me.value")}</span>
                  </div>
                  <div className="me-list">
                    {c.lines.map((l) => (
                      <Line
                        key={l.id}
                        icon={l.icon}
                        tag={l.chain}
                        title={`${l.symbol}`}
                        subtitle={l.side === "borrow" ? t("me.borrowed") : t("me.supplied")}
                        amount={l.amount}
                        price={l.quote ? fmtUsdc(l.quote.usdc) : "—"}
                        value={l.valueUsdc == null ? "—" : fmtUsdc(l.valueUsdc)}
                        href={explorerFor(l.chainId, l.contract)}
                      />
                    ))}
                  </div>
                </section>
              ))}

              {benqiCards.map((c) => (
                <section key={`benqi-${c.chainId}`} className="me-card">
                  <div className="me-card-head">
                    <b>
                      {t("me.benqi")} · {c.chain}
                    </b>
                    <span className="me-count">{fmtUsdc(c.lines.reduce((n, l) => n + (l.valueUsdc ?? 0), 0))}</span>
                  </div>
                  <div className="me-cols me-cols-5">
                    <span>{t("me.token")}</span>
                    <span>{t("me.quote")}</span>
                    <span>{t("me.amount")}</span>
                    <span>{t("me.value")}</span>
                  </div>
                  <div className="me-list">
                    {c.lines.map((l) => (
                      <Line
                        key={l.id}
                        icon={l.icon}
                        tag={l.chain}
                        title={l.symbol}
                        subtitle={l.side === "borrow" ? t("me.borrowed") : l.side === "lp" ? l.extra ?? t("me.staking") : t("me.supplied")}
                        amount={l.amount}
                        price={l.quote ? fmtUsdc(l.quote.usdc) : "—"}
                        value={l.valueUsdc == null ? "—" : fmtUsdc(l.valueUsdc)}
                        href={explorerFor(l.chainId, l.contract)}
                      />
                    ))}
                  </div>
                </section>
              ))}

              {aaveCards.map((c) => (
                <section key={`aave-${c.chainId}`} className="me-card">
                  <div className="me-card-head">
                    <b>
                      {t("me.aave")} · {c.chain}
                    </b>
                    <span className="me-count">
                      {t("me.health")} {c.health}
                    </span>
                  </div>
                  <div className="me-cols me-cols-5">
                    <span>{t("me.token")}</span>
                    <span>{t("me.quote")}</span>
                    <span>{t("me.amount")}</span>
                    <span>{t("me.value")}</span>
                  </div>
                  <div className="me-list">
                    {c.lines.map((l) => (
                      <Line
                        key={l.id}
                        icon={l.icon}
                        tag={l.chain}
                        title={`${l.symbol}`}
                        subtitle={l.side === "borrow" ? t("me.borrowed") : t("me.supplied")}
                        amount={l.amount}
                        price={l.quote ? fmtUsdc(l.quote.usdc) : "—"}
                        value={l.valueUsdc == null ? "—" : fmtUsdc(l.valueUsdc)}
                        href={explorerFor(l.chainId, l.contract)}
                      />
                    ))}
                  </div>
                </section>
              ))}

              {uniCards.map((c) => (
                <section key={`uni-${c.protocol}-${c.chainId}`} className="me-card">
                  <div className="me-card-head">
                    <b>
                      {c.protocol} · {c.chain}
                    </b>
                    <span className="me-count">{fmtUsdc(c.lines.reduce((n, l) => n + (l.valueUsdc ?? 0), 0))}</span>
                  </div>
                  <div className="me-cols me-cols-5">
                    <span>{t("me.token")}</span>
                    <span>{t("me.quote")}</span>
                    <span>{t("me.amount")}</span>
                    <span>{t("me.value")}</span>
                  </div>
                  <div className="me-list">
                    {c.lines.map((l) => (
                      <Line
                        key={l.id}
                        icon={l.icon}
                        tag={l.chain}
                        title={l.symbol}
                        subtitle={l.extra ?? l.name}
                        amount={l.amount}
                        price="—"
                        value={l.valueUsdc == null ? "—" : fmtUsdc(l.valueUsdc)}
                        href={explorerFor(l.chainId, l.contract)}
                      />
                    ))}
                  </div>
                </section>
              ))}

              {stake.length ? (
                <section className="me-card">
                  <div className="me-card-head">
                    <b>{t("me.staking")}</b>
                    <span className="me-count">{fmtUsdc(stake.reduce((n, l) => n + (l.valueUsdc ?? 0), 0))}</span>
                  </div>
                  <div className="me-cols me-cols-5">
                    <span>{t("me.token")}</span>
                    <span>{t("me.quote")}</span>
                    <span>{t("me.amount")}</span>
                    <span>{t("me.value")}</span>
                  </div>
                  <div className="me-list">
                    {stake.map((l) => (
                      <Line
                        key={l.id}
                        icon={l.icon}
                        tag={l.chain}
                        title={l.symbol}
                        subtitle={stakeSubtitle(l)}
                        amount={l.amount}
                        price={l.quote ? fmtUsdc(l.quote.usdc) : "—"}
                        value={l.valueUsdc == null ? "—" : fmtUsdc(l.valueUsdc)}
                        href={
                          l.chainId === 101
                            ? `https://solscan.io/account/${l.contract}`
                            : l.chainId === 397
                              ? `https://nearblocks.io/address/${l.contract}`
                              : l.chainId === 1815 && l.contract?.startsWith("pool")
                                ? `https://cardanoscan.io/pool/${l.contract}`
                                : explorerFor(l.chainId, l.contract)
                        }
                        badge={stakeBadge(l)}
                        note
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              {visibleLaunched.length ? (
                <section className="me-card">
                  <div className="me-card-head">
                    <span className="me-oft-mark">OFT</span>
                    <b>{t("me.launched")}</b>
                    <span className="me-count">{visibleLaunched.length}</span>
                  </div>
                  <div className="me-cols me-cols-5">
                    <span>{t("me.token")}</span>
                    <span>{t("me.quote")}</span>
                    <span>{t("me.amount")}</span>
                    <span>{t("me.value")}</span>
                  </div>
                  <div className="me-list">
                    {visibleLaunched.map((r) => (
                      <Line
                        key={`${r.chainId}-${r.token}`}
                        icon={(r.symbol || "OFT").slice(0, 2)}
                        tag={r.chain}
                        title={r.symbol || "OFT"}
                        subtitle={`${r.chain} · ${short(r.token)}`}
                        amount={r.name}
                        badge="OFT"
                        internal
                        href={`/token/${r.chainId}/${r.token}`}
                      />
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
