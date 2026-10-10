import type { DistanceUnit, TimeFormat } from "@keepraw-fly/core";
import type { SolarMode } from "../globe/globe-solar";

export type Language = "en" | "zh-CN" | "zh-TW";
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
  const browserLanguage = navigator.language.toLowerCase();
  const language =
    browserLanguage === "zh-tw" ||
    browserLanguage === "zh-hk" ||
    browserLanguage === "zh-mo" ||
    browserLanguage.includes("hant")
      ? "zh-TW"
      : browserLanguage.startsWith("zh")
        ? "zh-CN"
        : "en";
  return {
    language,
    appearance: "system",
    distanceUnit: language === "en" ? "miles" : "kilometers",
    timeFormat: "24-hour",
    powerUserMode: false,
    solarMode: "fixed",
  };
}

// Preferences share the existing IndexedDB record. Read-time normalization
// preserves older records and unrelated preferences without rewriting archives.
export function normalizeViewerSettings(
  settings: Omit<ViewerSettings, "solarMode"> & { solarMode?: unknown },
): ViewerSettings {
  return {
    ...settings,
    solarMode: settings.solarMode === "realtime" ? "realtime" : "fixed",
  };
}
