// Test-only loader: never import into the application entry.
import { readFileSync } from "node:fs";
import { supportedLanguages, type Language } from "./registry";
import { i18nOptions as runtimeOptions } from "./resources";
import type enUS from "./en-US.json";

export const translations = Object.fromEntries(
  supportedLanguages.map((language) => [
    language,
    JSON.parse(
      readFileSync(new URL(`./${language}.json`, import.meta.url), "utf8"),
    ),
  ]),
) as Record<Language, typeof enUS>;

export const i18nOptions = {
  ...runtimeOptions,
  resources: Object.fromEntries(
    supportedLanguages.map((language) => [
      language,
      { translation: translations[language] },
    ]),
  ),
};
