import type { PosterChart, PosterCopy, PosterStat } from "./poster-copy";
import type { PosterLayout, PosterRect, PosterStatRow } from "./poster-layout";
import {
  posterMapFrame,
  posterWorldPaths,
  projectToFrame,
  routePolylines,
  type PosterMapFrame,
} from "./poster-map";
import {
  applyTextStyle,
  shareGraphemes,
  type ShareFonts,
  type ShareTextStyle,
} from "./share-text";

/**
 * Canvas 2D poster drawing. One function for preview and export: callers
 * pass a context whose transform maps artboard units to pixels. Never
 * touches WebGL, the DOM or the network. Every effect is resolution
 * independent (no shadowBlur, no filters), so the preview is the export at a
 * smaller scale.
 */
type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Display serif for figures and titles; system fonts only, no new source. */
export const POSTER_SERIF = [
  '"Iowan Old Style"',
  '"Palatino Linotype"',
  "Palatino",
  '"Book Antiqua"',
  '"P052"',
  '"URW Palladio L"',
  "Georgia",
  '"Noto Serif"',
  '"DejaVu Serif"',
  '"Times New Roman"',
].join(", ");
/** Monospace for the machine-readable zone and codes. */
export const POSTER_MONO = [
  '"SFMono-Regular"',
  '"SF Mono"',
  "Menlo",
  '"Cascadia Mono"',
  "Consolas",
  '"Liberation Mono"',
  '"DejaVu Sans Mono"',
  "monospace",
].join(", ");

export interface PosterPalette {
  backgroundTop: string;
  backgroundBottom: string;
  frame: string;
  rule: string;
  ink: string;
  muted: string;
  faint: string;
  figure: string;
  accent: string;
  map: {
    sphere: string | null;
    sphereStroke: string;
    graticule: string;
    land: string;
    landShade: string | null;
    dots: string | null;
    borders: string;
    route: [number, number, number];
    routeGlow: [number, number, number] | null;
    airport: string;
    airportStroke: string;
    hub: string;
    label: string;
    composite: GlobalCompositeOperation;
  };
}

/** Flight Passport: deep navy cover, warm white type, ice-blue routes. */
export const PASSPORT_PALETTE: PosterPalette = {
  backgroundTop: "#0f1f38",
  backgroundBottom: "#08142a",
  frame: "rgba(232, 214, 178, 0.30)",
  rule: "rgba(242, 236, 225, 0.16)",
  ink: "#f3ede2",
  muted: "#97a6bc",
  faint: "rgba(242, 236, 225, 0.42)",
  figure: "#f3ede2",
  accent: "#e3c48f",
  map: {
    sphere: "rgba(140, 180, 230, 0.035)",
    sphereStroke: "rgba(242, 236, 225, 0.10)",
    graticule: "rgba(163, 200, 240, 0.075)",
    land: "rgba(86, 124, 176, 0.30)",
    landShade: null,
    dots: "rgba(186, 214, 246, 0.32)",
    borders: "rgba(9, 21, 42, 0.55)",
    route: [222, 236, 255],
    routeGlow: [120, 176, 240],
    airport: "#f3ede2",
    airportStroke: "rgba(227, 196, 143, 0.55)",
    hub: "#e9b878",
    label: "#f3ede2",
    composite: "lighter",
  },
};

/** Year in Flight: bright paper, navy type, cobalt routes, coral accent. */
export const YEAR_PALETTE: PosterPalette = {
  backgroundTop: "#f7f4ed",
  backgroundBottom: "#efeadf",
  frame: "rgba(19, 33, 59, 0.10)",
  rule: "rgba(19, 33, 59, 0.15)",
  ink: "#14223d",
  muted: "#66717f",
  faint: "rgba(19, 33, 59, 0.38)",
  figure: "#14223d",
  accent: "#dd6448",
  map: {
    sphere: null,
    sphereStroke: "rgba(19, 33, 59, 0.10)",
    graticule: "rgba(19, 33, 59, 0.055)",
    land: "#cfe0f1",
    landShade: "rgba(64, 120, 196, 0.18)",
    dots: null,
    borders: "rgba(250, 248, 243, 0.95)",
    route: [38, 82, 196],
    routeGlow: null,
    airport: "#fbfaf6",
    airportStroke: "#2652c4",
    hub: "#dd6448",
    label: "#14223d",
    composite: "source-over",
  },
};

export interface PosterTextBox {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PosterDrawReport {
  texts: PosterTextBox[];
  /** Text whose box leaves the safe area. Always empty for valid layouts. */
  outside: PosterTextBox[];
  /** Text that had to be shortened with an ellipsis. */
  truncated: string[];
  /** Routes and airport dots actually drawn on the map. */
  map: { routes: number; airports: number; labels: string[] };
}

type FontRole = "sans" | "serif" | "mono";

interface TextStyle extends ShareTextStyle {
  font?: FontRole;
}

interface TextOptions extends TextStyle {
  maxWidth?: number;
  /** Shrink to fit down to this size before truncating. */
  minSize?: number;
}

class Painter {
  readonly texts: PosterTextBox[] = [];
  readonly truncated: string[] = [];
  constructor(
    readonly context: Context2D,
    readonly fonts: Pick<ShareFonts, "family">,
  ) {}

  family(role: FontRole = "sans") {
    if (role === "serif")
      return { family: `${POSTER_SERIF}, ${this.fonts.family}` };
    if (role === "mono") return { family: `${POSTER_MONO}` };
    return this.fonts;
  }

  apply(style: TextStyle) {
    applyTextStyle(this.context, this.family(style.font), style);
  }

  measure(text: string, style: TextStyle) {
    this.apply(style);
    return this.context.measureText(text).width;
  }

