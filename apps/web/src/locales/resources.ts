import enUS from "./en-US.json";
import type { BackendModule } from "i18next";
import {
  localeRegistry,
  supportedLanguages,
  defaultLanguage,
} from "./registry";

// URL imports emit static JSON assets, not eager translations in the entry JS.
export const resourceUrls = import.meta.glob<string>("./*.json", {
  query: "?url&no-inline",
  import: "default",
  eager: true,
});

export const i18nOptions = {
  resources: { "en-US": { translation: enUS } },
  partialBundledLanguages: true,
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
  react: { useSuspense: false },
};

const pending = new Map<string, Promise<object>>();
const cacheName = "keepraw-fly-locales-v1";

/** Cache keys contain Vite's content hash, so old deployments cannot supply stale text. */
export function loadTranslation(language: string): Promise<object> {
  if (language === "en-US") return Promise.resolve(enUS);
  const url = resourceUrls[`./${language}.json`];
  if (!url) return Promise.reject(new Error("Unsupported locale"));
  const existing = pending.get(url);
  if (existing) return existing;
  const request = (async () => {
    // CacheStorage is optional (private browsing, file hosting, quota failures).
    const cache =
      typeof caches === "undefined"
        ? undefined
        : await caches.open(cacheName).catch(() => undefined);
    const cached = await cache?.match(url).catch(() => undefined);
    if (cached) return cached.json() as Promise<object>;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Locale resource unavailable");
    const resource = (await response.clone().json()) as object;
    await cache?.put(url, response).catch(() => {});
    return resource;
  })();
  pending.set(url, request);
  void request.catch(() => pending.delete(url));
  return request;
}

// The native API and cloned instances (including independently mounted Globe
// modules) must use the same loader, not require the App's preload helper.
export const localeBackend: BackendModule = {
  type: "backend",
  init() {},
  read(language, _namespace, callback) {
    void loadTranslation(language).then(
      (resource) => callback(null, resource),
      (error) => callback(error, false),
    );
  },
};

/** Warm unused locales after startup, sequentially, from same-origin static files. */
export async function warmLocaleCache(): Promise<void> {
  for (const language of supportedLanguages) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    await loadTranslation(language).catch(() => {});
  }
}
