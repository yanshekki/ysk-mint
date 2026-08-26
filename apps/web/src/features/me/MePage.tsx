import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { formatUnits, parseAbiItem, type Address } from "viem";
import { useAccount, useConfig } from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { CHAINS, evmEnabledChains, featuredChains, isConfigured, type ChainDefinition } from "@ysk-mint/sdk";
import {
  useAptosHoldings,
  useBitcoinHoldings,
  useCardanoHoldings,
  useCelestiaHoldings,
  useCosmosHoldings,
  useEvmHoldings,
  useHyperCoreHoldings,
  useNearHoldings,
  useOsmosisHoldings,
  useSolanaHoldings,
  useStarknetHoldings,
  useStellarHoldings,
  useSuiHoldings,
  useTonHoldings,
  useTronHoldings,
  useXrplHoldings,
  type HoldingRow,
} from "../../lib/useHoldings.ts";
import { useNativeWallets } from "../../lib/nativeWallets.ts";
import { stakeFromPayment } from "../../lib/cardanoCip30.ts";
import { resolvedContracts } from "../../lib/launchStack.ts";
import { useWizard } from "../wizard/store.ts";
import { useAdaHandle, useEvmName, useSolName } from "../../lib/chainNames.ts";
import { chainIcon } from "../../lib/chainIcon.ts";
import { Badge } from "../../shared/ui/TokenRow.tsx";
import { ChipBusy } from "../../shared/ui/LiveDock.tsx";
import { trackLive, useLiveStatus } from "../../lib/liveStatus.ts";
import { TOKEN_CATALOG } from "../../lib/tokenRegistry.ts";
import { DEX, isLst, SOL_NATIVE_MINT } from "../../lib/defiAddresses.ts";
import { fmtUsdc, quoteKey, quoteSolMints, type Quote } from "../../lib/defiQuotes.ts";
import { oracleTokenUsdc } from "../../lib/oracle.ts";
import { readAave, readUniV3, type AaveCard, type ProtocolLine, type UniCard } from "../../lib/defiPositions.ts";
import { readExtraLending, type LendCard } from "../../lib/lendingExtra.ts";
import { readNativeLending } from "../../lib/lendingNative.ts";
import { SortHead, useSort, type SortDir } from "../../shared/ui/SortTable.tsx";
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
  if (chain.vm === "tron") return `${chain.explorer}/#/token20/${contract}`;
  if (chain.vm === "sui") return `${chain.explorer}/mainnet/object/${contract}`;
  if (chain.vm === "ton") return `${chain.explorer}/${contract}`;
  if (chain.vm === "aptos") return `${chain.explorer}/fungible_asset/${contract}`;
  if (chain.vm === "hypercore") return chain.explorer;
  if (chain.vm === "bitcoin") return `${chain.explorer}/address/${contract}`;
  if (chain.vm === "xrpl") return `${chain.explorer}/accounts/${contract}`;
  if (chain.vm === "stellar") return `${chain.explorer}/account/${contract}`;
  if (chain.vm === "cosmos") return `${chain.explorer}/address/${contract}`;
  if (chain.vm === "starknet") return `${chain.explorer}/contract/${contract}`;
  return `${chain.explorer}/token/${contract}`;
}

