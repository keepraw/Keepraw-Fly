import type { DistanceUnit, TimeFormat } from "@keepraw-fly/core";

export type Language = "en" | "zh-CN" | "zh-TW";
export type Appearance = "system" | "light" | "dark";

export interface ViewerSettings {
  language: Language;
  appearance: Appearance;
  distanceUnit: DistanceUnit;
  timeFormat: TimeFormat;
  powerUserMode: boolean;
  lastBackupAt?: string;
}

export function defaultViewerSettings(): ViewerSettings {
  const browserLanguage = navigator.language.toLowerCase();
  const language = browserLanguage === "zh-tw" || browserLanguage === "zh-hk" || browserLanguage === "zh-mo" || browserLanguage.includes("hant")
    ? "zh-TW"
    : browserLanguage.startsWith("zh")
      ? "zh-CN"
      : "en";
  return {
    language,
    appearance: "system",
    distanceUnit: "miles",
    timeFormat: "24-hour",
    powerUserMode: false,
  };
}
