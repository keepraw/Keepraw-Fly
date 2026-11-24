import type { MapTheme } from "./theme";
import { DAYLIGHT_CHART_THEME } from "./themes/daylight-chart";
import { GRAPHITE_CHART_THEME } from "./themes/graphite-chart";
import { NEON_AVIATION_THEME } from "./themes/neon-aviation";

export const MAP_THEMES = {
  "neon-aviation": NEON_AVIATION_THEME,
  "daylight-chart": DAYLIGHT_CHART_THEME,
  "graphite-chart": GRAPHITE_CHART_THEME,
} as const;

export type MapThemeId = keyof typeof MAP_THEMES;

export const DEFAULT_MAP_THEME_ID: MapThemeId = "neon-aviation";

export function isMapThemeId(value: unknown): value is MapThemeId {
  return typeof value === "string" && Object.hasOwn(MAP_THEMES, value);
}

export function resolveMapTheme(id: unknown): MapTheme {
  return MAP_THEMES[isMapThemeId(id) ? id : DEFAULT_MAP_THEME_ID];
}

export function listMapThemes(): readonly MapTheme[] {
  return Object.values(MAP_THEMES);
}

/** Themes a skin brings with it; they are not offered as a separate choice. */
const SKIN_ONLY_THEME_IDS: ReadonlySet<string> = new Set(["graphite-chart"]);

/** The themes offered where the map theme is still chosen on its own. */
export function listSelectableMapThemes(): readonly MapTheme[] {
  return listMapThemes().filter((theme) => !SKIN_ONLY_THEME_IDS.has(theme.id));
}