  /** Fits by shrinking (to minSize), then by ellipsis; records the box. */
  text(value: string, x: number, y: number, options: TextOptions) {
    const max = options.maxWidth ?? Infinity;
    let size = options.size;
    const min = options.minSize ?? size;
    const scaled = (s: number): TextStyle => ({
      ...options,
      size: s,
      letterSpacing:
        options.letterSpacing === undefined
          ? undefined
          : (options.letterSpacing * s) / options.size,
    });
    let style = scaled(size);
    while (size > min && this.measure(value, style) > max) {
      size = Math.max(min, Math.floor(size * 0.95));
      style = scaled(size);
    }
    let text = value;
    if (this.measure(text, style) > max) {
      this.truncated.push(value);
      let graphemes = shareGraphemes(value);
      while (graphemes.length > 1 && this.measure(text, style) > max) {
        graphemes = graphemes.slice(0, -1);
        text = `${graphemes.join("").trimEnd()}…`;
      }
    }
    this.apply(style);
    this.context.fillText(text, x, y);
    const metrics = this.context.measureText(text);
    // Canvas letterSpacing adds trailing space after the last glyph.
    const width = Math.max(0, metrics.width - (style.letterSpacing ?? 0));
    const align = style.align ?? "left";
    const left =
      align === "right" || align === "end"
        ? x - metrics.width
        : align === "center"
          ? x - metrics.width / 2
          : x;
    const ascent = metrics.actualBoundingBoxAscent || size * 0.8;
    const descent = metrics.actualBoundingBoxDescent || size * 0.2;
    this.texts.push({
      text,
      x: left,
      y: y - ascent,
      width,
      height: ascent + descent,
    });
    return { width, size };
  }

