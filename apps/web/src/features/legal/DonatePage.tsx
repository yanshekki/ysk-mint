import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ProsePage } from "./LegalDoc.tsx";

const ROWS = [
  { net: "donate.evm", addr: "yanshekki.eth" },
  { net: "donate.near", addr: "yanshekki.near" },
  { net: "donate.ada", addr: "$yanshekki" },
] as const;

export function DonatePage() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(addr: string) {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(addr);
      window.setTimeout(() => setCopied((cur) => (cur === addr ? null : cur)), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <ProsePage kicker={t("donate.kicker")} title={t("donate.title")} lede={t("donate.lede")}>
      <p>{t("donate.note")}</p>
      <div className="donate-table-wrap">
        <table className="donate-table">
          <thead>
            <tr>
              <th>{t("donate.network")}</th>
              <th>{t("donate.address")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.addr}>
                <td>{t(row.net)}</td>
                <td>
                  <code className="donate-addr">{row.addr}</code>
                </td>
                <td>
                  <button type="button" className="legal-copy" onClick={() => void copy(row.addr)}>
                    {copied === row.addr ? t("donate.copied") : t("donate.copy")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="legal-cross">
        <Link to="/disclaimer">{t("donate.disclaimerLink")}</Link>
      </p>
    </ProsePage>
  );
}
