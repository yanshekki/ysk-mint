import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useLaunchFeed } from "../../lib/useLaunchFeed.ts";

const TABS = ["new", "hot", "search", "pump", "blue"] as const;
const TIMES = ["1m", "5m", "1h", "6h", "24h"] as const;

export function HotPage() {
  const { t } = useTranslation();
  const { created } = useLaunchFeed();
  const [tab, setTab] = useState<(typeof TABS)[number]>("hot");
  const [tf, setTf] = useState<(typeof TIMES)[number]>("1h");

  return (
    <div className="stage">
      <div className="subbar">
        {TABS.map((k) => (
          <button key={k} type="button" className={`pill ${tab === k ? "pill-on" : ""}`} onClick={() => setTab(k)}>
            {t(`hot.tabs.${k}`)}
          </button>
        ))}
        <span style={{ width: 12 }} />
        {TIMES.map((k) => (
          <button key={k} type="button" className={`pill ${tf === k ? "pill-on" : ""}`} onClick={() => setTf(k)}>
            {k}
          </button>
        ))}
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>{t("hot.cols.token")}</th>
              <th>{t("hot.cols.mc")}</th>
              <th>{t("hot.cols.ath")}</th>
              <th>{t("hot.cols.pool")}</th>
              <th>{t("hot.cols.vol")}</th>
              <th>{t("hot.cols.tx")}</th>
              <th>{t("hot.cols.holders")}</th>
              <th>{t("hot.cols.fee")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {created.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty">
                  {t("trenches.empty")}
                </td>
              </tr>
            ) : (
              created.map((row) => (
                <tr key={row.href}>
                  <td>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <div className="tcard-av" style={{ width: 32, height: 32, fontSize: 11 }}>
                        {row.ticker.slice(0, 2)}
                      </div>
                      <div>
                        <b>{row.ticker}</b> <span style={{ color: "var(--muted)" }}>{row.name}</span>
                      </div>
                    </div>
                  </td>
                  <td className="num">—</td>
                  <td className="num amber">—</td>
                  <td className="num">—</td>
                  <td className="num">—</td>
                  <td className="num">—</td>
                  <td className="num">—</td>
                  <td className="num">—</td>
                  <td>
                    <Link className="buy" to={row.href}>
                      {t("hot.buy")}
                    </Link>
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
