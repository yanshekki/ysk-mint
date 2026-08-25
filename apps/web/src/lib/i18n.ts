import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../shared/i18n/en.json";
import zhHK from "../shared/i18n/zh-HK.json";

const saved = typeof localStorage !== "undefined" ? localStorage.getItem("ysk-mint.locale") : null;

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    "zh-HK": { translation: zhHK },
  },
  lng: saved === "zh-HK" || saved === "en" ? saved : "zh-HK",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lng) => {
  localStorage.setItem("ysk-mint.locale", lng);
  document.documentElement.lang = lng;
});

export default i18n;
