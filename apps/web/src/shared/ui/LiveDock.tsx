import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CHAINS } from "@ysk-mint/config";
import { chainIcon } from "../../lib/chainIcon.ts";
import { useLiveStatus, type LiveJob, type LiveKind } from "../../lib/liveStatus.ts";

const SHOW_AFTER = 200;

function chainOf(chainId: number) {
  return Object.values(CHAINS).find((c) => c.chainId === chainId);
}

function kindKey(kind: LiveKind) {
  return `live.kind.${kind}` as const;
}

export function LiveDock() {
  const { t } = useTranslation();
  const jobs = useLiveStatus((s) => s.jobs);
  const [now, setNow] = useState(() => Date.now());

  const needsTick = jobs.some((j) => j.phase === "run" || j.phase === "wait" || j.phase === "fail");
  useEffect(() => {
    if (!needsTick) return;
    const id = window.setInterval(() => setNow(Date.now()), 120);
    return () => window.clearInterval(id);
  }, [needsTick]);

  const visible = useMemo(() => {
    const run: LiveJob[] = [];
    let waiting = 0;
    for (const j of jobs) {
      if (j.phase === "wait") waiting += 1;
      else if (j.phase === "fail" || (j.phase === "run" && now - j.at >= SHOW_AFTER)) run.push(j);
    }
    return { run, waiting };
  }, [jobs, now]);

  if (!visible.run.length && !visible.waiting) return null;
  if (!visible.run.length) return null;

  return (
    <aside className="live-dock" aria-live="polite" aria-label={t("live.title")}>
      <p className="live-dock-title">{t("live.title")}</p>
      <ul className="live-dock-list">
        {visible.run.map((j) => {
          const chain = chainOf(j.chainId);
          const short = chain?.short ?? String(j.chainId);
          return (
            <li key={j.id} className={j.phase === "fail" ? "live-dock-fail" : undefined}>
              {chain ? <img src={chainIcon(chain)} alt="" width={18} height={18} /> : <span className="live-dock-dot" />}
              <span>
                {short} {t(kindKey(j.kind))}
              </span>
              {j.phase === "fail" ? <em>{t("live.fail")}</em> : <i className="live-spin" />}
            </li>
          );
        })}
      </ul>
      {visible.waiting ? <p className="live-dock-more">{t("live.left", { n: visible.waiting })}</p> : null}
    </aside>
  );
}

export function ChipBusy({ chainId }: { chainId: number }) {
  const busy = useLiveStatus((s) => s.jobs.some((j) => j.chainId === chainId && j.phase !== "fail"));
  if (!busy) return null;
  return <i className="live-spin live-spin-chip" />;
}
