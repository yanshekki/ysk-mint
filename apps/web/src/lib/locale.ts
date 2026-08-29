export const SITE_ORIGIN = "https://mint.ysk.hk";
export const LOCALE_KEY = "ysk-mint.locale";
export const DEFAULT_LOCALE = "zh-HK" as const;
export const PREFIX_LOCALES = ["zh-CN", "en", "es", "ar", "pt", "id", "ja", "ru", "fr", "de"] as const;

export type PrefixLocale = (typeof PREFIX_LOCALES)[number];
export type LocaleId = typeof DEFAULT_LOCALE | PrefixLocale;
export type SdkLocale = "en" | "zh-HK" | "zh-CN";

export const LOCALES = [
  { id: "zh-HK", label: "繁體中文", htmlLang: "zh-HK", ogLocale: "zh_HK", dir: "ltr" as const },
  { id: "zh-CN", label: "简体中文", htmlLang: "zh-CN", ogLocale: "zh_CN", dir: "ltr" as const },
  { id: "en", label: "English", htmlLang: "en-US", ogLocale: "en_US", dir: "ltr" as const },
  { id: "es", label: "Español", htmlLang: "es", ogLocale: "es_ES", dir: "ltr" as const },
  { id: "ar", label: "العربية", htmlLang: "ar", ogLocale: "ar_SA", dir: "rtl" as const },
  { id: "pt", label: "Português", htmlLang: "pt-BR", ogLocale: "pt_BR", dir: "ltr" as const },
  { id: "id", label: "Bahasa Indonesia", htmlLang: "id", ogLocale: "id_ID", dir: "ltr" as const },
  { id: "ja", label: "日本語", htmlLang: "ja", ogLocale: "ja_JP", dir: "ltr" as const },
  { id: "ru", label: "Русский", htmlLang: "ru", ogLocale: "ru_RU", dir: "ltr" as const },
  { id: "fr", label: "Français", htmlLang: "fr", ogLocale: "fr_FR", dir: "ltr" as const },
  { id: "de", label: "Deutsch", htmlLang: "de", ogLocale: "de_DE", dir: "ltr" as const },
] as const;

export const PREFIX_SET = new Set<string>(PREFIX_LOCALES);
export const LOCALE_SET = new Set<string>(LOCALES.map((l) => l.id));

function matchPrefixSegment(seg: string | undefined): PrefixLocale | undefined {
  if (!seg) return undefined;
  return PREFIX_LOCALES.find((p) => p.toLowerCase() === seg.toLowerCase());
}

export function localeMeta(id: string) {
  return LOCALES.find((l) => l.id === id) ?? LOCALES[0];
}

export function canonicalLocale(raw: string | undefined | null): LocaleId {
  if (!raw) return DEFAULT_LOCALE;
  const lower = raw.replace(/_/g, "-").toLowerCase();
  if (lower === "zh-hk" || lower === "zh-tw" || lower === "zh-mo" || lower.startsWith("zh-hant")) return "zh-HK";
  if (lower === "zh-cn" || lower === "zh-sg" || lower.startsWith("zh-hans")) return "zh-CN";
  if (lower === "zh") return DEFAULT_LOCALE;
  const exact = matchPrefixSegment(lower);
  if (exact) return exact;
  const base = lower.split("-")[0] ?? "";
  if (PREFIX_SET.has(base)) return base as PrefixLocale;
  return DEFAULT_LOCALE;
}

export function sdkLocale(raw: string | undefined | null): SdkLocale {
  const id = canonicalLocale(raw);
  if (id === "zh-HK" || id === "zh-CN") return id;
  return "en";
}

export function parseHref(href: string) {
  const hashAt = href.indexOf("#");
  const hash = hashAt >= 0 ? href.slice(hashAt) : "";
  const noHash = hashAt >= 0 ? href.slice(0, hashAt) : href;
  const q = noHash.indexOf("?");
  const search = q >= 0 ? noHash.slice(q) : "";
  const pathname = (q >= 0 ? noHash.slice(0, q) : noHash) || "/";
  return { pathname, search, hash };
}

export function stripLocalePrefix(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (matchPrefixSegment(parts[0]) || (parts[0] && /^zh-hk$/i.test(parts[0]))) {
    const rest = `/${parts.slice(1).join("/")}`;
    return rest === "/" ? "/" : rest.replace(/\/+$/, "") || "/";
  }
  return pathname.replace(/\/+$/, "") || "/";
}

