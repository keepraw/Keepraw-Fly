import type { PosterFonts, PosterFontRole } from "./poster-fonts";
import type { PosterCopy, PosterStat } from "./poster-copy";
import type {
  PosterLayout,
  PosterProfileField,
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
  mrzTexture: string;
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
  backgroundTop: "#f5f7f6",
  backgroundBottom: "#f5f7f6",
  guilloche: ["rgba(55, 96, 128, 0.065)", "rgba(125, 161, 181, 0.065)"],
  frame: "rgba(150, 136, 102, 0.48)",
  rule: "rgba(16, 32, 60, 0.16)",
  ink: "#10243a",
  muted: "#475d70",
  faint: "rgba(16, 32, 60, 0.58)",
  figure: "#10243a",
  accent: "#88734c",
  brandMark: "#88734c",
  mrzTexture: "rgba(55, 96, 128, 0.010)",
  mrzInk: "#475d70",
  map: {
    sphere: "rgba(26, 52, 98, 0.025)",
    sphereStroke: "rgba(16, 32, 60, 0.12)",
    graticule: "rgba(55, 96, 128, 0.12)",
    land: "#c4d6df",
    landShade: null,
    dots: null,
    borders: "rgba(245, 247, 246, 0.95)",
    route: [44, 91, 126],
    routeGlow: null,
    airport: "#f5f7f6",
    airportStroke: "#88734c",
    hub: "#a18b60",
    composite: "source-over",
  },
};

export interface PosterTextBox {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  baseline: number;
  color: string;
  /** Actual glyph ink, including bearings; distinct from logical advances. */
  ink: PosterRect;
}

export interface PosterDrawReport {
  texts: PosterTextBox[];
  /** Text whose box leaves the safe area. Always empty for valid layouts. */
  outside: PosterTextBox[];
  /** Text that had to be shortened with an ellipsis. */
  truncated: string[];
  /** Routes and airport dots actually drawn on the map. */
  map: { routes: number; airports: number };
  /** Includes paper print margins, MRZ area and separator clearance. */
  paperOutside: PosterTextBox[];
}

interface TextStyle extends ShareTextStyle {
  font?: PosterFontRole;
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
    readonly fonts: PosterFonts,
  ) {}

  family(role: PosterFontRole = "text") {
    return { family: this.fonts.families[role] };
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
    const ascent = metrics.actualBoundingBoxAscent ?? size * 0.8;
    const descent = metrics.actualBoundingBoxDescent ?? size * 0.2;
    this.texts.push({
      text,
      x: left,
      y: y - ascent,
      width,
      height: ascent + descent,
      baseline: y,
      color: String(this.context.fillStyle),
      ink: {
        x: x - metrics.actualBoundingBoxLeft,
        y: y - ascent,
        width: metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight,
        height: ascent + descent,
      },
    });
    return { width, size };
  }

  rule(x0: number, x1: number, y: number, color: string, weight = 1) {
    this.context.fillStyle = color;
    this.context.fillRect(x0, y, x1 - x0, weight);
  }
}

/** Tracking for labels, as a share of the font size. */
const LABEL_TRACKING = 0.045;
const labelTracking = (text: string) =>
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(
    text,
  )
    ? 0
    : LABEL_TRACKING;

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
    weight: 400,
    color,
    letterSpacing: size * labelTracking(text),
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
    weight: 400 as const,
    letterSpacing: s * labelTracking(text),
  });
  const words = upper.split(" ");
  if (words.length < 2 || painter.measure(upper, style(min)) <= maxWidth)
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
  unitSize: number,
  align: "left" | "right" = "left",
) {
  // Units read like labels: never smaller than the small-text scale.
  const gap = Math.round(size * 0.14);
  const valueStyle = (s: number): TextStyle => ({
    size: s,
    weight: 400,
    font: "figures",
    letterSpacing: -s * 0.015,
  });
  const unitWidth = stat.unit
    ? painter.measure(stat.unit, { size: unitSize, weight: 400 }) + gap
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
      weight: 400,
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
    block.unitSize,
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
    font: "brand",
    color,
    letterSpacing: size * 0.04,
  });
  return { ...drawn, right: offset + drawn.width };
}

