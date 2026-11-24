import type { MapTheme, MapThemeTokens } from "../theme";
import { NEON_AVIATION_TOKENS } from "./neon-aviation";

/** Restrained dark chart: neutral greys, one blue for routes, almost no glow. */
export const GRAPHITE_CHART_TOKENS = {
  ...NEON_AVIATION_TOKENS,
  color: {
    backgroundTop: [20, 22, 26, 1],
    backgroundBottom: [14, 15, 18, 1],
    backgroundBloom: [143, 176, 255, 0.04],
    ocean: [16, 18, 21, 1],
    land: [44, 48, 56, 0.9],
    landHatch: [120, 128, 142, 0.28],
    coastline: [128, 136, 150, 0.6],
    border: [128, 136, 150, 0.2],
    graticule: [160, 168, 182, 0.07],
    routeBase: [143, 176, 255, 1],
    routeFrequent: [171, 196, 255, 1],
    routeHighlight: [214, 226, 255, 1],
    routeSelected: [255, 255, 255, 1],
    routeGlow: [143, 176, 255, 1],
    airport: [201, 213, 240, 1],
    airportHub: [232, 238, 252, 1],
    airportSelected: [255, 255, 255, 1],
    airportHalo: [143, 176, 255, 1],
    label: [236, 238, 241, 1],
    labelMuted: [163, 169, 179, 1],
    labelHalo: [14, 15, 18, 0.9],
    tooltip: [27, 30, 34, 0.97],
    tooltipLine: [70, 77, 89, 0.9],
    focus: [169, 193, 255, 1],
    dateline: [143, 176, 255, 0.35],
  },
  glow: {
    ...NEON_AVIATION_TOKENS.glow,
    spread: 2,
    intensity: 0.05,
    innerSpread: 1,
    innerIntensity: 0.12,
  },
} as const satisfies MapThemeTokens;

export const GRAPHITE_CHART_THEME = {
  id: "graphite-chart",
  label: "Graphite Chart",
  tokens: GRAPHITE_CHART_TOKENS,
} as const satisfies MapTheme;
