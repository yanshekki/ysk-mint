import { Link } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useTranslation } from "react-i18next";
import { useAccount, useChainId } from "wagmi";
import { evmEnabledChains } from "@ysk-mint/config";
import { LOCALES } from "../../lib/i18n.ts";
import { useNativeWallets } from "../../lib/nativeWallets.ts";

function short(v: string, head = 4, tail = 4) {
  if (!v || v.length <= head + tail + 1) return v || "—";
  return `${v.slice(0, head)}…${v.slice(-tail)}`;
}

export function ConnectBar() {
  const { t, i18n } = useTranslation();
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const native = useNativeWallets();
  const chain = evmEnabledChains().find((c) => c.chainId === chainId);
  const hasNear = Boolean(native.nearAccount);
  const hasAda = Boolean(native.cardanoAddress);
  const any = isConnected || hasNear || hasAda;

  return (
    <div className="session-bar">
      <label className="lang-dd-wrap">
        <span className="sr-only">{t("nav.lang")}</span>
        <select
          className="lang-dd"
          value={LOCALES.some((l) => l.id === i18n.language) ? i18n.language : "zh-HK"}
          onChange={(e) => void i18n.changeLanguage(e.target.value)}
        >
          {LOCALES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </label>

      <ConnectButton.Custom>
        {({ account, mounted, openConnectModal, openAccountModal }) => {
          if (!mounted) {
            return (
              <button type="button" className="ghost-btn" disabled>
                {t("wallet.connect")}
              </button>
            );
          }
          return (
            <div className="session-pills">
              {account ? (
                <button type="button" className="wallet-session-btn" onClick={openAccountModal}>
                  <span className="wallet-dot wallet-dot-on" />
                  <b>{chain?.short ?? "EVM"}</b>
                  <span className="num">{account.displayName}</span>
                </button>
              ) : null}
              {hasNear ? (
                <Link to="/create" className="wallet-session-btn">
                  <span className="wallet-dot wallet-dot-on" />
                  <b>NEAR</b>
                  <span className="num">{short(native.nearAccount, 6, 4)}</span>
                </Link>
              ) : null}
              {hasAda ? (
                <Link to="/create" className="wallet-session-btn">
                  <span className="wallet-dot wallet-dot-on" />
                  <b>ADA</b>
                  <span className="num">{short(native.cardanoAddress, 6, 4)}</span>
                </Link>
              ) : null}
              {!any ? (
                <button type="button" className="ghost-btn" onClick={openConnectModal}>
                  {t("wallet.connect")}
                </button>
              ) : !account ? (
                <button type="button" className="ghost-btn" onClick={openConnectModal}>
                  EVM
                </button>
              ) : null}
            </div>
          );
        }}
      </ConnectButton.Custom>
    </div>
  );
}
