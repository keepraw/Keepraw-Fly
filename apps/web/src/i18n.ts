import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { browserLanguage, normalizeLanguage } from "./locales/registry";
import { i18nOptions } from "./locales/resources";

// Keep HTML language synchronized for every i18next language change.
i18n.on("languageChanged", (language) => {
  if (typeof document !== "undefined")
    document.documentElement.lang = normalizeLanguage(language);
});
void i18n.use(initReactI18next).init({
  ...i18nOptions,
  lng: browserLanguage(),
  // Defensive fallback for unrecognized dynamic keys; never show identifiers.
  parseMissingKeyHandler: (_key, defaultValue) =>
    defaultValue ??
    i18n.getResource(
      normalizeLanguage(i18n.language),
      "translation",
      "app.unavailable",
    ) ??
    i18n.getResource("en-US", "translation", "app.unavailable"),
});

export { i18n };
