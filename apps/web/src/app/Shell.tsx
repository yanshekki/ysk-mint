import { Link, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAccount, useBalance, useChainId } from "wagmi";
import { evmEnabledChains } from "@ysk-mint/config";
import { ConnectBar } from "../features/wallet/ConnectBar.tsx";
import { LiveDock } from "../shared/ui/LiveDock.tsx";
import { useNativeWallets } from "../lib/nativeWallets.ts";

const NAV = [
  ["/", "nav.lp"],
  ["/lend", "nav.lend"],
  ["/create", "nav.create"],
  ["/transfer", "nav.transfer"],
  ["/me", "nav.me"],
  ["/settings", "nav.settings"],
] as const;

function navOn(path: string, href: string) {
  return path === href || (href !== "/" && path.startsWith(href));
}

function gasLabel(formatted?: string) {
  if (!formatted) return "";
  const n = Number(formatted);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n < 0.001) return " <0.001";
  return ` ${n.toLocaleString(undefined, { maximumFractionDigits: 3 })}`;
}

export function Shell() {
  const { t } = useTranslation();
  const loc = useLocation();
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const bal = useBalance({ address });
  const native = useNativeWallets();
  const chain = evmEnabledChains().find((c) => c.chainId === chainId);

  const sessionChips: string[] = [];
  if (isConnected) sessionChips.push(`${chain?.short ?? "EVM"}${gasLabel(bal.data?.formatted)}`);
  if (native.nearAccount) sessionChips.push("NEAR");
  if (native.cardanoAddress) sessionChips.push("ADA");
  if (native.solanaAddress) sessionChips.push("SOL");
  if (native.suiAddress) sessionChips.push("SUI");
  if (native.aptosAddress) sessionChips.push("APT");
  if (native.tonAddress) sessionChips.push("TON");

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="logo">
          <span className="logo-mark" />
          ysk-mint
        </Link>
        <nav className="top-nav">
          {NAV.map(([href, key]) => (
            <Link key={href} to={href} className={navOn(loc.pathname, href) ? "on" : ""}>
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
        <nav className="bot-nav" aria-label={t("app.name")}>
          {NAV.map(([href, key]) => (
            <Link key={href} to={href} className={navOn(loc.pathname, href) ? "on" : ""}>
              {t(key)}
            </Link>
          ))}
        </nav>
        {sessionChips.length ? (
          <div className="bot-session">
            {sessionChips.map((chip) => (
              <span key={chip} className="bot-chip">
                {chip}
              </span>
            ))}
          </div>
        ) : null}
        <span className="bot-dot">{t("nav.disclaimer")}</span>
      </footer>
    </div>
  );
}
