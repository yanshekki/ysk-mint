import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LocaleLink as Link } from "../../app/LocaleLink.tsx";
import { localePath } from "../../lib/locale.ts";
import { useTranslation } from "react-i18next";
import { scansMarketChain, useDexMarkets, type MarketRow } from "../../lib/useDexMarkets.ts";
import { fmtDepthUsd, fmtQuoteUsd } from "../../lib/defiQuotes.ts";
import { chainIcon } from "../../lib/chainIcon.ts";
import { ChipBusy } from "../../shared/ui/LiveDock.tsx";
import { useLiveStatus } from "../../lib/liveStatus.ts";
import { SortHead, useSort } from "../../shared/ui/SortTable.tsx";
import { Metric } from "../../shared/ui/Metric.tsx";
import { useUserSettings } from "../../lib/userSettings.ts";
import { isTokenizedUsEquityPair, usEquityChainIds, usEquityMarketChains } from "../../lib/usEquity.ts";

const PAGE = 50;
const STOCKS_KEY = "ysk-stocks";

function tokenImgFallback(symbol: string) {
  return (e: { currentTarget: HTMLImageElement }) => {
    const el = e.currentTarget;
    if (el.dataset.fb) return;
    el.dataset.fb = "1";
    el.src = /usd/i.test(symbol) ? "/tokens/usdc.png" : "/tokens/eth.png";
  };
}

function parseChain(raw: string | null): number | "all" {
  if (!raw || raw === "all") return "all";
  const n = Number(raw);
  return Number.isFinite(n) ? n : "all";
}

function normTok(s: string) {
  return s.toLowerCase().replace(/^w/, "");
}

/** Whole-token match. "near" must not hit LINEAR. */
function symHit(sym: string, needle: string) {
  const s = normTok(sym);
  const n = needle.toLowerCase().replace(/^w/, "");
  if (!n) return false;
  if (s === n) return true;
  if (n === "usd") return s.startsWith("usd");
  return false;
}

export function persistStocksQuery(q: string, chain: number | "all", n: number) {
  try {
    sessionStorage.setItem(STOCKS_KEY, JSON.stringify({ q, chain, n }));
  } catch {
    /* ignore */
  }
}

export function stocksHref() {
  try {
    const raw = sessionStorage.getItem(STOCKS_KEY);
    if (!raw) return localePath("/stocks");
    const saved = JSON.parse(raw) as { q?: string; chain?: number | "all"; n?: number };
    const p = new URLSearchParams();
    if (saved.q) p.set("q", saved.q);
    if (saved.chain && saved.chain !== "all" && usEquityChainIds.has(saved.chain) && scansMarketChain(saved.chain)) {
      p.set("chain", String(saved.chain));
    }
    if (saved.n && saved.n !== PAGE) p.set("n", String(saved.n));
    const s = p.toString();
    return localePath(s ? `/stocks?${s}` : "/stocks");
  } catch {
    return localePath("/stocks");
  }
}

