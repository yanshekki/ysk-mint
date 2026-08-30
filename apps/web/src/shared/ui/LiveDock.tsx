import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { CHAINS } from "@ysk-mint/config";
import { chainIcon } from "../../lib/chainIcon.ts";
import { getOutboundSnapshot, subscribeOutbound } from "../../lib/outbound.ts";
import { useLiveStatus, type LiveJob, type LiveKind } from "../../lib/liveStatus.ts";
import { useUserSettings } from "../../lib/userSettings.ts";

const QUEUE_SHOW = 8;

function chainOf(chainId: number) {
  return Object.values(CHAINS).find((c) => c.chainId === chainId);
}

function kindKey(kind: LiveKind) {
  return `live.kind.${kind}` as const;
}

function byStart(a: LiveJob, b: LiveJob) {
  return a.at - b.at;
}

function JobRow({
  job,
  ord,
  queued,
}: {
  job: LiveJob;
  ord: number;
  queued?: boolean;
}) {
  const { t } = useTranslation();
  const chain = chainOf(job.chainId);
  const short = chain?.short ?? String(job.chainId);
  const fail = job.phase === "fail";
  return (
    <li className={fail ? "live-dock-fail" : queued ? "live-dock-wait" : "live-dock-run"}>
      <span className="live-dock-ord">{ord}</span>
      {chain ? <img src={chainIcon(chain)} alt="" width={18} height={18} /> : <span className="live-dock-dot" />}
      <span className="live-dock-name">
        {short}
        <small>{t(kindKey(job.kind))}</small>
      </span>
      {fail ? <b>{t("live.fail")}</b> : queued ? <b>{t("live.waitTag")}</b> : <i className="live-spin" />}
    </li>
  );
}

export function LiveDock() {
  const { t } = useTranslation();
  const dockOn = useUserSettings((s) => s.liveDock);
  const jobs = useLiveStatus((s) => s.jobs);
  const waveDone = useLiveStatus((s) => s.waveDone);
  const links = useSyncExternalStore(subscribeOutbound, getOutboundSnapshot, getOutboundSnapshot);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1024px)");
    const sync = () => setCollapsed(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const { running, queued, failed } = useMemo(() => {
    const running: LiveJob[] = [];
    const queued: LiveJob[] = [];
    const failed: LiveJob[] = [];
    for (const j of jobs) {
      if (j.phase === "run") running.push(j);
      else if (j.phase === "wait") queued.push(j);
      else failed.push(j);
    }
    running.sort(byStart);
    queued.sort(byStart);
    return { running, queued, failed };
  }, [jobs]);

  const active = running.length + queued.length;
  const total = waveDone + active;
  const pct = total ? Math.min(100, Math.round((waveDone / total) * 100)) : 0;
  const queuedShow = queued.slice(0, QUEUE_SHOW);
  const queuedRest = queued.length - queuedShow.length;

  if (!dockOn || !jobs.length) return null;

  return (
    <aside className={`live-dock${collapsed ? " live-dock-collapsed" : ""}`} aria-live="polite" aria-label={t("live.title")}>
      <button type="button" className="live-dock-head" onClick={() => setCollapsed((v) => !v)} aria-expanded={!collapsed}>
        <p className="live-dock-title">{t("live.title")}</p>
        <p className="live-dock-count">{t("live.count", { done: waveDone, total })}</p>
      </button>
      <div
        className="live-dock-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={t("live.count", { done: waveDone, total })}
      >
        <i style={{ width: `${pct}%` }} />
      </div>
      <p className="live-dock-meta">
        {t("live.links", { n: links.inflight, max: links.global })}
        {links.waiters ? ` · ${t("live.httpWait", { n: links.waiters })}` : null}
      </p>
      <div className="live-dock-body">
        {running.length ? (
          <>
            <p className="live-dock-sec">{t("live.now")}</p>
            <ul className="live-dock-list">
              {running.map((j, i) => (
                <JobRow key={j.id} job={j} ord={i + 1} />
              ))}
            </ul>
          </>
        ) : null}
        {queued.length ? (
          <>
            <p className="live-dock-sec">{t("live.queueTitle")}</p>
            <ul className="live-dock-list">
              {queuedShow.map((j, i) => (
                <JobRow key={j.id} job={j} ord={running.length + i + 1} queued />
              ))}
            </ul>
          </>
        ) : null}
        {failed.length ? (
          <ul className="live-dock-list">
            {failed.map((j, i) => (
              <JobRow key={j.id} job={j} ord={running.length + queuedShow.length + i + 1} />
            ))}
          </ul>
        ) : null}
      </div>
      {queuedRest > 0 ? <p className="live-dock-more">{t("live.left", { n: queuedRest })}</p> : null}
    </aside>
  );
}

export function ChipBusy({ chainId }: { chainId: number }) {
  const busy = useLiveStatus((s) => s.jobs.some((j) => j.chainId === chainId && j.phase !== "fail"));
  if (!busy) return null;
  return <i className="live-spin live-spin-chip" />;
}
