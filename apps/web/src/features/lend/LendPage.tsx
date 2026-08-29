import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CHAINS, featuredChains, type ChainDefinition } from "@ysk-mint/config";
import { chainIcon } from "../../lib/chainIcon.ts";
import { fmtApyRange, fmtUsd, utilOf } from "../../lib/lendFormat.ts";
import { groupLendAssets, lendChainIds, lendSymbolSlug, type LendAssetRow } from "../../lib/lendMarkets.ts";
import { useLiveStatus } from "../../lib/liveStatus.ts";
import { useLendMarkets } from "../../lib/useLendMarkets.ts";
import { useUserSettings } from "../../lib/userSettings.ts";
import { ChipBusy } from "../../shared/ui/LiveDock.tsx";
import { SortHead, useSort } from "../../shared/ui/SortTable.tsx";

const PRIMARY_LEND_IDS = new Set([1, 8453, 42161, 43114, 56, 137, 10, 999, 101, 397, 784, 637]);
const PAGE = 50;
const LEND_KEY = "ysk-lend";

function parseChain(raw: string | null): number | "all" {
  if (!raw || raw === "all") return "all";
  const n = Number(raw);
  return Number.isFinite(n) ? n : "all";
}

export function persistLendQuery(q: string, chain: number | "all", n: number, p: string) {
  try {
    sessionStorage.setItem(LEND_KEY, JSON.stringify({ q, chain, n, p }));
  } catch {
    /* ignore */
  }
}

export function lendHref() {
  try {
    const raw = sessionStorage.getItem(LEND_KEY);
    if (!raw) return "/lend";
    const saved = JSON.parse(raw) as { q?: string; chain?: number | "all"; n?: number; p?: string };
    const next = new URLSearchParams();
    if (saved.q) next.set("q", saved.q);
    if (saved.chain && saved.chain !== "all") next.set("chain", String(saved.chain));
    if (saved.n && saved.n !== PAGE) next.set("n", String(saved.n));
    if (saved.p && saved.p !== "all") next.set("p", saved.p);
    const s = next.toString();
    return s ? `/lend?${s}` : "/lend";
  } catch {
    return "/lend";
  }
}

export function LendChainBar({ filter, onPick }: { filter: number | "all"; onPick: (next: number | "all") => void }) {
  const { t } = useTranslation();
  const disabledChains = useUserSettings((s) => s.disabledChains);
  const [moreChains, setMoreChains] = useState(false);
  const lendChains = useMemo(() => {
    const ids = new Set(lendChainIds("all", disabledChains));
    const seen = new Set<number>();
    const out: ChainDefinition[] = [];
    for (const c of featuredChains()) {
      if (!ids.has(c.chainId) || seen.has(c.chainId)) continue;
      seen.add(c.chainId);
      out.push(c);
    }
    for (const id of ids) {
      if (seen.has(id)) continue;
      const c = Object.values(CHAINS).find((x) => x.chainId === id);
      if (c) out.push(c);
    }
    return out;
  }, [disabledChains]);
  const primaryChains = useMemo(() => lendChains.filter((c) => PRIMARY_LEND_IDS.has(c.chainId)), [lendChains]);
  const extraChains = useMemo(() => lendChains.filter((c) => !PRIMARY_LEND_IDS.has(c.chainId)), [lendChains]);
  const visibleChains = useMemo(() => {
    if (moreChains) return lendChains;
    const pinned = extraChains.filter((c) => c.chainId === filter);
    return pinned.length ? [...primaryChains, ...pinned] : primaryChains;
  }, [extraChains, filter, lendChains, moreChains, primaryChains]);
  useEffect(() => {
    if (filter !== "all" && !PRIMARY_LEND_IDS.has(filter)) setMoreChains(true);
  }, [filter]);
  return (
    <div className="me-chips">
      <button type="button" className={`me-chip ${filter === "all" ? "me-chip-on" : ""}`} onClick={() => onPick("all")}>
        {t("lend.all")}
      </button>
      {visibleChains.map((c) => (
        <button
          key={c.key}
          type="button"
          className={`me-chip ${filter === c.chainId ? "me-chip-on" : ""}`}
          onClick={() => onPick(c.chainId)}
        >
          <img src={chainIcon(c)} alt="" width={20} height={20} />
          {c.short}
          <ChipBusy chainId={c.chainId} />
        </button>
      ))}
      {extraChains.length ? (
        <button type="button" className={`me-chip ${moreChains ? "me-chip-on" : ""}`} onClick={() => setMoreChains((v) => !v)}>
          {moreChains ? t("lend.lessChains") : t("lend.moreChains")}
          <span className="me-count">{extraChains.length}</span>
        </button>
      ) : null}
    </div>
  );
}

