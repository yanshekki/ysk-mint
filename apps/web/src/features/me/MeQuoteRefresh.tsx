import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLiveStatus } from "../../lib/liveStatus.ts";

const FLASH_MS = 1_200;
const COOL_MS = 8_000;
const TICK_MS = 1_000;

function RefreshIco() {
  return (
    <svg className="me-quote-ico" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.2 8A5.2 5.2 0 0 0 4.4 4.2M2.6 2.8v3.1h3.1M2.8 8a5.2 5.2 0 0 0 8.8 3.8M13.4 13.2V10H10.3"
      />
    </svg>
  );
}

function CheckIco() {
  return (
    <svg className="me-quote-ico" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.2 8.4 6.5 11.6 12.8 4.4"
      />
    </svg>
  );
}

function agoLabel(t: (key: string, opts?: Record<string, unknown>) => string, at: number, now: number) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 5) return t("me.quoteJustNow");
  if (s < 60) return t("me.quoteSecAgo", { n: s });
  return t("me.quoteMinAgo", { n: Math.max(1, Math.round(s / 60)) });
}

export function MeQuoteRefresh({
  total,
  quoteAt,
  failed,
  armed,
  note,
  onRefresh,
}: {
  total: string;
  quoteAt: number | null;
  failed: boolean;
  armed: boolean;
  note: string;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const jobsBusy = useLiveStatus((s) => s.jobs.some((j) => (j.kind === "quote" || j.kind === "defi") && j.phase !== "fail"));
  const waitingFirst = quoteAt == null && !failed;
  const busy = armed || jobsBusy || waitingFirst;
  const [flash, setFlash] = useState(false);
  const [cool, setCool] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const prevArmed = useRef(false);

  useEffect(() => {
    if (prevArmed.current && !armed && !failed) {
      setFlash(true);
      setCool(true);
      const a = window.setTimeout(() => setFlash(false), FLASH_MS);
      const b = window.setTimeout(() => setCool(false), COOL_MS);
      prevArmed.current = armed;
      return () => {
        window.clearTimeout(a);
        window.clearTimeout(b);
      };
    }
    prevArmed.current = armed;
    return undefined;
  }, [armed, failed]);

  useEffect(() => {
    if (!quoteAt && !cool) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, [quoteAt, cool]);

  const locked = busy || cool;
  let sub = note;
  if (busy) sub = t("me.quoteBusyNote");
  else if (failed) sub = t("me.quoteFailNote");
  else if (flash) sub = `${t("me.quoteJustNow")} · ${note}`;
  else if (quoteAt) sub = `${agoLabel(t, quoteAt, now)} · ${note}`;

  let label = t("me.quoteRefresh");
  if (flash) label = t("me.quoteUpdated");
  else if (busy) label = t("me.quoteRefreshing");

  return (
    <div className="me-summary">
      <div className="me-summary-row">
        <b>{total}</b>
        <button
          type="button"
          className={`me-quote-btn${flash ? " me-quote-btn-ok" : ""}`}
          disabled={locked}
          aria-busy={busy}
          aria-label={t("me.quoteRefreshAria")}
          onClick={() => {
            if (locked) return;
            onRefresh();
          }}
        >
          {flash ? <CheckIco /> : busy ? <i className="live-spin" /> : <RefreshIco />}
          <span className="me-quote-lbl">{label}</span>
        </button>
      </div>
      <span className="me-summary-note" aria-live="polite">
        {sub}
      </span>
    </div>
  );
}
