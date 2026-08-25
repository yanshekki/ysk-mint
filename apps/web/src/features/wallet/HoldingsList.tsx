import { useTranslation } from "react-i18next";
import type { HoldingRow } from "../../lib/useHoldings.ts";

function short(v: string) {
  if (v.length < 18) return v;
  return `${v.slice(0, 6)}…${v.slice(-4)}`;
}

export function HoldingsList({
  rows,
  funded,
  connected,
  loading,
}: {
  rows: HoldingRow[];
  funded: number;
  connected: boolean;
  loading: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="holdings">
      <div className="holdings-head">
        <strong>{connected ? t("wallet.holdingsFunded", { n: funded }) : t("wallet.holdingsIdle")}</strong>
        <span>{t("wallet.holdingsHint")}</span>
      </div>
      <ul className="holdings-list">
        {rows.map((r) => (
          <li key={r.id} className={connected && r.raw === 0n ? "holding-zero" : ""}>
            <img src={r.icon} alt="" width={28} height={28} className="holding-ico" />
            <div className="holding-meta">
              <b>{r.symbol}</b>
              <span className="num">{r.contract ? short(r.contract) : t("wallet.nativeCoin")}</span>
            </div>
            <span className="num holding-amt">{loading && connected ? "…" : r.amount}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
