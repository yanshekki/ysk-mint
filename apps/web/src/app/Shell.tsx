import { Link, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { enabledChains } from "@ysk-mint/config";
import { ConnectBar } from "../features/wallet/ConnectBar.tsx";
import { Segmented } from "../shared/ui/Segmented.tsx";
import i18n from "../lib/i18n.ts";

export function Shell() {
  const { t } = useTranslation();
  const loc = useLocation();
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const chains = enabledChains();

  const links = [
    ["/", "nav.home"],
    ["/create", "nav.create"],
    ["/transfer", "nav.transfer"],
    ["/me", "nav.me"],
  ] as const;

  return (
    <div className="min-h-screen">
      <div className="hairline" />
      <header className="shell-header sticky top-0 z-20">
        <div className="mx-auto flex h-full max-w-[1200px] items-center gap-4 px-4">
          <Link to="/" className="shrink-0 text-[15px] font-black tracking-tight">
            ysk<span className="text-brand-blue">-</span>mint
          </Link>
          <nav className="hidden items-center md:flex">
            {links.map(([href, key]) => (
              <Link
                key={href}
                to={href}
                className={`nav-link ${loc.pathname === href || (href !== "/" && loc.pathname.startsWith(href)) ? "nav-link-on" : ""}`}
              >
                {t(key)}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {isConnected ? (
              <Segmented
                ariaLabel="chain"
                value={chainId}
                onChange={(id) => switchChain({ chainId: id })}
                options={chains.map((c) => ({ value: c.chainId, label: c.name.replace(" Sepolia", "") }))}
              />
            ) : null}
            <button
              type="button"
              className="chip"
              onClick={() => void i18n.changeLanguage(i18n.language === "zh-HK" ? "en" : "zh-HK")}
            >
              {i18n.language === "zh-HK" ? "EN" : "中文"}
            </button>
            <ConnectBar />
          </div>
        </div>
      </header>
      <main className="pb-16">
        <Outlet />
      </main>
    </div>
  );
}
