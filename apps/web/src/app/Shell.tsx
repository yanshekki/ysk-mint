import { Link, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAccount, useBalance, useChainId } from "wagmi";
import { evmEnabledChains } from "@ysk-mint/config";
import { ConnectBar } from "../features/wallet/ConnectBar.tsx";
import { LiveDock } from "../shared/ui/LiveDock.tsx";
import { useNativeWallets } from "../lib/nativeWallets.ts";

export function Shell() {
  const { t } = useTranslation();
  const loc = useLocation();
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const bal = useBalance({ address });
  const native = useNativeWallets();
  const chain = evmEnabledChains().find((c) => c.chainId === chainId);

  const nav = [
    ["/", "nav.lp"],
    ["/create", "nav.create"],
    ["/transfer", "nav.transfer"],
    ["/me", "nav.me"],
  ] as const;

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="logo">
          <span className="logo-mark" />
          ysk-mint
        </Link>
        <nav className="top-nav">
          {nav.map(([href, key]) => (
            <Link
              key={href}
              to={href}
              className={loc.pathname === href || (href !== "/" && loc.pathname.startsWith(href)) ? "on" : ""}
            >
              {t(key)}
            </Link>
          ))}
        </nav>
        <div className="top-right">
          <ConnectBar />
        </div>
      </header>
      <main className="stage">
        <Outlet />
      </main>
      <LiveDock />
      <footer className="botbar">
        <span>{t("nav.lp")}</span>
        <span>{t("nav.create")}</span>
        <span className="bot-session">
          {isConnected ? (
            <span>
              {chain?.short ?? "EVM"} <b>{bal.data ? Number(bal.data.formatted).toFixed(4) : "—"}</b>
            </span>
          ) : null}
          {native.nearAccount ? <span>NEAR</span> : null}
          {native.cardanoAddress ? <span>ADA</span> : null}
          {native.solanaAddress ? <span>SOL</span> : null}
          {!isConnected && !native.nearAccount && !native.cardanoAddress && !native.solanaAddress ? t("wallet.connect") : null}
        </span>
        <span className="bot-dot">● {t("nav.disclaimer")}</span>
      </footer>
    </div>
  );
}
