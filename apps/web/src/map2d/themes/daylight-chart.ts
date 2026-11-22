import type { MapTheme, MapThemeTokens } from "../theme";
import { NEON_AVIATION_TOKENS } from "./neon-aviation";

/** Light chart palette derived from the light `--color-map-*` page tokens. */
export const DAYLIGHT_CHART_TOKENS = {
  ...NEON_AVIATION_TOKENS,
  color: {
    backgroundTop: [236, 243, 250, 1],
    backgroundBottom: [220, 233, 245, 1],
    backgroundBloom: [255, 255, 255, 0.5],
    ocean: [226, 237, 247, 1],
    land: [196, 215, 235, 0.9],
    landHatch: [104, 138, 180, 0.42],
    coastline: [96, 128, 170, 0.7],
    border: [96, 128, 170, 0.26],
    graticule: [67, 94, 125, 0.1],
    routeBase: [41, 87, 140, 1],
    routeFrequent: [28, 70, 125, 1],
    routeHighlight: [16, 50, 100, 1],
    routeSelected: [10, 36, 80, 1],
    routeGlow: [60, 105, 170, 1],
    airport: [36, 79, 133, 1],
    airportHub: [27, 54, 88, 1],
    airportSelected: [10, 36, 80, 1],
    airportHalo: [80, 130, 200, 1],
    label: [27, 54, 88, 1],
    labelMuted: [67, 94, 125, 1],
    labelHalo: [244, 248, 253, 0.92],
    tooltip: [244, 248, 253, 0.97],
    tooltipLine: [150, 175, 205, 0.9],
    focus: [20, 90, 200, 1],
    dateline: [41, 87, 140, 0.4],
  },
} as const satisfies MapThemeTokens;

export const DAYLIGHT_CHART_THEME = {
  id: "daylight-chart",
  label: "Daylight Chart",
  tokens: DAYLIGHT_CHART_TOKENS,
} as const satisfies MapTheme;
