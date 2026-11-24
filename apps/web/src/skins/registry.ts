/**
 * First-party skins (docs/views-and-skins.md, `skin-contract/0`). A skin is
 * compiled into the application; nothing here loads code or styles at runtime.
 */
import { DEFAULT_MAP_THEME_ID, type MapThemeId } from "../map2d/theme-registry";
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
  /** Registered 2D map theme for each appearance the skin is drawn in. */
  mapTheme: Partial<Record<SkinAppearance, MapThemeId>>;
  /** Flight Passport template. */
  passportTemplate: PosterTemplateId;
}

export const SKINS = {
  minimal: {
    id: "minimal",
    labelKey: "settings.skinOption.minimal",
    appearances: ["light", "dark"],
    landingView: "log",
    mapTheme: { light: "daylight-chart", dark: "graphite-chart" },
    passportTemplate: "neon",
  },
  aviation: {
    id: "aviation",
    labelKey: "settings.skinOption.aviation",
    appearances: ["dark"],
    landingView: "map",
    mapTheme: { dark: "neon-aviation" },
    passportTemplate: "neon",
  },
} as const satisfies Record<string, SkinDefinition>;

export type SkinId = keyof typeof SKINS;

export const SKIN_IDS = Object.keys(SKINS) as SkinId[];

export const DEFAULT_SKIN_ID: SkinId = "aviation";

export function isSkinId(value: unknown): value is SkinId {
  return typeof value === "string" && Object.hasOwn(SKINS, value);
}

/**
 * An unknown or missing stored value resolves to the default skin. That
 * includes `classic`, the v0.3.0 look that earlier versions stored.
 */
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

/** The map theme the skin draws in the given appearance. */
export function skinMapTheme(
  skin: SkinDefinition,
  appearance: SkinAppearance,
): MapThemeId {
  return (
    skin.mapTheme[skinAppearance(skin, appearance)] ?? DEFAULT_MAP_THEME_ID
  );
}
