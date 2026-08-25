import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useTranslation } from "react-i18next";

export function ConnectBar() {
  const { t } = useTranslation();
  return (
    <ConnectButton.Custom>
      {({ account, mounted, openConnectModal, openAccountModal }) => {
        if (!mounted) {
          return (
            <button type="button" className="wallet-cta" disabled>
              {t("wallet.connect")}
            </button>
          );
        }
        if (!account) {
          return (
            <button type="button" className="wallet-cta" onClick={openConnectModal}>
              {t("wallet.connect")}
            </button>
          );
        }
        return (
          <button type="button" className="ghost-btn" onClick={openAccountModal}>
            {account.displayName}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
