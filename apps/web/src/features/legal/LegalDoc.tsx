import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";

export function ProsePage({
  kicker,
  title,
  lede,
  extra,
  children,
}: {
  kicker: string;
  title: string;
  lede?: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="workspace">
      <div className="workspace-head">
        <div>
          <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-text-muted">{kicker}</p>
          <h1>{title}</h1>
          {lede ? <p className="mt-1 text-[15px] text-text-sub">{lede}</p> : null}
          {extra}
        </div>
      </div>
      <div className="workspace-scroll">
        <article className="legal-page">{children}</article>
      </div>
    </section>
  );
}

type LegalSection = { title: string; body: string };

export function LegalDoc({ kind }: { kind: "disclaimer" | "terms" }) {
  const { t } = useTranslation();
  const raw = t(`legal.${kind}.sections`, { returnObjects: true });
  const sections = Array.isArray(raw) ? (raw as LegalSection[]) : [];
  return (
    <ProsePage kicker={t("nav.legal")} title={t(`legal.${kind}.title`)} lede={t(`legal.${kind}.lede`)}>
      <p className="legal-updated">{t("legal.updated")}</p>
      {sections.map((s) => (
        <section key={s.title} className="legal-section">
          <h2>{s.title}</h2>
          <p>{s.body}</p>
        </section>
      ))}
      <p className="legal-cross">
        {kind === "disclaimer" ? (
          <Link to="/terms">{t("nav.terms")}</Link>
        ) : (
          <Link to="/disclaimer">{t("nav.disclaimer")}</Link>
        )}
      </p>
    </ProsePage>
  );
}

export function DisclaimerPage() {
  return <LegalDoc kind="disclaimer" />;
}

export function TermsPage() {
  return <LegalDoc kind="terms" />;
}
