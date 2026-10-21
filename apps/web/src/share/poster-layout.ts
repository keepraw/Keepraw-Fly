import type { PosterAspect } from "./poster-data";

/**
 * Flight Passport compositions in artboard units, built on one grid system.
 *
 * Both formats share the same rules: a 96-unit content margin, a 48-unit
 * gutter, one hairline weight, and stat rows that always read
 * rule → label → figure with the same spacing. Every block in a row starts
 * on a grid column and shares the row's label baseline and figure baseline,
 * and each label's left edge is its figure's left edge.
 *
 * - 3:4 is one vertical column: title, full-bleed map, the distance row,
 *   a two-column row (flights, time) and a three-column row (airports,
 *   airlines, countries) on a shared 6-column grid.
 * - 4:3 has two zones split on the grid: title on the left, map on the
 *   right, and stat columns that start on the same zone boundaries.
 *
 * The two artboards are composed separately: neither is a cropped,
 * stretched or scaled copy of the other.
 */
export interface PosterRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const POSTER_SIZE: Record<
  PosterAspect,
  { width: number; height: number }
> = {
  "3:4": { width: 1200, height: 1600 },
  "4:3": { width: 1600, height: 1200 },
};
/** Nothing but the background, frame and map art may come closer than this
 * to the artboard edge. Every text box is checked against it. */
export const POSTER_SAFE_INSET = 64;
/** Content margin and column gutter shared by both formats. */
export const POSTER_MARGIN = 96;
export const POSTER_GUTTER = 48;
/** The app's existing phone breakpoint (`max-width: 760px`). */
export const POSTER_PORTRAIT_MAX_VIEWPORT = 760;

/** Viewports up to 760 px wide share 3:4 portrait, wider ones 4:3. */
export function posterAspectForViewport(viewportWidth: number): PosterAspect {
  return viewportWidth <= POSTER_PORTRAIT_MAX_VIEWPORT ? "3:4" : "4:3";
}

/** Type scale (artboard units). Small text is sized for a phone screen:
 * a 1200-wide 3:4 poster shown about 360 px wide still reads clearly. */
export const POSTER_TYPE = {
  brand: 36,
  issuer: 26,
  label: 30,
  note: 26,
  spanLabel: 28,
  spanValue: 30,
  mrz: 22,
} as const;

/** One statistic: label above, figure below, both starting at `x`. */
export interface PosterStatBlock {
  x: number;
  width: number;
  /** Baseline of the label (its last line when it wraps). */
  label: number;
  /** Baseline of the figure. */
  baseline: number;
  size: number;
  labelSize: number;
}

export interface PosterLayout {
  aspect: PosterAspect;
  width: number;
  height: number;
  safe: PosterRect;
  left: number;
  right: number;
  /** Brand at the left of the header row; issuer right-aligned on it. */
  brand: { baseline: number; size: number };
  issuer: { baseline: number; size: number };
  title: {
    x: number;
    baseline: number;
    size: number;
    maxWidth: number;
    lines: 1 | 2;
  };
  span: { baseline: number; labelSize: number; valueSize: number };
  map: PosterRect;
  /** Coverage notes, left-aligned under the map. */
  notes: { x: number; baseline: number; size: number; maxWidth: number };
  /** "All 49 routes shown", right-aligned under the map. */
  mapNote: { x: number; baseline: number; size: number; maxWidth: number };
  distance: PosterStatBlock;
  /** Flights, time in the air. */
  primary: [PosterStatBlock, PosterStatBlock];
  /** Airports, airlines, countries and regions. */
  secondary: [PosterStatBlock, PosterStatBlock, PosterStatBlock];
  /** Hairlines on row boundaries, all spanning the content width. */
  rules: Array<{ x0: number; x1: number; y: number }>;
  /** Machine-readable-zone style band. */
  mrz: { top: number; lines: [number, number]; size: number };
}

/** Spacing every stat row uses, so rows read as one system. */
const ROW = {
  /** Hairline to the label baseline: room for a label that wraps onto a
   * second line above, so figures never move. */
  ruleToLabel: 76,
} as const;

function block(
  x: number,
  width: number,
  label: number,
  baseline: number,
  size: number,
): PosterStatBlock {
  return { x, width, label, baseline, size, labelSize: POSTER_TYPE.label };
}