  rule(x0: number, x1: number, y: number, color: string, weight = 1) {
    this.context.fillStyle = color;
    this.context.fillRect(x0, y, x1 - x0, weight);
  }
}

/** Small-caps style label: tracked, upper case where the script has case. */
function label(
  painter: Painter,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  color: string,
  size = 17,
  align: CanvasTextAlign = "left",
) {
  return painter.text(text.toLocaleUpperCase(), x, y, {
    size,
    weight: 500,
    color,
    letterSpacing: size * 0.16,
    maxWidth,
    minSize: Math.round(size * 0.78),
    align,
  });
}

/** A label that wraps onto a second line (at a space) instead of being
 * truncated when it does not fit at its minimum size. */
function wrappingLabel(
  painter: Painter,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  color: string,
  size: number,
) {
  const upper = text.toLocaleUpperCase();
  const style = { size, weight: 500 as const, letterSpacing: size * 0.16 };
  const min = Math.round(size * 0.78);
  const words = upper.split(" ");
  if (
    words.length < 2 ||
    painter.measure(upper, {
      ...style,
      size: min,
      letterSpacing: min * 0.16,
    }) <= maxWidth
  )
    return label(painter, text, x, y, maxWidth, color, size);
  let best = 1;
  let bestWidth = Infinity;
  for (let cut = 1; cut < words.length; cut += 1) {
    const widest = Math.max(
      painter.measure(words.slice(0, cut).join(" "), style),
      painter.measure(words.slice(cut).join(" "), style),
    );
    if (widest < bestWidth) {
      bestWidth = widest;
      best = cut;
    }
  }
  label(painter, words.slice(0, best).join(" "), x, y, maxWidth, color, size);
  return label(
    painter,
    words.slice(best).join(" "),
    x,
    y + size * 1.2,
    maxWidth,
    color,
    size,
  );
}

/** A serif figure followed by a smaller sans unit, fitted together. */
function figure(
  painter: Painter,
  stat: PosterStat,
  x: number,
  y: number,
  size: number,
  maxWidth: number,
  color: string,
  unitColor: string,
  align: "left" | "right" = "left",
) {
  const unitSize = Math.max(16, Math.round(size * 0.3));
  const gap = Math.round(size * 0.14);
  const valueStyle = (s: number): TextStyle => ({
    size: s,
    weight: 400,
    font: "serif",
    letterSpacing: -s * 0.015,
  });
  const unitWidth = stat.unit
    ? painter.measure(stat.unit, { size: unitSize, weight: 500 }) + gap
    : 0;
  let valueSize = size;
  while (
    valueSize > size * 0.5 &&
    painter.measure(stat.value, valueStyle(valueSize)) + unitWidth > maxWidth
  )
    valueSize = Math.floor(valueSize * 0.96);
  const valueWidth = painter.measure(stat.value, valueStyle(valueSize));
  const start = align === "right" ? x - valueWidth - unitWidth : x;
  const drawn = painter.text(stat.value, start, y, {
    ...valueStyle(valueSize),
    color,
    maxWidth: Math.max(40, maxWidth - unitWidth),
  });
  if (stat.unit)
    painter.text(stat.unit, start + drawn.width + gap, y, {
      size: unitSize,
      weight: 500,
      color: unitColor,
      maxWidth: Math.max(30, maxWidth - drawn.width - gap),
      minSize: 13,
    });
  return valueSize;
}

/** A row of statistics with hairline separators between columns. */
function statRow(
  painter: Painter,
  stats: PosterStat[],
  row: PosterStatRow,
  palette: PosterPalette,
  options: { figureColor: string; labelSize?: number; separators?: boolean },
) {
  const column = row.width / stats.length;
  stats.forEach((stat, index) => {
    const x = row.x + index * column + (index ? 24 : 0);
    const width = column - (index ? 48 : 24);
    if (index && options.separators !== false)
      painter.rule(
        row.x + index * column,
        row.x + index * column + 1,
        row.baseline - row.size * 0.78,
        palette.rule,
        row.label - row.baseline + row.size * 0.78 + 6,
      );
    figure(
      painter,
      stat,
      x,
      row.baseline,
      row.size,
      width,
      options.figureColor,
      palette.muted,
    );
    wrappingLabel(
      painter,
      stat.label,
      x,
      row.label,
      width,
      palette.muted,
      options.labelSize ?? 15,
    );
  });
}

// ---------------------------------------------------------------- art ----

/** Deterministic PRNG so textures are identical in preview and export. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Top-view airliner, nose up, in a unit box (-1…1). */
const PLANE: Array<[number, number]> = [
  [0, -1],
  [0.075, -0.9],
  [0.09, -0.3],
  [0.92, 0.16],
  [0.92, 0.3],
  [0.09, 0.1],
  [0.07, 0.62],
  [0.32, 0.8],
  [0.32, 0.9],
  [0, 0.83],
];

function plane(
  context: Context2D,
  x: number,
  y: number,
  size: number,
  angle: number,
  color: string,
) {
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.scale(size, size);
  context.beginPath();
  PLANE.forEach(([px, py], index) =>
    index ? context.lineTo(px, py) : context.moveTo(px, py),
  );
  for (let index = PLANE.length - 2; index > 0; index -= 1)
    context.lineTo(-PLANE[index]![0], PLANE[index]![1]);
  context.closePath();
  context.fillStyle = color;
  context.fill();
  context.restore();
}

function brand(
  painter: Painter,
  text: string,
  x: number,
  y: number,
  color: string,
  markColor: string,
) {
  plane(painter.context, x + 10, y - 7, 10, Math.PI / 4, markColor);
  return painter.text(text, x + 32, y, {
    size: 17,
    weight: 600,
    color,
    letterSpacing: 4,
  });
}

function passportBackground(context: Context2D, layout: PosterLayout) {
  const p = PASSPORT_PALETTE;
  const { width, height } = layout;
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, p.backgroundTop);
  gradient.addColorStop(1, p.backgroundBottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  // Guilloche: fine interleaved sine bands, barely above the paper.
  context.save();
  context.lineWidth = 0.7;
  for (let band = 0; band < 2; band += 1) {
    context.strokeStyle =
      band === 0 ? "rgba(160, 196, 240, 0.035)" : "rgba(232, 214, 178, 0.03)";
    for (let line = 0; line < 26; line += 1) {
      context.beginPath();
      const base = height * (band === 0 ? 0.08 : 0.62) + line * 9;
      for (let x = 0; x <= width; x += 8) {
        const y =
          base +
          Math.sin(x / 61 + line * 0.32 + band) * 22 +
          Math.sin(x / 23 + line * 0.11) * 4;
        if (x === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
    }
  }
  context.restore();
  // Double frame like a passport cover.
  context.strokeStyle = p.frame;
  context.lineWidth = 1.5;
  context.strokeRect(36, 36, width - 72, height - 72);
  context.lineWidth = 0.75;
  context.strokeRect(44, 44, width - 88, height - 88);
}

function yearBackground(context: Context2D, layout: PosterLayout) {
  const p = YEAR_PALETTE;
  const { width, height } = layout;
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, p.backgroundTop);
  gradient.addColorStop(1, p.backgroundBottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  // Paper grain: a few thousand seeded specks, never noise at random.
  const next = random(20241);
  for (let index = 0; index < 4200; index += 1) {
    const x = next() * width;
    const y = next() * height;
    const dark = next() > 0.5;
    context.fillStyle = dark
      ? "rgba(70, 60, 40, 0.045)"
      : "rgba(255, 255, 255, 0.5)";
    context.fillRect(x, y, 1.2, 1.2);
  }
}

// ---------------------------------------------------------------- map ----

/**
 * A fresh Path2D per draw. Reusing one Path2D object across draws and
 * transforms crashes WebKit's Canvas backend, and parsing the SVG strings
 * (already cached in poster-map.ts) costs only a few milliseconds.
 */
function path2d(svg: string) {
  return new Path2D(svg);
}

const dotCache = new Map<string, Float32Array>();
let probe: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null =
  null;

/** Poster-unit centres of the grid dots that lie on land, cached per frame. */
function landDots(
  frame: PosterMapFrame,
  rect: PosterRect,
  landSvg: string,
  step: number,
): Float32Array {
  const key = [
    frame.centerLongitude,
    rect.x,
    rect.width,
    frame.offsetY,
    frame.scale,
    step,
  ].join("|");
  const cached = dotCache.get(key);
  if (cached) return cached;
  probe ??=
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(1, 1).getContext("2d")
      : document.createElement("canvas").getContext("2d");
  const land = new Path2D(landSvg);
  const points: number[] = [];
  const bottom = frame.offsetY + frame.crop.height * frame.scale;
  for (let y = frame.offsetY + step / 2; y < bottom; y += step)
    for (let x = rect.x + step / 2; x < rect.x + rect.width; x += step) {
      const mx = frame.crop.x + (x - frame.offsetX) / frame.scale;
      const my = frame.crop.y + (y - frame.offsetY) / frame.scale;
      if (probe!.isPointInPath(land, mx, my)) points.push(x, y);
    }
  const value = Float32Array.from(points);
  dotCache.set(key, value);
  return value;
}

function withMapTransform(
  context: Context2D,
  frame: PosterMapFrame,
  draw: () => void,
) {
  context.save();
  context.translate(frame.offsetX, frame.offsetY);
  context.scale(frame.scale, frame.scale);
  context.translate(-frame.crop.x, -frame.crop.y);
  draw();
  context.restore();
}

function drawMap(
  painter: Painter,
  rect: PosterRect,
  copy: PosterCopy,
  palette: PosterPalette,
  layout: PosterLayout,
): PosterDrawReport["map"] {
  const { context } = painter;
  const style = palette.map;
  const frame = posterMapFrame(rect, copy.map.centerLongitude);
  const world = posterWorldPaths(copy.map.centerLongitude);
  const sphere = path2d(world.sphere);
  const land = path2d(world.land);
  const s = frame.scale;
  context.save();
  // Only the inhabited latitudes; the crop edge fades out softly.
  context.beginPath();
  context.rect(rect.x, frame.offsetY, rect.width, frame.crop.height * s);
  context.clip();
  withMapTransform(context, frame, () => {
    if (style.sphere) {
      context.fillStyle = style.sphere;
      context.fill(sphere);
    }
    context.save();
    context.clip(sphere);
    context.strokeStyle = style.graticule;
    context.lineWidth = 0.8 / s;
    context.stroke(path2d(world.graticule));
    context.restore();
    context.strokeStyle = style.sphereStroke;
    context.lineWidth = 1 / s;
    context.stroke(sphere);
    context.fillStyle = style.land;
    context.fill(land);
    if (style.landShade) {
      // Lower-latitude wash for depth on paper (pure gradient, no blur).
      const shade = context.createLinearGradient(
        0,
        frame.crop.y,
        0,
        frame.crop.y + frame.crop.height,
      );
      shade.addColorStop(0, "rgba(64, 120, 196, 0)");
      shade.addColorStop(1, style.landShade);
      context.fillStyle = shade;
      context.fill(land);
    }
  });
  if (style.dots) {
    // Halftone land: a regular dot grid, kept only where it falls on land.
    // Tested once per framing with isPointInPath (no clip: WebKit crashes
    // on a repeated Path2D clip followed by thousands of fills).
    context.fillStyle = style.dots;
    const dot = 1.7;
    const dots = landDots(frame, rect, world.land, 6.5);
    for (let index = 0; index < dots.length; index += 2)
      context.fillRect(
        dots[index]! - dot / 2,
        dots[index + 1]! - dot / 2,
        dot,
        dot,
      );
  }
  withMapTransform(context, frame, () => {
    context.strokeStyle = style.borders;
    context.lineWidth = 0.75 / s;
    context.lineJoin = "round";
    context.stroke(path2d(world.borders));
  });
  // Feather the cropped top and bottom edges into the background.
  for (const [edge, direction] of [
    [frame.offsetY, 1],
    [frame.offsetY + frame.crop.height * s, -1],
  ] as const) {
    const color = backgroundAt(palette, edge / layout.height);
    const fade = context.createLinearGradient(
      0,
      edge,
      0,
      edge + direction * 34,
    );
    fade.addColorStop(0, color);
    fade.addColorStop(1, transparent(color));
    context.fillStyle = fade;
    context.fillRect(
      rect.x,
      Math.min(edge, edge + direction * 34),
      rect.width,
      34,
    );
  }

  // Routes: least-flown first so the busiest sit on top; width and opacity
  // follow frequency so a dense archive reads as structure, not a tangle.
  const routes = [...copy.map.routes].reverse();
  const max = Math.max(1, ...routes.map((route) => route.flights));
  const [r, g, b] = style.route;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.globalCompositeOperation = style.composite;
  // Dense maps get quieter strokes so crossings stay legible; only the
  // busiest few keep a glow.
  const density = Math.min(1, Math.sqrt(16 / Math.max(1, routes.length)));
  const glowFrom = routes.length - 10;
  let drawnRoutes = 0;
  for (const [order, route] of routes.entries()) {
    const weight = Math.sqrt(route.flights / max);
    const lines = routePolylines(frame, route.from, route.to);
    if (!lines.length) continue;
    drawnRoutes += 1;
    const trace = () => {
      context.beginPath();
      for (const line of lines)
        line.forEach((point, index) =>
          index
            ? context.lineTo(point.x, point.y)
            : context.moveTo(point.x, point.y),
        );
    };
    if (style.routeGlow && order >= glowFrom) {
      const [gr, gg, gb] = style.routeGlow;
      context.strokeStyle = `rgba(${gr}, ${gg}, ${gb}, ${0.05 + 0.08 * weight})`;
      context.lineWidth = 4 + 6 * weight;
      trace();
      context.stroke();
    }
    const alpha = (0.2 + 0.7 * weight) * (0.45 + 0.55 * density);
    context.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
    context.lineWidth = 0.8 + (1.2 + 0.8 * density) * weight;
    trace();
    context.stroke();
  }
  context.globalCompositeOperation = "source-over";

  // Airport dots; the busiest few get a ring (and a code when granted).
  const airports = copy.map.airports;
  const maxVisits = Math.max(1, ...airports.map((airport) => airport.flights));
  const placed: Array<{ x: number; y: number; r: number }> = [];
  [...airports].reverse().forEach((airport) => {
    const point = projectToFrame(frame, airport);
    if (!point) return;
    const weight = Math.sqrt(airport.flights / maxVisits);
    const radius = 2.2 + 3.4 * weight;
    const hub = airports.indexOf(airport) < 5;
    if (hub) {
      context.strokeStyle = style.airportStroke;
      context.lineWidth = 1.2;
      context.beginPath();
      context.arc(point.x, point.y, radius + 5, 0, Math.PI * 2);
      context.stroke();
    }
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fillStyle = hub ? style.hub : style.airport;
    context.fill();
    if (!hub) {
      context.strokeStyle = style.airportStroke;
      context.lineWidth = 1;
      context.stroke();
    }
    placed.push({ x: point.x, y: point.y, r: radius + 5 });
  });
  context.restore();

  // Labels only for airports whose code the model carries (explicit grant).
  const labels: string[] = [];
  const boxes: PosterRect[] = [];
  const { safe } = layout;
  for (const airport of airports) {
    if (!airport.code) continue;
    const point = projectToFrame(frame, airport);
    if (!point) continue;
    const size = 17;
    const width = painter.measure(airport.code, {
      size,
      weight: 600,
      font: "mono",
      letterSpacing: 1.5,
    });
    const candidates = [
      { x: point.x + 12, y: point.y - 8 },
      { x: point.x - 12 - width, y: point.y - 8 },
      { x: point.x + 12, y: point.y + 22 },
      { x: point.x - 12 - width, y: point.y + 22 },
    ];
    const fits = (c: { x: number; y: number }) => {
      const box = {
        x: c.x - 4,
        y: c.y - size,
        width: width + 8,
        height: size + 6,
      };
      if (
        box.x < Math.max(safe.x, rect.x) ||
        box.x + box.width >
          Math.min(safe.x + safe.width, rect.x + rect.width) ||
        box.y < Math.max(safe.y, rect.y) ||
        box.y + box.height > rect.y + rect.height
      )
        return null;
      const overlaps = boxes.some(
        (o) =>
          box.x < o.x + o.width &&
          box.x + box.width > o.x &&
          box.y < o.y + o.height &&
          box.y + box.height > o.y,
      );
      return overlaps ? null : box;
    };
    for (const candidate of candidates) {
      const box = fits(candidate);
      if (!box) continue;
      boxes.push(box);
      context.fillStyle =
        layout.template === "year"
          ? "rgba(247, 244, 237, 0.86)"
          : "rgba(8, 20, 42, 0.72)";
      context.fillRect(box.x, box.y, box.width, box.height);
      painter.text(airport.code, candidate.x, candidate.y, {
        size,
        weight: 600,
        font: "mono",
        letterSpacing: 1.5,
        color: style.label,
      });
      labels.push(airport.code);
      break;
    }
  }
  return { routes: drawnRoutes, airports: placed.length, labels };
}

/** The vertical background gradient's colour at `t` (0 top … 1 bottom). */
function backgroundAt(palette: PosterPalette, t: number) {
  const a = Number.parseInt(palette.backgroundTop.slice(1), 16);
  const b = Number.parseInt(palette.backgroundBottom.slice(1), 16);
  const mix = (shift: number) =>
    Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  const value = (mix(16) << 16) | (mix(8) << 8) | mix(0);
  return `#${value.toString(16).padStart(6, "0")}`;
}

/** The same colour fully transparent (hex only), for clean gradients. */
function transparent(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, 0)`;
}

// --------------------------------------------------------------- stamps --

function ringText(
  context: Context2D,
  painter: Painter,
  text: string,
  x: number,
  y: number,
  radius: number,
  center: number,
  size: number,
  color: string,
  inward: boolean,
) {
  const glyphs = shareGraphemes(text);
  const measureAll = (s: number) => {
    painter.apply({ size: s, weight: 600, color, letterSpacing: 0 });
    return glyphs.map((glyph) => context.measureText(glyph).width + s * 0.18);
  };
  // Never wrap past ~150° of the ring, so top and bottom texts never meet.
  let widths = measureAll(size);
  let total = widths.reduce((sum, w) => sum + w, 0);
  const limit = radius * Math.PI * 0.82;
  if (total > limit) {
    size = Math.max(7, (size * limit) / total);
    widths = measureAll(size);
    total = widths.reduce((sum, w) => sum + w, 0);
  }
  let angle = center - ((inward ? -1 : 1) * (total / radius)) / 2;
  context.save();
  context.textAlign = "center";
  glyphs.forEach((glyph, index) => {
    const step = widths[index]! / radius;
    const mid = angle + ((inward ? -1 : 1) * step) / 2;
    context.save();
    context.translate(x + Math.cos(mid) * radius, y + Math.sin(mid) * radius);
    context.rotate(mid + (inward ? -Math.PI / 2 : Math.PI / 2));
    context.fillText(glyph, 0, inward ? size * 0.7 : 0);
    context.restore();
    angle += (inward ? -1 : 1) * step;
  });
  context.restore();
}

function passportStamp(
  painter: Painter,
  copy: PosterCopy,
  layout: PosterLayout,
) {
  const { context } = painter;
  const { x, y, radius } = layout.stamp;
  const color = "rgba(227, 196, 143, 0.62)";
  context.save();
  context.translate(x, y);
  context.rotate(-0.16);
  context.translate(-x, -y);
  context.strokeStyle = color;
  context.lineWidth = 1.6;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.stroke();
  context.lineWidth = 0.8;
  context.beginPath();
  context.arc(x, y, radius - 7, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.arc(x, y, radius - 30, 0, Math.PI * 2);
  context.stroke();
  ringText(
    context,
    painter,
    copy.stamp.top,
    x,
    y,
    radius - 23,
    -Math.PI / 2,
    12,
    color,
    false,
  );
  ringText(
    context,
    painter,
    copy.stamp.bottom,
    x,
    y,
    radius - 15,
    Math.PI / 2,
    12,
    color,
    true,
  );
  plane(context, x, y - 8, 15, 0, color);
  painter.apply({
    size: 15,
    weight: 600,
    font: "mono",
    color,
    letterSpacing: 1,
  });
  context.textAlign = "center";
  context.fillText(copy.stamp.middle, x, y + 22);
  // Two dots separate the ring texts.
  for (const side of [-1, 1]) {
    context.beginPath();
    context.arc(x + side * (radius - 19), y, 1.8, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
  }
  context.restore();
}

function yearStamp(painter: Painter, copy: PosterCopy, layout: PosterLayout) {
  const { context } = painter;
  const { x, y, radius } = layout.stamp;
  const color = "rgba(38, 82, 196, 0.70)";
  const w = radius * 2.3;
  const h = radius * 1.5;
  context.save();
  context.translate(x, y);
  context.rotate(-0.12);
  const roundRect = (inset: number) => {
    const r = 14 - inset / 2;
    const left = -w / 2 + inset;
    const top = -h / 2 + inset;
    const width = w - inset * 2;
    const height = h - inset * 2;
    context.beginPath();
    context.moveTo(left + r, top);
    context.arcTo(left + width, top, left + width, top + height, r);
    context.arcTo(left + width, top + height, left, top + height, r);
    context.arcTo(left, top + height, left, top, r);
    context.arcTo(left, top, left + width, top, r);
    context.closePath();
  };
  context.fillStyle = "rgba(247, 244, 237, 0.55)";
  roundRect(0);
  context.fill();
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.stroke();
  context.setLineDash([3, 4]);
  context.lineWidth = 1;
  roundRect(7);
  context.stroke();
  context.setLineDash([]);
  const small = Math.round(radius * 0.15);
  painter.apply({
    size: small,
    weight: 600,
    color,
    letterSpacing: small * 0.2,
  });
  context.textAlign = "center";
  context.fillText(copy.stamp.top, 0, -h / 2 + 15 + small);
  painter.apply({
    size: Math.round(radius * 0.52),
    weight: 400,
    font: "serif",
    color,
    letterSpacing: 0,
  });
  context.textAlign = "center";
  context.fillText(copy.stamp.middle, -radius * 0.12, radius * 0.17);
  plane(
    context,
    w / 2 - radius * 0.4,
    -radius * 0.02,
    radius * 0.13,
    Math.PI / 2,
    color,
  );
  painter.apply({
    size: small - 1,
    weight: 600,
    color,
    letterSpacing: small * 0.18,
  });
  context.textAlign = "center";
  context.fillText(copy.stamp.bottom, 0, h / 2 - 15);
  context.restore();
}

// ---------------------------------------------------------------- chart --

function monthlyChart(
  painter: Painter,
  chart: PosterChart,
  area: PosterRect,
  labelsBaseline: number,
  palette: PosterPalette,
) {
  const { context } = painter;
  const count = chart.values.length;
  const max = Math.max(0, ...chart.values);
  // Dotted baseline.
  context.fillStyle = palette.faint;
  for (let x = area.x; x <= area.x + area.width; x += 6)
    context.fillRect(x, area.y + area.height + 6, 1.4, 1.4);
  if (!count || max === 0) {
    painter.text(
      chart.emptyText,
      area.x + area.width / 2,
      area.y + area.height / 2,
      {
        size: 20,
        weight: 500,
        color: palette.muted,
        align: "center",
        maxWidth: area.width,
      },
    );
    return;
  }
  const slot = area.width / count;
  const bar = Math.min(26, slot * 0.44);
  const valueRoom = 30;
  const usable = area.height - valueRoom;
  const labelSize = 15;
  const widest = Math.max(
    ...chart.labels.map((text) =>
      painter.measure(text, { size: labelSize, weight: 500 }),
    ),
  );
  const narrow =
    widest + 8 > slot &&
    chart.narrowLabels.length === count &&
    Math.max(
      ...chart.narrowLabels.map((text) =>
        painter.measure(text, { size: labelSize, weight: 500 }),
      ),
    ) +
      6 <=
      slot;
  const labels = narrow ? chart.narrowLabels : chart.labels;
  const step = narrow ? 1 : Math.max(1, Math.ceil((widest + 8) / slot));
  const capsule = (x: number, top: number, bottom: number) => {
    const r = bar / 2;
    context.beginPath();
    context.moveTo(x, bottom - r);
    context.lineTo(x, top + r);
    context.arc(x + r, top + r, r, Math.PI, 0);
    context.lineTo(x + bar, bottom - r);
    context.arc(x + r, bottom - r, r, 0, Math.PI);
    context.closePath();
  };
  chart.values.forEach((value, index) => {
    const x = area.x + index * slot + (slot - bar) / 2;
    const bottom = area.y + area.height;
    const accent = index === chart.accentIndex;
    // Quiet track for every month, so empty months read as zero.
    context.fillStyle = "rgba(38, 82, 196, 0.06)";
    capsule(x, area.y + valueRoom, bottom);
    context.fill();
    if (value > 0) {
      const height = Math.max(bar, (value / max) * usable);
      const gradient = context.createLinearGradient(
        0,
        bottom - height,
        0,
        bottom,
      );
      if (accent) {
        gradient.addColorStop(0, "#e8806a");
        gradient.addColorStop(1, palette.accent);
      } else {
        gradient.addColorStop(0, "#7fa6ea");
        gradient.addColorStop(1, "#2652c4");
      }
      context.fillStyle = gradient;
      capsule(x, bottom - height, bottom);
      context.fill();
      painter.text(
        chart.valueLabels[index] ?? "",
        x + bar / 2,
        bottom - height - 10,
        {
          size: 16,
          weight: 600,
          color: accent ? palette.accent : palette.ink,
          align: "center",
        },
      );
    }
    if ((count - 1 - index) % step === 0)
      painter.text(labels[index] ?? "", x + bar / 2, labelsBaseline, {
        size: labelSize,
        weight: 500,
        color: accent ? palette.accent : palette.muted,
        align: "center",
        maxWidth: slot * step - 4,
        minSize: 12,
      });
  });
}

// ------------------------------------------------------------- templates --

function topAirportsLine(
  painter: Painter,
  copy: PosterCopy,
  layout: PosterLayout,
  palette: PosterPalette,
) {
  if (!copy.airports) return;
  const slot = layout.airports;
  const right = slot.align === "right";
  const title = copy.airports.title.toLocaleUpperCase();
  const titleWidth = painter.measure(title, {
    size: 15,
    weight: 500,
    letterSpacing: 2.4,
  });
  const room = slot.width - titleWidth - 24;
  const full = copy.airports.rows
    .map((row) => `${row.code} ${row.name}`)
    .join("  ·  ");
  const body = { size: 17, weight: 500 as const };
  if (painter.measure(full, body) <= room) {
    const textWidth = painter.measure(full, body);
    const start = right ? slot.x - textWidth - 24 - titleWidth : slot.x;
    label(
      painter,
      copy.airports.title,
      start,
      slot.baseline,
      titleWidth + 1,
      palette.muted,
      15,
    );
    painter.text(full, start + titleWidth + 24, slot.baseline, {
      ...body,
      color: palette.ink,
      maxWidth: room,
    });
    return;
  }
  // Too long for one line: one column per airport, code first, then the
  // name shrunk (and only then shortened) to its column.
  const start = right ? slot.x - slot.width : slot.x;
  label(
    painter,
    copy.airports.title,
    start,
    slot.baseline,
    titleWidth + 1,
    palette.muted,
    15,
  );
  const columns = copy.airports.rows.length;
  const column = room / columns;
  copy.airports.rows.forEach((row, index) => {
    const x = start + titleWidth + 24 + index * column;
    const code = painter.text(row.code, x, slot.baseline, {
      size: 17,
      weight: 600,
      font: "mono",
      color: palette.ink,
      letterSpacing: 1,
    });
    painter.text(row.name, x + code.width + 8, slot.baseline, {
      size: 14,
      weight: 400,
      color: palette.muted,
      maxWidth: column - code.width - 24,
      minSize: 11,
    });
  });
}

function passportTitle(
  painter: Painter,
  copy: PosterCopy,
  layout: PosterLayout,
) {
  const p = PASSPORT_PALETTE;
  const { title } = layout;
  const text = copy.title.toLocaleUpperCase();
  const style = {
    size: title.size,
    weight: 400 as const,
    font: "serif" as const,
    color: p.ink,
    letterSpacing: title.size * 0.03,
    maxWidth: title.maxWidth,
    minSize: Math.round(title.size * 0.6),
  };
  const words = text.split(/\s+/).filter(Boolean);
  if (title.lines === 2 && words.length > 1) {
    const cut = Math.ceil(words.length / 2);
    painter.text(words.slice(0, cut).join(" "), title.x, title.baseline, style);
    painter.text(
      words.slice(cut).join(" "),
      title.x,
      title.baseline + title.size * 1.02,
      style,
    );
  } else
    painter.text(
      text,
      title.x,
      title.baseline + (title.lines === 2 ? title.size * 0.5 : 0),
      style,
    );
}

function drawPassport(
  painter: Painter,
  copy: PosterCopy,
  layout: PosterLayout,
) {
  const p = PASSPORT_PALETTE;
  const { left, right } = layout;
  const width = right - left;
  brand(painter, copy.brand, left, layout.header, p.ink, p.accent);
  label(
    painter,
    `${copy.title} · ${copy.scopeLabel}`,
    right,
    layout.header,
    width / 2,
    p.muted,
    15,
    "right",
  );
  layout.rules.forEach((rule) =>
    painter.rule(rule.x0, rule.x1, rule.y, p.rule),
  );
  passportTitle(painter, copy, layout);
  if (layout.span && copy.span) {
    const spanLabel = label(
      painter,
      copy.span.label,
      left,
      layout.span.baseline,
      width / 3,
      p.muted,
      15,
    );
    painter.text(
      copy.span.value,
      left + spanLabel.width + 20,
      layout.span.baseline,
      {
        size: 20,
        weight: 500,
        font: "mono",
        color: p.accent,
        letterSpacing: 2,
        maxWidth: width / 2,
      },
    );
  }
  passportStamp(painter, copy, layout);
  const map = drawMap(painter, layout.map, copy, p, layout);
  if (copy.map.note)
    label(
      painter,
      copy.map.note,
      layout.mapNote.x,
      layout.mapNote.baseline,
      width * 0.55,
      p.muted,
      13,
      layout.mapNote.align,
    );
  if (copy.notes.length)
    painter.text(copy.notes.join(" · "), left, layout.notes.baseline, {
      size: 14,
      weight: 400,
      color: p.faint,
      maxWidth: copy.map.note ? width * 0.42 : width,
      minSize: 12,
    });

  const d = layout.distance;
  label(painter, copy.distance.label, d.x, d.label, d.maxWidth, p.accent, 16);
  figure(
    painter,
    copy.distance,
    d.x - 4,
    d.baseline,
    d.size,
    d.maxWidth,
    p.figure,
    p.muted,
  );
  statRow(painter, [copy.flights, copy.duration], layout.primary, p, {
    figureColor: p.ink,
    labelSize: 15,
    separators: layout.aspect === "3:4",
  });
  statRow(painter, copy.secondary, layout.secondary, p, {
    figureColor: p.ink,
    labelSize: 14,
  });
  topAirportsLine(painter, copy, layout, p);

  if (layout.mrz) {
    const { mrz } = layout;
    painter.context.fillStyle = "rgba(242, 236, 225, 0.035)";
    painter.context.fillRect(
      48,
      mrz.top,
      layout.width - 96,
      mrz.lines[1] - mrz.top + 22,
    );
    // Spread each line across the full column like a real MRZ.
    const mono = {
      size: mrz.size,
      weight: 500 as const,
      font: "mono" as const,
    };
    const cell = painter.measure("<", mono) + 3;
    const length = Math.max(30, Math.floor((width + 3) / cell));
    copy.mrz.forEach((source, index) => {
      const line =
        source.length >= length
          ? source.slice(0, length)
          : source.replace(/<*$/, "") +
            "<".repeat(length - source.replace(/<*$/, "").length);
      const natural = painter.measure(line, mono);
      const spacing = Math.max(
        0,
        Math.min(9, (width - natural) / Math.max(1, line.length - 1)),
      );
      painter.text(line, left, mrz.lines[index]!, {
        ...mono,
        color: "rgba(242, 236, 225, 0.6)",
        letterSpacing: spacing,
        maxWidth: width + spacing,
        minSize: 14,
      });
    });
  }
  return map;
}

function drawYear(painter: Painter, copy: PosterCopy, layout: PosterLayout) {
  const p = YEAR_PALETTE;
  const { left, right } = layout;
  const width = right - left;
  brand(painter, copy.brand, left, layout.header, p.ink, p.ink);
  label(
    painter,
    copy.title,
    right,
    layout.header,
    width / 2,
    p.accent,
    15,
    "right",
  );
  const t = layout.title;
  painter.text(copy.year ?? copy.scopeLabel, t.x, t.baseline, {
    size: t.size,
    weight: 400,
    font: "serif",
    color: p.ink,
    letterSpacing: -t.size * 0.02,
    maxWidth: t.maxWidth,
    minSize: Math.round(t.size * 0.6),
  });
  if (layout.active && copy.activeMonths) {
    const a = layout.active;
    painter.rule(a.x, a.x + 40, a.label - 34, p.accent, 3);
    label(
      painter,
      copy.activeMonths.label,
      a.x,
      a.label,
      right - a.x,
      p.muted,
      15,
    );
    painter.text(copy.activeMonths.value, a.x - 2, a.baseline, {
      size: a.size,
      weight: 400,
      font: "serif",
      color: p.ink,
      maxWidth: Math.min(
        right - a.x,
        layout.map.x > a.x ? layout.map.x - a.x - 16 : right - a.x,
      ),
      minSize: 28,
    });
  }
  layout.rules.forEach((rule) =>
    painter.rule(rule.x0, rule.x1, rule.y, p.rule),
  );
  const map = drawMap(painter, layout.map, copy, p, layout);
  yearStamp(painter, copy, layout);
  if (copy.map.note)
    label(
      painter,
      copy.map.note,
      layout.mapNote.x,
      layout.mapNote.baseline,
      width * 0.45,
      p.muted,
      13,
      layout.mapNote.align,
    );
  topAirportsLine(painter, copy, layout, p);

  const d = layout.distance;
  label(painter, copy.distance.label, d.x, d.label, d.maxWidth, p.accent, 16);
  figure(
    painter,
    copy.distance,
    d.x - 3,
    d.baseline,
    d.size,
    d.maxWidth,
    "#2652c4",
    p.muted,
  );
  statRow(painter, [copy.flights, copy.duration], layout.primary, p, {
    figureColor: p.ink,
    labelSize: 14,
  });
  statRow(painter, copy.secondary, layout.secondary, p, {
    figureColor: p.ink,
    labelSize: 13,
  });
  if (layout.chart) {
    const c = layout.chart;
    label(
      painter,
      copy.chart.title,
      c.bars.x,
      c.title,
      c.bars.width,
      p.muted,
      15,
    );
    monthlyChart(painter, copy.chart, c.bars, c.labels, p);
  }
  if (layout.highlights && copy.highlights.length) {
    const h = layout.highlights;
    if (h.title !== null) {
      painter.rule(
        h.x - 40,
        h.x - 39,
        layout.chart!.title - 18,
        p.rule,
        layout.footer!.rule - layout.chart!.title - 10,
      );
    }
    copy.highlights.forEach((stat, index) => {
      const row = h.rows[index]!;
      if (index && h.title === null)
        painter.rule(
          row.x - 32,
          row.x - 31,
          row.label - 22,
          p.rule,
          row.baseline - row.label + 34,
        );
      painter.context.fillStyle = index === 0 ? p.accent : "#2652c4";
      painter.context.beginPath();
      painter.context.arc(row.x + 4, row.label - 6, 4, 0, Math.PI * 2);
      painter.context.fill();
      label(
        painter,
        stat.label,
        row.x + 18,
        row.label,
        row.width - 18,
        p.muted,
        15,
      );
      figure(
        painter,
        stat,
        row.x - 2,
        row.baseline,
        h.size,
        row.width,
        p.ink,
        p.muted,
      );
    });
  }
  if (layout.footer) {
    const f = layout.footer;
    painter.rule(left, right, f.rule, p.rule);
    const b = brand(painter, copy.brand, left, f.baseline, p.ink, p.accent);
    if (copy.notes.length)
      painter.text(copy.notes.join(" · "), right, f.baseline, {
        size: 14,
        weight: 400,
        color: p.muted,
        align: "right",
        maxWidth: width - b.width - 80,
        minSize: 12,
      });
  }
  return map;
}

/**
 * Draws a complete poster in artboard units. The caller sets the transform
 * (scale = pixel width / artboard width). Returns every text box for the
 * safe-area check and what the map actually drew.
 */
export function drawPoster(
  context: Context2D,
  layout: PosterLayout,
  copy: PosterCopy,
  fonts: Pick<ShareFonts, "family">,
): PosterDrawReport {
  const painter = new Painter(context, fonts);
  context.save();
  let map: PosterDrawReport["map"];
  if (layout.template === "year") {
    yearBackground(context, layout);
    map = drawYear(painter, copy, layout);
  } else {
    passportBackground(context, layout);
    map = drawPassport(painter, copy, layout);
  }
  context.restore();
  const { safe } = layout;
  const outside = painter.texts.filter(
    (box) =>
      box.x < safe.x - 0.5 ||
      box.y < safe.y - 0.5 ||
      box.x + box.width > safe.x + safe.width + 0.5 ||
      box.y + box.height > safe.y + safe.height + 0.5,
  );
  return { texts: painter.texts, outside, truncated: painter.truncated, map };
}