export function localeFromPathname(pathname: string): LocaleId {
  const first = pathname.split("/").filter(Boolean)[0];
  const prefix = matchPrefixSegment(first);
  if (prefix) return prefix;
  return DEFAULT_LOCALE;
}

export function localePath(href: string, locale?: LocaleId): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) return href;
  const loc =
    locale ??
    localeFromPathname(typeof window !== "undefined" ? window.location.pathname : "/");
  const { pathname, search, hash } = parseHref(href || "/");
  const rest = stripLocalePrefix(pathname || "/");
  const prefix = loc === DEFAULT_LOCALE ? "" : `/${loc}`;
  const body = rest === "/" ? prefix || "/" : `${prefix}${rest}`;
  return `${body}${search}${hash}`;
}

export function absUrl(href: string, locale: LocaleId): string {
  const path = localePath(href, locale);
  return `${SITE_ORIGIN}${path}`;
}

export function hreflangAlternates(href: string): { lang: string; href: string }[] {
  const { pathname, search } = parseHref(href);
  const rest = `${stripLocalePrefix(pathname)}${search}`;
  const out: { lang: string; href: string }[] = LOCALES.map((l) => ({
    lang: l.id,
    href: absUrl(rest, l.id),
  }));
  out.push({ lang: "x-default", href: absUrl(rest, DEFAULT_LOCALE) });
  return out;
}

export function isCrawler(ua: string): boolean {
  return /googlebot|bingbot|bingpreview|yandex(bot|images)|baiduspider|duckduckbot|slurp|facebookexternalhit|twitterbot|linkedinbot|applebot|gptbot|claudebot|anthropic|ccbot|bytespider|semrushbot|ahrefsbot/i.test(
    ua,
  );
}

export function detectBrowserLocale(
  langs: readonly string[] = typeof navigator !== "undefined"
    ? navigator.languages?.length
      ? navigator.languages
      : navigator.language
        ? [navigator.language]
        : []
    : [],
): LocaleId {
  for (const raw of langs) {
    if (!raw) continue;
    const tag = raw.trim().toLowerCase().replace(/_/g, "-").split(";")[0];
    const base = tag.split("-")[0] ?? "";
    if (base === "zh") {
      if (tag.includes("hans") || /(^|-)(cn|sg)(-|$)/.test(tag)) return "zh-CN";
      return DEFAULT_LOCALE;
    }
    if (base === "en") return "en";
    if (base === "es") return "es";
    if (base === "pt") return "pt";
    if (base === "ar") return "ar";
    if (PREFIX_SET.has(base)) return base as PrefixLocale;
  }
  return DEFAULT_LOCALE;
}

export function loadLocaleFonts(id: string) {
  if (typeof document === "undefined") return;
  const href =
    id === "ar"
      ? "https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;700&display=swap"
      : id === "ja"
        ? "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap"
        : id === "zh-CN"
          ? "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap"
          : "";
  const existing = document.getElementById("ysk-locale-font");
  if (!href) {
    existing?.remove();
    return;
  }
  if (existing instanceof HTMLLinkElement && existing.getAttribute("href") === href) return;
  existing?.remove();
  const link = document.createElement("link");
  link.id = "ysk-locale-font";
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

export function applyDocumentLang(lng: string) {
  if (typeof document === "undefined") return;
  const meta = localeMeta(canonicalLocale(lng));
  document.documentElement.lang = meta.htmlLang;
  document.documentElement.dir = meta.dir;
  loadLocaleFonts(meta.id);
}

/** First visit only: map browser language onto a prefix. Never bounce crawlers. URL wins after that. */
export function applyFirstVisitLocale() {
  if (typeof window === "undefined") return;
  const urlLocale = localeFromPathname(window.location.pathname);
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(LOCALE_KEY);
  } catch {
    saved = null;
  }
  if (saved) return;
  if (isCrawler(navigator.userAgent)) return;
  if (urlLocale !== DEFAULT_LOCALE) {
    try {
      localStorage.setItem(LOCALE_KEY, urlLocale);
    } catch {
      /* ignore */
    }
    return;
  }
  const detected = detectBrowserLocale();
  try {
    localStorage.setItem(LOCALE_KEY, detected);
  } catch {
    /* ignore */
  }
  if (detected === DEFAULT_LOCALE) return;
  const dest = localePath(window.location.pathname + window.location.search + window.location.hash, detected);
  const here = window.location.pathname + window.location.search + window.location.hash;
  if (dest !== here) history.replaceState(null, "", dest);
}

export const SITEMAP_PATHS = ["/", "/lend", "/create", "/transfer", "/about", "/donate", "/terms", "/disclaimer"] as const;
