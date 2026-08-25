import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { SolanaWalletInfo } from "../../lib/solanaWallets.ts";

export function SolanaSelector({
  open,
  wallets,
  busy,
  onClose,
  onPick,
}: {
  open: boolean;
  wallets: SolanaWalletInfo[];
  busy?: boolean;
  onClose: () => void;
  onPick: (wallet: SolanaWalletInfo) => void;
}) {
  const { t } = useTranslation();
  if (!open) return null;
  const installed = wallets.filter((w) => w.installed);
  const more = wallets.filter((w) => !w.installed);

  return createPortal(
    <div className="sol-sel" role="dialog" aria-modal="true" aria-label={t("wallet.connectSolana")}>
      <button type="button" className="sol-sel-backdrop" aria-label={t("wizard.back")} onClick={onClose} />
      <div className="sol-sel-panel">
        <header className="sol-sel-head">
          <div>
            <p className="wallet-kicker">Solana</p>
            <h3>{t("wallet.connectSolana")}</h3>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            {t("wizard.back")}
          </button>
        </header>
        {installed.length ? (
          <section>
            <p className="sol-sel-label">{t("wallet.solInstalled")}</p>
            <ul className="sol-sel-list">
              {installed.map((w) => (
                <li key={w.id}>
                  <button type="button" className="sol-sel-item" disabled={busy} onClick={() => onPick(w)}>
                    {w.icon ? <img src={w.icon} alt="" /> : <span className="sol-sel-mark">SOL</span>}
                    <b>{w.name}</b>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="sol-sel-empty">{t("wallet.noSolana")}</p>
        )}
        {more.length ? (
          <section>
            <p className="sol-sel-label">{t("wallet.solMore")}</p>
            <ul className="sol-sel-list">
              {more.map((w) => (
                <li key={w.id}>
                  <button type="button" className="sol-sel-item" onClick={() => onPick(w)}>
                    <span className="sol-sel-mark">SOL</span>
                    <b>{w.name}</b>
                    <span className="sol-sel-install">{t("wallet.solInstall")}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
