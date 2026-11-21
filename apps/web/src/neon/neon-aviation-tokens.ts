/** @deprecated Import the map2d theme registry and helpers directly. */
export {
  NEON_AVIATION_THEME,
  NEON_AVIATION_TOKENS,
  NEON_AVIATION_TOKENS as NEON_AVIATION,
} from "../map2d/themes/neon-aviation";
export type {
  MapThemeTokens as NeonAviationTokens,
  Rgba as NeonRgba,
} from "../map2d/theme";
export type {
  MapAirportKind as NeonAirportKind,
  MapRouteState as NeonRouteState,
} from "../map2d/theme-style";
export {
  airportStyle,
  contrastRatio,
  deviceSnap,
  hatchTile,
  rgba,
  routeStroke,
  routeTier,
} from "../map2d/theme-style";
export { mapThemeCssVariables as neonCssVariables } from "../map2d/theme-css";
