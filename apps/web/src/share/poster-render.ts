import type { PosterChart, PosterCopy, PosterStat } from "./poster-copy";
import type { PosterLayout, PosterRect } from "./poster-layout";
import {
  applyTextStyle,
  shareGraphemes,
  type ShareFonts,
  type ShareTextStyle,
} from "./share-text";

/**
 * Canvas 2D poster drawing. One function for preview and export: callers
 * pass a context whose transform maps artboard units to pixels. Never
 * touches WebGL, the DOM or the network.
 */
type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface PosterPalette {
  backgroundTop: string;
  backgroundBottom: string;
  grid: string | null;
  rule: string;
  ink: string;
  muted: string;
  figure: string;
  secondaryFigure: string;
  bar: string;
  barEmpty: string;
  accent: string;
}

/** Template A: deep navy, warm white text, ice blue figures. */
export const PASSPORT_PALETTE: PosterPalette = {
  backgroundTop: "#0d1b2f",
  backgroundBottom: "#060e1b",
  grid: "rgba(159, 211, 242, 0.045)",
  rule: "rgba(242, 236, 225, 0.16)",
  ink: "#f2ece1",
  muted: "#8e9cb1",
  figure: "#a3d5f3",
  secondaryFigure: "#f2ece1",
  bar: "#86c3ea",
  barEmpty: "rgba(159, 211, 242, 0.22)",
  accent: "#a3d5f3",
};

/** Template B: paper white, navy text, cobalt charts, restrained coral. */
export const YEAR_PALETTE: PosterPalette = {
  backgroundTop: "#f6f3ec",
  backgroundBottom: "#ece8de",
  grid: null,
  rule: "rgba(19, 33, 59, 0.16)",
  ink: "#13213b",
  muted: "#5f6b7e",
  figure: "#2b53c2",
  secondaryFigure: "#13213b",
  bar: "#2b53c2",
  barEmpty: "rgba(19, 33, 59, 0.14)",
  accent: "#e0644d",
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
}

interface TextOptions extends ShareTextStyle {
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

  measure(text: string, style: ShareTextStyle) {
    applyTextStyle(this.context, this.fonts, style);
    return this.context.measureText(text).width;
  }

  /** Fits by shrinking (to minSize), then by ellipsis; records the box. */
  text(value: string, x: number, y: number, options: TextOptions) {
    const max = options.maxWidth ?? Infinity;
    let size = options.size;
    const min = options.minSize ?? size;
    let style: ShareTextStyle = { ...options, size };
    while (size > min && this.measure(value, style) > max) {
      size = Math.max(min, Math.floor(size * 0.94));
      style = { ...options, size };
    }
    let text = value;
    if (this.measure(text, style) > max) {
      this.truncated.push(value);
      let graphemes = shareGraphemes(value);
      while (graphemes.length > 1 && this.measure(`${text}`, style) > max) {
        graphemes = graphemes.slice(0, -1);
        text = `${graphemes.join("").trimEnd()}…`;
      }
    }
    applyTextStyle(this.context, this.fonts, style);
    this.context.fillText(text, x, y);
    const metrics = this.context.measureText(text);
    const width = metrics.width;
    const align = style.align ?? "left";
    const left =
      align === "right" || align === "end"
        ? x - width
        : align === "center"
          ? x - width / 2
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

  rule(x0: number, x1: number, y: number, color: string) {
    this.context.fillStyle = color;
    this.context.fillRect(x0, Math.round(y), x1 - x0, 1.5);
  }
}

/** A figure with a smaller unit after it, fitted to `maxWidth` together. */
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
  const unitSize = Math.max(20, Math.round(size * 0.3));
  const gap = Math.round(size * 0.12);
  let valueSize = size;
  const unitWidth = stat.unit
    ? painter.measure(stat.unit, { size: unitSize, weight: 500 }) + gap
    : 0;
  const valueStyle = (s: number): ShareTextStyle => ({
    size: s,
    weight: 600,
    letterSpacing: -Math.round(s * 0.02),
  });
  while (
    valueSize > size * 0.45 &&
    painter.measure(stat.value, valueStyle(valueSize)) + unitWidth > maxWidth
  )
    valueSize = Math.floor(valueSize * 0.95);
  const valueWidth = painter.measure(stat.value, valueStyle(valueSize));
  const start = align === "right" ? x - valueWidth - unitWidth : x;
  painter.text(stat.value, start, y, {
    ...valueStyle(valueSize),
    color,
    maxWidth: maxWidth - unitWidth,
  });
  if (stat.unit)
    painter.text(stat.unit, start + valueWidth + gap, y, {
      size: unitSize,
      weight: 500,
      color: unitColor,
      maxWidth: Math.max(40, maxWidth - valueWidth - gap),
      minSize: 16,
    });
}

