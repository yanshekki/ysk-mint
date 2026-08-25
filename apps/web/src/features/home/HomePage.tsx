import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../../shared/ui/Button.tsx";
import { enabledChains } from "@ysk-mint/config";

export function HomePage() {
  const { t } = useTranslation();
  const chains = enabledChains();

  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <p className="mb-3 text-sm font-medium text-brand-green">{t("app.tagline")}</p>
      <h1 className="text-4xl font-bold tracking-tight text-text-main">{t("home.title")}</h1>
      <p className="mt-4 text-lg text-text-sub">{t("home.body")}</p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link to="/create">
          <Button>{t("home.cta")}</Button>
        </Link>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
          {t("nav.disclaimer")}
        </span>
      </div>
      <ul className="mt-10 grid gap-3 sm:grid-cols-2">
        {chains.map((c) => (
          <li key={c.chainId} className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <p className="font-semibold">{c.name}</p>
            <p className="text-sm text-text-sub">
              chainId {c.chainId} · EID {c.eid}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-sm text-text-sub">{t("home.honesty")}</p>
    </section>
  );
}
