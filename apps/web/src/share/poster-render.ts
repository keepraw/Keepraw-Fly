import type { PosterCopy, PosterStat } from "./poster-copy";
import type {
  PosterLayout,
  PosterRect,
  PosterStatBlock,
} from "./poster-layout";
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

export type PosterTone = "dark" | "light";

export interface PosterPalette {
  tone: PosterTone;
  backgroundTop: string;
  backgroundBottom: string;
  guilloche: [string, string];
  frame: string;
  rule: string;
  ink: string;
  muted: string;
  faint: string;
  figure: string;
  accent: string;
  brandMark: string;
  mrzBand: string;
  mrzInk: string;
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
    composite: GlobalCompositeOperation;
  };
}

/** Dark passport (light app): deep navy cover, warm white type, ice routes. */
export const DARK_PASSPORT_PALETTE: PosterPalette = {
  tone: "dark",
  backgroundTop: "#0f1f38",
  backgroundBottom: "#08142a",
  guilloche: ["rgba(160, 196, 240, 0.035)", "rgba(232, 214, 178, 0.03)"],
  frame: "rgba(232, 214, 178, 0.30)",
  rule: "rgba(242, 236, 225, 0.16)",
  ink: "#f3ede2",
  muted: "#a3b1c6",
  faint: "rgba(242, 236, 225, 0.5)",
  figure: "#f3ede2",
  accent: "#e3c48f",
  brandMark: "#e3c48f",
  mrzBand: "rgba(242, 236, 225, 0.035)",
  mrzInk: "rgba(242, 236, 225, 0.42)",
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
    composite: "lighter",
  },
};

/**
 * Light passport (dark app): the same passport on ivory security paper.
 * Navy ink and the cover's gold, re-weighted for paper; routes in deep
 * cobalt so they stay the strongest mark on the map.
 */
export const LIGHT_PASSPORT_PALETTE: PosterPalette = {
  tone: "light",
  backgroundTop: "#f8f4ea",
  backgroundBottom: "#efe8d8",
  guilloche: ["rgba(26, 52, 98, 0.05)", "rgba(150, 112, 52, 0.05)"],
  frame: "rgba(150, 112, 52, 0.38)",
  rule: "rgba(16, 32, 60, 0.16)",
  ink: "#10203c",
  muted: "#4f5d72",
  faint: "rgba(16, 32, 60, 0.58)",
  figure: "#10203c",
  accent: "#94692a",
  brandMark: "#94692a",
  mrzBand: "rgba(16, 32, 60, 0.045)",
  mrzInk: "rgba(16, 32, 60, 0.46)",
  map: {
    sphere: "rgba(26, 52, 98, 0.025)",
    sphereStroke: "rgba(16, 32, 60, 0.12)",
    graticule: "rgba(26, 52, 98, 0.07)",
    land: "#d9e1e8",
    landShade: "rgba(52, 86, 140, 0.16)",
    dots: null,
    borders: "rgba(248, 244, 234, 0.95)",
    route: [24, 62, 168],
    routeGlow: null,
    airport: "#fbf8f0",
    airportStroke: "#183ea8",
    hub: "#b5772a",
    composite: "source-over",
  },
};

export function posterPalette(tone: PosterTone): PosterPalette {
  return tone === "light" ? LIGHT_PASSPORT_PALETTE : DARK_PASSPORT_PALETTE;
}

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
  map: { routes: number; airports: number };
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

/** Tracking for labels, as a share of the font size. */
const LABEL_TRACKING = 0.08;

/** Small-caps style label: tracked, upper case where the script has case. */
function label(
  painter: Painter,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  color: string,
  size: number,
  align: CanvasTextAlign = "left",
) {
  return painter.text(text.toLocaleUpperCase(), x, y, {
    size,
    weight: 500,
    color,
    letterSpacing: size * LABEL_TRACKING,
    maxWidth,
    minSize: Math.round(size * 0.8),
    align,
  });
}

/**
 * A stat label whose LAST line sits on `y`, so the figure below keeps its
 * place. A label too wide at full size wraps onto a line above at a word
 * boundary (keeping one type size across the row); a single word shrinks
 * (to 80%), and only then shortens.
 */