function label(
  painter: Painter,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  color: string,
  size = 21,
  align: CanvasTextAlign = "left",
) {
  painter.text(text, x, y, {
    size,
    weight: 500,
    color,
    letterSpacing: 1,
    maxWidth,
    minSize: Math.round(size * 0.8),
    align,
  });
}

function drawChart(
  painter: Painter,
  chart: PosterChart,
  area: PosterRect,
  labelsBaseline: number,
  palette: PosterPalette,
  options: { gridLines: boolean; valueLabels: boolean },
) {
  const { context } = painter;
  const count = chart.values.length;
  const max = Math.max(0, ...chart.values);
  context.fillStyle = palette.rule;
  context.fillRect(area.x, area.y + area.height, area.width, 1.5);
  if (options.gridLines && max > 0)
    for (const fraction of [0.5, 1]) {
      context.fillStyle = palette.grid ?? palette.rule;
      context.fillRect(
        area.x,
        Math.round(area.y + area.height * (1 - fraction)),
        area.width,
        1,
      );
    }
  if (!count || max === 0) {
    painter.text(
      chart.emptyText,
      area.x + area.width / 2,
      area.y + area.height / 2,
      {
        size: 24,
        weight: 500,
        color: palette.muted,
        align: "center",
        maxWidth: area.width,
      },
    );
    return;
  }
  const gap = Math.max(4, Math.min(18, (area.width / count) * 0.28));
  const barWidth = (area.width - gap * (count - 1)) / count;
  const valueRoom = options.valueLabels ? 34 : 0;
  const usable = area.height - valueRoom;
  const labelSize = count > 20 ? 17 : 19;
  const widest = Math.max(
    ...chart.labels.map((text) =>
      painter.measure(text, { size: labelSize, weight: 500 }),
    ),
  );
  const step = Math.max(1, Math.ceil((widest + 14) / (barWidth + gap)));
  const showValues =
    options.valueLabels &&
    Math.max(
      ...chart.valueLabels.map((text) =>
        painter.measure(text, { size: 18, weight: 600 }),
      ),
    ) <=
      barWidth + gap - 4;
  chart.values.forEach((value, index) => {
    const x = area.x + index * (barWidth + gap);
    const bottom = area.y + area.height;
    const color =
      index === chart.accentIndex
        ? palette.accent
        : value > 0
          ? palette.bar
          : palette.barEmpty;
    context.fillStyle = color;
    if (value > 0) {
      const barHeight = Math.max(4, (value / max) * usable);
      context.fillRect(x, bottom - barHeight, barWidth, barHeight);
      if (showValues)
        painter.text(
          chart.valueLabels[index] ?? "",
          x + barWidth / 2,
          bottom - barHeight - 10,
          {
            size: 18,
            weight: 600,
            color: index === chart.accentIndex ? palette.accent : palette.ink,
            align: "center",
          },
        );
    } else {
      // Zero months/years stay visible as a quiet tick, never as a bar.
      context.fillRect(x, bottom - 3, barWidth, 3);
    }
    if ((count - 1 - index) % step === 0)
      painter.text(
        chart.labels[index] ?? "",
        x + barWidth / 2,
        labelsBaseline,
        {
          size: labelSize,
          weight: 500,
          color: index === chart.accentIndex ? palette.accent : palette.muted,
          align: "center",
        },
      );
  });
}

