import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import zhCN from "./locales/zh-CN.json";

const browserLanguage = navigator.language.toLowerCase();
const initialLanguage = browserLanguage.startsWith("zh") ? "zh-CN" : "en";

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    "zh-CN": { translation: zhCN },
  },
  lng: initialLanguage,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

document.documentElement.lang = initialLanguage;

export { i18n };

