import type { PosterAspect, PosterTemplate } from "./poster-data";

/**
 * Poster compositions in artboard units. Preview and export draw from the
 * same description; only the pixel scale differs. Each of the four
 * template × aspect pairs is composed on its own: the 3:4 and 4:3 artboards
 * are never cropped, stretched or scaled copies of one another.
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

/** Default format per device class: phones 3:4, desktops 4:3. */
export function defaultPosterAspect(narrowViewport: boolean): PosterAspect {
  return narrowViewport ? "3:4" : "4:3";
}

export interface PosterStatRow {
  /** Left edge of the row and its width. */
  x: number;
  width: number;
  baseline: number;
  label: number;
  size: number;
}

export interface PosterLayout {
  template: PosterTemplate;
  aspect: PosterAspect;
  width: number;
  height: number;
  safe: PosterRect;
  left: number;
  right: number;
  header: number;
  /** Passport: title block. Year: the large year. */
  title: {
    x: number;
    baseline: number;
    size: number;
    maxWidth: number;
    lines: 1 | 2;
  };
  span: { baseline: number } | null;
  /** Circular passport stamp or the rectangular Year in Flight stamp. */
  stamp: { x: number; y: number; radius: number };
  map: PosterRect;
  mapNote: { x: number; baseline: number; align: "left" | "right" };
  distance: {
    x: number;
    label: number;
    baseline: number;
    size: number;
    maxWidth: number;
  };
  primary: PosterStatRow;
  secondary: PosterStatRow;
  rules: Array<{ x0: number; x1: number; y: number }>;
  airports: {
    x: number;
    baseline: number;
    width: number;
    align: "left" | "right";
  };
  /** Year in Flight only: active months, monthly chart and highlights. */
  active: { x: number; label: number; baseline: number; size: number } | null;
  chart: { title: number; bars: PosterRect; labels: number } | null;
  highlights: {
    x: number;
    width: number;
    title: number | null;
    rows: Array<{ x: number; label: number; baseline: number; width: number }>;
    size: number;
  } | null;
  /** Flight Passport only: machine-readable-zone style band. */
  mrz: { top: number; lines: [number, number]; size: number } | null;
  notes: { baseline: number };
  footer: { rule: number; baseline: number } | null;
}

