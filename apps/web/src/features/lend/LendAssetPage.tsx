import { useCallback, useMemo, type ReactNode } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { LocaleLink as Link, LocaleNavigate as Navigate } from "../../app/LocaleLink.tsx";
import { useSeoExtra } from "../../lib/seo.ts";
import { useTranslation } from "react-i18next";
import { CHAINS } from "@ysk-mint/config";
import { chainIcon } from "../../lib/chainIcon.ts";
import { lendAppHref, lendExplorerHref } from "../../lib/lendApp.ts";
import { fmtApy, fmtApyRange, fmtUsd, sameLendToken, utilOf } from "../../lib/lendFormat.ts";
import { groupLendAssets, groupLendByChain, lendSymbolSlug, type LendMarketRow } from "../../lib/lendMarkets.ts";
import { TOKEN_CATALOG } from "../../lib/tokenRegistry.ts";
import { useLendMarkets } from "../../lib/useLendMarkets.ts";
import { useSort } from "../../shared/ui/SortTable.tsx";
import { Metric } from "../../shared/ui/Metric.tsx";
import { LendChainBar, lendHref, persistLendQuery } from "./LendPage.tsx";

function parseChain(raw: string | null): number | "all" {
  if (!raw || raw === "all") return "all";
  const n = Number(raw);
  return Number.isFinite(n) ? n : "all";
}

function ChainHead({ name, icon, right }: { name: string; icon?: string; right?: ReactNode }) {
  return (
    <div className="lend-group-head">
      <span>
        {icon ? <img src={icon} alt="" width={16} height={16} /> : null}
        {name}
      </span>
      {right ? <span>{right}</span> : null}
    </div>
  );
}

export function LendAssetRedirect() {
  const { chainId: cid, token: rawToken } = useParams();
  const loc = useLocation();
  const chainId = Number(cid);
  const token = decodeURIComponent(rawToken || "");
  const catalog = TOKEN_CATALOG.find(
    (t) => t.chainId === chainId && ((t.native && token === "native") || (t.address && t.address.toLowerCase() === token.toLowerCase())),
  );
  const markets = useLendMarkets(Number.isFinite(chainId) ? chainId : "all");
  const row = markets.rows.find((r) => sameLendToken(r.token, token));
  const slug = catalog ? lendSymbolSlug(catalog.symbol) : row ? lendSymbolSlug(row.symbol) : "";
  if (slug) return <Navigate to={`/lend/${slug}${loc.search}`} replace />;
  if (!markets.loading) return <Navigate to={lendHref()} replace />;
  return (
    <section className="workspace">
      <p className="me-card-empty">{markets.loading ? "…" : ""}</p>
    </section>
  );
}

