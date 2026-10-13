/** The only list of released UI languages. Reference data may support more. */
export const localeRegistry = {
  "en-US": { label: "English (United States)", fallback: "en-US" },
  "en-GB": { label: "English (United Kingdom)", fallback: "en-US" },
  "zh-CN": { label: "简体中文", fallback: "en-US" },
  "zh-TW": { label: "繁體中文（台灣）", fallback: "en-US" },
  "ja-JP": { label: "日本語", fallback: "en-US" },
  "fr-FR": { label: "Français", fallback: "en-US" },
  "de-DE": { label: "Deutsch", fallback: "en-US" },
  es: { label: "Español", fallback: "en-US" },
  "pt-BR": { label: "Português (Brasil)", fallback: "en-US" },
  "ko-KR": { label: "한국어", fallback: "en-US" },
} as const;

export type Language = keyof typeof localeRegistry;
export const defaultLanguage: Language = "en-US";
export const supportedLanguages = Object.keys(localeRegistry) as Language[];

/** Resolve supported BCP 47 variants; script takes precedence over region. */
export function resolveLanguage(value: unknown): Language | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const locale = new Intl.Locale(value);
    if (locale.baseName in localeRegistry) return locale.baseName as Language;
    if (locale.language === "zh") {
      if (locale.script === "Hant") return "zh-TW";
      if (locale.script === "Hans") return "zh-CN";
      return ["TW", "HK", "MO"].includes(locale.region ?? "")
        ? "zh-TW"
        : "zh-CN";
    }
    if (locale.language === "en")
      return locale.region === "GB" ? "en-GB" : "en-US";
    return supportedLanguages.find(
      (tag) => tag.split("-")[0] === locale.language,
    );
  } catch {
    // Malformed/unknown browser or saved preferences use the released fallback.
  }
  return undefined;
}

export function normalizeLanguage(value: unknown): Language {
  return resolveLanguage(value) ?? defaultLanguage;
}

export function browserLanguage(
  browser:
    Pick<Navigator, "languages" | "language"> | undefined = typeof navigator ===
  "undefined"
    ? undefined
    : navigator,
): Language {
  for (const candidate of [...(browser?.languages ?? []), browser?.language]) {
    const language = resolveLanguage(candidate);
    if (language) return language;
  }
  return defaultLanguage;
}
