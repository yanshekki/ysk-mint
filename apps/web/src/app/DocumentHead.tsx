import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  SITE_ORIGIN,
  absUrl,
  applyDocumentLang,
  canonicalLocale,
  hreflangAlternates,
  localeFromPathname,
  localeMeta,
  stripLocalePrefix,
} from "../lib/locale.ts";
import { faqJsonLd, matchSeoPage, orgJsonLd, useSeoExtraState, webPageJsonLd, type SeoPage } from "../lib/seo.ts";

const OG_IMAGE = `${SITE_ORIGIN}/og.png`;

function upsertMeta(kind: "name" | "property", key: string, content: string) {
  const sel = `meta[${kind}="${key}"]`;
  let el = document.head.querySelector(sel) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(kind, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertLink(rel: string, href: string, attrs?: Record<string, string>) {
  const extra = attrs
    ? Object.entries(attrs)
        .map(([k, v]) => `[${k}="${v}"]`)
        .join("")
    : "";
  const sel = `link[rel="${rel}"]${extra}`;
  let el = document.head.querySelector(sel) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    if (attrs) for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    el.setAttribute("data-ysk", "1");
    document.head.appendChild(el);
  }
  el.href = href;
}

function setJsonLd(id: string, data: unknown) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function fallbackTitle(page: SeoPage, t: (k: string) => string) {
  if (page === "other") return "YSK Mint";
  if (page === "lendAsset") return t("seo.lendAssetFallback");
  if (page === "pair") return t("seo.pairFallback");
  if (page === "token") return t("seo.tokenFallback");
  if (page === "lock") return t("seo.lockFallback");
  return t(`seo.${page}Title`);
}

function fallbackDesc(page: SeoPage, t: (k: string) => string) {
  if (page === "other") return t("app.tagline");
  if (page === "lendAsset") return t("seo.lendAssetDesc");
  if (page === "pair") return t("seo.pairDesc");
  if (page === "token") return t("seo.tokenDesc");
  if (page === "lock") return t("seo.lockDesc");
  return t(`seo.${page}Desc`);
}

export function DocumentHead() {
  const { t, i18n } = useTranslation();
  const loc = useLocation();
  const extra = useSeoExtraState();
  const locale = localeFromPathname(loc.pathname);
  const { page, noindex } = matchSeoPage(loc.pathname);
  const rest = `${stripLocalePrefix(loc.pathname)}${loc.search}`;
  const canonical = absUrl(rest, locale);
  const title = extra.title || fallbackTitle(page, t);
  const description = extra.description || fallbackDesc(page, t);
  const ogLoc = localeMeta(locale).ogLocale;

  useEffect(() => {
    applyDocumentLang(canonicalLocale(i18n.language) === locale ? i18n.language : locale);
  }, [i18n.language, locale]);

  useEffect(() => {
    document.title = title;
    upsertMeta("name", "description", description);
    upsertMeta("name", "robots", noindex ? "noindex,follow" : "index,follow");
    upsertMeta("name", "theme-color", "#3b82f6");
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", "YSK Mint");
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:image", OG_IMAGE);
    upsertMeta("property", "og:locale", ogLoc);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", OG_IMAGE);
    upsertLink("canonical", canonical);
    upsertLink("apple-touch-icon", `${SITE_ORIGIN}/logo.svg`);

    for (const node of [...document.head.querySelectorAll('link[rel="alternate"][hreflang]')]) {
      node.remove();
    }
    for (const alt of hreflangAlternates(rest)) {
      const link = document.createElement("link");
      link.rel = "alternate";
      link.hreflang = alt.lang;
      link.href = alt.href;
      link.setAttribute("data-ysk", "hreflang");
      document.head.appendChild(link);
    }

    const graph = orgJsonLd();
    setJsonLd("ysk-jsonld-org", graph);

    if (page === "about") {
      const contact = [t("about.location"), `${t("about.email")}: email@ysk.hk`, `${t("about.whatsapp")}: +852 6160 4242`].join(
        " · ",
      );
      setJsonLd(
        "ysk-jsonld-page",
        faqJsonLd(canonical, [
          { q: t("seo.faqMintQ"), a: t("about.mintBody") },
          { q: t("seo.faqWhoQ"), a: t("about.lede") },
          { q: t("seo.faqContactQ"), a: contact },
        ]),
      );
    } else if (page === "terms" || page === "disclaimer") {
      setJsonLd("ysk-jsonld-page", webPageJsonLd(canonical, title, description));
    } else {
      document.getElementById("ysk-jsonld-page")?.remove();
    }
  }, [canonical, description, extra.description, extra.title, i18n.language, locale, noindex, ogLoc, page, rest, t, title]);

  return null;
}
