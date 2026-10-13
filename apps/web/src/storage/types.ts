import type { DistanceUnit, TimeFormat } from "@keepraw-fly/core";
import type { SolarMode } from "../globe/globe-solar";

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
  };
}

// Preferences share the existing IndexedDB record. Read-time normalization
// preserves older records and unrelated preferences without rewriting archives.
export function normalizeViewerSettings(
  settings: Omit<ViewerSettings, "solarMode" | "language"> & {
    language: unknown;
    solarMode?: unknown;
  },
): ViewerSettings {
  return {
    ...settings,
    language: normalizeLanguage(settings.language),
    solarMode: settings.solarMode === "realtime" ? "realtime" : "fixed",
  };
}