export function createPosterLayout(
  template: PosterTemplate,
  aspect: PosterAspect,
): PosterLayout {
  const { width, height } = POSTER_SIZE[aspect];
  const safe = {
    x: POSTER_SAFE_INSET,
    y: POSTER_SAFE_INSET,
    width: width - POSTER_SAFE_INSET * 2,
    height: height - POSTER_SAFE_INSET * 2,
  };
  const left = 96;
  const right = width - 96;
  const base = { template, aspect, width, height, safe, left, right };

  if (template === "passport" && aspect === "3:4")
    return {
      ...base,
      header: 132,
      title: { x: left, baseline: 268, size: 84, maxWidth: 780, lines: 1 },
      span: { baseline: 324 },
      stamp: { x: 1010, y: 262, radius: 76 },
      map: { x: 52, y: 372, width: 1096, height: 466 },
      mapNote: { x: right, baseline: 872, align: "right" },
      distance: {
        x: left,
        label: 948,
        baseline: 1100,
        size: 156,
        maxWidth: 1008,
      },
      primary: { x: left, width: 1008, baseline: 1236, label: 1276, size: 68 },
      secondary: {
        x: left,
        width: 1008,
        baseline: 1366,
        label: 1400,
        size: 44,
      },
      rules: [
        { x0: left, x1: right, y: 166 },
        { x0: left, x1: right, y: 1150 },
        { x0: left, x1: right, y: 1312 },
      ],
      airports: { x: left, baseline: 1448, width: 1008, align: "left" },
      active: null,
      chart: null,
      highlights: null,
      mrz: { top: 1460, lines: [1494, 1528], size: 24 },
      notes: { baseline: 872 },
      footer: null,
    };
  if (template === "passport")
    return {
      ...base,
      header: 124,
      title: { x: left, baseline: 290, size: 84, maxWidth: 440, lines: 2 },
      span: { baseline: 470 },
      stamp: { x: 436, y: 548, radius: 58 },
      map: { x: 556, y: 166, width: 968, height: 412 },
      mapNote: { x: right, baseline: 624, align: "right" },
      distance: {
        x: left,
        label: 712,
        baseline: 862,
        size: 150,
        maxWidth: 760,
      },
      primary: { x: 920, width: 584, baseline: 862, label: 782, size: 72 },
      secondary: { x: left, width: 780, baseline: 990, label: 1024, size: 44 },
      rules: [
        { x0: left, x1: right, y: 158 },
        { x0: left, x1: right, y: 660 },
        { x0: left, x1: right, y: 924 },
      ],
      airports: { x: 920, baseline: 990, width: 584, align: "left" },
      active: null,
      chart: null,
      highlights: null,
      mrz: { top: 1060, lines: [1094, 1128], size: 26 },
      notes: { baseline: 624 },
      footer: null,
    };
  if (aspect === "3:4")
    return {
      ...base,
      header: 124,
      title: { x: left - 8, baseline: 368, size: 248, maxWidth: 680, lines: 1 },
      span: null,
      stamp: { x: 994, y: 772, radius: 74 },
      map: { x: 76, y: 412, width: 1048, height: 446 },
      mapNote: { x: left, baseline: 890, align: "left" },
      distance: {
        x: left,
        label: 958,
        baseline: 1048,
        size: 96,
        maxWidth: 520,
      },
      primary: { x: left, width: 520, baseline: 1144, label: 1176, size: 54 },
      secondary: { x: left, width: 520, baseline: 1250, label: 1280, size: 40 },
      rules: [
        { x0: left, x1: right, y: 920 },
        { x0: left, x1: right, y: 1332 },
      ],
      airports: { x: right, baseline: 890, width: 560, align: "right" },
      active: { x: 812, label: 262, baseline: 344, size: 64 },
      chart: {
        title: 958,
        bars: { x: 668, y: 986, width: 436, height: 244 },
        labels: 1272,
      },
      highlights: {
        x: left,
        width: 1008,
        title: null,
        rows: [
          { x: left, label: 1384, baseline: 1446, width: 480 },
          { x: 624, label: 1384, baseline: 1446, width: 480 },
        ],
        size: 48,
      },
      mrz: null,
      notes: { baseline: 890 },
      footer: { rule: 1484, baseline: 1524 },
    };
  return {
    ...base,
    header: 116,
    title: { x: left - 8, baseline: 300, size: 196, maxWidth: 480, lines: 1 },
    span: null,
    stamp: { x: 1428, y: 610, radius: 62 },
    map: { x: 772, y: 150, width: 792, height: 336 },
    mapNote: { x: 780, baseline: 530, align: "left" },
    distance: { x: left, label: 394, baseline: 484, size: 84, maxWidth: 620 },
    primary: { x: left, width: 620, baseline: 572, label: 604, size: 52 },
    secondary: { x: left, width: 620, baseline: 670, label: 700, size: 38 },
    rules: [
      { x0: left, x1: 716, y: 342 },
      { x0: left, x1: right, y: 736 },
    ],
    airports: { x: 780, baseline: 568, width: 520, align: "left" },
    active: { x: 596, label: 216, baseline: 296, size: 52 },
    chart: {
      title: 786,
      bars: { x: left, y: 812, width: 860, height: 196 },
      labels: 1044,
    },
    highlights: {
      x: 1060,
      width: 444,
      title: 786,
      rows: [
        { x: 1060, label: 852, baseline: 914, width: 444 },
        { x: 1060, label: 970, baseline: 1032, width: 444 },
      ],
      size: 50,
    },
    mrz: null,
    notes: { baseline: 524 },
    footer: { rule: 1080, baseline: 1124 },
  };
}