/** Each leaf has its own paper, security pattern, margins and frame. */
function pagePaper(
  context: Context2D,
  rect: PosterRect,
  p: PosterPalette,
  frameInset: number,
  mrz?: PosterLayout["mrz"],
) {
  context.save();
  context.beginPath();
  context.rect(rect.x, rect.y, rect.width, rect.height);
  context.clip();
  context.fillStyle = p.backgroundTop;
  context.fillRect(rect.x, rect.y, rect.width, rect.height);
  // Deterministic fibres rather than a raster texture or noisy filter.
  context.strokeStyle = "rgba(61, 92, 114, 0.035)";
  context.lineWidth = 0.7;
  for (let i = 0; i < 1800; i += 1) {
    const x = rect.x + ((i * 137.508) % rect.width);
    const y = rect.y + ((i * 71.713) % rect.height);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + 1 + (i % 5), y + 0.6);
    context.stroke();
  }
  // A continuous paper pattern fades through the nominal MRZ boundary.
  // No rectangle/wash singles out the machine-readable zone.
  const securityInk = mrz
    ? context.createLinearGradient(0, mrz.area.y - 48, 0, mrz.area.y + 48)
    : null;
  if (securityInk) {
    securityInk.addColorStop(0, p.guilloche[0]);
    securityInk.addColorStop(1, p.mrzTexture);
  }
  context.strokeStyle = securityInk ?? p.guilloche[0];
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
    rect.x + frameInset,
    rect.y + frameInset,
    rect.width - frameInset * 2,
    rect.height - frameInset * 2,
  );
  context.restore();
}

function bookBackground(
  context: Context2D,
  layout: PosterLayout,
  p: PosterPalette,
) {
  context.fillStyle = "#10243a";
  context.fillRect(0, 0, layout.width, layout.height);
  // The cover lip and offset fore-edge lines give the leaves physical depth.
  context.strokeStyle = "#968866";
  context.lineWidth = 1;
  context.strokeRect(17, 12, layout.width - 34, layout.height - 24);
  context.fillStyle = "#cbd4d7";
  context.fillRect(28, 32, layout.width - 56, layout.height - 52);
  for (let edge = 0; edge < 4; edge += 1) {
    context.strokeStyle = edge % 2 ? "#e6ecec" : "#a8b8bf";
    context.strokeRect(
      28 + edge,
      30 + edge * 2,
      layout.width - 56 - edge * 2,
      layout.height - 52 - edge * 2,
    );
  }
  pagePaper(context, layout.recordPage, p, layout.frameInset);
  pagePaper(context, layout.holderPage, p, layout.frameInset, layout.mrz);
}

