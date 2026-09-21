import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import zhCN from "./locales/zh-CN.json";
import zhTW from "./locales/zh-TW.json";

const browserLanguage = navigator.language.toLowerCase();
const initialLanguage = browserLanguage === "zh-tw" || browserLanguage === "zh-hk" || browserLanguage === "zh-mo" || browserLanguage.includes("hant")
  ? "zh-TW"
  : browserLanguage.startsWith("zh")
    ? "zh-CN"
    : "en";

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    "zh-CN": { translation: zhCN },
    "zh-TW": { translation: zhTW },
  },
  lng: initialLanguage,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

document.documentElement.lang = initialLanguage;

export { i18n };
