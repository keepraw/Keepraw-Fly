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

export interface PosterPalette {
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

export const PASSPORT_PALETTE: PosterPalette = {
  backgroundTop: "#f8f4ea",
  backgroundBottom: "#f8f4ea",
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
    land: "#d9dedc",
    landShade: null,
    dots: null,
    borders: "rgba(248, 244, 234, 0.95)",
    route: [25, 48, 74],
    routeGlow: null,
    airport: "#fbf8f0",
    airportStroke: "#94692a",
    hub: "#b5772a",
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

/** Each leaf has its own paper, security pattern, margins and frame. */
function pagePaper(context: Context2D, rect: PosterRect, p: PosterPalette) {
  context.save();
  context.beginPath();
  context.rect(rect.x, rect.y, rect.width, rect.height);
  context.clip();
  context.fillStyle = p.backgroundTop;
  context.fillRect(rect.x, rect.y, rect.width, rect.height);
  // Deterministic fibres rather than a raster texture or noisy filter.
  context.strokeStyle = "rgba(114, 94, 61, 0.035)";
  context.lineWidth = 0.7;
  for (let i = 0; i < 1800; i += 1) {
    const x = rect.x + ((i * 137.508) % rect.width);
    const y = rect.y + ((i * 71.713) % rect.height);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + 1 + (i % 5), y + 0.6);
    context.stroke();
  }
  context.strokeStyle = p.guilloche[0];
  for (let line = 0; line < 18; line += 1) {
    context.beginPath();
    for (let x = 0; x <= rect.width; x += 8) {
      const y =
        rect.y +
        rect.height * 0.72 +
        line * 6 +
        Math.sin(x / 72 + line * 0.18) * 34;
      if (!x) context.moveTo(rect.x + x, y);
      else context.lineTo(rect.x + x, y);
    }
    context.stroke();
  }
  context.strokeStyle = p.frame;
  context.lineWidth = 0.8;
  context.strokeRect(
    rect.x + 24,
    rect.y + 24,
    rect.width - 48,
    rect.height - 48,
  );
  context.restore();
}

function bookBackground(
  context: Context2D,
  layout: PosterLayout,
  p: PosterPalette,
) {
  context.fillStyle = "#14273d";
  context.fillRect(0, 0, layout.width, layout.height);
  // The cover lip and offset fore-edge lines give the leaves physical depth.
  context.strokeStyle = "#967b4f";
  context.lineWidth = 1;
  context.strokeRect(17, 12, layout.width - 34, layout.height - 24);
  context.fillStyle = "#d3cab8";
  context.fillRect(28, 32, layout.width - 56, layout.height - 52);
  for (let edge = 0; edge < 4; edge += 1) {
    context.strokeStyle = edge % 2 ? "#e9e1d1" : "#bcb29f";
    context.strokeRect(
      28 + edge,
      30 + edge * 2,
      layout.width - 56 - edge * 2,
      layout.height - 52 - edge * 2,
    );
  }
  pagePaper(context, layout.recordPage, p);
  pagePaper(context, layout.holderPage, p);
}

/** A curved gutter on both leaves, a recessed hinge and visible sewn thread. */
function drawBinding(context: Context2D, layout: PosterLayout) {
  const { x, y, width, height } = layout.binding;
  context.save();
  const curve = context.createLinearGradient(0, y - 48, 0, y + height + 48);
  curve.addColorStop(0, "rgba(94, 74, 44, 0)");
  curve.addColorStop(0.33, "rgba(94, 74, 44, 0.14)");
  curve.addColorStop(0.49, "rgba(44, 34, 23, 0.42)");
  curve.addColorStop(0.51, "rgba(44, 34, 23, 0.42)");
  curve.addColorStop(0.67, "rgba(94, 74, 44, 0.17)");
  curve.addColorStop(1, "rgba(94, 74, 44, 0)");
  context.fillStyle = "#d4c7af";
  context.fillRect(x, y, width, height);
  context.fillStyle = curve;
  context.fillRect(x, y - 48, width, height + 96);
  const middle = y + height / 2;
  context.strokeStyle = "rgba(55, 43, 29, 0.5)";
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(x, middle);
  context.lineTo(x + width, middle);
  context.stroke();
  context.setLineDash([12, 7]);
  context.strokeStyle = "#e6d9be";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x + 18, middle + 1);
  context.lineTo(x + width - 18, middle + 1);
  context.stroke();
  context.setLineDash([]);
  for (const center of [220, 600, 980]) {
    context.strokeStyle = "#b5a382";
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(center, middle, 30, 5, 0, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
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

// ------------------------------------------------------------- leaves ----

function drawRecordPage(
  painter: Painter,
  copy: PosterCopy,
  layout: PosterLayout,
  p: PosterPalette,
) {
  const { left, right } = layout;
  label(painter, "KEEPRAW FLY / TRAVEL ARCHIVE", left, 94, 780, p.muted, 24);
  label(painter, "01", right, 94, 100, p.accent, 24, "right");
  painter.text("FLIGHT RECORD", left, 160, {
    size: 60,
    font: "serif",
    color: p.ink,
  });
  painter.text(copy.recordTitle, left, 204, {
    size: 28,
    color: p.muted,
    maxWidth: 660,
  });
  painter.text(copy.span?.value ?? "—", right, 172, {
    size: 32,
    font: "mono",
    color: p.accent,
    align: "right",
    maxWidth: 330,
  });
  const map = drawMap(painter, layout.map, copy, p, layout);
  painter.rule(left, right, 656, p.rule);
  if (copy.map.note)
    label(painter, copy.map.note, left, 694, 1020, p.muted, 24);
  // A restrained legend, with no invented airports, dates or flights.
  painter.context.strokeStyle = p.ink;
  painter.context.lineWidth = 2;
  painter.context.beginPath();
  painter.context.moveTo(left, 737);
  painter.context.lineTo(left + 44, 737);
  painter.context.stroke();
  painter.context.beginPath();
  painter.context.arc(left + 22, 737, 4, 0, Math.PI * 2);
  painter.context.fillStyle = p.accent;
  painter.context.fill();
  label(painter, "RECORDED JOURNEYS", left + 60, 744, 600, p.muted, 20);
  label(painter, "KEEP EXPLORING", right, 744, 360, p.accent, 20, "right");
  return map;
}

function profileField(
  painter: Painter,
  labelText: string,
  value: string,
  x: number,
  y: number,
  width: number,
  p: PosterPalette,
) {
  label(painter, labelText, x, y, width, p.muted, 20);
  painter.text(value, x, y + 34, {
    size: 27,
    color: p.ink,
    maxWidth: width,
    minSize: 22,
  });
}

/** Preserve the entire nickname, wrapping at grapheme boundaries if needed. */
function holderName(
  painter: Painter,
  name: string,
  x: number,
  y: number,
  width: number,
  p: PosterPalette,
) {
  const style = {
    size: 58,
    minSize: 34,
    font: "serif" as const,
    color: p.ink,
    maxWidth: width,
  };
  if (painter.measure(name, { ...style, size: 34 }) <= width) {
    painter.text(name, x, y, style);
    return;
  }
  const graphemes = shareGraphemes(name);
  const cut = Math.ceil(graphemes.length / 2);
  painter.text(graphemes.slice(0, cut).join(""), x, y - 10, {
    ...style,
    size: 44,
  });
  painter.text(graphemes.slice(cut).join(""), x, y + 38, {
    ...style,
    size: 44,
  });
}

function drawHolderPage(
  painter: Painter,
  copy: PosterCopy,
  layout: PosterLayout,
  p: PosterPalette,
) {
  const { left, right } = layout;
  brand(painter, "KEEPRAW FLY", left, 878, 28, p.ink, p.accent);
  label(painter, "02 / HOLDER PROFILE", right, 878, 440, p.muted, 22, "right");
  painter.text(copy.title, left, 944, {
    size: 52,
    font: "serif",
    color: p.ink,
    maxWidth: 1020,
    minSize: 36,
  });
  painter.rule(left, right, 968, p.rule);
  profileField(painter, "DOCUMENT TYPE", "FLIGHT PASSPORT", left, 1000, 320, p);
  profileField(painter, "ISSUING STATE", "KEEPRAW FLY", 440, 1000, 260, p);
  profileField(painter, "ISSUING AUTHORITY", "KEEPRAW FLY", 770, 1000, 340, p);
  label(painter, "HOLDER NAME", left, 1080, 650, p.muted, 22);
  holderName(painter, copy.holder.name, left, 1142, 680, p);
  profileField(painter, "PASSPORT NO.", copy.holder.number, 816, 1080, 294, p);
  profileField(painter, "FIRST FLIGHT", copy.firstFlight, left, 1210, 300, p);
  profileField(painter, "RECORD PERIOD", copy.recordPeriod, 440, 1210, 670, p);
  painter.rule(left, right, 1266, p.rule);
  statBlock(painter, copy.distance, layout.distance, p.accent, p.ink, p.muted);
  [copy.flights, copy.duration, ...copy.secondary, copy.routes].forEach(
    (stat, index) => {
      statBlock(
        painter,
        stat,
        layout.achievements[index]!,
        p.muted,
        p.ink,
        p.muted,
      );
    },
  );
  if (copy.notes.length)
    painter.text(copy.notes.join(" · "), left, 1472, {
      size: 20,
      minSize: 16,
      color: p.muted,
      maxWidth: 1020,
    });
  painter.rule(left, right, 1490, p.rule);
  painter.text(copy.mrz[0], left, 1514, {
    size: 18,
    font: "mono",
    color: p.mrzInk,
    maxWidth: 570,
  });
  label(
    painter,
    "DIGITAL TRAVEL JOURNAL",
    right,
    1514,
    430,
    p.accent,
    20,
    "right",
  );
  // Deliberately outside the decorative code: readable, explicit souvenir status.
  painter.text(copy.disclaimer, left, 1540, {
    size: 18,
    color: p.muted,
    maxWidth: 1020,
    minSize: 14,
  });
}

/** Preview/export share the two independent leaf renderers and the sewn hinge.
 * No full-page source image is cropped, sliced or captured from the DOM. */
export function drawPoster(
  context: Context2D,
  layout: PosterLayout,
  copy: PosterCopy,
  fonts: Pick<ShareFonts, "family">,
): PosterDrawReport {
  const painter = new Painter(context, fonts);
  const palette = PASSPORT_PALETTE;
  context.save();
  bookBackground(context, layout, palette);
  const map = drawRecordPage(painter, copy, layout, palette);
  drawHolderPage(painter, copy, layout, palette);
  drawBinding(context, layout);
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
