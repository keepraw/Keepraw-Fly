import type { PosterFonts, PosterFontRole } from "./poster-fonts";
import type { PosterLayout, PosterRect } from "./poster-layout";
import {
  applyTextStyle,
  shareGraphemes,
  type ShareTextStyle,
} from "./share-text";

/**
 * Template-independent Canvas 2D text and report primitives shared by every
 * Flight Passport layout: measured fitting, the drawn-text report and the
 * small aviation glyph. No template geometry or palette lives here.
 */
export type Context2D =
  CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

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

export interface PosterDrawReport<Layout = PosterLayout> {
  texts: PosterTextBox[];
  /** Text whose box leaves the safe area. Always empty for valid layouts. */
  outside: PosterTextBox[];
  /** Text that had to be shortened with an ellipsis. */
  truncated: string[];
  /** Routes and airport dots drawn with the fixed global projection. */
  map: { routes: number; airports: number };
  /** Effective holder geometry, resolved from actual glyph bounds. */
  layout: Layout;
  /** Includes paper print margins, MRZ area and separator clearance. */
  paperOutside: PosterTextBox[];
}

export interface TextStyle extends ShareTextStyle {
  font?: PosterFontRole;
}

export interface TextOptions extends TextStyle {
  maxWidth?: number;
  /** Shrink to fit down to this size before truncating. */
  minSize?: number;
}

export class Painter {
  readonly texts: PosterTextBox[] = [];
  readonly truncated: string[] = [];
  constructor(
    readonly context: Context2D,
    readonly fonts: PosterFonts,
    readonly paint = true,
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
    if (this.paint) this.context.fillText(text, x, y);
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
export const labelTracking = (text: string) =>
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(
    text,
  )
    ? 0
    : LABEL_TRACKING;

/** Small-caps style label: tracked, upper case where the script has case. */
export function label(
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
export function stackedLabel(
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

export function plane(
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

export interface MrzRowGeometry {
  x: number;
  baseline: number;
  lineHeight: number;
  size: number;
  cellAdvance: number;
  color: string;
}

/** MRZ encoding is untouched: only the advance between equal-width cells
 * changes. Native Canvas tracking is probed rather than assumed; older or
 * partial implementations draw the same glyphs at explicit cell positions. */
export function drawMrzRows(
  painter: Painter,
  lines: readonly string[],
  mrz: MrzRowGeometry,
) {
  const cells = lines[0]?.length ?? 0;
  const style: TextStyle = { size: mrz.size, font: "mono", color: mrz.color };
  const cellWidth = painter.measure("0", style);
  // Fixed print grid: never stretch a row to fill the leaf. Both rows use
  // precisely the same type size and cell advance, including fallback faces.
  const spacing = Math.max(0, mrz.cellAdvance - cellWidth);
  const width = cells * cellWidth + (cells - 1) * spacing;
  const x = mrz.x;
  const probe =
    painter.measure(lines[0] ?? "", { ...style, letterSpacing: 3 }) -
    painter.measure(lines[0] ?? "", style);
  // Native letterSpacing includes a trailing cell of tracking; report/text
  // positioning excludes that last gap from the row advance.
  const nativeTracking = Math.abs(probe - cells * 3) < 0.1;
  for (const [index, line] of lines.entries()) {
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
      color: mrz.color,
      ink: {
        x: inkLeft,
        y: y - ascent,
        width: inkRight - inkLeft,
        height: ascent + descent,
      },
    });
  }
}