function background(
  context: Context2D,
  layout: PosterLayout,
  palette: PosterPalette,
) {
  const gradient = context.createLinearGradient(0, 0, 0, layout.height);
  gradient.addColorStop(0, palette.backgroundTop);
  gradient.addColorStop(1, palette.backgroundBottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, layout.width, layout.height);
  if (palette.grid) {
    // Fine archival grid, aligned to the content column.
    context.fillStyle = palette.grid;
    const step = 56;
    for (
      let x = layout.left;
      x <= layout.right + 0.5;
      x += (layout.right - layout.left) / 16
    )
      context.fillRect(Math.round(x), layout.safe.y, 1, layout.safe.height);
    for (
      let y = layout.safe.y;
      y <= layout.safe.y + layout.safe.height;
      y += step
    )
      context.fillRect(layout.safe.x, y, layout.safe.width, 1);
  }
}

function footer(
  painter: Painter,
  copy: PosterCopy,
  layout: PosterLayout,
  palette: PosterPalette,
) {
  const { left, right } = layout;
  painter.rule(left, right, layout.footer.rule, palette.rule);
  const brand = painter.text(copy.brand, left, layout.footer.baseline, {
    size: 19,
    weight: 600,
    color: palette.ink,
    letterSpacing: 4,
  });
  const note = copy.notes.join(" · ");
  if (note)
    painter.text(note, right, layout.footer.baseline, {
      size: 17,
      weight: 400,
      color: palette.muted,
      align: "right",
      maxWidth: right - left - brand.width - 40,
      minSize: 14,
    });
}

function drawPassport(
  painter: Painter,
  copy: PosterCopy,
  layout: PosterLayout,
) {
  const p = PASSPORT_PALETTE;
  const { left, right } = layout;
  const width = right - left;
  label(painter, copy.brand, left, layout.header, width / 2, p.figure, 20);
  label(
    painter,
    copy.scopeLabel.toLocaleUpperCase(),
    right,
    layout.header,
    width / 2 - 24,
    p.muted,
    20,
    "right",
  );
  painter.text(copy.title.toLocaleUpperCase(), left, layout.title.baseline, {
    size: layout.title.size,
    weight: 600,
    color: p.ink,
    letterSpacing: Math.round(layout.title.size * 0.04),
    maxWidth: width,
    minSize: Math.round(layout.title.size * 0.6),
  });
  layout.rules.forEach((y) => painter.rule(left, right, y, p.rule));
  if (layout.span && copy.span) {
    label(
      painter,
      copy.span.label,
      left,
      layout.span.baseline,
      width / 2,
      p.muted,
    );
    painter.text(copy.span.value, right, layout.span.baseline, {
      size: layout.aspect === "9:16" ? 34 : 30,
      weight: 500,
      color: p.ink,
      align: "right",
      letterSpacing: 2,
      maxWidth: width / 2,
    });
  }
  label(
    painter,
    copy.distance.label,
    left,
    layout.distance.label,
    width,
    p.muted,
  );
  figure(
    painter,
    copy.distance,
    left - 4,
    layout.distance.baseline,
    layout.distance.size,
    width + 4,
    p.figure,
    p.muted,
  );
  const half = width / 2;
  [copy.flights, copy.duration].forEach((stat, index) => {
    const x = left + index * (half + 12);
    label(painter, stat.label, x, layout.primary.label, half - 24, p.muted);
    figure(
      painter,
      stat,
      x - 2,
      layout.primary.baseline,
      layout.primary.size,
      half - 24,
      p.ink,
      p.muted,
    );
  });
  if (layout.secondary) {
    const column = width / copy.secondary.length;
    copy.secondary.forEach((stat, index) => {
      const x = left + index * column;
      figure(
        painter,
        stat,
        x - 2,
        layout.secondary!.baseline,
        layout.secondary!.size,
        column - 24,
        p.figure,
        p.muted,
      );
      label(
        painter,
        stat.label,
        x,
        layout.secondary!.label,
        column - 24,
        p.muted,
        19,
      );
    });
  }
  if (layout.airports && copy.airports) drawAirports(painter, copy, layout, p);
  label(painter, copy.chart.title, left, layout.chart.title, width, p.muted);
  drawChart(painter, copy.chart, layout.chart.bars, layout.chart.labels, p, {
    gridLines: true,
    valueLabels: layout.aspect === "9:16" || copy.chart.values.length <= 12,
  });
  footer(painter, copy, layout, p);
}

