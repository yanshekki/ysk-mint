import { useState } from "react";
import { useAccount } from "wagmi";
import { useTranslation } from "react-i18next";
import { useLaunchFeed } from "../../lib/useLaunchFeed.ts";

const TABS = ["alpha", "smart", "kol"] as const;
const RANGE = ["1D", "7D", "30D"] as const;

export function BoardPage() {
  const { t } = useTranslation();
  const { address } = useAccount();
  const { created } = useLaunchFeed();
  const [tab, setTab] = useState<(typeof TABS)[number]>("alpha");
  const [range, setRange] = useState<(typeof RANGE)[number]>("1D");

  return (
    <div className="stage">
      <div className="subbar">
        {TABS.map((k) => (
          <button key={k} type="button" className={`pill ${tab === k ? "pill-on" : ""}`} onClick={() => setTab(k)}>
            {t(`board.tabs.${k}`)}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        {RANGE.map((k) => (
          <button key={k} type="button" className={`pill ${range === k ? "pill-on" : ""}`} onClick={() => setRange(k)}>
            {k}
          </button>
        ))}
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>#</th>
              <th>{t("board.cols.wallet")}</th>
              <th>PnL</th>
              <th>{t("board.cols.win")}</th>
              <th>{t("board.cols.tx")}</th>
              <th>{t("board.cols.flow")}</th>
            </tr>
          </thead>
          <tbody>
            {!address || created.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty">
                  {t("trenches.empty")}
                </td>
              </tr>
            ) : (
              created.map((row, i) => (
                <tr key={row.href}>
                  <td className="num">{i + 1}</td>
                  <td>
                    <b>{row.ticker}</b> <span style={{ color: "var(--muted)" }}>{row.name}</span>
                  </td>
                  <td className="num">—</td>
                  <td className="num">—</td>
                  <td className="num">—</td>
                  <td className="num">—</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
