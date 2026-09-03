import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAccount, useBalance, useChainId } from "wagmi";
import { evmEnabledChains } from "@ysk-mint/config";
import { ConnectBar } from "../features/wallet/ConnectBar.tsx";
import { LiveDock } from "../shared/ui/LiveDock.tsx";
import { useNativeWallets } from "../lib/nativeWallets.ts";
import { canonicalLocale, localeFromPathname, stripLocalePrefix } from "../lib/locale.ts";
import { DocumentHead } from "./DocumentHead.tsx";
import { LocaleLink } from "./LocaleLink.tsx";
import i18n from "../lib/i18n.ts";

const NAV = [
  ["/", "nav.lp"],
  ["/stocks", "nav.stocks"],
  ["/lend", "nav.lend"],
  ["/create", "nav.create"],
  ["/transfer", "nav.transfer"],
  ["/me", "nav.me"],
  ["/settings", "nav.settings"],
] as const;

const TAB_NAV = [
  ["/", "nav.lp", "markets"],
  ["/stocks", "nav.stocks", "stocks"],
  ["/lend", "nav.lend", "lend"],
  ["/me", "nav.me", "me"],
] as const;

const MORE_LINKS = [
  ["/create", "nav.create"],
  ["/transfer", "nav.transfer"],
  ["/settings", "nav.settings"],
] as const;

const LEGAL = [
  ["/about", "nav.about"],
  ["/donate", "nav.donate"],
  ["/terms", "nav.terms"],
  ["/disclaimer", "nav.disclaimer"],
] as const;

const GITHUB = "https://github.com/yanshekki/ysk-mint";

function navOn(path: string, href: string) {
  const rest = stripLocalePrefix(path);
  return rest === href || (href !== "/" && rest.startsWith(href));
}

function moreOn(path: string) {
  const rest = stripLocalePrefix(path);
  if (MORE_LINKS.some(([href]) => navOn(path, href))) return true;
  return LEGAL.some(([href]) => rest === href || rest.startsWith(href));
}

const APP_VERSION = import.meta.env.VITE_APP_VERSION || "";
const APP_BUILD = import.meta.env.VITE_APP_BUILD || "";

function FooterVersion() {
  const { t } = useTranslation();
  const [stale, setStale] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void fetch("/version.json", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { build?: string } | null) => {
        if (cancelled || !json?.build || !APP_BUILD) return;
        if (json.build !== APP_BUILD) setStale(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  if (!APP_VERSION) return null;
  return (
    <span className="bot-ver" title={APP_BUILD}>
      {t("app.version", { v: APP_VERSION })}
      {stale ? (
        <button type="button" className="bot-reload" onClick={() => globalThis.location.reload()}>
          {t("app.reload")}
        </button>
      ) : null}
    </span>
  );
}

function gasLabel(formatted?: string) {
  if (!formatted) return "";
  const n = Number(formatted);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n < 0.001) return " <0.001";
  return ` ${n.toLocaleString(undefined, { maximumFractionDigits: 3 })}`;
}

function TabIcon({ name }: { name: (typeof TAB_NAV)[number][2] | "more" }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true as const };
  const stroke = { stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "markets") {
    return (
      <svg {...common}>
        <path {...stroke} d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
      </svg>
    );
  }
  if (name === "stocks") {
    return (
      <svg {...common}>
        <path {...stroke} d="M4 16l5-5 3 3 8-9" />
        <path {...stroke} d="M15 5h5v5" />
      </svg>
    );
  }
  if (name === "lend") {
    return (
      <svg {...common}>
        <rect {...stroke} x="3" y="6" width="18" height="13" rx="2" />
        <path {...stroke} d="M3 10h18M7 14h2M12 14h2" />
      </svg>
    );
  }
  if (name === "me") {
    return (
      <svg {...common}>
        <circle {...stroke} cx="12" cy="8" r="3.2" />
        <path {...stroke} d="M5 19c1.2-3 3.7-4.5 7-4.5S17.8 16 19 19" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="6" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="18" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function Shell() {
  const { t } = useTranslation();
  const loc = useLocation();
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const bal = useBalance({ address });
  const native = useNativeWallets();
  const chain = evmEnabledChains().find((c) => c.chainId === chainId);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const urlLng = localeFromPathname(loc.pathname);
    if (canonicalLocale(i18n.language) !== urlLng) void i18n.changeLanguage(urlLng);
  }, [loc.pathname]);

  useEffect(() => {
    setMoreOpen(false);
  }, [loc.pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moreOpen]);

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
      <DocumentHead />
      <header className="topbar">
        <LocaleLink to="/" className="logo">
          <img className="logo-mark" src="/logo.svg" width={28} height={28} alt="" />
          <span className="logo-name">{t("app.name")}</span>
        </LocaleLink>
        <nav className="top-nav">
          {NAV.map(([href, key]) => (
            <LocaleLink key={href} to={href} className={navOn(loc.pathname, href) ? "on" : ""}>
              {t(key)}
            </LocaleLink>
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
      {moreOpen ? (
        <>
          <button type="button" className="more-sheet-backdrop" aria-hidden="true" tabIndex={-1} onClick={() => setMoreOpen(false)} />
          <div className="more-sheet" role="dialog" aria-modal="true" aria-label={t("nav.more")}>
            <nav className="more-sheet-nav">
              {MORE_LINKS.map(([href, key]) => (
                <LocaleLink key={href} to={href} className={navOn(loc.pathname, href) ? "on" : ""} onClick={() => setMoreOpen(false)}>
                  {t(key)}
                </LocaleLink>
              ))}
            </nav>
            <nav className="more-sheet-nav more-sheet-legal" aria-label={t("nav.legal")}>
              {LEGAL.map(([href, key]) => (
                <LocaleLink key={href} to={href} className={navOn(loc.pathname, href) ? "on" : ""} onClick={() => setMoreOpen(false)}>
                  {t(key)}
                </LocaleLink>
              ))}
              <a href={GITHUB} target="_blank" rel="noreferrer" onClick={() => setMoreOpen(false)}>
                {t("nav.github")}
              </a>
            </nav>
          </div>
        </>
      ) : null}
      <footer className="botbar">
        <div className="bot-meta">
          <LocaleLink to="/about" className="bot-powered">
            {t("app.poweredBy")}
          </LocaleLink>
          <FooterVersion />
          <a className="bot-github" href={GITHUB} target="_blank" rel="noreferrer">
            {t("nav.github")}
          </a>
          <nav className="bot-legal" aria-label={t("nav.legal")}>
            {LEGAL.map(([href, key]) => (
              <LocaleLink key={href} to={href} className={navOn(loc.pathname, href) ? "on" : ""}>
                {t(key)}
              </LocaleLink>
            ))}
          </nav>
        </div>
        <nav className="bot-nav" aria-label={t("app.name")}>
          {TAB_NAV.map(([href, key, icon]) => (
            <LocaleLink key={href} to={href} className={navOn(loc.pathname, href) ? "on" : ""}>
              <TabIcon name={icon} />
              <span>{t(key)}</span>
            </LocaleLink>
          ))}
          <button
            type="button"
            className={`bot-more-btn ${moreOpen || moreOn(loc.pathname) ? "on" : ""}`}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            onClick={() => setMoreOpen((v) => !v)}
          >
            <TabIcon name="more" />
            <span>{t("nav.more")}</span>
          </button>
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
      </footer>
    </div>
  );
}
