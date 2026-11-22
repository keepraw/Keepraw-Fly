import type { MapTheme } from "./theme";
import { DAYLIGHT_CHART_THEME } from "./themes/daylight-chart";
import { NEON_AVIATION_THEME } from "./themes/neon-aviation";

export const MAP_THEMES = {
  "neon-aviation": NEON_AVIATION_THEME,
  "daylight-chart": DAYLIGHT_CHART_THEME,
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
