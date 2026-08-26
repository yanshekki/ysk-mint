import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAccount } from "wagmi";
import { featuredChains, isConfigured, launchContracts } from "@ysk-mint/config";
import { useLpFeed, type LpFilter } from "../../lib/useLpFeed.ts";
import { useDexMarkets } from "../../lib/useDexMarkets.ts";
import { useDexLp } from "../../lib/useDexLp.ts";
import { fmtUsdc } from "../../lib/defiQuotes.ts";
import { chainIcon } from "../../lib/chainIcon.ts";
import { useNativeWallets } from "../../lib/nativeWallets.ts";
import { useCardanoHoldings } from "../../lib/useHoldings.ts";

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

  return (
    <section className="workspace">
      <div className="workspace-head">
        <div>
          <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-text-muted">{t("lp.kicker")}</p>
          <h1>{t("nav.lp")}</h1>
          <p className="mt-1 text-[15px] text-text-sub">{t("lp.hint")}</p>
        </div>
      </div>
      <div className="workspace-scroll">
        <div className="me-desk">
          <div className="me-chips">
            <button type="button" className={`me-chip ${filter === "all" ? "me-chip-on" : ""}`} onClick={() => setFilter("all")}>
              {t("lp.all")}
            </button>
            {featured.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`me-chip ${filter === c.chainId ? "me-chip-on" : ""}`}
                onClick={() => setFilter(c.chainId)}
              >
                <img src={chainIcon(c)} alt="" width={20} height={20} />
                {c.short}
              </button>
            ))}
          </div>

          {mine.rows.length ? (
            <section className="me-card">
              <div className="me-card-head">
                <b>{t("lp.myLp")}</b>
                <span className="me-count">{mine.rows.length}</span>
              </div>
              <div className="me-list">
                {mine.rows.map((r) => (
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
              <p className="me-card-empty">{t("lp.loading")}</p>
            ) : !markets.rows.length ? (
              <p className="me-card-empty">{t("lp.emptyMarkets")}</p>
            ) : (
              <div className="me-list">
                <div className="me-cols me-cols-5">
                  <span>{t("lp.markets")}</span>
                  <span>{t("me.quote")}</span>
                  <span>{t("lp.venues")}</span>
                  <span>{t("lp.depth")}</span>
                </div>
                {markets.loading ? <p className="me-card-empty">{t("lp.loading")}</p> : null}
                {markets.rows.map((r) => (
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
              <div className="me-list">
                {locks.rows.map((r) => (
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
