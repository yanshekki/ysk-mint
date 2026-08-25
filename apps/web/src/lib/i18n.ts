import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../shared/i18n/en.json";
import zhHK from "../shared/i18n/zh-HK.json";

export const LOCALES = [
  { id: "zh-HK", label: "繁中" },
  { id: "en", label: "English" },
] as const;

export type LocaleId = (typeof LOCALES)[number]["id"];

const saved = typeof localStorage !== "undefined" ? localStorage.getItem("ysk-mint.locale") : null;
const supported = new Set<string>(LOCALES.map((l) => l.id));

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    "zh-HK": { translation: zhHK },
  },
  lng: saved && supported.has(saved) ? saved : "zh-HK",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lng) => {
  localStorage.setItem("ysk-mint.locale", lng);
  document.documentElement.lang = lng;
});

export default i18n;
