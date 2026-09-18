import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LocaleLink as Link } from "../../app/LocaleLink.tsx";
import { localePath } from "../../lib/locale.ts";
import { fmtCompact, fmtQuoteUsd, fmtUsdc } from "../../lib/defiQuotes.ts";
import { useSeoExtra } from "../../lib/seo.ts";
import {
  LADDER_IDS,
  SCALE_PRESETS,
  scaleAsset,
  searchScaleAssets,
  type ScaleAsset,
} from "../../lib/scale/assets.ts";
import {
  capOf,
  invalidateScaleQuotes,
  loadScaleMany,
  parseAmount,
  scaleResult,
  type CapMode,
  type ScaleMetrics,
} from "../../lib/scale/metrics.ts";

function AssetPick({
  label,
  value,
  exclude,
  onPick,
}: {
  label: string;
  value?: ScaleAsset;
  exclude?: string;
  onPick: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const hits = useMemo(
    () => searchScaleAssets(q).filter((a) => a.id !== exclude),
    [q, exclude],
  );
  useEffect(() => {
    setHi(0);
  }, [q]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  return (
    <div className="scale-pick" ref={box}>
      <span className="scale-pick-lab">{label}</span>
      <div className={`scale-combobox${open ? " is-open" : ""}`}>
        {value ? <img src={value.icon} alt="" width={28} height={28} /> : <span className="scale-ico-ph" />}
        <input
          value={open ? q : value ? `${value.symbol} · ${value.name}` : ""}
          placeholder={t("scale.search")}
          aria-label={label}
          aria-expanded={open}
          aria-autocomplete="list"
          onFocus={() => {
            setQ("");
            setOpen(true);
          }}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHi((n) => Math.min(hits.length - 1, n + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHi((n) => Math.max(0, n - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const hit = hits[hi] ?? hits[0];
              if (hit) {
                onPick(hit.id);
                setOpen(false);
                setQ("");
              }
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
      </div>
      {open ? (
        <ul className="scale-menu" role="listbox">
          {hits.length ? (
            hits.map((a, i) => (
              <li key={a.id}>
                <button
                  type="button"
                  className={i === hi ? "is-on" : undefined}
                  onMouseEnter={() => setHi(i)}
                  onClick={() => {
                    onPick(a.id);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  <img src={a.icon} alt="" width={24} height={24} />
                  <span>
                    <b>{a.symbol}</b>
                    <i>{a.name}</i>
                  </span>
                </button>
              </li>
            ))
          ) : (
            <li className="scale-menu-empty">{t("scale.noMatch")}</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}

function SideCard({
  asset,
  metrics,
  mode,
  loading,
}: {
  asset?: ScaleAsset;
  metrics?: ScaleMetrics;
  mode: CapMode;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const cap = capOf(metrics, mode);
  return (
    <article className="scale-card">
      {asset ? (
        <>
          <div className="scale-card-id">
            <img src={asset.icon} alt="" width={36} height={36} />
            <div>
              <b>{asset.symbol}</b>
              <span>{asset.name}</span>
            </div>
          </div>
          <dl>
            <div>
              <dt>{t("scale.price")}</dt>
              <dd className="num">{loading ? "…" : fmtQuoteUsd(metrics?.price)}</dd>
            </div>
            <div>
              <dt>{t("scale.cap")}</dt>
              <dd className="num">{loading ? "…" : fmtCompact(mode === "circ" ? cap : metrics?.cap)}</dd>
            </div>
            <div>
              <dt>{t("scale.fdv")}</dt>
              <dd className="num">{loading ? "…" : fmtCompact(metrics?.fdv)}</dd>
            </div>
          </dl>
          {metrics?.thin ? <p className="scale-thin">{t("scale.thin")}</p> : null}
        </>
      ) : (
        <p className="scale-card-empty">{t("scale.pickHint")}</p>
      )}
    </article>
  );
}

function RefreshIco() {
  return (
    <svg className="me-quote-ico" viewBox="0 0 16 16" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" d="M13.2 8A5.2 5.2 0 0 0 4.4 4.2M2.6 2.8v3.1h3.1M2.8 8a5.2 5.2 0 0 0 8.8 3.8M13.4 13.2V10H10.3" />
    </svg>
  );
}

function CheckIco() {
  return (
    <svg className="me-quote-ico" viewBox="0 0 16 16" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" d="M3.2 8.4 6.5 11.6 12.8 4.4" />
    </svg>
  );
}

function agoLabel(t: (key: string, opts?: Record<string, unknown>) => string, at: number, now: number) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 5) return t("me.quoteJustNow");
  if (s < 60) return t("me.quoteSecAgo", { n: s });
  return t("me.quoteMinAgo", { n: Math.max(1, Math.round(s / 60)) });
}

export function ScalePage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const params = useParams();
  const a = scaleAsset(params.a);
  const b = scaleAsset(params.b);
  const [mode, setMode] = useState<CapMode>("circ");
  const [bagRaw, setBagRaw] = useState("");
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [flash, setFlash] = useState(false);
  const [cool, setCool] = useState(false);
  const [quoteAt, setQuoteAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [epoch, setEpoch] = useState(0);
  const [metrics, setMetrics] = useState<Record<string, ScaleMetrics>>({});
  const prevBusy = useRef(false);

  const go = (left?: string, right?: string) => {
    if (left && right) nav(localePath(`/scale/${left}/${right}`));
    else if (left) nav(localePath(`/scale/${left}`));
    else nav(localePath("/scale"));
  };

  useSeoExtra(
    a && b
      ? { title: t("seo.scalePairTitle", { a: a.symbol, b: b.symbol }), description: t("seo.scalePairDesc", { a: a.symbol, b: b.name, c: b.symbol }) }
      : { title: t("seo.scaleTitle"), description: t("seo.scaleDesc") },
  );

  useEffect(() => {
    const ids = [...new Set([a?.id, b?.id, ...(a ? LADDER_IDS : [])].filter(Boolean) as string[])];
    if (!ids.length) {
      setBusy(false);
      return;
    }
    let cancelled = false;
    setBusy(true);
    const assets = ids.map((id) => scaleAsset(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
    void (async () => {
      let got = false;
      try {
        for (let i = 0; i < 3; i++) {
          const rows = await loadScaleMany(assets);
          if (cancelled) return;
          setMetrics((prev) => {
            const next = { ...prev };
            for (const [id, m] of Object.entries(rows)) {
              if (m.price != null || m.cap != null || m.fdv != null) next[id] = m;
            }
            return next;
          });
          const need = [a?.id, b?.id].filter(Boolean) as string[];
          const ok = !need.length || need.every((id) => rows[id]?.cap != null || rows[id]?.price != null);
          if (ok) {
            got = true;
            setQuoteAt(Date.now());
            setFailed(false);
            break;
          }
          await new Promise((r) => window.setTimeout(r, 1600 * (i + 1)));
        }
        if (!got) setFailed(true);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [a?.id, b?.id, epoch]);

  useEffect(() => {
    if (!quoteAt && !cool) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [quoteAt, cool]);

  useEffect(() => {
    if (prevBusy.current && !busy && !failed) {
      setFlash(true);
      const id = window.setTimeout(() => setFlash(false), 1200);
      prevBusy.current = busy;
      return () => window.clearTimeout(id);
    }
    prevBusy.current = busy;
    return undefined;
  }, [busy, failed]);

  const amount = parseAmount(bagRaw);
  const result = scaleResult(a ? metrics[a.id] : undefined, b ? metrics[b.id] : undefined, mode, amount);
  const sharePct = result.share != null ? Math.min(100, result.share * 100) : null;
  const capA = capOf(a ? metrics[a.id] : undefined, mode);
  const capB = capOf(b ? metrics[b.id] : undefined, mode);
  const locked = busy || cool;
  const multipleTxt =
    result.multiple == null ? "—" : result.multiple >= 10 ? `${result.multiple.toFixed(1)}×` : `${result.multiple.toFixed(2)}×`;

  let sub = t("scale.sourceNote");
  if (busy) sub = t("scale.quoteBusyNote");
  else if (failed) sub = t("scale.quoteFailNote");
  else if (flash) sub = `${t("me.quoteJustNow")} · ${t("scale.sourceNote")}`;
  else if (quoteAt) sub = `${agoLabel(t, quoteAt, now)} · ${t("scale.sourceNote")}`;

  let refreshLbl = t("me.quoteRefresh");
  if (flash) refreshLbl = t("me.quoteUpdated");
  else if (busy) refreshLbl = t("me.quoteRefreshing");

  const ladder = LADDER_IDS.map((id) => {
    const ref = scaleAsset(id);
    const r = scaleResult(a ? metrics[a.id] : undefined, ref ? metrics[id] : undefined, mode, null);
    return { ref, implied: r.implied, multiple: r.multiple };
  }).filter((row) => row.ref && row.ref.id !== a?.id);

  const sharePair = () => {
    if (!a || !b) return;
    const url = window.location.href;
    const go = async () => {
      try {
        if (navigator.share) await navigator.share({ title: t("nav.scale"), url });
        else await navigator.clipboard.writeText(url);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          return;
        }
      }
      setShared(true);
      window.setTimeout(() => setShared(false), 2500);
    };
    void go();
  };

  return (
    <section className="workspace">
      <div className="workspace-head">
        <div>
          <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-text-muted">{t("scale.kicker")}</p>
          <h1>{t("nav.scale")}</h1>
          <p className="mt-1 text-[15px] text-text-sub">{t("scale.hint")}</p>
        </div>
        <div className="me-summary">
          <div className="me-summary-row">
            <b>{result.implied == null ? "—" : t("me.about", { n: fmtUsdc(result.implied) })}</b>
            <button
              type="button"
              className={`me-quote-btn${flash ? " me-quote-btn-ok" : ""}`}
              disabled={locked || !a}
              aria-busy={busy}
              aria-label={t("scale.refreshAria")}
              onClick={() => {
                if (locked || !a) return;
                invalidateScaleQuotes();
                setCool(true);
                setEpoch((n) => n + 1);
                window.setTimeout(() => setCool(false), 8000);
              }}
            >
              {flash ? <CheckIco /> : busy ? <i className="live-spin" /> : <RefreshIco />}
              <span className="me-quote-lbl">{refreshLbl}</span>
            </button>
          </div>
          <span className="me-summary-note" aria-live="polite">
            {sub}
          </span>
        </div>
      </div>
      <div className="workspace-scroll">
        <div className="me-desk">
          <div className="me-sets">
            <div className="me-chips" aria-label={t("scale.presets")}>
              {SCALE_PRESETS.map((p) => {
                const left = scaleAsset(p.a);
                const right = scaleAsset(p.b);
                if (!left || !right) return null;
                const on = a?.id === p.a && b?.id === p.b;
                return (
                  <Link key={`${p.a}-${p.b}`} to={`/scale/${p.a}/${p.b}`} className={`me-chip ${on ? "me-chip-on" : ""}`}>
                    {left.symbol} → {right.symbol}
                  </Link>
                );
              })}
              <button type="button" role="radio" aria-checked={mode === "circ"} className={`me-chip ${mode === "circ" ? "me-chip-on" : ""}`} onClick={() => setMode("circ")}>
                {t("scale.circMode")}
              </button>
              <button type="button" role="radio" aria-checked={mode === "fdv"} className={`me-chip ${mode === "fdv" ? "me-chip-on" : ""}`} onClick={() => setMode("fdv")}>
                {t("scale.fdvMode")}
              </button>
            </div>
            <div className="me-sets-acts">
              <button type="button" className="me-pool-btn me-pool-btn-explore" disabled={!a || !b} onClick={sharePair}>
                {shared ? t("me.copied") : t("me.share")}
              </button>
            </div>
          </div>

          <div className="lend-stats lend-stats-bar">
            <div className="lend-stat">
              <b className="num">{result.implied == null ? "—" : fmtUsdc(result.implied)}</b>
              <span>{t("scale.implied")}</span>
            </div>
            <div className="lend-stat">
              <b className="num">{multipleTxt}</b>
              <span>{t("scale.multiple")}</span>
            </div>
            <div className="lend-stat">
              <b className="num">{fmtCompact(capA)}</b>
              <span>{a ? `${a.symbol} · ${mode === "fdv" ? t("scale.fdv") : t("scale.cap")}` : t("scale.statCapA")}</span>
            </div>
            <div className="lend-stat">
              <b className="num">{fmtCompact(capB)}</b>
              <span>{b ? `${b.symbol} · ${mode === "fdv" ? t("scale.fdv") : t("scale.cap")}` : t("scale.statCapB")}</span>
            </div>
          </div>

          <div className="scale-toolbar">
            <AssetPick label={t("scale.pickA")} value={a} exclude={b?.id} onPick={(id) => go(id, b?.id)} />
            <button type="button" className="scale-swap" aria-label={t("scale.swap")} title={t("scale.swap")} disabled={!a && !b} onClick={() => go(b?.id, a?.id)}>
              ⇄
            </button>
            <AssetPick label={t("scale.pickB")} value={b} exclude={a?.id} onPick={(id) => go(a?.id ?? id, a ? id : undefined)} />
          </div>

          <section className="me-card scale-compare-card">
            <div className="scale-compare">
              <SideCard asset={a} metrics={a ? metrics[a.id] : undefined} mode={mode} loading={Boolean(busy && a && !metrics[a.id])} />
              <div className="scale-bar-wrap" aria-hidden={!a || !b}>
                <div className="scale-bar">
                  <span style={{ width: sharePct == null ? "0%" : `${sharePct}%` }} />
                </div>
                <p className="num">{sharePct == null ? "—" : t("scale.shareOf", { n: sharePct < 1 ? sharePct.toFixed(2) : sharePct.toFixed(1) })}</p>
                <p className="scale-implied-note">{a && b ? t("scale.impliedNote", { a: a.symbol, b: b.symbol }) : t("scale.empty")}</p>
              </div>
              <SideCard asset={b} metrics={b ? metrics[b.id] : undefined} mode={mode} loading={Boolean(busy && b && !metrics[b.id])} />
            </div>
            <p className="scale-source-foot">
              {t("scale.sourceNative")} {t("scale.sourceToken")}
            </p>
          </section>

          <section className="me-card">
            <div className="me-card-head">
              <b>{t("scale.bagValue")}</b>
            </div>
            <div className="scale-bag">
              <label className="scale-bag-field">
                <span>{t("scale.bagLabel", { symbol: a?.symbol ?? "—" })}</span>
                <input
                  className="scale-bag-input"
                  inputMode="decimal"
                  value={bagRaw}
                  disabled={!a}
                  placeholder={t("scale.bagHint")}
                  onChange={(e) => setBagRaw(e.target.value)}
                />
              </label>
              <div className="scale-bag-out">
                <span>{t("scale.bagValue")}</span>
                <b className="num">{result.bag == null ? "—" : fmtUsdc(result.bag)}</b>
              </div>
            </div>
          </section>

          {a ? (
            <section className="me-card">
              <div className="me-card-head">
                <b>{t("scale.ladder", { a: a.symbol })}</b>
                <span className="me-count">{ladder.length}</span>
              </div>
              <div className="me-cols scale-lad-cols">
                <span>{t("scale.pickB")}</span>
                <span>{t("scale.implied")}</span>
                <span>{t("scale.multiple")}</span>
              </div>
              <div className="me-list">
                {ladder.map((row) =>
                  row.ref ? (
                    <Link key={row.ref.id} to={`/scale/${a.id}/${row.ref.id}`} className="me-token scale-lad">
                      <span className="holding-ico-wrap">
                        <img src={row.ref.icon} alt="" className="holding-ico" />
                      </span>
                      <div className="holding-meta">
                        <b>{row.ref.symbol}</b>
                        <span>{row.ref.name}</span>
                      </div>
                      <span className="num me-price">{fmtQuoteUsd(row.implied)}</span>
                      <span className="num me-value">
                        {row.multiple == null ? "—" : row.multiple >= 10 ? `${row.multiple.toFixed(1)}×` : `${row.multiple.toFixed(2)}×`}
                      </span>
                    </Link>
                  ) : null,
                )}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}