export function createPosterLayout(aspect: PosterAspect): PosterLayout {
  const { width, height } = POSTER_SIZE[aspect];
  const safe = {
    x: POSTER_SAFE_INSET,
    y: POSTER_SAFE_INSET,
    width: width - POSTER_SAFE_INSET * 2,
    height: height - POSTER_SAFE_INSET * 2,
  };
  const left = POSTER_MARGIN;
  const right = width - POSTER_MARGIN;
  const content = right - left;
  const rule = (y: number) => ({ x0: left, x1: right, y });
  const base = { aspect, width, height, safe, left, right };

  if (aspect === "3:4") {
    // 6-column grid: halves start at columns 1 and 4, thirds at 1, 3, 5.
    const column = (content - POSTER_GUTTER * 5) / 6;
    const at = (index: number) => left + index * (column + POSTER_GUTTER);
    const span = (count: number) =>
      count * column + (count - 1) * POSTER_GUTTER;
    const rules = [184, 872, 1100, 1294];
    const row = (index: number) => rules[index]! + ROW.ruleToLabel;
    return {
      ...base,
      brand: { baseline: 142, size: POSTER_TYPE.brand },
      issuer: { baseline: 142, size: POSTER_TYPE.issuer },
      title: { x: left, baseline: 298, size: 84, maxWidth: content, lines: 1 },
      span: {
        baseline: 352,
        labelSize: POSTER_TYPE.spanLabel,
        valueSize: POSTER_TYPE.spanValue,
      },
      map: { x: 52, y: 384, width: 1096, height: 430 },
      notes: {
        x: left,
        baseline: 846,
        size: POSTER_TYPE.note,
        maxWidth: span(3),
      },
      mapNote: {
        x: right,
        baseline: 846,
        size: POSTER_TYPE.note,
        maxWidth: span(3),
      },
      distance: block(left, content, row(1), row(1) + 116, 116),
      primary: [
        block(at(0), span(3), row(2), row(2) + 84, 72),
        block(at(3), span(3), row(2), row(2) + 84, 72),
      ],
      secondary: [
        block(at(0), span(2), row(3), row(3) + 66, 50),
        block(at(2), span(2), row(3), row(3) + 66, 50),
        block(at(4), span(2), row(3), row(3) + 66, 50),
      ],
      rules: rules.map(rule),
      mrz: { top: 1462, lines: [1490, 1516], size: POSTER_TYPE.mrz },
    };
  }

  // 4:3: two zones on a 4-column grid. Title and distance own columns 1–2,
  // the map and the flights/time columns own columns 3–4.
  const column = (content - POSTER_GUTTER * 3) / 4;
  const at = (index: number) => left + index * (column + POSTER_GUTTER);
  const zone = 2 * column + POSTER_GUTTER;
  const rules = [170, 600, 846];
  const row = (index: number) => rules[index]! + ROW.ruleToLabel;
  return {
    ...base,
    brand: { baseline: 128, size: POSTER_TYPE.brand },
    issuer: { baseline: 128, size: POSTER_TYPE.issuer },
    title: { x: left, baseline: 282, size: 80, maxWidth: zone, lines: 2 },
    span: {
      baseline: 446,
      labelSize: POSTER_TYPE.spanLabel,
      valueSize: POSTER_TYPE.spanValue,
    },
    // Map art may bleed past the grid; its drawn land starts on column 3.
    map: { x: at(2) - 48, y: 196, width: 768, height: 318 },
    notes: { x: left, baseline: 560, size: POSTER_TYPE.note, maxWidth: zone },
    mapNote: {
      x: right,
      baseline: 560,
      size: POSTER_TYPE.note,
      maxWidth: zone,
    },
    distance: block(at(0), zone, row(1), row(1) + 124, 112),
    primary: [
      block(at(2), column, row(1), row(1) + 124, 72),
      block(at(3), column, row(1), row(1) + 124, 72),
    ],
    secondary: [
      block(at(0), zone, row(2), row(2) + 68, 50),
      block(at(2), column, row(2), row(2) + 68, 50),
      block(at(3), column, row(2), row(2) + 68, 50),
    ],
    rules: rules.map(rule),
    mrz: { top: 1028, lines: [1058, 1086], size: POSTER_TYPE.mrz },
  };
}