/** A curved gutter on both leaves, a recessed hinge and visible sewn thread. */
function drawBinding(context: Context2D, layout: PosterLayout) {
  const { x, y, width, height } = layout.binding;
  context.save();
  const curve = context.createLinearGradient(0, y - 48, 0, y + height + 48);
  curve.addColorStop(0, "rgba(52, 76, 94, 0)");
  curve.addColorStop(0.33, "rgba(52, 76, 94, 0.14)");
  curve.addColorStop(0.49, "rgba(24, 42, 58, 0.42)");
  curve.addColorStop(0.51, "rgba(24, 42, 58, 0.42)");
  curve.addColorStop(0.67, "rgba(52, 76, 94, 0.17)");
  curve.addColorStop(1, "rgba(52, 76, 94, 0)");
  context.fillStyle = "#c6d0d5";
  context.fillRect(x, y, width, height);
  context.fillStyle = curve;
  context.fillRect(x, y - 48, width, height + 96);
  const middle = y + height / 2;
  context.strokeStyle = "rgba(30, 49, 64, 0.5)";
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(x, middle);
  context.lineTo(x + width, middle);
  context.stroke();
  context.setLineDash([12, 7]);
  context.strokeStyle = "#e1e7e7";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x + 18, middle + 1);
  context.lineTo(x + width - 18, middle + 1);
  context.stroke();
  context.setLineDash([]);
  for (const part of [1 / 6, 1 / 2, 5 / 6]) {
    const center = x + width * part;
    context.strokeStyle = "#98a8b1";
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

/** The two leaves share one wordmark and page-title treatment. */
function pageHeader(
  painter: Painter,
  copy: PosterCopy,
  layout: PosterLayout,
  p: PosterPalette,
  page: "record" | "holder",
) {
  const { header, left, right } = layout;
  const y = header[page];
  brand(painter, "KEEPRAW FLY", left, y, header.brandSize, p.ink, p.accent);
  label(
    painter,
    page === "record"
      ? `01 / ${copy.labels.routeMap}`
      : `02 / ${copy.labels.profile}`,
    right,
    y,
    header.labelWidth,
    p.muted,
    header.labelSize,
    "right",
  );
}

function drawRecordPage(
  painter: Painter,
  copy: PosterCopy,
  layout: PosterLayout,
  p: PosterPalette,
) {
  pageHeader(painter, copy, layout, p, "record");
  return drawMap(painter, layout.map, copy, p, layout);
}

function profileField(
  painter: Painter,
  labelText: string,
  value: string,
  field: PosterProfileField,
  profile: PosterLayout["profile"],
  p: PosterPalette,
) {
  label(
    painter,
    labelText,
    field.x,
    field.label,
    field.width,
    p.muted,
    profile.labelSize,
  );
  painter.text(value, field.x, field.baseline, {
    size: profile.valueSize,
    color: p.ink,
    maxWidth: field.width,
    minSize: 22,
  });
}

/** Keep the saved name intact. Both lines use one fitted size, and the
 * first baseline always aligns with the number in the adjacent column. */
function holderName(
  painter: Painter,
  name: string,
  profile: PosterLayout["profile"],
  p: PosterPalette,
) {
  const { x, baseline, width } = profile.name;
  const style = {
    size: profile.nameSize,
    weight: 500 as const,
    minSize: profile.nameMinSize,
    font: "display" as const,
    color: p.ink,
    maxWidth: width,
  };
  if (painter.measure(name, { ...style, size: profile.nameMinSize }) <= width) {
    painter.text(name, x, baseline, style);
    return;
  }
  const graphemes = shareGraphemes(name);
  let cut = 1;
  let bestWidth = Infinity;
  for (let index = 1; index < graphemes.length; index += 1) {
    const widest = Math.max(
      painter.measure(graphemes.slice(0, index).join(""), {
        ...style,
        size: profile.nameWrappedSize,
      }),
      painter.measure(graphemes.slice(index).join(""), {
        ...style,
        size: profile.nameWrappedSize,
      }),
    );
    if (widest < bestWidth) {
      bestWidth = widest;
      cut = index;
    }
  }
  // Settings names have no nickname length limit. Fit both complete halves
  // rather than sending either through the ellipsis path at a fixed minimum.
  const size = Math.min(
    profile.nameWrappedSize,
    (profile.nameWrappedSize * width) / bestWidth,
  );
  for (const [index, line] of [
    graphemes.slice(0, cut).join(""),
    graphemes.slice(cut).join(""),
  ].entries()) {
    painter.text(line, x, baseline + index * profile.nameLineHeight, {
      size,
      font: style.font,
      weight: 500,
      color: p.ink,
    });
  }
}

/** MRZ encoding is untouched: only the advance between equal-width cells
 * changes. Native Canvas tracking is probed rather than assumed; older or
 * partial implementations draw the same glyphs at explicit cell positions. */
function drawMrz(
  painter: Painter,
  copy: PosterCopy,
  layout: PosterLayout,
  p: PosterPalette,
) {
  const { mrz } = layout;
  const cells = copy.mrz[0].length;
  const style: TextStyle = { size: mrz.size, font: "mono", color: p.mrzInk };
  const cellWidth = painter.measure("0", style);
  // Fixed print grid: never stretch a row to fill the leaf. Both rows use
  // precisely the same type size and cell advance, including fallback faces.
  const spacing = Math.max(0, mrz.cellAdvance - cellWidth);
  const width = cells * cellWidth + (cells - 1) * spacing;
  const x = mrz.x;
  const probe =
    painter.measure(copy.mrz[0], { ...style, letterSpacing: 3 }) -
    painter.measure(copy.mrz[0], style);
  // Native letterSpacing includes a trailing cell of tracking; report/text
  // positioning excludes that last gap from the row advance.
  const nativeTracking = Math.abs(probe - cells * 3) < 0.1;
  for (const [index, line] of copy.mrz.entries()) {
    const y = mrz.baseline + index * mrz.lineHeight;
    if (nativeTracking) {
      painter.text(line, x, y, { ...style, letterSpacing: spacing });
      continue;
    }
    painter.apply(style);
    const metrics = painter.context.measureText(line);
    let inkLeft = Infinity,
      inkRight = -Infinity;
    for (const [cell, character] of [...line].entries()) {
      const px = x + cell * (cellWidth + spacing);
      const glyph = painter.context.measureText(character);
      inkLeft = Math.min(inkLeft, px - glyph.actualBoundingBoxLeft);
      inkRight = Math.max(inkRight, px + glyph.actualBoundingBoxRight);
      painter.context.fillText(character, px, y);
    }
    const ascent = metrics.actualBoundingBoxAscent ?? mrz.size * 0.8;
    const descent = metrics.actualBoundingBoxDescent ?? mrz.size * 0.2;
    painter.texts.push({
      text: line,
      x,
      y: y - ascent,
      width,
      height: ascent + descent,
      baseline: y,
      color: p.mrzInk,
      ink: {
        x: inkLeft,
        y: y - ascent,
        width: inkRight - inkLeft,
        height: ascent + descent,
      },
    });
  }
}

function drawHolderPage(
  painter: Painter,
  copy: PosterCopy,
  layout: PosterLayout,
  p: PosterPalette,
) {
  const { left, right } = layout;
  pageHeader(painter, copy, layout, p, "holder");
  painter.text(copy.title, left, layout.header.title, {
    size: layout.header.titleSize,
    weight: 500,
    font: "display",
    color: p.ink,
    maxWidth: right - left,
    minSize: 36,
  });
  const { profile } = layout;
  label(
    painter,
    copy.labels.name,
    profile.name.x,
    profile.name.label,
    profile.name.width,
    p.muted,
    profile.labelSize,
  );
  holderName(painter, copy.holder.name, profile, p);
  profileField(
    painter,
    copy.labels.number,
    copy.holder.number,
    profile.number,
    profile,
    p,
  );
  profileField(
    painter,
    copy.labels.issuingAuthority,
    "KEEPRAW FLY",
    profile.authority,
    profile,
    p,
  );
  profileField(
    painter,
    copy.labels.firstFlight,
    copy.firstFlight,
    profile.firstFlight,
    profile,
    p,
  );
  profileField(
    painter,
    copy.labels.period,
    copy.recordPeriod,
    profile.period,
    profile,
    p,
  );
  painter.rule(left, right, layout.statsRule, p.rule);
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
    painter.text(copy.notes.join(" · "), left, layout.notesBaseline, {
      size: 20,
      minSize: 16,
      color: p.muted,
      maxWidth: right - left,
    });
  painter.rule(
    layout.mrz.x,
    layout.mrz.x + layout.mrz.print.width,
    layout.mrz.rule,
    "rgba(16, 32, 60, 0.07)",
    0.7,
  );
  drawMrz(painter, copy, layout, p);
}

/** Preview/export share the two independent leaf renderers and the sewn hinge.
 * No full-page source image is cropped, sliced or captured from the DOM. */
export function drawPoster(
  context: Context2D,
  layout: PosterLayout,
  copy: PosterCopy,
  fonts: PosterFonts,
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
  const inside = (box: PosterRect, rect: PosterRect) =>
    box.x >= rect.x - 0.5 &&
    box.y >= rect.y - 0.5 &&
    box.x + box.width <= rect.x + rect.width + 0.5 &&
    box.y + box.height <= rect.y + rect.height + 0.5;
  const outside = painter.texts.filter(
    (box) => !inside(box, safe) || !inside(box.ink, safe),
  );
  const paperOutside = painter.texts.filter((box) => {
    const content =
      box.baseline < layout.holderPage.y
        ? layout.recordContent
        : layout.holderContent;
    if (!inside(box, content) || !inside(box.ink, content)) return true;
    if (box.baseline < layout.holderPage.y) return false;
    if (copy.mrz.includes(box.text)) return !inside(box.ink, layout.mrz.print);
    return box.ink.y + box.ink.height > layout.mrz.rule - 8;
  });
  return {
    texts: painter.texts,
    outside,
    paperOutside,
    truncated: painter.truncated,
    map,
  };
}
