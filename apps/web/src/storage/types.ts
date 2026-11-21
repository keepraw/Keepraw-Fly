import type { DistanceUnit, TimeFormat } from "@keepraw-fly/core";
import type { SolarMode } from "../globe/globe-solar";
import {
  DEFAULT_MAP_THEME_ID,
  resolveMapTheme,
  type MapThemeId,
} from "../map2d/theme-registry";

import {
  browserLanguage,
  normalizeLanguage,
  type Language,
} from "../locales/registry";
export type { Language } from "../locales/registry";
export type Appearance = "system" | "light" | "dark";

export interface ViewerSettings {
  language: Language;
  appearance: Appearance;
  distanceUnit: DistanceUnit;
  timeFormat: TimeFormat;
  powerUserMode: boolean;
  solarMode: SolarMode;
  /** Registered 2D map theme; unknown stored values fall back to the default. */
  mapTheme: MapThemeId;
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
  };
}

// Preferences share the existing IndexedDB record. Read-time normalization
// preserves older records and unrelated preferences without rewriting archives.
export function normalizeViewerSettings(
  settings: Omit<ViewerSettings, "solarMode" | "language" | "mapTheme"> & {
    language: unknown;
    solarMode?: unknown;
    mapTheme?: unknown;
  },
): ViewerSettings {
  return {
    ...settings,
    language: normalizeLanguage(settings.language),
    solarMode: settings.solarMode === "realtime" ? "realtime" : "fixed",
    mapTheme: resolveMapTheme(settings.mapTheme).id as MapThemeId,
  };
}
