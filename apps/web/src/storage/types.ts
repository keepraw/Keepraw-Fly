import type { DistanceUnit, TimeFormat } from "@keepraw-fly/core";
import { DEFAULT_SKIN_ID, resolveSkin, type SkinId } from "../skins/registry";
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
  /** Registered skin; unknown stored values fall back to the default. */
  skin: SkinId;
  distanceUnit: DistanceUnit;
  timeFormat: TimeFormat;
  powerUserMode: boolean;
  lastBackupAt?: string;
}

export function defaultViewerSettings(): ViewerSettings {
  const language = browserLanguage();
  return {
    language,
    appearance: "system",
    skin: DEFAULT_SKIN_ID,
    distanceUnit: language.startsWith("en-") ? "miles" : "kilometers",
    timeFormat: "24-hour",
    powerUserMode: false,
  };
}

// Preferences share the existing IndexedDB record. Read-time normalization
// preserves older records and unrelated preferences without rewriting archives.
// The skin owns the map theme and the Flight Passport layout, so the values
// earlier versions stored for them are dropped here.
export function normalizeViewerSettings(
  settings: Omit<ViewerSettings, "language" | "skin"> & {
    language: unknown;
    skin?: unknown;
    mapTheme?: unknown;
    passportTemplate?: unknown;
  },
): ViewerSettings {
  const { mapTheme: _mapTheme, passportTemplate: _layout, ...kept } = settings;
  return {
    ...kept,
    language: normalizeLanguage(settings.language),
    skin: resolveSkin(settings.skin).id as SkinId,
  };
}
