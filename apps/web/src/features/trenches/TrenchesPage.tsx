import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TokenCard, type CardToken } from "../../shared/ui/TokenCard.tsx";
import { useLaunchFeed } from "../../lib/useLaunchFeed.ts";

function Column({
  title,
  items,
  empty,
}: {
  title: string;
  items: CardToken[];
  empty: string;
}) {
  const [q, setQ] = useState("");
  const [p, setP] = useState("P1");
  const shown = items.filter(
    (t) => !q || `${t.ticker} ${t.name}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <section className="col">
      <header className="col-h">
        <h2>{title}</h2>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="關鍵字…" />
        {(["P1", "P2", "P3"] as const).map((x) => (
          <button key={x} type="button" className={`pill ${p === x ? "pill-on" : ""}`} onClick={() => setP(x)}>
            {x}
          </button>
        ))}
      </header>
      <div className="col-body">
        {shown.length === 0 ? <div className="empty">{empty}</div> : shown.map((t) => <TokenCard key={t.href + t.ticker} token={t} />)}
      </div>
    </section>
  );
}

export function TrenchesPage() {
  const { t } = useTranslation();
  const { created, pending, live } = useLaunchFeed();
  return (
    <div className="stage">
      <div className="subbar">
        <span className="subbar-title">{t("nav.trenches")}</span>
        <span>{t("trenches.hint")}</span>
      </div>
      <div className="trenches">
        <Column title={t("trenches.new")} items={created} empty={t("trenches.empty")} />
        <Column title={t("trenches.pending")} items={pending} empty={t("trenches.empty")} />
        <Column title={t("trenches.live")} items={live} empty={t("trenches.empty")} />
      </div>
    </div>
  );
}