function rowDecimals(r: HoldingRow) {
  return TOKEN_CATALOG.find((t) => t.id === r.id)?.decimals ?? (r.native ? 18 : 18);
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

function ValueHeads({ sort }: { sort: { key: string; dir: SortDir; toggle: (id: string) => void } }) {
  const { t } = useTranslation();
  return (
    <div className="me-cols me-cols-5">
      <SortHead id="name" label={t("me.token")} active={sort.key === "name"} dir={sort.dir} onToggle={sort.toggle} align="left" />
      <SortHead id="quote" label={t("me.quote")} active={sort.key === "quote"} dir={sort.dir} onToggle={sort.toggle} />
      <SortHead id="amount" label={t("me.amount")} active={sort.key === "amount"} dir={sort.dir} onToggle={sort.toggle} />
      <SortHead id="value" label={t("me.value")} active={sort.key === "value"} dir={sort.dir} onToggle={sort.toggle} />
    </div>
  );
}

function protocolSortGet(l: ProtocolLine, k: string) {
  if (k === "name") return l.symbol;
  if (k === "quote") return l.quote?.usdc ?? null;
  if (k === "amount") return Number(String(l.amount).replace(/,/g, ""));
  return l.valueUsdc ?? null;
}

function ProtocolTable({ lines, render }: { lines: ProtocolLine[]; render: (l: ProtocolLine) => ReactNode }) {
  const sort = useSort(lines, "value", protocolSortGet);
  return (
    <>
      <ValueHeads sort={sort} />
      <div className="me-list">{sort.sorted.map(render)}</div>
    </>
  );
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
  const tron = useTronHoldings(native.tronAddress);
  const sui = useSuiHoldings(native.suiAddress);
  const ton = useTonHoldings(native.tonAddress);
  const aptos = useAptosHoldings(native.aptosAddress);
  const btc = useBitcoinHoldings(native.bitcoinAddress);
  const xrpl = useXrplHoldings(native.xrplAddress);
  const xlm = useStellarHoldings(native.stellarAddress);
  const atom = useCosmosHoldings(native.cosmosAddress);
  const osmo = useOsmosisHoldings(native.osmosisAddress);
  const tia = useCelestiaHoldings(native.celestiaAddress);
  const strk = useStarknetHoldings(native.starknetAddress);
  const hyper = useHyperCoreHoldings(address);
  const evmName = useEvmName(address);
  const adaName = useAdaHandle(native.cardanoAddress, native.cardanoStake);
  const solName = useSolName(native.solanaAddress);
  const [filter, setFilter] = useState<number | "all">("all");
  const [hideZero, setHideZero] = useState(true);
  const [launched, setLaunched] = useState<LaunchRow[]>([]);
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());
  const [aave, setAave] = useState<AaveCard[]>([]);
  const [burrow, setBurrow] = useState<AaveCard[]>([]);
  const [benqi, setBenqi] = useState<AaveCard[]>([]);
  const [lendExtra, setLendExtra] = useState<LendCard[]>([]);
  const [uni, setUni] = useState<UniCard[]>([]);
  const [aTokens, setATokens] = useState<Set<string>>(new Set());
  const [stakeExtra, setStakeExtra] = useState<StakeLine[]>([]);
  const [adaStakeLines, setAdaStakeLines] = useState<StakeLine[]>([]);

  const anyWallet =
    isConnected ||
    Boolean(
      native.nearAccount ||
        native.cardanoAddress ||
        native.solanaAddress ||
        native.tronAddress ||
        native.suiAddress ||
        native.tonAddress ||
        native.aptosAddress ||
        native.bitcoinAddress ||
        native.xrplAddress ||
        native.stellarAddress ||
        native.cosmosAddress ||
        native.osmosisAddress ||
        native.celestiaAddress ||
        native.starknetAddress,
    );

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
    add(tron.rows, Boolean(native.tronAddress));
    add(sui.rows, Boolean(native.suiAddress));
    add(ton.rows, Boolean(native.tonAddress));
    add(aptos.rows, Boolean(native.aptosAddress));
    add(btc.rows, Boolean(native.bitcoinAddress));
    add(xrpl.rows, Boolean(native.xrplAddress));
    add(xlm.rows, Boolean(native.stellarAddress));
    add(atom.rows, Boolean(native.cosmosAddress));
    add(osmo.rows, Boolean(native.osmosisAddress));
    add(tia.rows, Boolean(native.celestiaAddress));
    add(strk.rows, Boolean(native.starknetAddress));
    add(hyper.rows, isConnected);
    const connectedFor = (c: ChainDefinition) => {
      if (c.vm === "cardano") return Boolean(native.cardanoAddress);
      if (c.vm === "near") return Boolean(native.nearAccount);
      if (c.vm === "solana") return Boolean(native.solanaAddress);
      if (c.vm === "tron") return Boolean(native.tronAddress);
      if (c.vm === "sui") return Boolean(native.suiAddress);
      if (c.vm === "ton") return Boolean(native.tonAddress);
      if (c.vm === "aptos") return Boolean(native.aptosAddress);
      if (c.vm === "bitcoin") return Boolean(native.bitcoinAddress);
      if (c.vm === "xrpl") return Boolean(native.xrplAddress);
      if (c.vm === "stellar") return Boolean(native.stellarAddress);
      if (c.vm === "cosmos") {
        if (c.chainId === 118) return Boolean(native.cosmosAddress);
        if (c.chainId === 100001) return Boolean(native.osmosisAddress);
        if (c.chainId === 100002) return Boolean(native.celestiaAddress);
        return false;
      }
      if (c.vm === "starknet") return Boolean(native.starknetAddress);
      return isConnected;
    };
    const loadingFor = (c: ChainDefinition) => {
      if (c.vm === "cardano") return ada.loading;
      if (c.vm === "near") return near.loading;
      if (c.vm === "solana") return sol.loading;
      if (c.vm === "tron") return tron.loading;
      if (c.vm === "sui") return sui.loading;
      if (c.vm === "ton") return ton.loading;
      if (c.vm === "aptos") return aptos.loading;
      if (c.vm === "bitcoin") return btc.loading;
      if (c.vm === "xrpl") return xrpl.loading;
      if (c.vm === "stellar") return xlm.loading;
      if (c.vm === "cosmos") {
        if (c.chainId === 118) return atom.loading;
        if (c.chainId === 100001) return osmo.loading;
        if (c.chainId === 100002) return tia.loading;
        return false;
      }
      if (c.vm === "starknet") return strk.loading;
      if (c.vm === "hypercore") return hyper.loading;
      return evm.loading;
    };
    return GROUPS.map((c) => {
      const rows = map.get(c.chainId) ?? [];
      const connected = connectedFor(c);
      return {
        id: c.chainId,
        label: c.short,
        name: c.name,
        icon: chainIcon(c),
        rows,
        funded: rows.filter((r) => r.raw > 0n).length,
        loading: loadingFor(c),
        connected,
      };
    }).filter((g) => g.connected);
  }, [
    ada.loading,
    ada.rows,
    aptos.loading,
    aptos.rows,
    atom.loading,
    atom.rows,
    btc.loading,
    btc.rows,
    evm.loading,
    evm.rows,
    hyper.loading,
    hyper.rows,
    isConnected,
    native.aptosAddress,
    native.bitcoinAddress,
    native.cardanoAddress,
    native.celestiaAddress,
    native.cosmosAddress,
    native.nearAccount,
    native.osmosisAddress,
    native.solanaAddress,
    native.starknetAddress,
    native.stellarAddress,
    native.suiAddress,
    native.tonAddress,
    native.tronAddress,
    native.xrplAddress,
    near.loading,
    near.rows,
    osmo.loading,
    osmo.rows,
    sol.loading,
    sol.rows,
    strk.loading,
    strk.rows,
    sui.loading,
    sui.rows,
    tia.loading,
    tia.rows,
    ton.loading,
    ton.rows,
    tron.loading,
    tron.rows,
    xlm.loading,
    xlm.rows,
    xrpl.loading,
    xrpl.rows,
  ]);

  const bucketsRef = useRef(buckets);
  bucketsRef.current = buckets;
  const holdingsKey = useMemo(
    () =>
      buckets
        .flatMap((g) => g.rows)
        .filter((r) => r.raw > 0n || r.native)
        .map((r) => `${r.chainId}:${r.native ? "n" : (r.contract ?? "").toLowerCase()}:${r.raw}`)
        .sort()
        .join("|"),
    [buckets],
  );
  const unstakeLiquid = t("me.unstakeLiquid");
  const liveJobs = useLiveStatus((s) => s.jobs);
  const adaStake = native.cardanoStake || (native.cardanoAddress ? stakeFromPayment(native.cardanoAddress) : "");

  useEffect(() => {
    if (!anyWallet) {
      setQuotes(new Map());
      setAave([]);
      setBurrow([]);
      setBenqi([]);
      setLendExtra([]);
      setUni([]);
      setATokens(new Set());
      setStakeExtra([]);
      setAdaStakeLines([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const snapshot = bucketsRef.current;
      const next = new Map<string, Quote>();
      const funded = snapshot.flatMap((g) => g.rows.filter((r) => r.raw > 0n || r.native));
      const evmRows = funded.filter((r) => r.chainId != null && DEX[r.chainId]);
      const clients = new Map<number, NonNullable<ReturnType<typeof getPublicClient>>>();
      for (const id of new Set(evmRows.map((r) => r.chainId!))) {
        const c = getPublicClient(config, { chainId: id });
        if (c) clients.set(id, c);
      }
      if (address) {
        for (const id of [1, 8453, 42161, 56, 43114, 10, 137]) {
          if (clients.has(id)) continue;
          const c = getPublicClient(config, { chainId: id });
          if (c) clients.set(id, c);
        }
      }
      const quoteIds = [...new Set(funded.map((r) => r.chainId).filter((id): id is number => id != null))];
      for (const id of quoteIds) useLiveStatus.getState().start(`quote:${id}`, id, "quote", "wait");

      const quoteChain = async (id: number) => {
        const rows = funded.filter((r) => r.chainId === id);
        if (!rows.length) {
          useLiveStatus.getState().finish(`quote:${id}`, true);
          return;
        }
        await trackLive(`quote:${id}`, id, "quote", async () => {
          if (id === 101) {
            const solMints = rows.map((r) => (r.native ? SOL_NATIVE_MINT : r.contract || ""));
            const jup = await quoteSolMints(solMints);
            for (const [mint, q] of jup) next.set(`101:${mint === SOL_NATIVE_MINT ? "native" : mint.toLowerCase()}`, q);
            return;
          }
          await Promise.all(
            rows.map(async (r) => {
              const client = clients.get(id);
              const q = await oracleTokenUsdc(
                client,
                id,
                r.contract as Address | undefined,
                rowDecimals(r),
                r.native,
              ).catch(() => null);
              if (q) next.set(quoteKey(id, r.contract, r.native), q);
            }),
          );
        }).catch(() => undefined);
      };
      await Promise.all(quoteIds.map(quoteChain));

      const extra: StakeLine[] = [];
      const aaveCards: AaveCard[] = [];
      const uniCards: UniCard[] = [];
      const lendCards: LendCard[] = [];
      const tokens = new Set<string>();
      let burrowCards: AaveCard | null = null;
      let benqiCard: AaveCard | null = null;
      const defiIds = [
        ...clients.keys(),
        ...(native.nearAccount ? [397] : []),
        ...(native.solanaAddress ? [101] : []),
        ...(native.suiAddress ? [784] : []),
        ...(native.tronAddress ? [728126428] : []),
        ...(native.aptosAddress ? [637] : []),
      ];
      for (const id of defiIds) useLiveStatus.getState().start(`defi:${id}`, id, "defi", "wait");

      await Promise.all(
        [...new Set(defiIds)].map((id) =>
          trackLive(`defi:${id}`, id, "defi", async () => {
            if (id === 397) {
              burrowCards = native.nearAccount ? await readBurrow(native.nearAccount).catch(() => null) : null;
              extra.push(...(await readNearStake(native.nearAccount).catch(() => [])));
              return;
            }
            if (id === 101) {
              extra.push(...(await readSolStake(native.solanaAddress, next.get("101:native")?.usdc).catch(() => [])));
              const more = await readNativeLending({ sol: native.solanaAddress, quotes: next }).catch(() => []);
              for (const card of more) {
                lendCards.push(card);
                for (const x of card.aTokens) tokens.add(x);
              }
              return;
            }
            if (id === 784) {
              const more = await readNativeLending({ sui: native.suiAddress, quotes: next }).catch(() => []);
              for (const card of more) {
                lendCards.push(card);
                for (const x of card.aTokens) tokens.add(x);
              }
              return;
            }
            if (id === 728126428) {
              const more = await readNativeLending({ tron: native.tronAddress, quotes: next }).catch(() => []);
              for (const card of more) {
                lendCards.push(card);
                for (const x of card.aTokens) tokens.add(x);
              }
              return;
            }
            if (id === 637) {
              const more = await readNativeLending({ aptos: native.aptosAddress, quotes: next }).catch(() => []);
              for (const card of more) {
                lendCards.push(card);
                for (const x of card.aTokens) tokens.add(x);
              }
              return;
            }
            const client = clients.get(id);
            if (!client || !address) return;
            const a = await readAave(client, id, address);
            if (a) {
              aaveCards.push(a);
              for (const x of a.aTokens) tokens.add(x);
            }
            uniCards.push(...(await readUniV3(client, id, address)));
            const more = await readExtraLending(client, id, address, next).catch(() => []);
            for (const card of more) {
              lendCards.push(card);
              for (const x of card.aTokens) tokens.add(x);
            }
            extra.push(...(await readPinnedLst(client, id, address, next, unstakeLiquid).catch(() => [])));
            if (id === 1) extra.push(...(await readLidoQueue(client, address, next.get(quoteKey(1, undefined, true))?.usdc ?? next.get("1:native")?.usdc).catch(() => [])));
            if (id === 43114) {
              extra.push(...(await readSavaxUnlocks(client, address, next.get("43114:native")?.usdc).catch(() => [])));
              benqiCard = await readBenqiMarkets(client, address, next).catch(() => null);
            }
          }).catch(() => undefined),
        ),
      );

      if (cancelled) return;
      setQuotes(next);
      setAave(aaveCards);
      setBurrow(burrowCards ? [burrowCards] : []);
      setBenqi(benqiCard ? [benqiCard] : []);
      setLendExtra(lendCards);
      setUni(uniCards);
      setATokens(tokens);
      setStakeExtra(extra);
    })();
    return () => {
      cancelled = true;
      useLiveStatus.getState().clear("quote:");
      useLiveStatus.getState().clear("defi:");
    };
  }, [address, anyWallet, holdingsKey, config, native.nearAccount, native.solanaAddress, native.suiAddress, native.tronAddress, native.aptosAddress, unstakeLiquid]);

  const adaPays = (native.cardanoAddresses ?? []).join("|");
  useEffect(() => {
    if (!native.cardanoAddress && !adaStake) {
      setAdaStakeLines([]);
      return;
    }
    let cancelled = false;
    void trackLive("defi:1815", 1815, "defi", async () => {
      const lines = await readAdaStake(adaStake, adaPays ? adaPays.split("|") : []);
      if (!cancelled) setAdaStakeLines(lines);
    }).catch(() => {
      if (!cancelled) setAdaStakeLines([]);
    });
    return () => {
      cancelled = true;
      useLiveStatus.getState().finish("defi:1815", true);
    };
  }, [adaStake, adaPays, native.cardanoAddress]);

  const walletRows = useMemo(() => {
    const rows = buckets.flatMap((g) =>
      g.rows.filter((r) => {
        if (r.chainId != null && isLst(r.chainId, r.contract)) return false;
        if (r.contract && aTokens.has(r.contract.toLowerCase())) return false;
        if (r.contract && benqi.some((c) => c.aTokens.has(r.contract!.toLowerCase()))) return false;
        return true;
      }),
    );
    const scoped = filter === "all" ? rows : rows.filter((r) => r.chainId === filter);
    if (!hideZero) return scoped;
    return scoped.filter((r) => r.raw > 0n && r.amount !== "—");
  }, [aTokens, benqi, buckets, filter, hideZero]);

  const stakeAll = useMemo(() => {
    const lst = buckets.flatMap((g) => lstStakeLines(g.id, g.rows, quotes, t("me.unstakeLiquid")));
    const merged = new Map<string, StakeLine>();
    for (const l of [...lst, ...stakeExtra, ...adaStakeLines]) {
      const k =
        l.id.includes("unlock") ||
        l.id.includes("unstk") ||
        l.id.includes("lido-q") ||
        l.id.includes("rew") ||
        l.id.includes("pending")
          ? l.id
          : `${l.chainId}:${(l.contract || l.id).toLowerCase()}:${l.status}`;
      if (!merged.has(k)) merged.set(k, l);
    }
    return [...merged.values()];
  }, [buckets, quotes, stakeExtra, adaStakeLines, t]);
  const stake = filter === "all" ? stakeAll : stakeAll.filter((l) => l.chainId === filter);
  const walletGet = useCallback(
    (r: HoldingRow, k: string) => {
      const q = quotes.get(quoteKey(r.chainId ?? 0, r.contract, r.native));
      if (k === "name") return r.symbol;
      if (k === "quote") return q?.usdc ?? null;
      if (k === "amount") return Number(formatUnits(r.raw, rowDecimals(r)));
      return valued(r.raw, rowDecimals(r), q);
    },
    [quotes],
  );
  const walletSort = useSort(walletRows, "value", walletGet);
  const stakeSort = useSort(stake, "value", protocolSortGet);

  const aaveCards = filter === "all" ? aave : aave.filter((c) => c.chainId === filter);
  const burrowCards = filter === "all" ? burrow : burrow.filter((c) => c.chainId === filter);
  const benqiCards = filter === "all" ? benqi : benqi.filter((c) => c.chainId === filter);
  const uniCards = filter === "all" ? uni : uni.filter((c) => c.chainId === filter);
  const extraLendCards = filter === "all" ? lendExtra : lendExtra.filter((c) => c.chainId === filter);
  const visibleLaunched = filter === "all" ? launched : launched.filter((r) => r.chainId === filter);
  const launchedGet = useCallback((r: LaunchRow, k: string) => (k === "name" ? r.symbol : r.chain), []);
  const launchedSort = useSort(visibleLaunched, "name", launchedGet, "asc");

  const allValues: Array<number | null> = [];
  for (const r of walletRows) {
    if (r.raw === 0n && r.native) continue;
    allValues.push(valued(r.raw, rowDecimals(r), quotes.get(quoteKey(r.chainId ?? 0, r.contract, r.native))));
  }
  for (const c of aaveCards) for (const l of c.lines) allValues.push(l.valueUsdc ?? null);
  for (const c of burrowCards) for (const l of c.lines) allValues.push(l.valueUsdc ?? null);
  for (const c of benqiCards) for (const l of c.lines) allValues.push(l.valueUsdc ?? null);
  for (const c of uniCards) for (const l of c.lines) allValues.push(l.valueUsdc ?? null);
  for (const c of extraLendCards) for (const l of c.lines) allValues.push(l.valueUsdc ?? null);
  for (const l of stake) {
    if (l.inWallet && !isLst(l.chainId, l.contract)) continue;
    allValues.push(l.valueUsdc ?? null);
  }
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
    const nLend = (id === "all" ? lendExtra : lendExtra.filter((c) => c.chainId === id)).reduce((n, c) => n + c.lines.length, 0);
    const nStake = id === "all" ? stakeAll.length : stakeAll.filter((l) => l.chainId === id).length;
    return nWallet + nAave + nBurrow + nBenqi + nUni + nLend + nStake;
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
                {native.tronAddress ? (
                  <div className="me-id">
                    <img src="/tokens/trx.png" alt="" width={28} height={28} />
                    <div>
                      <b>TRX</b>
                      <span className="num">{short(native.tronAddress, 8, 6)}</span>
                    </div>
                  </div>
                ) : null}
                {native.suiAddress ? (
                  <div className="me-id">
                    <img src="/tokens/sui.png" alt="" width={28} height={28} />
                    <div>
                      <b>SUI</b>
                      <span className="num">{short(native.suiAddress, 8, 6)}</span>
                    </div>
                  </div>
                ) : null}
                {native.tonAddress ? (
                  <div className="me-id">
                    <img src="/tokens/ton.png" alt="" width={28} height={28} />
                    <div>
                      <b>TON</b>
                      <span className="num">{short(native.tonAddress, 8, 6)}</span>
                    </div>
                  </div>
                ) : null}
                {native.aptosAddress ? (
                  <div className="me-id">
                    <img src="/tokens/apt.png" alt="" width={28} height={28} />
                    <div>
                      <b>APT</b>
                      <span className="num">{short(native.aptosAddress, 8, 6)}</span>
                    </div>
                  </div>
                ) : null}
                {native.bitcoinAddress ? (
                  <div className="me-id">
                    <img src="/tokens/btc.png" alt="" width={28} height={28} />
                    <div>
                      <b>BTC</b>
                      <span className="num">{short(native.bitcoinAddress, 8, 6)}</span>
                    </div>
                  </div>
                ) : null}
                {native.xrplAddress ? (
                  <div className="me-id">
                    <img src="/tokens/xrp.png" alt="" width={28} height={28} />
                    <div>
                      <b>XRP</b>
                      <span className="num">{short(native.xrplAddress, 8, 6)}</span>
                    </div>
                  </div>
                ) : null}
                {native.stellarAddress ? (
                  <div className="me-id">
                    <img src="/tokens/xlm.png" alt="" width={28} height={28} />
                    <div>
                      <b>XLM</b>
                      <span className="num">{short(native.stellarAddress, 8, 6)}</span>
                    </div>
                  </div>
                ) : null}
                {native.cosmosAddress || native.osmosisAddress || native.celestiaAddress ? (
                  <div className="me-id">
                    <img src="/tokens/atom.png" alt="" width={28} height={28} />
                    <div>
                      <b>Keplr</b>
                      <span className="num">{short(native.cosmosAddress || native.osmosisAddress || native.celestiaAddress, 8, 6)}</span>
                    </div>
                  </div>
                ) : null}
                {native.starknetAddress ? (
                  <div className="me-id">
                    <img src="/tokens/strk.png" alt="" width={28} height={28} />
                    <div>
                      <b>STRK</b>
                      <span className="num">{short(native.starknetAddress, 8, 6)}</span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="me-chips-bar">
                <div className="me-chips">
                  <button type="button" className={`me-chip ${filter === "all" ? "me-chip-on" : ""}`} onClick={() => setFilter("all")}>
                    {t("me.all")}
                    <span className="me-count">{chipCount("all")}</span>
                  </button>
                  {buckets
                    .filter((g) => !hideZero || chipCount(g.id) > 0)
                    .map((g) => (
                      <button key={g.id} type="button" className={`me-chip ${filter === g.id ? "me-chip-on" : ""}`} onClick={() => setFilter(g.id)}>
                        <img src={g.icon} alt="" width={20} height={20} />
                        {g.label}
                        <ChipBusy chainId={g.id} />
                        <span className="me-count">{chipCount(g.id)}</span>
                      </button>
                    ))}
                </div>
                <label className="me-hide-zero">
                  <input
                    type="checkbox"
                    checked={hideZero}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setHideZero(on);
                      if (on && filter !== "all" && chipCount(filter) === 0) setFilter("all");
                    }}
                  />
                  {t("me.hideZero")}
                </label>
              </div>

              <section className="me-card">
                <div className="me-card-head">
                  <b>{t("me.wallet")}</b>
                  <span className="me-count">{fmtUsdc(walletRows.reduce((n, r) => n + (valued(r.raw, rowDecimals(r), quotes.get(quoteKey(r.chainId ?? 0, r.contract, r.native))) ?? 0), 0))}</span>
                </div>
                <ValueHeads sort={walletSort} />
                {walletRows.length === 0 ? (
                  <p className="me-card-empty">{t("me.emptyChain")}</p>
                ) : (
                  <div className="me-list">
                    {walletSort.sorted.map((r) => {
                      const q = quotes.get(quoteKey(r.chainId ?? 0, r.contract, r.native));
                      const v = valued(r.raw, rowDecimals(r), q);
                      const loading = buckets.find((g) => g.id === r.chainId)?.loading;
                      const quoting = liveJobs.some((j) => j.chainId === r.chainId && j.kind === "quote" && j.phase !== "fail");
                      return (
                        <Line
                          key={r.id}
                          icon={r.icon}
                          tag={r.chainTag}
                          title={r.symbol}
                          subtitle={r.native ? r.name || t("wallet.nativeCoin") : `${r.name}${r.contract ? ` · ${short(r.contract)}` : ""}`}
                          amount={loading ? "…" : r.amount}
                          price={q ? fmtUsdc(q.usdc) : quoting ? "…" : "—"}
                          value={v == null ? (quoting ? "…" : "—") : fmtUsdc(v)}
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
                  <ProtocolTable
                    lines={c.lines}
                    render={(l) => (
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
                    )}
                  />
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
                  <ProtocolTable
                    lines={c.lines}
                    render={(l) => (
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
                    )}
                  />
                </section>
              ))}

              {extraLendCards.map((c) => (
                <section key={`lend-${c.protocol}-${c.chainId}`} className="me-card">
                  <div className="me-card-head">
                    <b>
                      {c.protocol} · {c.chain}
                    </b>
                    <span className="me-count">
                      {c.health !== "—" ? `${t("me.health")} ${c.health}` : fmtUsdc(c.lines.reduce((n, l) => n + (l.valueUsdc ?? 0), 0))}
                    </span>
                  </div>
                  <ProtocolTable
                    lines={c.lines}
                    render={(l) => (
                      <Line
                        key={l.id}
                        icon={l.icon}
                        tag={l.chain}
                        title={l.symbol}
                        subtitle={l.side === "borrow" ? t("me.borrowed") : t("me.supplied")}
                        amount={l.amount}
                        price={l.quote ? fmtUsdc(l.quote.usdc) : "—"}
                        value={l.valueUsdc == null ? "—" : fmtUsdc(l.valueUsdc)}
                        href={explorerFor(l.chainId, l.contract)}
                      />
                    )}
                  />
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
                  <ProtocolTable
                    lines={c.lines}
                    render={(l) => (
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
                    )}
                  />
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
                  <ProtocolTable
                    lines={c.lines}
                    render={(l) => (
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
                    )}
                  />
                </section>
              ))}

              {stake.length ? (
                <section className="me-card">
                  <div className="me-card-head">
                    <b>{t("me.staking")}</b>
                    <span className="me-count">{fmtUsdc(stake.reduce((n, l) => n + (l.valueUsdc ?? 0), 0))}</span>
                  </div>
                  <ValueHeads sort={stakeSort} />
                  <div className="me-list">
                    {stakeSort.sorted.map((l) => (
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
                    <SortHead id="name" label={t("me.token")} active={launchedSort.key === "name"} dir={launchedSort.dir} onToggle={launchedSort.toggle} align="left" />
                    <span>{t("me.quote")}</span>
                    <span>{t("me.amount")}</span>
                    <SortHead id="chain" label={t("lp.cols.chain")} active={launchedSort.key === "chain"} dir={launchedSort.dir} onToggle={launchedSort.toggle} />
                  </div>
                  <div className="me-list">
                    {launchedSort.sorted.map((r) => (
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
