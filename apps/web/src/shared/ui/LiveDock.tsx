import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CHAINS } from "@ysk-mint/config";
import { chainIcon } from "../../lib/chainIcon.ts";
import { useLiveStatus, type LiveJob, type LiveKind } from "../../lib/liveStatus.ts";

function chainOf(chainId: number) {
  return Object.values(CHAINS).find((c) => c.chainId === chainId);
}

function kindKey(kind: LiveKind) {
  return `live.kind.${kind}` as const;
}

export function LiveDock() {
  const { t } = useTranslation();
  const jobs = useLiveStatus((s) => s.jobs);

  const visible = useMemo(() => {
    const run: LiveJob[] = [];
    let waiting = 0;
    for (const j of jobs) {
      if (j.phase === "wait") {
        waiting += 1;
        run.push(j);
      } else if (j.phase === "fail" || j.phase === "run") run.push(j);
    }
    return { run, waiting };
  }, [jobs]);

  if (!visible.run.length && !visible.waiting) return null;

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
        {!visible.run.length && visible.waiting ? (
          <li>
            <span className="live-dock-dot" />
            <span>{t("live.queued", { n: visible.waiting })}</span>
            <i className="live-spin" />
          </li>
        ) : null}
      </ul>
      {visible.run.length && visible.waiting ? <p className="live-dock-more">{t("live.left", { n: visible.waiting })}</p> : null}
    </aside>
  );
}

export function ChipBusy({ chainId }: { chainId: number }) {
  const busy = useLiveStatus((s) => s.jobs.some((j) => j.chainId === chainId && j.phase !== "fail"));
  if (!busy) return null;
  return <i className="live-spin live-spin-chip" />;
}
