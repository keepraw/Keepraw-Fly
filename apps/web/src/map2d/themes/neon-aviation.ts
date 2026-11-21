import type { MapTheme, MapThemeTokens } from "../theme";

export const NEON_AVIATION_TOKENS = {
  color: {
    backgroundTop: [27, 16, 64, 1],
    backgroundBottom: [11, 10, 38, 1],
    backgroundBloom: [92, 64, 214, 0.22],
    ocean: [17, 13, 52, 1],
    land: [58, 52, 138, 0.5],
    landHatch: [150, 140, 255, 0.58],
    coastline: [150, 140, 255, 0.55],
    border: [160, 150, 255, 0.16],
    graticule: [150, 140, 255, 0.08],
    routeBase: [196, 181, 255, 1],
    routeFrequent: [176, 220, 255, 1],
    routeHighlight: [236, 242, 255, 1],
    routeSelected: [255, 255, 255, 1],
    routeGlow: [150, 170, 255, 1],
    airport: [255, 214, 236, 1],
    airportHub: [255, 236, 246, 1],
    airportSelected: [255, 255, 255, 1],
    airportHalo: [255, 150, 210, 1],
    label: [244, 241, 255, 1],
    labelMuted: [184, 176, 232, 1],
    labelHalo: [14, 11, 44, 0.92],
    tooltip: [22, 17, 66, 0.96],
    tooltipLine: [170, 160, 255, 0.28],
    focus: [130, 220, 255, 1],
    dateline: [176, 220, 255, 0.45],
  },
  route: {
    base: { width: 1.1, opacity: 0.5 },
    frequent: { width: 1.6, opacity: 0.78 },
    highlight: { width: 2.2, opacity: 0.95 },
    selected: { width: 2.6, opacity: 1 },
    disabledOpacity: 0.18,
    dimmedOpacity: 0.26,
  },
  glow: {
    spread: 3.5,
    intensity: 0.14,
    innerSpread: 1.4,
    innerIntensity: 0.32,
    maxGlowingRoutes: 12,
  },
  airport: {
    base: { radius: 2.1, stroke: 0.8, halo: 5 },
    hub: { radius: 3.2, stroke: 1, halo: 8 },
    selected: { radius: 4, stroke: 1.4, halo: 11 },
  },
  hatch: { angleDegrees: 45, spacing: 4, width: 1 },
  line: { coastline: 0.75, border: 0.5, graticule: 0.5 },
  type: {
    family: {
      display:
        '"Barlow Semi Condensed", "Inter", system-ui, "Helvetica Neue", Arial, sans-serif',
      data: '"IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace',
      label:
        '"Inter", system-ui, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    },
    size: {
      mapLabel: 10,
      mapLabelHub: 11.5,
      mapLabelSelected: 13,
      tooltipTitle: 12,
      tooltipBody: 11,
      statValue: 56,
      statLabel: 15,
      posterTitle: 84,
    },
    weight: { regular: 400, semibold: 600, bold: 700 },
    letterSpacing: { code: "0.08em", caps: "0.18em" },
  },
  state: {
    hoverScale: 1.15,
    focusRingWidth: 2,
    focusRingOffset: 2,
    transitionMs: 160,
  },
} as const satisfies MapThemeTokens;

export const NEON_AVIATION_THEME = {
  id: "neon-aviation",
  label: "Neon Aviation",
  tokens: NEON_AVIATION_TOKENS,
} as const satisfies MapTheme;
