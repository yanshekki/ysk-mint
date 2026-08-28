import { useTranslation } from "react-i18next";
import type { HoldingRow } from "../../lib/useHoldings.ts";
import { fmtCompact } from "../../lib/defiQuotes.ts";
import { SortHead, useSort } from "../../shared/ui/SortTable.tsx";

function short(v: string) {
  if (v.length < 18) return v;
  return `${v.slice(0, 6)}…${v.slice(-4)}`;
}

function fmtAmt(amount: string) {
  const n = Number(String(amount).replace(/,/g, ""));
  if (!Number.isFinite(n)) {
    const s = amount.replace(/,/g, "");
    return s.length > 14 ? `${s.slice(0, 6)}…` : amount;
  }
  if (Math.abs(n) >= 1e15) return n.toExponential(2).replace("e+", "e");
  return fmtCompact(n);
}

function holdingGet(r: HoldingRow, k: string) {
  if (k === "name") return r.symbol;
  const n = Number(String(r.amount).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
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
  const sort = useSort(rows, "amount", holdingGet);
  return (
    <div className="holdings">
      <div className="holdings-head">
        <strong>{connected ? t("wallet.holdingsFunded", { n: funded }) : t("wallet.holdingsIdle")}</strong>
        <div className="holdings-sort">
          <SortHead id="name" label={t("me.token")} active={sort.key === "name"} dir={sort.dir} onToggle={sort.toggle} align="left" />
          <SortHead id="amount" label={t("me.amount")} active={sort.key === "amount"} dir={sort.dir} onToggle={sort.toggle} />
        </div>
      </div>
      <ul className="holdings-list">
        {sort.sorted.map((r) => (
          <li key={r.id} className={connected && r.raw === 0n ? "holding-zero" : ""}>
            <span className="holding-ico-wrap">
              <img src={r.icon} alt="" width={28} height={28} className="holding-ico" />
              {r.chainTag ? <span className="holding-chain-tag">{r.chainTag}</span> : null}
            </span>
            <div className="holding-meta">
              <b>{r.symbol}</b>
              <span className="num">{r.contract ? short(r.contract) : t("wallet.nativeCoin")}</span>
            </div>
            <span className="num holding-amt" title={r.amount}>
              {loading && connected ? "…" : fmtAmt(r.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
