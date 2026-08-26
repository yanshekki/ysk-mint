import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { SolanaWalletInfo } from "../../lib/solanaWallets.ts";
import type { ExtraWalletInfo } from "../../lib/extraWallets.ts";

type PickWallet = { id: string; name: string; icon?: string; installed: boolean; url?: string };

export function WalletPicker({
  open,
  kicker,
  title,
  empty,
  mark,
  wallets,
  busy,
  onClose,
  onPick,
}: {
  open: boolean;
  kicker: string;
  title: string;
  empty: string;
  mark: string;
  wallets: PickWallet[];
  busy?: boolean;
  onClose: () => void;
  onPick: (wallet: PickWallet) => void;
}) {
  const { t } = useTranslation();
  if (!open) return null;
  const installed = wallets.filter((w) => w.installed);
  const more = wallets.filter((w) => !w.installed);

  return createPortal(
    <div className="sol-sel" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="sol-sel-backdrop" aria-label={t("wizard.back")} onClick={onClose} />
      <div className="sol-sel-panel">
        <header className="sol-sel-head">
          <div>
            <p className="wallet-kicker">{kicker}</p>
            <h3>{title}</h3>
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
                    {w.icon ? <img src={w.icon} alt="" /> : <span className="sol-sel-mark">{mark}</span>}
                    <b>{w.name}</b>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="sol-sel-empty">{empty}</p>
        )}
        {more.length ? (
          <section>
            <p className="sol-sel-label">{t("wallet.solMore")}</p>
            <ul className="sol-sel-list">
              {more.map((w) => (
                <li key={w.id}>
                  <button type="button" className="sol-sel-item" onClick={() => onPick(w)}>
                    {w.icon ? <img src={w.icon} alt="" /> : <span className="sol-sel-mark">{mark}</span>}
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
  return (
    <WalletPicker
      open={open}
      kicker="Solana"
      title={t("wallet.connectSolana")}
      empty={t("wallet.noSolana")}
      mark="SOL"
      wallets={wallets}
      busy={busy}
      onClose={onClose}
      onPick={(w) => onPick(w as SolanaWalletInfo)}
    />
  );
}

export type { ExtraWalletInfo };
