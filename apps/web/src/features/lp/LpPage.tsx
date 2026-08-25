import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { featuredChains, isConfigured, launchContracts, testnetChains } from "@ysk-mint/config";
import { useLpFeed, type LpFilter } from "../../lib/useLpFeed.ts";

function fmtUnlock(ts: number) {
  if (!ts) return "—";
  return new Date(ts * 1000).toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

function short(a: string) {
  if (!a || a.length < 10) return a || "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function LpPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<LpFilter>("all");
  const { rows, loading, error, selected } = useLpFeed(filter);
  const featured = featuredChains();
  const tests = testnetChains();

  let emptyKey = "lp.empty";
  if (selected && !selected.evm) emptyKey = "lp.emptyAda";
  else if (selected && selected.evm && !isConfigured(launchContracts(selected.key))) emptyKey = "lp.emptyUndeployed";
  else if (filter === "all") emptyKey = "lp.emptyAll";

  return (
    <div className="stage">
      <div className="subbar">
        <span className="subbar-title">{t("nav.lp")}</span>
        <span>{t("lp.hint")}</span>
        <div className="pills" style={{ marginLeft: "auto" }}>
          <button type="button" className={`pill ${filter === "all" ? "pill-on" : ""}`} onClick={() => setFilter("all")}>
            {t("lp.all")}
          </button>
          {featured.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`pill ${filter === c.key ? "pill-on" : ""}`}
              onClick={() => setFilter(c.key)}
              title={c.name}
            >
              {c.short}
            </button>
          ))}
        </div>
      </div>
      <div className="subbar" style={{ minHeight: 40 }}>
        <span className="text-[12px] font-bold">{t("lp.testnets")}</span>
        {tests.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`pill ${filter === c.key ? "pill-on" : ""}`}
            onClick={() => setFilter(c.key)}
          >
            {c.short}
          </button>
        ))}
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>{t("lp.cols.chain")}</th>
              <th>{t("lp.cols.token")}</th>
              <th>{t("lp.cols.lp")}</th>
              <th>{t("lp.cols.lock")}</th>
              <th>{t("lp.cols.unlock")}</th>
              <th>{t("lp.cols.amount")}</th>
              <th>{t("lp.cols.explorer")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty">{t("lp.loading")}</div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty">{t("lp.rpcError")}</div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty">
                    <strong>{t(emptyKey)}</strong>
                    {selected?.key !== undefined && !selected.evm ? t("lp.adaDetail") : t("lp.emptyDetail")}
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={`${r.chainId}-${r.lockId}-${r.lpToken}`}>
                  <td>
                    <span className="badge badge-info">{r.chainShort}</span>
                  </td>
                  <td>
                    <Link to={`/token/${r.chainId}/${r.token}`}>
                      <b>{r.symbol}</b> <span className="addr">{r.name}</span>
                    </Link>
                  </td>
                  <td className="addr">{short(r.lpToken)}</td>
                  <td>{r.mode === 1 ? t("lp.burn") : t("lp.timed")}</td>
                  <td className="num">{r.mode === 1 ? "—" : fmtUnlock(r.unlockAt)}</td>
                  <td className="num">{Number(r.liquidity).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                  <td>
                    <a href={`${r.explorer}/address/${r.lpToken}`} target="_blank" rel="noreferrer" className="up">
                      {t("lp.open")}
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
