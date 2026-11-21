import type { CSSProperties } from "react";

/**
 * Neon Aviation design tokens: the single source for every 2D map renderer
 * (SVG/CSS through `neonCssVariables`, Canvas 2D by reading this object).
 * Lengths are CSS px at zoom 1 unless named otherwise; renderers convert to
 * device pixels with `deviceSnap`. Values are page-independent.
 */

export type NeonRgba = readonly [r: number, g: number, b: number, a: number];

export interface NeonAviationTokens {
  color: {
    backgroundTop: NeonRgba;
    backgroundBottom: NeonRgba;
    backgroundBloom: NeonRgba;
    ocean: NeonRgba;
    land: NeonRgba;
    landHatch: NeonRgba;
    coastline: NeonRgba;
    border: NeonRgba;
    graticule: NeonRgba;
    routeBase: NeonRgba;
    routeFrequent: NeonRgba;
    routeHighlight: NeonRgba;
    routeSelected: NeonRgba;
    routeGlow: NeonRgba;
    airport: NeonRgba;
    airportHub: NeonRgba;
    airportSelected: NeonRgba;
    airportHalo: NeonRgba;
    label: NeonRgba;
    labelMuted: NeonRgba;
    labelHalo: NeonRgba;
    tooltip: NeonRgba;
    tooltipLine: NeonRgba;
    focus: NeonRgba;
    dateline: NeonRgba;
  };
  route: Record<
    "base" | "frequent" | "highlight" | "selected",
    { width: number; opacity: number }
  > & { disabledOpacity: number; dimmedOpacity: number };
  glow: {
    /** Extra width on each side of the core stroke. */
    spread: number;
    /** Opacity of the wide underlay stroke (no SVG filter, no shadowBlur). */
    intensity: number;
    /** Second, tighter underlay for selected routes only. */
    innerSpread: number;
    innerIntensity: number;
    /** Only this many highest-ranked routes may glow at once. */
    maxGlowingRoutes: number;
  };
  airport: Record<
    "base" | "hub" | "selected",
    { radius: number; stroke: number; halo: number }
  >;
  hatch: {
    angleDegrees: number;
    /** Perpendicular spacing between hatch lines, screen px. */
    spacing: number;
    /** Line width in screen px; never below one device pixel. */
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

export const NEON_AVIATION = {
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
} as const satisfies NeonAviationTokens;

export type NeonRouteState =
  "normal" | "hover" | "selected" | "dimmed" | "disabled";

export type NeonAirportKind = "base" | "hub" | "selected";

export function rgba(c: NeonRgba, alphaScale = 1): string {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${Number(
    Math.max(0, Math.min(1, c[3] * alphaScale)).toFixed(4),
  )})`;
}

export function neonCssVariables(
  tokens: NeonAviationTokens = NEON_AVIATION,
): CSSProperties {
  return {
    "--neon-background-top": rgba(tokens.color.backgroundTop),
    "--neon-background-bottom": rgba(tokens.color.backgroundBottom),
    "--neon-background-bloom": rgba(tokens.color.backgroundBloom),
    "--neon-ocean": rgba(tokens.color.ocean),
    "--neon-land": rgba(tokens.color.land),
    "--neon-land-hatch": rgba(tokens.color.landHatch),
    "--neon-coastline": rgba(tokens.color.coastline),
    "--neon-border": rgba(tokens.color.border),
    "--neon-graticule": rgba(tokens.color.graticule),
    "--neon-route-base": rgba(tokens.color.routeBase),
    "--neon-route-frequent": rgba(tokens.color.routeFrequent),
    "--neon-route-highlight": rgba(tokens.color.routeHighlight),
    "--neon-route-selected": rgba(tokens.color.routeSelected),
    "--neon-route-glow": rgba(tokens.color.routeGlow),
    "--neon-airport": rgba(tokens.color.airport),
    "--neon-airport-hub": rgba(tokens.color.airportHub),
    "--neon-airport-selected": rgba(tokens.color.airportSelected),
    "--neon-airport-halo": rgba(tokens.color.airportHalo),
    "--neon-label": rgba(tokens.color.label),
    "--neon-label-muted": rgba(tokens.color.labelMuted),
    "--neon-label-halo": rgba(tokens.color.labelHalo),
    "--neon-tooltip": rgba(tokens.color.tooltip),
    "--neon-tooltip-line": rgba(tokens.color.tooltipLine),
    "--neon-focus": rgba(tokens.color.focus),
    "--neon-dateline": rgba(tokens.color.dateline),
    "--neon-route-base-width": `${tokens.route.base.width}px`,
    "--neon-route-base-opacity": `${tokens.route.base.opacity}`,
    "--neon-route-frequent-width": `${tokens.route.frequent.width}px`,
    "--neon-route-frequent-opacity": `${tokens.route.frequent.opacity}`,
    "--neon-route-highlight-width": `${tokens.route.highlight.width}px`,
    "--neon-route-highlight-opacity": `${tokens.route.highlight.opacity}`,
    "--neon-route-selected-width": `${tokens.route.selected.width}px`,
    "--neon-route-selected-opacity": `${tokens.route.selected.opacity}`,
    "--neon-route-disabled-opacity": `${tokens.route.disabledOpacity}`,
    "--neon-route-dimmed-opacity": `${tokens.route.dimmedOpacity}`,
    "--neon-glow-spread": `${tokens.glow.spread}px`,
    "--neon-glow-intensity": `${tokens.glow.intensity}`,
    "--neon-glow-inner-spread": `${tokens.glow.innerSpread}px`,
    "--neon-glow-inner-intensity": `${tokens.glow.innerIntensity}`,
    "--neon-glow-max-routes": `${tokens.glow.maxGlowingRoutes}`,
    "--neon-airport-base-radius": `${tokens.airport.base.radius}px`,
    "--neon-airport-base-stroke": `${tokens.airport.base.stroke}px`,
    "--neon-airport-base-halo": `${tokens.airport.base.halo}px`,
    "--neon-airport-hub-radius": `${tokens.airport.hub.radius}px`,
    "--neon-airport-hub-stroke": `${tokens.airport.hub.stroke}px`,
    "--neon-airport-hub-halo": `${tokens.airport.hub.halo}px`,
    "--neon-airport-selected-radius": `${tokens.airport.selected.radius}px`,
    "--neon-airport-selected-stroke": `${tokens.airport.selected.stroke}px`,
    "--neon-airport-selected-halo": `${tokens.airport.selected.halo}px`,
    "--neon-hatch-angle": `${tokens.hatch.angleDegrees}deg`,
    "--neon-hatch-spacing": `${tokens.hatch.spacing}px`,
    "--neon-hatch-width": `${tokens.hatch.width}px`,
    "--neon-line-coastline": `${tokens.line.coastline}px`,
    "--neon-line-border": `${tokens.line.border}px`,
    "--neon-line-graticule": `${tokens.line.graticule}px`,
    "--neon-type-family-display": tokens.type.family.display,
    "--neon-type-family-data": tokens.type.family.data,
    "--neon-type-family-label": tokens.type.family.label,
    "--neon-type-size-map-label": `${tokens.type.size.mapLabel}px`,
    "--neon-type-size-map-label-hub": `${tokens.type.size.mapLabelHub}px`,
    "--neon-type-size-map-label-selected": `${tokens.type.size.mapLabelSelected}px`,
    "--neon-type-size-tooltip-title": `${tokens.type.size.tooltipTitle}px`,
    "--neon-type-size-tooltip-body": `${tokens.type.size.tooltipBody}px`,
    "--neon-type-size-stat-value": `${tokens.type.size.statValue}px`,
    "--neon-type-size-stat-label": `${tokens.type.size.statLabel}px`,
    "--neon-type-size-poster-title": `${tokens.type.size.posterTitle}px`,
    "--neon-type-weight-regular": `${tokens.type.weight.regular}`,
    "--neon-type-weight-semibold": `${tokens.type.weight.semibold}`,
    "--neon-type-weight-bold": `${tokens.type.weight.bold}`,
    "--neon-type-letter-spacing-code": tokens.type.letterSpacing.code,
    "--neon-type-letter-spacing-caps": tokens.type.letterSpacing.caps,
    "--neon-state-hover-scale": `${tokens.state.hoverScale}`,
    "--neon-state-focus-ring-width": `${tokens.state.focusRingWidth}px`,
    "--neon-state-focus-ring-offset": `${tokens.state.focusRingOffset}px`,
    "--neon-state-transition": `${tokens.state.transitionMs}ms`,
  } as CSSProperties;
}

export function deviceSnap(cssPx: number, dpr: number): number {
  const safeDpr = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  return Math.max(1, Math.round(cssPx * safeDpr)) / safeDpr;
}

export function hatchTile(
  hatch: NeonAviationTokens["hatch"] = NEON_AVIATION.hatch,
  dpr: number = 1,
  zoom = 1,
): { size: number; lineWidth: number; angle: number } {
  const scale = Number.isFinite(zoom) && zoom >= 1 ? zoom : 1;
  const safeDpr = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const sizeAtZoom = deviceSnap(hatch.spacing * scale, safeDpr * scale) / scale;
  const lineWidthAtZoom =
    deviceSnap(hatch.width * scale, safeDpr * scale) / scale;
  return {
    size: deviceSnap(sizeAtZoom, safeDpr),
    lineWidth: deviceSnap(lineWidthAtZoom, safeDpr),
    angle: hatch.angleDegrees,
  };
}

export function routeTier(
  flightCount: number,
  maxCount: number,
): "base" | "frequent" {
  return flightCount >= 3 || (maxCount > 0 && flightCount >= maxCount * 0.75)
    ? "frequent"
    : "base";
}

export function routeStroke(
  tier: "base" | "frequent",
  state: NeonRouteState,
): {
  width: number;
  opacity: number;
  color: NeonRgba;
  glow: boolean;
  innerGlow: boolean;
} {
  const routeTier = tier === "frequent" ? "frequent" : "base";
  const style = NEON_AVIATION.route[routeTier];
  if (state === "disabled")
    return {
      width: style.width,
      opacity: NEON_AVIATION.route.disabledOpacity,
      color: NEON_AVIATION.color.routeBase,
      glow: false,
      innerGlow: false,
    };
  if (state === "dimmed")
    return {
      width: style.width,
      opacity: NEON_AVIATION.route.dimmedOpacity,
      color: NEON_AVIATION.color.routeBase,
      glow: false,
      innerGlow: false,
    };
  if (state === "hover")
    return {
      width: NEON_AVIATION.route.highlight.width,
      opacity: NEON_AVIATION.route.highlight.opacity,
      color: NEON_AVIATION.color.routeHighlight,
      glow: true,
      innerGlow: false,
    };
  if (state === "selected")
    return {
      width: NEON_AVIATION.route.selected.width,
      opacity: NEON_AVIATION.route.selected.opacity,
      color: NEON_AVIATION.color.routeSelected,
      glow: true,
      innerGlow: true,
    };
  return {
    width: style.width,
    opacity: style.opacity,
    color:
      routeTier === "frequent"
        ? NEON_AVIATION.color.routeFrequent
        : NEON_AVIATION.color.routeBase,
    glow: false,
    innerGlow: false,
  };
}

export function airportStyle(
  kind: NeonAirportKind,
  state: NeonRouteState,
): {
  radius: number;
  stroke: number;
  halo: number;
  color: NeonRgba;
  opacity: number;
  focus: boolean;
} {
  const style = NEON_AVIATION.airport[kind];
  const color =
    kind === "selected"
      ? NEON_AVIATION.color.airportSelected
      : kind === "hub"
        ? NEON_AVIATION.color.airportHub
        : NEON_AVIATION.color.airport;
  if (state === "disabled")
    return {
      ...style,
      color,
      opacity: NEON_AVIATION.route.disabledOpacity,
      focus: false,
    };
  if (state === "dimmed")
    return {
      ...style,
      color,
      opacity: NEON_AVIATION.route.dimmedOpacity,
      focus: false,
    };
  return {
    ...style,
    color,
    opacity: 1,
    focus: state === "selected" || state === "hover",
  };
}

export function contrastRatio(a: NeonRgba, b: NeonRgba): number {
  const background = NEON_AVIATION.color.backgroundBottom;
  const left = luminance(composite(a, background));
  const right = luminance(composite(b, background));
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
}

function composite(foreground: NeonRgba, background: NeonRgba): NeonRgba {
  const alpha = foreground[3] + background[3] * (1 - foreground[3]);
  if (alpha === 0) return [0, 0, 0, 0];
  return [
    (foreground[0] * foreground[3] +
      background[0] * background[3] * (1 - foreground[3])) /
      alpha,
    (foreground[1] * foreground[3] +
      background[1] * background[3] * (1 - foreground[3])) /
      alpha,
    (foreground[2] * foreground[3] +
      background[2] * background[3] * (1 - foreground[3])) /
      alpha,
    alpha,
  ];
}

function luminance(color: NeonRgba): number {
  const channels = color.slice(0, 3).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}
