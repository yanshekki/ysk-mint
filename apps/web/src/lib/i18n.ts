import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../shared/i18n/en.json";
import zhHK from "../shared/i18n/zh-HK.json";
import {
  LOCALES,
  LOCALE_KEY,
  applyDocumentLang,
  applyFirstVisitLocale,
  canonicalLocale,
  localeFromPathname,
  type LocaleId,
} from "./locale.ts";

export { LOCALES, type LocaleId };

applyFirstVisitLocale();

const startLng: LocaleId =
  typeof window !== "undefined" ? localeFromPathname(window.location.pathname) : "zh-HK";

const lazyLoaders: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
  "zh-CN": () => import("../shared/i18n/zh-CN.json"),
  es: () => import("../shared/i18n/es.json"),
  ar: () => import("../shared/i18n/ar.json"),
  pt: () => import("../shared/i18n/pt.json"),
  id: () => import("../shared/i18n/id.json"),
  ja: () => import("../shared/i18n/ja.json"),
  ru: () => import("../shared/i18n/ru.json"),
  fr: () => import("../shared/i18n/fr.json"),
  de: () => import("../shared/i18n/de.json"),
};

const bundled: Record<string, object> = {
  en,
  "zh-HK": zhHK,
};

const backend = {
  type: "backend" as const,
  init() {},
  read(lng: string, _ns: string, cb: (err: unknown, data: unknown) => void) {
    const pack = bundled[lng];
    if (pack) {
      cb(null, pack);
      return;
    }
    const load = lazyLoaders[lng];
    if (!load) {
      cb(null, false);
      return;
    }
    load()
      .then((mod) => cb(null, mod.default))
      .catch((err) => cb(err, false));
  },
};

export const i18nReady = i18n
  .use(backend)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      "zh-HK": { translation: zhHK },
    },
    partialBundledLanguages: true,
    ns: ["translation"],
    defaultNS: "translation",
    lng: startLng,
    fallbackLng: ["en"],
    supportedLngs: LOCALES.map((l) => l.id),
    lowerCaseLng: false,
    load: "currentOnly",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  })
  .then(() => {
    applyDocumentLang(canonicalLocale(i18n.language));
  });

i18n.on("languageChanged", (lng) => {
  try {
    localStorage.setItem(LOCALE_KEY, canonicalLocale(lng));
  } catch {
    /* ignore */
  }
  applyDocumentLang(lng);
});

export default i18n;
