import { LocaleLink as Link } from "../../app/LocaleLink.tsx";
import { useTranslation } from "react-i18next";
import { ProsePage } from "./LegalDoc.tsx";

export function AboutPage() {
  const { t } = useTranslation();
  const services = t("about.services", { returnObjects: true });
  const products = t("about.products", { returnObjects: true });
  return (
    <ProsePage kicker={t("about.kicker")} title={t("about.title")} lede={t("about.lede")}>
      <section className="legal-section">
        <h2>{t("about.mintTitle")}</h2>
        <p>{t("about.mintBody")}</p>
      </section>
      <section className="legal-section">
        <h2>{t("about.creatorTitle")}</h2>
        <p>
          <b>{t("about.creatorName")}</b>
          {" — "}
          {t("about.creatorRole")}
        </p>
        <p className="legal-links">
          <a href="https://linktr.ee/yanshekki" target="_blank" rel="noopener noreferrer">
            {t("about.linkTree")}
          </a>
          <span aria-hidden="true"> · </span>
          <a href="https://ysk.hk/" target="_blank" rel="noopener noreferrer">
            {t("about.linkSite")}
          </a>
          <span aria-hidden="true"> · </span>
          <a href="https://github.com/yanshekki" target="_blank" rel="noopener noreferrer">
            {t("about.linkGithub")}
          </a>
        </p>
      </section>
      <section className="legal-section">
        <h2>{t("about.contactTitle")}</h2>
        <ul className="legal-list">
          <li>{t("about.location")}</li>
          <li>
            {t("about.whatsapp")}
            {": "}
            <a href="https://wa.me/85261604242" target="_blank" rel="noopener noreferrer">
              +852 6160 4242
            </a>
          </li>
          <li>
            {t("about.email")}
            {": "}
            <a href="mailto:email@ysk.hk">email@ysk.hk</a>
          </li>
          <li>
            {t("about.privacy")}
            {": "}
            <a href="mailto:privacy@ysk.hk">privacy@ysk.hk</a>
            {" · "}
            <a href="https://ysk.hk/privacy-policy" target="_blank" rel="noopener noreferrer">
              ysk.hk/privacy-policy
            </a>
          </li>
        </ul>
      </section>
      {Array.isArray(services) ? (
        <section className="legal-section">
          <h2>{t("about.servicesTitle")}</h2>
          <ul className="legal-list">
            {services.map((item) => (
              <li key={String(item)}>{String(item)}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {Array.isArray(products) ? (
        <section className="legal-section">
          <h2>{t("about.productsTitle")}</h2>
          <ul className="legal-list">
            {products.map((item) => (
              <li key={String(item)}>{String(item)}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="legal-cross">
        <Link to="/donate">{t("about.donateCta")}</Link>
      </p>
    </ProsePage>
  );
}