function drawAirports(
  painter: Painter,
  copy: PosterCopy,
  layout: PosterLayout,
  palette: PosterPalette,
) {
  const slot = layout.airports!;
  const airports = copy.airports!;
  const { left, right } = layout;
  if (slot.inline) {
    const title = painter.text(airports.title, left, slot.title, {
      size: 21,
      weight: 500,
      color: palette.muted,
      letterSpacing: 1,
      maxWidth: 300,
      minSize: 16,
    });
    const line = airports.rows.map((row) => row.code).join("  ·  ");
    painter.text(line, right, slot.title, {
      size: 26,
      weight: 600,
      color: palette.ink,
      align: "right",
      letterSpacing: 2,
      maxWidth: right - left - title.width - 32,
      minSize: 18,
    });
    return;
  }
  painter.text(airports.title, left, slot.title, {
    size: 21,
    weight: 500,
    color: palette.muted,
    letterSpacing: 1,
    maxWidth: right - left,
  });
  airports.rows.forEach((row, index) => {
    const y = slot.firstRow + index * slot.rowHeight;
    const code = painter.text(row.code, left, y, {
      size: 30,
      weight: 600,
      color: palette.figure,
      letterSpacing: 2,
    });
    const value = painter.text(row.value, right, y, {
      size: 22,
      weight: 500,
      color: palette.muted,
      align: "right",
      maxWidth: 220,
      minSize: 16,
    });
    painter.text(row.name, left + Math.max(code.width, 90) + 24, y, {
      size: 24,
      weight: 400,
      color: palette.ink,
      maxWidth: right - left - Math.max(code.width, 90) - 24 - value.width - 32,
      minSize: 18,
    });
  });
}

