import { useCallback, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAccount } from "wagmi";
import { CHAINS } from "@ysk-mint/config";
import { fmtUsdc } from "../../lib/defiQuotes.ts";
import { lendAppHref, lendExplorerHref } from "../../lib/lendApp.ts";
import { fmtApy, fmtUsd, sameLendToken, shortAddr, utilOf } from "../../lib/lendFormat.ts";
import { groupLendAssets, type LendMarketRow } from "../../lib/lendMarkets.ts";
import { useLendMarkets } from "../../lib/useLendMarkets.ts";
import { useMyLending } from "../../lib/useMyLending.ts";
import { useNativeWallets } from "../../lib/nativeWallets.ts";
import { SortHead, useSort } from "../../shared/ui/SortTable.tsx";
import { lendHref } from "./LendPage.tsx";

export function LendAssetPage() {
  const { t } = useTranslation();
  const { chainId: cid, token: rawToken } = useParams();
  const chainId = Number(cid);
  const token = decodeURIComponent(rawToken || "");
  const chain = Object.values(CHAINS).find((c) => c.chainId === chainId);
  const { address } = useAccount();
  const native = useNativeWallets();
  const markets = useLendMarkets(Number.isFinite(chainId) ? chainId : "all");
  const mine = useMyLending(Number.isFinite(chainId) ? chainId : "all");
  const hasWallet = Boolean(
    address || native.nearAccount || native.solanaAddress || native.suiAddress || native.tronAddress || native.aptosAddress,
  );

  const venues = useMemo(
    () => markets.rows.filter((r) => sameLendToken(r.token, token)).sort((a, b) => (b.supplyUsd ?? 0) - (a.supplyUsd ?? 0)),
    [markets.rows, token],
  );
  const asset = useMemo(() => groupLendAssets(venues)[0], [venues]);
  const mineRows = useMemo(
    () =>
      mine.rows.filter(
        (r) => r.chainId === chainId && (r.contract ? sameLendToken(r.contract, token) : r.symbol.toLowerCase() === (asset?.symbol ?? "").toLowerCase()),
      ),
    [asset?.symbol, chainId, mine.rows, token],
  );

  const venueGet = useCallback((r: LendMarketRow, k: string) => {
    if (k === "name") return r.protocol;
    if (k === "supply") return r.supplyApy;
    if (k === "borrow") return r.borrowApy;
    return r.supplyUsd;
  }, []);
  const venueSort = useSort(venues, "tvl", venueGet);

  if (!token || !Number.isFinite(chainId)) {
    return (
      <section className="workspace">
        <p className="workspace-scroll">{t("lend.assetMissing")}</p>
      </section>
    );
  }

  const symbol = asset?.symbol ?? shortAddr(token);
  const icon = asset?.icon ?? "/tokens/eth.png";
  const exploreToken = lendExplorerHref(chainId, token === "native" ? undefined : token);

  return (
    <section className="workspace">
      <div className="workspace-head">
        <div className="lend-asset-head">
          <span className="holding-ico-wrap">
            <img src={icon} alt="" className="holding-ico" />
            <span className="holding-chain-tag">{chain?.short ?? String(chainId)}</span>
          </span>
          <div>
            <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-text-muted">
              <Link to={lendHref()}>{t("nav.lend")}</Link>
              {" · "}
              {chain?.short ?? chainId}
            </p>
            <h1>{symbol}</h1>
            <p className="mt-1 text-[15px] text-text-sub">{t("lend.assetHint")}</p>
            <p className="mt-1 text-[13px] text-text-muted num">
              {shortAddr(token)}
              {exploreToken ? (
                <>
                  {" · "}
                  <a href={exploreToken} target="_blank" rel="noreferrer">
                    {t("lend.explorer")}
                  </a>
                </>
              ) : null}
            </p>
          </div>
        </div>
        <div className="lend-stats">
          <div className="lend-stat">
            <b>{asset?.supplyUsd == null && markets.loading ? "…" : fmtUsd(asset?.supplyUsd ?? null)}</b>
            <span>{t("lend.statTvl")}</span>
          </div>
          <div className="lend-stat">
            <b className="lend-apy-in">{fmtApy(asset?.supplyApy ?? null)}</b>
            <span>{t("lend.supplyApy")}</span>
          </div>
          <div className="lend-stat">
            <b className="lend-apy-out">{fmtApy(asset?.borrowApy ?? null)}</b>
            <span>{t("lend.borrowApy")}</span>
          </div>
        </div>
      </div>
      <div className="workspace-scroll">
        <div className="me-desk">
          {hasWallet && (mine.loading || mineRows.length) ? (
            <section className="me-card">
              <div className="me-card-head">
                <b>{t("lend.my")}</b>
                <span className="me-count">{mine.loading && !mineRows.length ? "…" : mineRows.length}</span>
              </div>
              {mine.loading && !mineRows.length ? (
                <p className="me-card-empty">{t("lend.loadingMine")}</p>
              ) : (
                mineRows.map((r) => {
                  const href = lendExplorerHref(r.chainId, r.contract);
                  const app = lendAppHref(r.protocol, r.chainId, r.contract);
                  return (
                    <div key={r.id} className="me-token me-token-5 me-token-lend">
                      <span className="holding-ico-wrap">
                        <img src={r.icon} alt="" className="holding-ico" />
                      </span>
                      <div className="holding-meta">
                        <b>{r.protocol}</b>
                        <span>
                          <em className={`lend-side ${r.side === "borrow" ? "lend-side-out" : "lend-side-in"}`}>
                            {r.side === "borrow" ? t("lend.sideBorrow") : t("lend.sideSupply")}
                          </em>
                          {r.extra ? ` · ${r.extra}` : ""}
                        </span>
                      </div>
                      <span className="num me-price">{r.amount}</span>
                      <span className="num holding-amt me-lend-borrow" />
                      <span className="num me-value">{r.valueUsdc == null ? "—" : fmtUsdc(r.valueUsdc)}</span>
                      <span className="me-pool-acts">
                        {href ? (
                          <a className="me-pool-btn me-pool-btn-explore" href={href} target="_blank" rel="noreferrer">
                            {t("lend.explorer")}
                          </a>
                        ) : null}
                        {app ? (
                          <a className="me-pool-btn me-pool-btn-dex" href={app} target="_blank" rel="noreferrer">
                            {t("lend.openApp")}
                          </a>
                        ) : null}
                      </span>
                    </div>
                  );
                })
              )}
            </section>
          ) : null}

          <section className="me-card">
            <div className="me-card-head">
              <b>{t("lend.venues")}</b>
              <span className="me-count">{markets.loading && !venues.length ? "…" : venues.length}</span>
            </div>
            {markets.error && !venues.length ? (
              <p className="me-card-empty">{t("lend.rpcError")}</p>
            ) : !venues.length && markets.loading ? (
              <p className="me-card-empty">{t("lend.loading")}</p>
            ) : !venues.length ? (
              <p className="me-card-empty">{t("lend.noVenues")}</p>
            ) : (
              <div className="me-list">
                <div className="me-cols me-cols-5 me-cols-lend">
                  <SortHead id="name" label={t("lp.protocol")} active={venueSort.key === "name"} dir={venueSort.dir} onToggle={venueSort.toggle} align="left" />
                  <SortHead id="supply" label={t("lend.supplyApy")} active={venueSort.key === "supply"} dir={venueSort.dir} onToggle={venueSort.toggle} />
                  <SortHead id="borrow" label={t("lend.borrowApy")} active={venueSort.key === "borrow"} dir={venueSort.dir} onToggle={venueSort.toggle} />
                  <SortHead id="tvl" label={t("lend.supplied")} active={venueSort.key === "tvl"} dir={venueSort.dir} onToggle={venueSort.toggle} />
                  <span />
                </div>
                {venueSort.sorted.map((r) => {
                  const util = utilOf(r);
                  const explore = lendExplorerHref(r.chainId, r.token === "native" ? r.market : r.token);
                  const app = lendAppHref(r.protocol, r.chainId, r.token);
                  return (
                    <div key={r.id} className="me-token me-token-5 me-token-lend">
                      <span className="holding-ico-wrap">
                        <img src={r.icon} alt="" className="holding-ico" />
                      </span>
                      <div className="holding-meta">
                        <b>{r.protocol}</b>
                        <span>
                          {r.chainShort}
                          {util != null && util >= 1 ? ` · ${t("lend.util")} ${util.toFixed(0)}%` : ""}
                        </span>
                        {util != null && util >= 1 ? (
                          <i className="lend-util" aria-hidden>
                            <i style={{ width: `${util}%` }} />
                          </i>
                        ) : null}
                      </div>
                      <span className="num me-price lend-apy-in">{fmtApy(r.supplyApy)}</span>
                      <span className="num holding-amt me-lend-borrow lend-apy-out">{fmtApy(r.borrowApy)}</span>
                      <span className="num me-value">{fmtUsd(r.supplyUsd)}</span>
                      <span className="me-pool-acts">
                        {explore ? (
                          <a className="me-pool-btn me-pool-btn-explore" href={explore} target="_blank" rel="noreferrer">
                            {t("lend.explorer")}
                          </a>
                        ) : null}
                        {app ? (
                          <a className="me-pool-btn me-pool-btn-dex" href={app} target="_blank" rel="noreferrer">
                            {t("lend.openApp")}
                          </a>
                        ) : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
