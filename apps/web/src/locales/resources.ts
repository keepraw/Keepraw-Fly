import enUS from "./en-US.json";
import enGB from "./en-GB.json";
import zhCN from "./zh-CN.json";
import zhTW from "./zh-TW.json";
import {
  localeRegistry,
  supportedLanguages,
  defaultLanguage,
  type Language,
} from "./registry";

export const translations = {
  "en-US": enUS,
  "en-GB": enGB,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
} satisfies Record<Language, object>;

export const i18nOptions = {
  resources: Object.fromEntries(
    supportedLanguages.map((language) => [
      language,
      { translation: translations[language] },
    ]),
  ),
  supportedLngs: supportedLanguages,
  load: "currentOnly" as const,
  fallbackLng: Object.fromEntries([
    ...supportedLanguages.map((language) => [
      language,
      [localeRegistry[language].fallback],
    ]),
    ["default", [defaultLanguage]],
  ]),
  interpolation: { escapeValue: false },
  returnEmptyString: false,
};
