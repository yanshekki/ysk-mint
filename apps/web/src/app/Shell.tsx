import { Link, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ConnectBar } from "../features/wallet/ConnectBar.tsx";
import i18n from "../lib/i18n.ts";

export function Shell() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="text-lg font-bold tracking-tight">
            {t("app.name")}
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/" className="text-text-sub hover:text-text-main">
              {t("nav.home")}
            </Link>
            <Link to="/create" className="text-text-sub hover:text-text-main">
              {t("nav.create")}
            </Link>
            <Link to="/transfer" className="text-text-sub hover:text-text-main">
              {t("nav.transfer")}
            </Link>
            <Link to="/me" className="text-text-sub hover:text-text-main">
              {t("nav.me")}
            </Link>
            <button
              type="button"
              className="rounded-lg border border-border px-2 py-1 text-xs"
              onClick={() => void i18n.changeLanguage(i18n.language === "zh-HK" ? "en" : "zh-HK")}
            >
              {i18n.language === "zh-HK" ? "EN" : "中文"}
            </button>
            <ConnectBar />
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