export function LendPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const filter = parseChain(params.get("chain"));
  const proto = params.get("p") || "all";
  const urlQ = params.get("q") ?? "";
  const [marketQ, setMarketQ] = useState(urlQ);
  const marketQRef = useRef(marketQ);
  marketQRef.current = marketQ;
  const searchFocused = useRef(false);
  const shownCap = Math.max(PAGE, Number(params.get("n")) || PAGE);
  const restored = useRef(false);

  const markets = useLendMarkets(filter);
  const jobs = useLiveStatus((s) => s.jobs);
  const reading = useMemo(() => {
    const lendJobs = jobs.filter((j) => j.kind === "lend" && j.phase !== "fail");
    return lendJobs.find((j) => j.phase === "run") ?? lendJobs[0];
  }, [jobs]);
  const readingShort = reading ? Object.values(CHAINS).find((c) => c.chainId === reading.chainId)?.short : undefined;

  const protocols = useMemo(() => {
    const c = new Map<string, number>();
    for (const r of markets.rows) c.set(r.protocol, (c.get(r.protocol) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [markets.rows]);

  const marketGet = useCallback((r: LendAssetRow, k: string) => {
    if (k === "name") return r.symbol;
    if (k === "supply") return r.supplyApyMax ?? r.supplyApy;
    if (k === "borrow") return r.borrowApyMin ?? r.borrowApy;
    if (k === "venues") return r.venues.length;
    return r.supplyUsd;
  }, []);

  const grouped = useMemo(() => {
    const src = proto === "all" ? markets.rows : markets.rows.filter((r) => r.protocol === proto);
    return groupLendAssets(src);
  }, [markets.rows, proto]);

  const marketFiltered = useMemo(() => {
    const q = marketQ.trim().toLowerCase();
    if (!q) return grouped;
    const addrQ = q.startsWith("0x") || (q.length >= 8 && /^[0-9a-f]+$/.test(q));
    return grouped.filter((r) => {
      if (r.symbol.toLowerCase().includes(q)) return true;
      if (r.venueNames.some((n) => n.toLowerCase().includes(q))) return true;
      if (r.chainNames.some((n) => n.toLowerCase().includes(q))) return true;
      if (addrQ && r.venues.some((v) => v.token.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [grouped, marketQ]);

  const marketSort = useSort(marketFiltered, "tvl", marketGet);
  const marketVisible = useMemo(() => marketSort.sorted.slice(0, shownCap), [marketSort.sorted, shownCap]);
  const marketMore = marketVisible.length < marketSort.sorted.length;

  const stats = useMemo(() => {
    let tvl = 0;
    let tvlN = 0;
    const protos = new Set<string>();
    for (const r of marketFiltered) {
      for (const n of r.venueNames) protos.add(n);
      if (r.supplyUsd != null && Number.isFinite(r.supplyUsd)) {
        tvl += r.supplyUsd;
        tvlN += 1;
      }
    }
    return { tvl: tvlN ? tvl : null, markets: marketFiltered.length, protocols: protos.size };
  }, [marketFiltered]);

  useEffect(() => {
    if (searchFocused.current) return;
    if (urlQ !== marketQRef.current) setMarketQ(urlQ);
  }, [urlQ]);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const here = new URLSearchParams(window.location.search);
    if (here.get("q") || here.get("chain") || here.get("n") || here.get("p")) return;
    if (searchFocused.current || marketQRef.current) return;
    try {
      const raw = sessionStorage.getItem(LEND_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { q?: string; chain?: number | "all"; n?: number; p?: string };
      const next = new URLSearchParams();
      if (saved.q) next.set("q", saved.q);
      if (saved.chain && saved.chain !== "all") next.set("chain", String(saved.chain));
      if (saved.n && saved.n !== PAGE) next.set("n", String(saved.n));
      if (saved.p && saved.p !== "all") next.set("p", saved.p);
      if (![...next.keys()].length) return;
      if (saved.q) setMarketQ(saved.q);
      setParams(next, { replace: true });
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
    persistLendQuery(marketQ, filter, shownCap, proto);
  }, [filter, marketQ, proto, shownCap]);
  useEffect(() => {
    const handle = window.setTimeout(() => writeSearch(marketQ), 250);
    return () => window.clearTimeout(handle);
  }, [marketQ, writeSearch]);

  function setChainFilter(next: number | "all") {
    persistLendQuery(marketQ, next, shownCap, proto);
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next === "all") p.delete("chain");
      else p.set("chain", String(next));
      p.delete("n");
      p.delete("p");
      return p;
    });
  }
  function setProto(next: string) {
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next === "all") p.delete("p");
      else p.set("p", next);
      p.delete("n");
      return p;
    });
  }

  return (
    <section className="workspace">
      <div className="workspace-head">
        <div>
          <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-text-muted">{t("lend.kicker")}</p>
          <h1>{t("nav.lend")}</h1>
          <p className="mt-1 text-[15px] text-text-sub">{t("lend.hint")}</p>
        </div>
      </div>
      <div className="workspace-scroll">
        <div className="me-desk">
          <div className="lend-stats lend-stats-bar">
            <div className="lend-stat">
              <b>{stats.tvl == null && markets.loading ? "…" : fmtUsd(stats.tvl)}</b>
              <span>{t("lend.statTvl")}</span>
            </div>
            <div className="lend-stat">
              <b>{markets.loading && !markets.rows.length ? "…" : stats.markets}</b>
              <span>{t("lend.statMarkets")}</span>
            </div>
            <div className="lend-stat">
              <b>{markets.loading && !markets.rows.length ? "…" : stats.protocols}</b>
              <span>{t("lend.statProtocols")}</span>
            </div>
          </div>
          <LendChainBar filter={filter} onPick={setChainFilter} />

          {protocols.length > 1 ? (
            <div className="lend-protos">
              <button type="button" className={`me-chip ${proto === "all" ? "me-chip-on" : ""}`} onClick={() => setProto("all")}>
                {t("lend.allProtocols")}
              </button>
              {protocols.map(([name, n]) => (
                <button key={name} type="button" className={`me-chip ${proto === name ? "me-chip-on" : ""}`} onClick={() => setProto(name)}>
                  {name}
                  <span className="me-count">{n}</span>
                </button>
              ))}
            </div>
          ) : null}

          <section className="me-card">
            <div className="me-card-head">
              <b>{t("lend.markets")}</b>
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
                placeholder={t("lend.search")}
                aria-label={t("lend.search")}
              />
              <span className="me-count">{markets.loading && !markets.rows.length ? "…" : marketSort.sorted.length}</span>
            </div>
            {markets.error && !markets.rows.length ? (
              <p className="me-card-empty">{t("lend.rpcError")}</p>
            ) : !markets.rows.length && markets.loading ? (
              <p className="me-card-empty">{readingShort ? t("lend.loadingChain", { chain: readingShort }) : t("lend.loading")}</p>
            ) : !markets.rows.length ? (
              <p className="me-card-empty">{t("lend.empty")}</p>
            ) : !marketSort.sorted.length ? (
              <p className="me-card-empty">{t("lend.emptyFilter")}</p>
            ) : (
              <div className="me-list">
                <div className="me-cols me-cols-5 me-cols-lend-range">
                  <SortHead id="name" label={t("lend.markets")} active={marketSort.key === "name"} dir={marketSort.dir} onToggle={marketSort.toggle} align="left" />
                  <SortHead id="supply" label={t("lend.supplyApy")} active={marketSort.key === "supply"} dir={marketSort.dir} onToggle={marketSort.toggle} />
                  <SortHead id="borrow" label={t("lend.borrowApy")} active={marketSort.key === "borrow"} dir={marketSort.dir} onToggle={marketSort.toggle} />
                  <SortHead id="tvl" label={t("lend.supplied")} active={marketSort.key === "tvl"} dir={marketSort.dir} onToggle={marketSort.toggle} />
                </div>
                {markets.loading && readingShort && !marketVisible.length ? (
                  <p className="me-card-empty">{t("lend.loadingChain", { chain: readingShort })}</p>
                ) : null}
                {marketVisible.map((r) => {
                  const util = utilOf(r);
                  return (
                    <Link
                      key={r.id}
                      to={filter === "all" ? `/lend/${lendSymbolSlug(r.symbol)}` : `/lend/${lendSymbolSlug(r.symbol)}?chain=${filter}`}
                      className="me-token me-token-5 me-token-lend-range"
                    >
                      <span className="holding-ico-wrap">
                        <img src={r.icon} alt="" className="holding-ico" />
                      </span>
                      <div className="holding-meta">
                        <b>{r.symbol}</b>
                        <span>
                          {r.venueNames.join(" · ") || r.chainNames.join(" · ")}
                          {util != null && util >= 1 ? ` · ${t("lend.util")} ${util.toFixed(0)}%` : ""}
                        </span>
                      </div>
                      <span className="num me-price lend-apy-in lend-apy-range">{fmtApyRange(r.supplyApyMin, r.supplyApyMax)}</span>
                      <span className="num holding-amt lend-apy-out lend-apy-range">{fmtApyRange(r.borrowApyMin, r.borrowApyMax)}</span>
                      <span className="num me-value">{fmtUsd(r.supplyUsd)}</span>
                    </Link>
                  );
                })}
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
                    {t("lend.moreRows")}
                  </button>
                ) : null}
                <p className="me-shown">{t("lend.shown", { shown: marketVisible.length, total: marketSort.sorted.length })}</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
