import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAccount } from "wagmi";
import { featuredChains, isConfigured, launchContracts } from "@ysk-mint/config";
import { useLpFeed, type LpFilter, type LpRow } from "../../lib/useLpFeed.ts";
import { useDexMarkets, type MarketRow } from "../../lib/useDexMarkets.ts";
import { useDexLp, type MyLpRow } from "../../lib/useDexLp.ts";
import { fmtUsdc } from "../../lib/defiQuotes.ts";
import { chainIcon } from "../../lib/chainIcon.ts";
import { useNativeWallets } from "../../lib/nativeWallets.ts";
import { useCardanoHoldings } from "../../lib/useHoldings.ts";
import { ChipBusy } from "../../shared/ui/LiveDock.tsx";
import { useLiveStatus } from "../../lib/liveStatus.ts";
import { SortHead, useSort } from "../../shared/ui/SortTable.tsx";
import { ttCoverageLine } from "../../lib/defi/coverage.ts";

/** High-usage chains shown before 「更多」. Order follows featuredChains(). */
const PRIMARY_MARKET_IDS = new Set([1, 101, 56, 8453, 42161, 43114, 137, 784, 607, 999]);

function fmtUnlock(ts: number) {
  if (!ts) return "—";
  return new Date(ts * 1000).toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

function short(a: string) {
  if (!a || a.length < 10) return a || "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function LpPage() {
  const { t } = useTranslation();
  const { address } = useAccount();
  const native = useNativeWallets();
  const ada = useCardanoHoldings(native.cardanoAddress, {
    addresses: native.cardanoAddresses,
    stake: native.cardanoStake,
    sync: native.cardanoSync,
  });
  const featured = featuredChains();
  const [filter, setFilter] = useState<number | "all">("all");
  const [moreChains, setMoreChains] = useState(false);
  const primaryChains = useMemo(() => featured.filter((c) => PRIMARY_MARKET_IDS.has(c.chainId)), [featured]);
  const extraChains = useMemo(() => featured.filter((c) => !PRIMARY_MARKET_IDS.has(c.chainId)), [featured]);
  const visibleChains = useMemo(() => {
    if (moreChains) return featured;
    const pinned = extraChains.filter((c) => c.chainId === filter);
    return pinned.length ? [...primaryChains, ...pinned] : primaryChains;
  }, [featured, moreChains, extraChains, primaryChains, filter]);
  const selected = filter === "all" ? undefined : featured.find((c) => c.chainId === filter);
  const lockFilter: LpFilter = filter === "all" ? "all" : (selected?.key ?? "all");
  const markets = useDexMarkets(filter);
  const adaUnitsKey = useMemo(
    () =>
      ada.rows
        .map((r) => r.contract)
        .filter((x): x is string => Boolean(x))
        .join("|"),
    [ada.rows],
  );
  const mine = useDexLp(address, filter, {
    near: native.nearAccount,
    cardanoUnits: adaUnitsKey ? adaUnitsKey.split("|") : [],
  });
  const locks = useLpFeed(lockFilter);
  const jobs = useLiveStatus((s) => s.jobs);
  const reading = useMemo(() => {
    const marketJobs = jobs.filter((j) => j.kind === "markets" && j.phase !== "fail");
    return marketJobs.find((j) => j.phase === "run") ?? marketJobs[0];
  }, [jobs]);
  const readingShort = featured.find((c) => c.chainId === reading?.chainId)?.short;
  const marketGet = useCallback((r: MarketRow, k: string) => {
    if (k === "name") return `${r.symbolA}/${r.symbolB}`;
    if (k === "quote") return r.price;
    if (k === "venues") return r.venues.length || r.venueNames.length;
    return r.depth;
  }, []);
  const marketSort = useSort(markets.rows, "depth", marketGet);
  const lpGet = useCallback((r: MyLpRow, k: string) => {
    if (k === "name") return `${r.symbolA}/${r.symbolB}`;
    if (k === "venues") return r.venueCount;
    const n = Number(r.valueHint);
    return Number.isFinite(n) ? n : null;
  }, []);
  const lpSort = useSort(mine.rows, "value", lpGet);
  const lockGet = useCallback((r: LpRow, k: string) => {
    if (k === "name") return r.symbol;
    if (k === "unlock") return r.unlockAt;
    return Number(r.liquidity);
  }, []);
  const lockSort = useSort(locks.rows, "amount", lockGet);
  const tt = ttCoverageLine();

  return (
    <section className="workspace">
      <div className="workspace-head">
        <div>
          <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-text-muted">{t("lp.kicker")}</p>
          <h1>{t("nav.lp")}</h1>
          <p className="mt-1 text-[15px] text-text-sub">{t("lp.hint")}</p>
          <p className="mt-1 text-[13px] text-text-muted">
            {t("lp.ttCoverage", {
              asOf: tt.dex.asOf,
              dexWired: tt.dex.wired,
              dexTotal: tt.dex.total,
              lendWired: tt.lending.wired,
              lendTotal: tt.lending.total,
            })}
          </p>
        </div>
      </div>
      <div className="workspace-scroll">
        <div className="me-desk">
          <div className="me-chips">
            <button type="button" className={`me-chip ${filter === "all" ? "me-chip-on" : ""}`} onClick={() => setFilter("all")}>
              {t("lp.all")}
            </button>
            {visibleChains.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`me-chip ${filter === c.chainId ? "me-chip-on" : ""}`}
                onClick={() => setFilter(c.chainId)}
              >
                <img src={chainIcon(c)} alt="" width={20} height={20} />
                {c.short}
                <ChipBusy chainId={c.chainId} />
              </button>
            ))}
            {extraChains.length ? (
              <button type="button" className={`me-chip ${moreChains ? "me-chip-on" : ""}`} onClick={() => setMoreChains((v) => !v)}>
                {moreChains ? t("lp.lessChains") : t("lp.moreChains")}
                <span className="me-count">{extraChains.length}</span>
              </button>
            ) : null}
          </div>

          {mine.rows.length ? (
            <section className="me-card">
              <div className="me-card-head">
                <b>{t("lp.myLp")}</b>
                <span className="me-count">{mine.rows.length}</span>
              </div>
              <div className="me-cols me-cols-5">
                <SortHead id="name" label={t("lp.myLp")} active={lpSort.key === "name"} dir={lpSort.dir} onToggle={lpSort.toggle} align="left" />
                <SortHead id="venues" label={t("lp.venues")} active={lpSort.key === "venues"} dir={lpSort.dir} onToggle={lpSort.toggle} />
                <SortHead id="value" label={t("me.value")} active={lpSort.key === "value"} dir={lpSort.dir} onToggle={lpSort.toggle} />
                <span />
              </div>
              <div className="me-list">
                {lpSort.sorted.map((r) => (
                  <Link key={r.pairId} to={`/pair/${r.chainId}/${encodeURIComponent(r.tokenA)}/${encodeURIComponent(r.tokenB)}`} className="me-token me-token-5">
                    <span className="holding-ico-wrap">
                      <img src={r.iconA} alt="" className="holding-ico" />
                      <span className="holding-chain-tag">{r.symbolB.slice(0, 3)}</span>
                    </span>
                    <div className="holding-meta">
                      <b>
                        {r.symbolA}/{r.symbolB}
                      </b>
                      <span>{r.venueNames.join(" · ") || t("lp.venues")}</span>
                    </div>
                    <span className="num me-price">{r.venueCount}</span>
                    <span className="num holding-amt">{r.valueHint === "—" ? "—" : fmtUsdc(Number(r.valueHint))}</span>
                    <span className="num me-value" />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <section className="me-card">
            <div className="me-card-head">
              <b>{t("lp.markets")}</b>
              <span className="me-count">{markets.loading && !markets.rows.length ? "…" : markets.rows.length}</span>
            </div>
            {markets.error && !markets.rows.length ? (
              <p className="me-card-empty">{t("lp.rpcError")}</p>
            ) : !markets.rows.length && markets.loading ? (
              <p className="me-card-empty">{readingShort ? t("lp.loadingChain", { chain: readingShort }) : t("lp.loading")}</p>
            ) : !markets.rows.length ? (
              <p className="me-card-empty">{t("lp.emptyMarkets")}</p>
            ) : (
              <div className="me-list">
                <div className="me-cols me-cols-5">
                  <SortHead id="name" label={t("lp.markets")} active={marketSort.key === "name"} dir={marketSort.dir} onToggle={marketSort.toggle} align="left" />
                  <SortHead id="quote" label={t("me.quote")} active={marketSort.key === "quote"} dir={marketSort.dir} onToggle={marketSort.toggle} />
                  <SortHead id="venues" label={t("lp.venues")} active={marketSort.key === "venues"} dir={marketSort.dir} onToggle={marketSort.toggle} />
                  <SortHead id="depth" label={t("lp.depth")} active={marketSort.key === "depth"} dir={marketSort.dir} onToggle={marketSort.toggle} />
                </div>
                {markets.loading && readingShort ? <p className="me-card-empty">{t("lp.loadingChain", { chain: readingShort })}</p> : null}
                {marketSort.sorted.map((r) => (
                  <Link key={r.pairId} to={`/pair/${r.chainId}/${encodeURIComponent(r.tokenA)}/${encodeURIComponent(r.tokenB)}`} className="me-token me-token-5">
                    <span className="holding-ico-wrap">
                      <img src={r.iconA} alt="" className="holding-ico" />
                      <span className="holding-chain-tag">{r.chainShort}</span>
                    </span>
                    <div className="holding-meta">
                      <b>
                        {r.symbolA}/{r.symbolB}
                      </b>
                      <span>{r.venueNames.join(" · ")}</span>
                    </div>
                    <span className="num me-price">{r.price == null ? "—" : fmtUsdc(r.price)}</span>
                    <span className="num holding-amt">{r.venues.length || r.venueNames.length}</span>
                    <span className="num me-value">{r.depth ? fmtUsdc(r.depth) : "—"}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {locks.rows.length ? (
            <section className="me-card">
              <div className="me-card-head">
                <b>{t("lp.productLocks")}</b>
                <span className="me-count">{locks.rows.length}</span>
              </div>
              <div className="me-cols me-cols-5">
                <SortHead id="name" label={t("lp.cols.token")} active={lockSort.key === "name"} dir={lockSort.dir} onToggle={lockSort.toggle} align="left" />
                <SortHead id="unlock" label={t("lp.cols.unlock")} active={lockSort.key === "unlock"} dir={lockSort.dir} onToggle={lockSort.toggle} />
                <SortHead id="amount" label={t("lp.cols.amount")} active={lockSort.key === "amount"} dir={lockSort.dir} onToggle={lockSort.toggle} />
                <span />
              </div>
              <div className="me-list">
                {lockSort.sorted.map((r) => (
                  <div key={`${r.chainId}-${r.lockId}-${r.lpToken}`} className="me-token me-token-5">
                    <span className="holding-ico-wrap">
                      <span className="holding-ico me-oft-mark">LP</span>
                    </span>
                    <div className="holding-meta">
                      <b>{r.symbol}</b>
                      <span className="num">
                        {r.chainShort} · {short(r.lpToken)} · {r.mode === 1 ? t("lp.burn") : t("lp.timed")}
                      </span>
                    </div>
                    <span className="num me-price">{r.mode === 1 ? "—" : fmtUnlock(r.unlockAt)}</span>
                    <span className="num holding-amt">{Number(r.liquidity).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                    <span className="num me-value">
                      {isConfigured(launchContracts(r.chainKey)) ? (
                        <a href={`${r.explorer}/address/${r.lpToken}`} target="_blank" rel="noreferrer">
                          {t("lp.open")}
                        </a>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}
