import { ConnectButton } from "@rainbow-me/rainbowkit";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { useTranslation } from "react-i18next";
import { privyAppId } from "../../lib/wagmi.ts";

function short(addr?: string) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function PrivyConnectBar() {
  const { t } = useTranslation();
  const { ready, authenticated, login, logout } = usePrivy();
  const { address } = useAccount();
  if (!ready) {
    return (
      <button type="button" className="wallet-cta" disabled>
        {t("wallet.create")}
      </button>
    );
  }
  if (!authenticated) {
    return (
      <button type="button" className="wallet-cta" onClick={() => void login()}>
        {t("wallet.create")}
      </button>
    );
  }
  return (
    <button type="button" className="ghost-btn" onClick={() => void logout()}>
      {short(address)}
    </button>
  );
}

function RainbowConnectBar() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      <ConnectButton.Custom>
        {({ account, mounted, openConnectModal, openAccountModal }) => {
          if (!mounted) {
            return (
              <button type="button" className="wallet-cta" disabled>
                {t("wallet.create")}
              </button>
            );
          }
          if (!account) {
            return (
              <button type="button" className="wallet-cta" onClick={openConnectModal}>
                {t("wallet.create")}
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
      <span className="wallet-hint">{t("wallet.privyMissing")}</span>
    </div>
  );
}

export function ConnectBar() {
  if (privyAppId) return <PrivyConnectBar />;
  return <RainbowConnectBar />;
}
