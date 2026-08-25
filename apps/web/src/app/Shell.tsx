import { Link, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAccount, useBalance, useChainId, useSwitchChain } from "wagmi";
import { evmEnabledChains } from "@ysk-mint/config";
import { ConnectBar } from "../features/wallet/ConnectBar.tsx";
import i18n from "../lib/i18n.ts";

export function Shell() {
  const { t } = useTranslation();
  const loc = useLocation();
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const bal = useBalance({ address });
  const chains = evmEnabledChains();

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
          <select
            className="chain-dd"
            value={chains.some((c) => c.chainId === chainId) ? chainId : chains[0]?.chainId}
            onChange={(e) => switchChain({ chainId: Number(e.target.value) })}
          >
            {chains.map((c) => (
              <option key={c.chainId} value={c.chainId}>
                {c.short}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => void i18n.changeLanguage(i18n.language === "zh-HK" ? "en" : "zh-HK")}
          >
            {i18n.language === "zh-HK" ? "EN" : "中文"}
          </button>
          <ConnectBar />
        </div>
      </header>
      <main className="stage">
        <Outlet />
      </main>
      <footer className="botbar">
        <span>{t("nav.lp")}</span>
        <span>{t("nav.create")}</span>
        <span>
          {isConnected ? (
            <>
              {bal.data?.symbol ?? "ETH"} <b>{bal.data ? Number(bal.data.formatted).toFixed(4) : "—"}</b>
            </>
          ) : (
            t("wallet.connect")
          )}
        </span>
        <span className="bot-dot">● {t("nav.disclaimer")}</span>
      </footer>
    </div>
  );
}
