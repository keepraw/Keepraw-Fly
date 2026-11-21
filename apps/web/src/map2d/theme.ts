export type Rgba = readonly [r: number, g: number, b: number, a: number];

export interface MapThemeTokens {
  color: {
    backgroundTop: Rgba;
    backgroundBottom: Rgba;
    backgroundBloom: Rgba;
    ocean: Rgba;
    land: Rgba;
    landHatch: Rgba;
    coastline: Rgba;
    border: Rgba;
    graticule: Rgba;
    routeBase: Rgba;
    routeFrequent: Rgba;
    routeHighlight: Rgba;
    routeSelected: Rgba;
    routeGlow: Rgba;
    airport: Rgba;
    airportHub: Rgba;
    airportSelected: Rgba;
    airportHalo: Rgba;
    label: Rgba;
    labelMuted: Rgba;
    labelHalo: Rgba;
    tooltip: Rgba;
    tooltipLine: Rgba;
    focus: Rgba;
    dateline: Rgba;
  };
  route: Record<
    "base" | "frequent" | "highlight" | "selected",
    { width: number; opacity: number }
  > & { disabledOpacity: number; dimmedOpacity: number };
  glow: {
    spread: number;
    intensity: number;
    innerSpread: number;
    innerIntensity: number;
    maxGlowingRoutes: number;
  };
  airport: Record<
    "base" | "hub" | "selected",
    { radius: number; stroke: number; halo: number }
  >;
  hatch: {
    angleDegrees: number;
    spacing: number;
    width: number;
  };
  line: { coastline: number; border: number; graticule: number };
  type: {
    family: { display: string; data: string; label: string };
    size: {
      mapLabel: number;
      mapLabelHub: number;
      mapLabelSelected: number;
      tooltipTitle: number;
      tooltipBody: number;
      statValue: number;
      statLabel: number;
      posterTitle: number;
    };
    weight: { regular: number; semibold: number; bold: number };
    letterSpacing: { code: string; caps: string };
  };
  state: {
    hoverScale: number;
    focusRingWidth: number;
    focusRingOffset: number;
    transitionMs: number;
  };
}

export interface MapTheme {
  id: string;
  label: string;
  tokens: MapThemeTokens;
}
