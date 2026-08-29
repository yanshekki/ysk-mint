#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const i18nDir = join(root, "src/shared/i18n");
const SITE = "https://mint.ysk.hk";
const DEFAULT = "zh-HK";
const PREFIX = ["zh-CN", "en", "es", "ar", "pt", "id", "ja", "ru", "fr", "de"];
const LOCALES = [DEFAULT, ...PREFIX];
const DIR = { ar: "rtl" };
const HTML_LANG = {
  "zh-HK": "zh-HK",
  "zh-CN": "zh-CN",
  en: "en-US",
  es: "es",
  ar: "ar",
  pt: "pt-BR",
  id: "id",
  ja: "ja",
  ru: "ru",
  fr: "fr",
  de: "de",
};
const PATHS = ["/", "/lend", "/create", "/transfer", "/about", "/donate", "/terms", "/disclaimer"];
const LEGAL = ["about", "donate", "terms", "disclaimer"];

function localePath(path, locale) {
  if (locale === DEFAULT) return path === "/" ? "/" : path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

function abs(path, locale) {
  return `${SITE}${localePath(path, locale)}`;
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loadLocale(id) {
  const file = id === "zh-HK" ? "zh-HK.json" : `${id}.json`;
  return JSON.parse(readFileSync(join(i18nDir, file), "utf8"));
}

function hreflang(path) {
  return [
    ...LOCALES.map((l) => `    <link rel="alternate" hreflang="${esc(l)}" href="${esc(abs(path, l))}" />`),
    `    <link rel="alternate" hreflang="x-default" href="${esc(abs(path, DEFAULT))}" />`,
  ].join("\n");
}

function sitemap() {
  const urls = [];
  for (const path of PATHS) {
    const links = [
      ...LOCALES.map((l) => `      <xhtml:link rel="alternate" hreflang="${l}" href="${abs(path, l)}"/>`),
      `      <xhtml:link rel="alternate" hreflang="x-default" href="${abs(path, DEFAULT)}"/>`,
    ].join("\n");
    for (const locale of LOCALES) {
      urls.push(`  <url>
    <loc>${abs(path, locale)}</loc>
${links}
  </url>`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>
`;
}

function legalHtml(pack, kind) {
  if (kind === "about") {
    const services = Array.isArray(pack.about?.services) ? pack.about.services : [];
    const products = Array.isArray(pack.about?.products) ? pack.about.products : [];
    return `<article class="legal-page">
  <p class="text-[13px] font-extrabold uppercase tracking-[0.14em] text-text-muted">${esc(pack.about.kicker)}</p>
  <h1>${esc(pack.about.title)}</h1>
  <p>${esc(pack.about.lede)}</p>
  <section class="legal-section"><h2>${esc(pack.about.mintTitle)}</h2><p>${esc(pack.about.mintBody)}</p></section>
  <section class="legal-section"><h2>${esc(pack.about.creatorTitle)}</h2><p><b>${esc(pack.about.creatorName)}</b> — ${esc(pack.about.creatorRole)}</p></section>
  <section class="legal-section"><h2>${esc(pack.about.contactTitle)}</h2>
    <ul class="legal-list">
      <li>${esc(pack.about.location)}</li>
      <li>${esc(pack.about.whatsapp)}: +852 6160 4242</li>
      <li>${esc(pack.about.email)}: email@ysk.hk</li>
      <li>${esc(pack.about.privacy)}: privacy@ysk.hk</li>
    </ul>
  </section>
  <section class="legal-section"><h2>${esc(pack.about.servicesTitle)}</h2><ul class="legal-list">${services.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></section>
  <section class="legal-section"><h2>${esc(pack.about.productsTitle)}</h2><ul class="legal-list">${products.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></section>
</article>`;
  }
  if (kind === "donate") {
    const rows = [
      [pack.donate.evm, "yanshekki.eth"],
      [pack.donate.near, "yanshekki.near"],
      [pack.donate.ada, "$yanshekki"],
    ];
    return `<article class="legal-page">
  <p class="text-[13px] font-extrabold uppercase tracking-[0.14em] text-text-muted">${esc(pack.donate.kicker)}</p>
  <h1>${esc(pack.donate.title)}</h1>
  <p>${esc(pack.donate.lede)}</p>
  <p>${esc(pack.donate.note)}</p>
  <table class="donate-table"><thead><tr><th>${esc(pack.donate.network)}</th><th>${esc(pack.donate.address)}</th></tr></thead>
  <tbody>${rows.map(([n, a]) => `<tr><td>${esc(n)}</td><td><code class="donate-addr">${esc(a)}</code></td></tr>`).join("")}</tbody></table>
</article>`;
  }
  const doc = pack.legal[kind];
  const sections = Array.isArray(doc.sections) ? doc.sections : [];
  return `<article class="legal-page">
  <p class="text-[13px] font-extrabold uppercase tracking-[0.14em] text-text-muted">${esc(pack.nav.legal)}</p>
  <h1>${esc(doc.title)}</h1>
  <p>${esc(doc.lede)}</p>
  <p class="legal-updated">${esc(pack.legal.updated)}</p>
  ${sections.map((s) => `<section class="legal-section"><h2>${esc(s.title)}</h2><p>${esc(s.body)}</p></section>`).join("\n  ")}
</article>`;
}

function seoFor(pack, kind) {
  const key = kind;
  return {
    title: pack.seo?.[`${key}Title`] || `${pack.nav[kind] || kind} · YSK Mint`,
    desc: pack.seo?.[`${key}Desc`] || pack.app?.tagline || "",
  };
}

function inject(template, { lang, dir, title, desc, canonical, path, body }) {
  let html = template;
  html = html.replace(/<html lang="[^"]*"/, `<html lang="${esc(lang)}" dir="${esc(dir)}"`);
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  html = html.replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(desc)}" />`);
  html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${esc(canonical)}" />`);
  html = html.replace(/<div id="root"><\/div>/, `<div id="root">${body}</div>`);
  const alts = hreflang(path);
  if (!html.includes('hreflang="x-default"')) {
    html = html.replace("</head>", `${alts}\n  </head>`);
  }
  return html;
}

const indexHtml = readFileSync(join(dist, "index.html"), "utf8");
writeFileSync(join(dist, "sitemap.xml"), sitemap());

for (const locale of LOCALES) {
  const pack = loadLocale(locale);
  const lang = HTML_LANG[locale] || locale;
  const dir = DIR[locale] || "ltr";
  for (const kind of LEGAL) {
    const path = `/${kind}`;
    const { title, desc } = seoFor(pack, kind);
    const html = inject(indexHtml, {
      lang,
      dir,
      title,
      desc,
      canonical: abs(path, locale),
      path,
      body: legalHtml(pack, kind),
    });
    const out = join(dist, localePath(path, locale).replace(/^\//, ""), "index.html");
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, html);
  }
}

console.log(`seo-static: sitemap + ${LOCALES.length * LEGAL.length} legal pages`);
