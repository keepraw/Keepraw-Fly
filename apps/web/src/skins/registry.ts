/**
 * First-party skins (docs/views-and-skins.md, `skin-contract/0`). A skin is
 * compiled into the application; nothing here loads code or styles at runtime.
 */
import type { MapThemeId } from "../map2d/theme-registry";
import type { PrimaryView } from "../routing";
import type { PosterTemplateId } from "../share/poster-template-ids";

export type SkinAppearance = "light" | "dark";

export interface SkinDefinition {
  id: string;
  /** Locale key of the name shown in Settings. */
  labelKey: string;
  /** Appearances the skin is drawn in; the first is used when only one is. */
  appearances: readonly SkinAppearance[];
  /** The view an empty address opens; it is also first in the navigation. */
  landingView: PrimaryView;
  /**
   * Registered 2D map theme per supported appearance. `null` keeps the stored
   * Map theme preference: only the transitional v0.3.0 look does that.
   */
  mapTheme: Partial<Record<SkinAppearance, MapThemeId>> | null;
  /** Flight Passport template; `null` keeps the stored preference. */
  passportTemplate: PosterTemplateId | null;
}

export const SKINS = {
  /** The v0.3.0 look. It stays the default until `aviation` replaces it. */
  classic: {
    id: "classic",
    labelKey: "settings.skinOption.classic",
    appearances: ["light", "dark"],
    landingView: "map",
    mapTheme: null,
    passportTemplate: null,
  },
  minimal: {
    id: "minimal",
    labelKey: "settings.skinOption.minimal",
    appearances: ["light", "dark"],
    landingView: "log",
    mapTheme: { light: "daylight-chart", dark: "graphite-chart" },
    passportTemplate: "neon",
  },
} as const satisfies Record<string, SkinDefinition>;

export type SkinId = keyof typeof SKINS;

export const SKIN_IDS = Object.keys(SKINS) as SkinId[];

export const DEFAULT_SKIN_ID: SkinId = "classic";

export function isSkinId(value: unknown): value is SkinId {
  return typeof value === "string" && Object.hasOwn(SKINS, value);
}

/** An unknown or missing stored value resolves to the default skin. */
export function resolveSkin(id: unknown): SkinDefinition {
  return SKINS[isSkinId(id) ? id : DEFAULT_SKIN_ID];
}

/** The appearance on screen: the resolved request when the skin supports it. */
export function skinAppearance(
  skin: SkinDefinition,
  requested: SkinAppearance,
): SkinAppearance {
  return skin.appearances.includes(requested)
    ? requested
    : (skin.appearances[0] ?? requested);
}

/** Whether Appearance is a choice in this skin. */
export function skinHasAppearanceChoice(skin: SkinDefinition): boolean {
  return skin.appearances.length > 1;
}

export function skinMapTheme(
  skin: SkinDefinition,
  appearance: SkinAppearance,
  stored: MapThemeId,
): MapThemeId {
  if (!skin.mapTheme) return stored;
  return skin.mapTheme[skinAppearance(skin, appearance)] ?? stored;
}

export function skinPassportTemplate(
  skin: SkinDefinition,
  stored: PosterTemplateId,
): PosterTemplateId {
  return skin.passportTemplate ?? stored;
}
