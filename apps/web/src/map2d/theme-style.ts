import type { MapThemeTokens, Rgba } from "./theme";

export type MapRouteState =
  "normal" | "hover" | "selected" | "dimmed" | "disabled";
export type MapAirportKind = "base" | "hub" | "selected";

export function rgba(color: Rgba, alphaScale = 1): string {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${Number(
    Math.max(0, Math.min(1, color[3] * alphaScale)).toFixed(4),
  )})`;
}

export function deviceSnap(cssPx: number, dpr: number): number {
  const safeDpr = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  return Math.max(1, Math.round(cssPx * safeDpr)) / safeDpr;
}

export function hatchTile(
  hatch: MapThemeTokens["hatch"],
  dpr = 1,
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
  tokens: MapThemeTokens,
  tier: "base" | "frequent",
  state: MapRouteState,
): {
  width: number;
  opacity: number;
  color: Rgba;
  glow: boolean;
  innerGlow: boolean;
} {
  const routeTier = tier === "frequent" ? "frequent" : "base";
  const style = tokens.route[routeTier];
  if (state === "disabled")
    return {
      width: style.width,
      opacity: tokens.route.disabledOpacity,
      color: tokens.color.routeBase,
      glow: false,
      innerGlow: false,
    };
  if (state === "dimmed")
    return {
      width: style.width,
      opacity: tokens.route.dimmedOpacity,
      color: tokens.color.routeBase,
      glow: false,
      innerGlow: false,
    };
  if (state === "hover")
    return {
      width: tokens.route.highlight.width,
      opacity: tokens.route.highlight.opacity,
      color: tokens.color.routeHighlight,
      glow: true,
      innerGlow: false,
    };
  if (state === "selected")
    return {
      width: tokens.route.selected.width,
      opacity: tokens.route.selected.opacity,
      color: tokens.color.routeSelected,
      glow: true,
      innerGlow: true,
    };
  return {
    width: style.width,
    opacity: style.opacity,
    color:
      routeTier === "frequent"
        ? tokens.color.routeFrequent
        : tokens.color.routeBase,
    glow: false,
    innerGlow: false,
  };
}

export function airportStyle(
  tokens: MapThemeTokens,
  kind: MapAirportKind,
  state: MapRouteState,
): {
  radius: number;
  stroke: number;
  halo: number;
  color: Rgba;
  opacity: number;
  focus: boolean;
} {
  const style = tokens.airport[kind];
  const color =
    kind === "selected"
      ? tokens.color.airportSelected
      : kind === "hub"
        ? tokens.color.airportHub
        : tokens.color.airport;
  if (state === "disabled")
    return {
      ...style,
      color,
      opacity: tokens.route.disabledOpacity,
      focus: false,
    };
  if (state === "dimmed")
    return {
      ...style,
      color,
      opacity: tokens.route.dimmedOpacity,
      focus: false,
    };
  return {
    ...style,
    color,
    opacity: 1,
    focus: state === "selected" || state === "hover",
  };
}

export function contrastRatio(a: Rgba, b: Rgba, background: Rgba): number {
  const left = luminance(composite(a, background));
  const right = luminance(composite(b, background));
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
}

function composite(foreground: Rgba, background: Rgba): Rgba {
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

function luminance(color: Rgba): number {
  const channels = color.slice(0, 3).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}