function drawYear(painter: Painter, copy: PosterCopy, layout: PosterLayout) {
  const p = YEAR_PALETTE;
  const { left, right } = layout;
  const width = right - left;
  label(painter, copy.brand, left, layout.header, width / 2, p.ink, 20);
  label(
    painter,
    copy.title.toLocaleUpperCase(),
    right,
    layout.header,
    width / 2 - 24,
    p.accent,
    20,
    "right",
  );
  if (layout.year)
    painter.text(
      copy.year ?? copy.scopeLabel,
      left - 10,
      layout.year.baseline,
      {
        size: layout.year.size,
        weight: 600,
        color: p.ink,
        letterSpacing: -Math.round(layout.year.size * 0.035),
        maxWidth: width + 10,
        minSize: 160,
      },
    );
  // Short coral rule: the one decorative accent of the template.
  const accentY = layout.rules[0]!;
  painter.context.fillStyle = p.accent;
  painter.context.fillRect(left, accentY - 2, 88, 5);
  painter.rule(left + 104, right, accentY, p.rule);
  layout.rules.slice(1).forEach((y) => painter.rule(left, right, y, p.rule));
  if (layout.aspect === "4:5") {
    const half = width / 2;
    [
      { stat: copy.distance, color: p.figure },
      { stat: copy.flights, color: p.ink },
    ].forEach(({ stat, color }, index) => {
      const x = left + index * (half + 12);
      label(painter, stat.label, x, layout.distance.label, half - 24, p.muted);
      figure(
        painter,
        stat,
        x - 3,
        layout.distance.baseline,
        layout.distance.size,
        half - 24,
        color,
        p.muted,
      );
    });
    const duration = layout.duration!;
    const durationLabel = painter.text(
      copy.duration.label,
      left,
      duration.baseline,
      {
        size: 21,
        weight: 500,
        color: p.muted,
        letterSpacing: 1,
        maxWidth: width / 2,
        minSize: 16,
      },
    );
    painter.text(
      copy.duration.value,
      left + durationLabel.width + 24,
      duration.baseline,
      {
        size: duration.size,
        weight: 600,
        color: p.ink,
        maxWidth: width - durationLabel.width - 24,
        minSize: 20,
      },
    );
  } else {
    label(
      painter,
      copy.distance.label,
      left,
      layout.distance.label,
      width,
      p.muted,
      23,
    );
    figure(
      painter,
      copy.distance,
      left - 4,
      layout.distance.baseline,
      layout.distance.size,
      width,
      p.figure,
      p.muted,
    );
    label(
      painter,
      copy.flights.label,
      left,
      layout.primary.label,
      width,
      p.muted,
      23,
    );
    figure(
      painter,
      copy.flights,
      left - 4,
      layout.primary.baseline,
      layout.primary.size,
      width,
      p.ink,
      p.muted,
    );
    const duration = layout.duration!;
    label(
      painter,
      copy.duration.label,
      left,
      duration.label,
      width,
      p.muted,
      23,
    );
    figure(
      painter,
      copy.duration,
      left - 2,
      duration.baseline,
      duration.size,
      width,
      p.ink,
      p.muted,
    );
  }
  label(painter, copy.chart.title, left, layout.chart.title, width, p.muted);
  drawChart(painter, copy.chart, layout.chart.bars, layout.chart.labels, p, {
    gridLines: false,
    valueLabels: true,
  });
  if (layout.highlights && copy.highlights.length) {
    const slot = layout.highlights;
    painter.rule(left, right, slot.label - 48, p.rule);
    const column = width / copy.highlights.length;
    copy.highlights.forEach((stat, index) => {
      const x = left + index * column + (index ? 32 : 0);
      if (index) {
        painter.context.fillStyle = p.rule;
        painter.context.fillRect(
          left + index * column,
          slot.label - 26,
          1.5,
          slot.baseline - slot.label + 40,
        );
      }
      label(painter, stat.label, x, slot.label, column - 48, p.muted);
      figure(
        painter,
        stat,
        x - 2,
        slot.baseline,
        slot.size,
        column - 48,
        index === 0 ? p.figure : p.ink,
        p.muted,
      );
    });
  }
  if (layout.airports && copy.airports) drawAirports(painter, copy, layout, p);
  footer(painter, copy, layout, p);
}

/**
 * Draws a complete poster in artboard units. The caller sets the transform
 * (scale = pixel width / 1080). Returns every text box for safe-area checks.
 */
export function drawPoster(
  context: Context2D,
  layout: PosterLayout,
  copy: PosterCopy,
  fonts: Pick<ShareFonts, "family">,
): PosterDrawReport {
  const painter = new Painter(context, fonts);
  const palette = layout.template === "year" ? YEAR_PALETTE : PASSPORT_PALETTE;
  context.save();
  background(context, layout, palette);
  if (layout.template === "year") drawYear(painter, copy, layout);
  else drawPassport(painter, copy, layout);
  context.restore();
  const { safe } = layout;
  const outside = painter.texts.filter(
    (box) =>
      box.x < safe.x - 0.5 ||
      box.y < safe.y - 0.5 ||
      box.x + box.width > safe.x + safe.width + 0.5 ||
      box.y + box.height > safe.y + safe.height + 0.5,
  );
  return { texts: painter.texts, outside, truncated: painter.truncated };
}