function stackedLabel(
  painter: Painter,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  color: string,
  size: number,
) {
  const upper = text.toLocaleUpperCase();
  const min = Math.round(size * 0.8);
  const style = (s: number) => ({
    size: s,
    weight: 500 as const,
    letterSpacing: s * LABEL_TRACKING,
  });
  const words = upper.split(" ");
  if (words.length < 2 || painter.measure(upper, style(size)) <= maxWidth)
    return label(painter, text, x, y, maxWidth, color, size);
  let best = 1;
  let bestWidth = Infinity;
  for (let cut = 1; cut < words.length; cut += 1) {
    const widest = Math.max(
      painter.measure(words.slice(0, cut).join(" "), style(size)),
      painter.measure(words.slice(cut).join(" "), style(size)),
    );
    if (widest < bestWidth) {
      bestWidth = widest;
      best = cut;
    }
  }
  label(
    painter,
    words.slice(0, best).join(" "),
    x,
    y - Math.round(size * 1.15),
    maxWidth,
    color,
    size,
  );
  return label(
    painter,
    words.slice(best).join(" "),
    x,
    y,
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
  // Units read like labels: never smaller than the small-text scale.
  const unitSize = Math.max(26, Math.round(size * 0.3));
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

/**
 * One statistic on the grid: label on the row's label baseline, figure on
 * the row's figure baseline, both starting at the block's left edge (the
 * serif figure is nudged by its side bearing so the two edges line up).
 */
function statBlock(
  painter: Painter,
  stat: PosterStat,
  block: PosterStatBlock,
  labelColor: string,
  figureColor: string,
  unitColor: string,
) {
  stackedLabel(
    painter,
    stat.label,
    block.x,
    block.label,
    block.width,
    labelColor,
    block.labelSize,
  );
  figure(
    painter,
    stat,
    block.x - Math.round(block.size * 0.03),
    block.baseline,
    block.size,
    block.width,
    figureColor,
    unitColor,
  );
}

// ---------------------------------------------------------------- art ----

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
  size: number,
  color: string,
  markColor: string,
) {
  // The mark is centred on the x-height middle of the wordmark.
  const mark = size * 0.58;
  plane(
    painter.context,
    x + mark,
    y - size * 0.36,
    mark,
    Math.PI / 4,
    markColor,
  );
  const offset = mark * 2 + size * 0.5;
  const drawn = painter.text(text, x + offset, y, {
    size,
    weight: 600,
    color,
    letterSpacing: size * 0.04,
  });
  return { ...drawn, right: offset + drawn.width };
}

function passportBackground(
  context: Context2D,
  layout: PosterLayout,
  p: PosterPalette,
) {
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
    context.strokeStyle = p.guilloche[band]!;
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

  // Unlabelled airport dots; the busiest few get a ring. Never a code.
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

  return { routes: drawnRoutes, airports: placed.length };
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

// ------------------------------------------------------------- passport --

/**
 * Splits a title into words: spaces where the script has them, otherwise
 * dictionary word boundaries (フライト|パスポート, 飞行|护照).
 */
function titleWords(text: string, locale: string): string[] {
  const spaced = text.split(/\s+/).filter(Boolean);
  if (spaced.length > 1 || typeof Intl.Segmenter !== "function") return spaced;
  const words = [
    ...new Intl.Segmenter(locale, { granularity: "word" }).segment(text),
  ]
    .map((part) => part.segment)
    .filter((part) => part.trim());
  return words.length > 1 ? words : spaced;
}

function passportTitle(
  painter: Painter,
  copy: PosterCopy,
  layout: PosterLayout,
  p: PosterPalette,
) {
  const { title } = layout;
  const text = copy.title.toLocaleUpperCase();
  const min = Math.round(title.size * 0.5);
  const style = (size: number) => ({
    size,
    weight: 400 as const,
    font: "serif" as const,
    color: p.ink,
    letterSpacing: size * 0.03,
    maxWidth: title.maxWidth,
    minSize: min,
  });
  // Width at a size, without the trailing letter-spacing canvas adds.
  const width = (line: string, size: number) =>
    painter.measure(line, style(size)) - size * 0.03;
  /** Largest size (down to min) at which every line fits. */
  const fit = (lines: string[]) => {
    let size = title.size;
    while (
      size > min &&
      Math.max(...lines.map((line) => width(line, size))) > title.maxWidth
    )
      size = Math.max(min, Math.floor(size * 0.96));
    return size;
  };
  const spaced = /\s/.test(text);
  const words = titleWords(text, copy.locale);
  const oneLine = width(text, title.size) <= title.maxWidth;
  if (title.lines === 2 && words.length > 1 && !oneLine) {
    // The cut that keeps the wider of the two lines narrowest.
    const join = (part: string[]) => part.join(spaced ? " " : "");
    let best = [join(words.slice(0, 1)), join(words.slice(1))];
    let bestWidth = Infinity;
    for (let cut = 1; cut < words.length; cut += 1) {
      const lines = [join(words.slice(0, cut)), join(words.slice(cut))];
      const widest = Math.max(...lines.map((line) => width(line, title.size)));
      if (widest < bestWidth) {
        bestWidth = widest;
        best = lines;
      }
    }
    const size = fit(best);
    painter.text(best[0]!, title.x, title.baseline, style(size));
    painter.text(
      best[1]!,
      title.x,
      title.baseline + Math.max(size * 1.02, title.size * 0.9),
      style(size),
    );
    return;
  }
  painter.text(
    text,
    title.x,
    title.baseline + (title.lines === 2 ? title.size * 0.5 : 0),
    style(fit([text])),
  );
}

function machineReadableZone(
  painter: Painter,
  copy: PosterCopy,
  layout: PosterLayout,
  p: PosterPalette,
) {
  const { mrz, left, right } = layout;
  const width = right - left;
  painter.context.fillStyle = p.mrzBand;
  painter.context.fillRect(
    48,
    mrz.top,
    layout.width - 96,
    mrz.lines[1] - mrz.top + 18,
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
    const trimmed = source.replace(/<*$/, "");
    const line =
      source.length >= length
        ? source.slice(0, length)
        : trimmed + "<".repeat(length - trimmed.length);
    const natural = painter.measure(line, mono);
    const spacing = Math.max(
      0,
      Math.min(9, (width - natural) / Math.max(1, line.length - 1)),
    );
    painter.text(line, left, mrz.lines[index]!, {
      ...mono,
      color: p.mrzInk,
      letterSpacing: spacing,
      maxWidth: width + spacing,
      minSize: 14,
    });
  });
}

function drawPassport(
  painter: Painter,
  copy: PosterCopy,
  layout: PosterLayout,
  p: PosterPalette,
) {
  const { left, right } = layout;
  const width = right - left;
  // Header row: brand on the left, issuer right-aligned on the same line.
  const mark = brand(
    painter,
    copy.brand,
    left,
    layout.brand.baseline,
    layout.brand.size,
    p.ink,
    p.brandMark,
  );
  const brandRight = left + mark.right;
  painter.text(copy.issuer, right, layout.issuer.baseline, {
    size: layout.issuer.size,
    weight: 500,
    color: p.muted,
    letterSpacing: layout.issuer.size * 0.02,
    align: "right",
    maxWidth: right - brandRight - 48,
    minSize: 18,
  });
  layout.rules.forEach((rule) =>
    painter.rule(rule.x0, rule.x1, rule.y, p.rule),
  );
  passportTitle(painter, copy, layout, p);
  if (copy.span) {
    const span = layout.span;
    const spanLabel = label(
      painter,
      copy.span.label,
      left,
      span.baseline,
      width / 3,
      p.muted,
      span.labelSize,
    );
    painter.text(copy.span.value, left + spanLabel.width + 24, span.baseline, {
      size: span.valueSize,
      weight: 500,
      font: "mono",
      color: p.accent,
      letterSpacing: 2,
      maxWidth: width / 2,
    });
  }
  const map = drawMap(painter, layout.map, copy, p, layout);
  const note = layout.mapNote;
  if (copy.map.note)
    label(
      painter,
      copy.map.note,
      note.x,
      note.baseline,
      note.maxWidth,
      p.muted,
      note.size,
      "right",
    );
  if (copy.notes.length)
    painter.text(
      copy.notes.join(" · "),
      layout.notes.x,
      layout.notes.baseline,
      {
        size: layout.notes.size,
        weight: 400,
        color: p.faint,
        maxWidth: copy.map.note ? layout.notes.maxWidth : width,
        minSize: 18,
      },
    );

  statBlock(
    painter,
    copy.distance,
    layout.distance,
    p.accent,
    p.figure,
    p.muted,
  );
  [copy.flights, copy.duration].forEach((stat, index) =>
    statBlock(painter, stat, layout.primary[index]!, p.muted, p.ink, p.muted),
  );
  copy.secondary.forEach((stat, index) => {
    const block = layout.secondary[index];
    if (block) statBlock(painter, stat, block, p.muted, p.ink, p.muted);
  });
  machineReadableZone(painter, copy, layout, p);
  return map;
}

/**
 * Draws a complete Flight Passport in artboard units. The caller sets the
 * transform (scale = pixel width / artboard width). Returns every text box
 * for the safe-area check and what the map actually drew.
 */
export function drawPoster(
  context: Context2D,
  layout: PosterLayout,
  copy: PosterCopy,
  fonts: Pick<ShareFonts, "family">,
  tone: PosterTone = "dark",
): PosterDrawReport {
  const painter = new Painter(context, fonts);
  const palette = posterPalette(tone);
  context.save();
  passportBackground(context, layout, palette);
  const map = drawPassport(painter, copy, layout, palette);
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