export function LendAssetPage() {
  const { t } = useTranslation();
  const { symbol: rawSymbol } = useParams();
  const slug = lendSymbolSlug(rawSymbol || "");
  const [params, setParams] = useSearchParams();
  const filter = parseChain(params.get("chain"));
  const markets = useLendMarkets("all");

  const matched = useMemo(
    () => markets.rows.filter((r) => lendSymbolSlug(r.symbol) === slug).sort((a, b) => (b.supplyUsd ?? 0) - (a.supplyUsd ?? 0)),
    [markets.rows, slug],
  );
  const venues = useMemo(() => (filter === "all" ? matched : matched.filter((r) => r.chainId === filter)), [filter, matched]);
  const asset = useMemo(() => groupLendAssets(venues)[0], [venues]);
  const chains = useMemo(() => groupLendByChain(venues), [venues]);

  const venueGet = useCallback((r: LendMarketRow, k: string) => {
    if (k === "name") return r.protocol;
    if (k === "supply") return r.supplyApy;
    if (k === "borrow") return r.borrowApy;
    return r.supplyUsd;
  }, []);

  function setChainFilter(next: number | "all") {
    try {
      const raw = sessionStorage.getItem("ysk-lend");
      const saved = raw ? (JSON.parse(raw) as { q?: string; n?: number; p?: string }) : {};
      persistLendQuery(saved.q ?? "", next, saved.n ?? 50, saved.p ?? "all");
    } catch {
      persistLendQuery("", next, 50, "all");
    }
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next === "all") p.delete("chain");
      else p.set("chain", String(next));
      return p;
    });
  }

  const symbol = asset?.symbol ?? rawSymbol?.toUpperCase() ?? slug;
  const icon = asset?.icon ?? "/tokens/eth.png";
  useSeoExtra(
    slug && slug !== "x"
      ? { title: t("seo.lendAssetTitle", { symbol }), description: t("seo.lendAssetDesc", { symbol }) }
      : {},
  );

  if (!slug || slug === "x") {
    return (
      <section className="workspace">
        <p className="workspace-scroll">{t("lend.assetMissing")}</p>
      </section>
    );
  }

  return (
    <section className="workspace">
      <div className="workspace-head">
        <div className="lend-asset-head">
          <span className="holding-ico-wrap">
            <img src={icon} alt="" className="holding-ico" />
          </span>
          <div>
            <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-text-muted">
              <Link to={lendHref()}>{t("nav.lend")}</Link>
            </p>
            <h1>{symbol}</h1>
            <p className="mt-1 text-[15px] text-text-sub">{t("lend.assetHint")}</p>
          </div>
        </div>
        <div className="lend-stats">
          <div className="lend-stat">
            <b>{asset?.supplyUsd == null && markets.loading ? "…" : fmtUsd(asset?.supplyUsd ?? null)}</b>
            <span>{t("lend.statTvl")}</span>
          </div>
          <div className="lend-stat">
            <b className="lend-apy-in">{fmtApyRange(asset?.supplyApyMin, asset?.supplyApyMax)}</b>
            <span>{t("lend.supplyApy")}</span>
          </div>
          <div className="lend-stat">
            <b className="lend-apy-out">{fmtApyRange(asset?.borrowApyMin, asset?.borrowApyMax)}</b>
            <span>{t("lend.borrowApy")}</span>
          </div>
        </div>
      </div>
      <div className="workspace-scroll">
        <div className="me-desk">
          <LendChainBar filter={filter} onPick={setChainFilter} />
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
                  <span style={{ textAlign: "left" }}>{t("lp.protocol")}</span>
                  <span>{t("lend.supplyApy")}</span>
                  <span>{t("lend.borrowApy")}</span>
                  <span>{t("lend.supplied")}</span>
                  <span />
                </div>
                {chains.map((c) => {
                  const ch = Object.values(CHAINS).find((x) => x.chainId === c.chainId);
                  return (
                    <div key={c.chainId}>
                      <ChainHead
                        name={c.chainShort}
                        icon={ch ? chainIcon(ch) : undefined}
                        right={fmtUsd(c.supplyUsd)}
                      />
                      <ChainVenues rows={c.venues} get={venueGet} />
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

function ChainVenues({ rows, get }: { rows: LendMarketRow[]; get: (r: LendMarketRow, k: string) => string | number | null }) {
  const { t } = useTranslation();
  const sort = useSort(rows, "tvl", get);
  return (
    <>
      {sort.sorted.map((r) => {
        const util = utilOf(r);
        const explore = lendExplorerHref(r.chainId, r.token === "native" ? r.market : r.token);
        const app = lendAppHref(r.protocol, r.chainId, r.token);
        return (
          <div key={r.id} className="me-token me-token-5 me-token-lend">
            <span className="holding-ico-wrap">
              <img src={r.icon} alt="" className="holding-ico" />
            </span>
            <div className="holding-meta">
              <b>
                {app ? (
                  <a className="me-brand-link" href={app} target="_blank" rel="noreferrer">
                    {r.protocol}
                  </a>
                ) : (
                  r.protocol
                )}
              </b>
              <span>
                {r.symbol}
                {util != null && util >= 1 ? ` · ${t("lend.util")} ${util.toFixed(0)}%` : ""}
              </span>
              {util != null && util >= 1 ? (
                <i className="lend-util" aria-hidden>
                  <i style={{ width: `${util}%` }} />
                </i>
              ) : null}
            </div>
            <Metric className="num me-price lend-apy-in" label={t("lend.supplyApy")}>
              {fmtApy(r.supplyApy)}
            </Metric>
            <Metric className="num holding-amt me-lend-borrow lend-apy-out" label={t("lend.borrowApy")}>
              {fmtApy(r.borrowApy)}
            </Metric>
            <Metric className="num me-value" label={t("lend.supplied")}>
              {fmtUsd(r.supplyUsd)}
            </Metric>
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
    </>
  );
}
