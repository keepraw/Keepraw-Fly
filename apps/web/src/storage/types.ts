import type { DistanceUnit, TimeFormat } from "@keepraw-fly/core";
import {
  DEFAULT_MAP_THEME_ID,
  resolveMapTheme,
  type MapThemeId,
} from "../map2d/theme-registry";
import {
  DEFAULT_POSTER_TEMPLATE_ID,
  isPosterTemplateId,
  type PosterTemplateId,
} from "../share/poster-template-ids";

import {
  browserLanguage,
  normalizeLanguage,
  type Language,
} from "../locales/registry";
export type { Language } from "../locales/registry";
export type Appearance = "system" | "light" | "dark";

/** Preference of the removed 3D globe. Still stored so existing saved
 * settings round-trip unchanged; nothing reads it. */
export type SolarMode = "fixed" | "realtime";

export interface ViewerSettings {
  language: Language;
  appearance: Appearance;
  distanceUnit: DistanceUnit;
  timeFormat: TimeFormat;
  powerUserMode: boolean;
  solarMode: SolarMode;
  /** Registered 2D map theme; unknown stored values fall back to the default. */
  mapTheme: MapThemeId;
  /** Flight Passport layout; unknown stored values fall back to the default. */
  passportTemplate: PosterTemplateId;
  lastBackupAt?: string;
}

export function defaultViewerSettings(): ViewerSettings {
  const language = browserLanguage();
  return {
    language,
    appearance: "system",
    distanceUnit: language.startsWith("en-") ? "miles" : "kilometers",
    timeFormat: "24-hour",
    powerUserMode: false,
    solarMode: "fixed",
    mapTheme: DEFAULT_MAP_THEME_ID,
    passportTemplate: DEFAULT_POSTER_TEMPLATE_ID,
  };
}

// Preferences share the existing IndexedDB record. Read-time normalization
// preserves older records and unrelated preferences without rewriting archives.
export function normalizeViewerSettings(
  settings: Omit<
    ViewerSettings,
    "solarMode" | "language" | "mapTheme" | "passportTemplate"
  > & {
    language: unknown;
    solarMode?: unknown;
    mapTheme?: unknown;
    passportTemplate?: unknown;
  },
): ViewerSettings {
  return {
    ...settings,
    language: normalizeLanguage(settings.language),
    solarMode: settings.solarMode === "realtime" ? "realtime" : "fixed",
    mapTheme: resolveMapTheme(settings.mapTheme).id as MapThemeId,
    passportTemplate: isPosterTemplateId(settings.passportTemplate)
      ? settings.passportTemplate
      : DEFAULT_POSTER_TEMPLATE_ID,
  };
}
