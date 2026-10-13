import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { browserLanguage, normalizeLanguage } from "./locales/registry";
import {
  i18nOptions,
  loadTranslation,
  localeBackend,
} from "./locales/resources";

// Keep HTML language synchronized for every i18next language change.
i18n.on("languageChanged", (language) => {
  if (typeof document !== "undefined")
    document.documentElement.lang = normalizeLanguage(language);
});
void i18n
  .use(localeBackend)
  .use(initReactI18next)
  .init({
    ...i18nOptions,
    lng: "en-US",
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

let languageRequest = 0;
/** Only the latest request may commit; keep the current UI while loading. */
export async function changeUiLanguage(language: string): Promise<boolean> {
  const request = ++languageRequest;
  const target = normalizeLanguage(language);
  try {
    const resource = await loadTranslation(target);
    if (request !== languageRequest) return false;
    i18n.addResourceBundle(target, "translation", resource, true, true);
    await i18n.changeLanguage(target);
    return true;
  } catch (error) {
    if (request !== languageRequest) return false;
    throw error;
  }
}

export const initialLanguageReady = changeUiLanguage(browserLanguage()).catch(
  () => false,
);

export { i18n };
