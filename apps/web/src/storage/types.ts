import type { DistanceUnit, TimeFormat } from "@keepraw-fly/core";

export type Language = "en" | "zh-CN";
export type Appearance = "system" | "light" | "dark";

export interface ViewerSettings {
  language: Language;
  appearance: Appearance;
  distanceUnit: DistanceUnit;
  timeFormat: TimeFormat;
  powerUserMode: boolean;
}

export function defaultViewerSettings(): ViewerSettings {
  return {
    language: navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en",
    appearance: "system",
    distanceUnit: "miles",
    timeFormat: "24-hour",
    powerUserMode: false,
  };
}