export function StocksPage() {
  const { t } = useTranslation();
  const disabledChains = useUserSettings((s) => s.disabledChains);
  const stockChains = useMemo(() => usEquityMarketChains(disabledChains), [disabledChains]);
  const stockIds = useMemo(() => new Set(stockChains.map((c) => c.chainId)), [stockChains]);
  const [params, setParams] = useSearchParams();
  const rawFilter = parseChain(params.get("chain"));
  const filter = rawFilter !== "all" && !stockIds.has(rawFilter) ? "all" : rawFilter;
  const urlQ = params.get("q") ?? "";
  const [marketQ, setMarketQ] = useState(urlQ);
  const marketQRef = useRef(marketQ);
  marketQRef.current = marketQ;
  const searchFocused = useRef(false);
  const restored = useRef(false);
  const shownCap = Math.max(PAGE, Number(params.get("n")) || PAGE);
  const markets = useDexMarkets(filter, stockIds);
  const jobs = useLiveStatus((s) => s.jobs);
  const reading = useMemo(() => {
    const marketJobs = jobs.filter((j) => j.kind === "markets" && stockIds.has(j.chainId) && j.phase !== "fail");
    return marketJobs.find((j) => j.phase === "run") ?? marketJobs[0];
  }, [jobs, stockIds]);
  const readingShort = stockChains.find((c) => c.chainId === reading?.chainId)?.short;
  const equityRows = useMemo(() => markets.rows.filter(isTokenizedUsEquityPair), [markets.rows]);
  const marketGet = useCallback((r: MarketRow, k: string) => {
    if (k === "name") return `${r.symbolA}/${r.symbolB}`;
    if (k === "quote") return r.price;
    if (k === "venues") return r.venues.length || r.venueNames.length;
    return r.depth;
  }, []);
  const marketFiltered = useMemo(() => {
    const q = marketQ.trim().toLowerCase();
    if (!q) return equityRows;
    const addrQ = q.startsWith("0x") || (q.length >= 8 && /^[0-9a-f]+$/.test(q));
    const parts = q.split(/[/\s]+/).filter(Boolean);
    return equityRows.filter((r) => {
      if (parts.length >= 2) {
        const [qa, qb] = parts;
        return (symHit(r.symbolA, qa) && symHit(r.symbolB, qb)) || (symHit(r.symbolA, qb) && symHit(r.symbolB, qa));
      }
      if (symHit(r.symbolA, q) || symHit(r.symbolB, q)) return true;
      if (r.venueNames.some((n) => n.toLowerCase().includes(q))) return true;
      if (filter === "all" && r.chainShort.toLowerCase() === q) return true;
      if (addrQ && (r.tokenA.toLowerCase().includes(q) || r.tokenB.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [equityRows, filter, marketQ]);
  const marketSort = useSort(marketFiltered, "depth", marketGet);
  const marketVisible = useMemo(() => marketSort.sorted.slice(0, shownCap), [shownCap, marketSort.sorted]);
  const marketMore = marketVisible.length < marketSort.sorted.length;
  useEffect(() => {
    if (rawFilter === "all" || stockIds.has(rawFilter) || !stockIds.size) return;
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete("chain");
        p.delete("n");
        return p;
      },
      { replace: true },
    );
  }, [rawFilter, setParams, stockIds]);
  useEffect(() => {
    if (searchFocused.current) return;
    if (urlQ !== marketQRef.current) setMarketQ(urlQ);
  }, [urlQ]);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const here = new URLSearchParams(window.location.search);
    if (here.get("q") || here.get("chain") || here.get("n")) return;
    if (searchFocused.current || marketQRef.current) return;
    try {
      const raw = sessionStorage.getItem(STOCKS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { q?: string; chain?: number | "all"; n?: number };
      const p = new URLSearchParams();
      if (saved.q) p.set("q", saved.q);
      if (saved.chain && saved.chain !== "all" && stockIds.has(saved.chain)) p.set("chain", String(saved.chain));
      if (saved.n && saved.n !== PAGE) p.set("n", String(saved.n));
      if (![...p.keys()].length) return;
      if (saved.q) setMarketQ(saved.q);
      setParams(p, { replace: true });
    } catch {
      /* ignore */
    }
  }, [setParams]);
  const writeSearch = useCallback(
    (q: string) => {
      const cur = new URLSearchParams(window.location.search).get("q") ?? "";
      if (cur === q) return;
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (!q) p.delete("q");
          else p.set("q", q);
          p.delete("n");
          return p;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  useEffect(() => {
    persistStocksQuery(marketQ, filter, shownCap);
  }, [filter, marketQ, shownCap]);
  useEffect(() => {
    const handle = window.setTimeout(() => writeSearch(marketQ), 250);
    return () => window.clearTimeout(handle);
  }, [marketQ, writeSearch]);

  function setChainFilter(next: number | "all") {
    persistStocksQuery(marketQ, next, shownCap);
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next === "all") p.delete("chain");
      else p.set("chain", String(next));
      p.delete("n");
      return p;
    });
  }

  return (
    <section className="workspace">
      <div className="workspace-head">
        <div>
          <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-text-muted">{t("stocks.kicker")}</p>
          <h1>{t("nav.stocks")}</h1>
          <p className="mt-1 text-[15px] text-text-sub">{t("stocks.hint")}</p>
        </div>
      </div>
      <div className="workspace-scroll">
        <div className="me-desk">
          <div className="me-chips">
            <button type="button" className={`me-chip ${filter === "all" ? "me-chip-on" : ""}`} onClick={() => setChainFilter("all")}>
              {t("lp.all")}
            </button>
            {stockChains.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`me-chip ${filter === c.chainId ? "me-chip-on" : ""}`}
                onClick={() => setChainFilter(c.chainId)}
              >
                <img src={chainIcon(c)} alt="" width={20} height={20} />
                {c.short}
                <ChipBusy chainId={c.chainId} />
              </button>
            ))}
          </div>

          <section className="me-card">
            <div className="me-card-head">
              <b>{t("nav.stocks")}</b>
              <input
                className="me-filter"
                type="text"
                value={marketQ}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                onFocus={() => {
                  searchFocused.current = true;
                }}
                onBlur={() => {
                  searchFocused.current = false;
                  writeSearch(marketQRef.current);
                }}
                onChange={(e) => setMarketQ(e.target.value)}
                placeholder={t("stocks.search")}
                aria-label={t("stocks.search")}
              />
              <span className="me-count">{markets.loading && !equityRows.length ? "…" : marketSort.sorted.length}</span>
            </div>
            {markets.error && !equityRows.length ? (
              <p className="me-card-empty">{t("lp.rpcError")}</p>
            ) : !equityRows.length && markets.loading ? (
              <p className="me-card-empty">{readingShort ? t("lp.loadingChain", { chain: readingShort }) : t("lp.loading")}</p>
            ) : !equityRows.length ? (
              <p className="me-card-empty">{t("stocks.empty")}</p>
            ) : !marketSort.sorted.length ? (
              <p className="me-card-empty">{t("stocks.emptyFilter")}</p>
            ) : (
              <div className="me-list">
                <div className="me-cols me-cols-5 me-cols-markets">
                  <SortHead id="name" label={t("nav.stocks")} active={marketSort.key === "name"} dir={marketSort.dir} onToggle={marketSort.toggle} align="left" />
                  <SortHead id="quote" label={t("me.quote")} active={marketSort.key === "quote"} dir={marketSort.dir} onToggle={marketSort.toggle} />
                  <SortHead id="venues" label={t("lp.poolCount")} active={marketSort.key === "venues"} dir={marketSort.dir} onToggle={marketSort.toggle} />
                  <SortHead id="depth" label={t("lp.depth")} active={marketSort.key === "depth"} dir={marketSort.dir} onToggle={marketSort.toggle} />
                </div>
                {markets.loading && readingShort ? <p className="me-card-empty">{t("lp.loadingChain", { chain: readingShort })}</p> : null}
                {marketVisible.map((r) => (
                  <Link key={r.pairId} to={`/pair/${r.chainId}/${encodeURIComponent(r.tokenA)}/${encodeURIComponent(r.tokenB)}`} className="me-token me-token-5 me-token-markets">
                    <span className="holding-ico-wrap">
                      <img src={r.iconA} alt="" className="holding-ico" onError={tokenImgFallback(r.symbolA)} />
                      <span className="holding-chain-tag">{r.chainShort}</span>
                    </span>
                    <div className="holding-meta">
                      <b>
                        {r.symbolA}/{r.symbolB}
                      </b>
                      <span>{r.venueNames.join(" · ")}</span>
                    </div>
                    <Metric className="num me-price" label={t("me.quote")}>
                      {r.price == null ? "—" : fmtQuoteUsd(r.price)}
                    </Metric>
                    <Metric className="num holding-amt" label={t("lp.poolCount")}>
                      {r.venues.length || r.venueNames.length}
                    </Metric>
                    <Metric className="num me-value" label={t("lp.depth")}>
                      {r.depth ? fmtDepthUsd(r.depth) : "—"}
                    </Metric>
                  </Link>
                ))}
                {marketMore ? (
                  <button
                    type="button"
                    className="me-more-rows"
                    onClick={() =>
                      setParams((prev) => {
                        const p = new URLSearchParams(prev);
                        p.set("n", String(shownCap + PAGE));
                        return p;
                      })
                    }
                  >
                    {t("lp.moreRows")}
                  </button>
                ) : null}
                <p className="me-shown">{t("lp.shown", { shown: marketVisible.length, total: marketSort.sorted.length })}</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
