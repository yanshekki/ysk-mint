import { Link, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAccount, useBalance, useChainId, useSwitchChain } from "wagmi";
import { enabledChains } from "@ysk-mint/config";
import { ConnectBar } from "../features/wallet/ConnectBar.tsx";
import i18n from "../lib/i18n.ts";

export function Shell() {
  const { t } = useTranslation();
  const loc = useLocation();
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const bal = useBalance({ address });
  const chains = enabledChains();

  const nav = [
    ["/", "nav.trenches"],
    ["/hot", "nav.hot"],
    ["/board", "nav.board"],
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
            <Link key={href} to={href} className={loc.pathname === href || (href !== "/" && loc.pathname.startsWith(href)) ? "on" : ""}>
              {t(key)}
            </Link>
          ))}
        </nav>
        <input className="search" placeholder={t("nav.search")} readOnly />
        <div className="top-right">
          <select
            className="chain-dd"
            value={chainId}
            onChange={(e) => switchChain({ chainId: Number(e.target.value) })}
          >
            {chains.map((c) => (
              <option key={c.chainId} value={c.chainId}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="button" className="ghost-btn" onClick={() => void i18n.changeLanguage(i18n.language === "zh-HK" ? "en" : "zh-HK")}>
            {i18n.language === "zh-HK" ? "EN" : "中文"}
          </button>
          <ConnectBar />
        </div>
      </header>
      <Outlet />
      <footer className="botbar">
        <span>{t("nav.trenches")}</span>
        <span>{t("nav.create")}</span>
        <span>{t("nav.me")}</span>
        <span>
          {isConnected ? (
            <>
              ETH <b>{bal.data ? Number(bal.data.formatted).toFixed(4) : "—"}</b>
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
