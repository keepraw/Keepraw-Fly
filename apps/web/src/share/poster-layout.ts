import type { PosterAspect } from "./poster-data";

/**
 * Flight Passport compositions in artboard units. The 3:4 and 4:3 artboards
 * are composed separately: neither is a cropped, stretched or scaled copy of
 * the other.
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
/** The app's existing phone breakpoint (`max-width: 760px`). */
export const POSTER_PORTRAIT_MAX_VIEWPORT = 760;

/** Viewports up to 760 px wide share 3:4 portrait, wider ones 4:3. */
export function posterAspectForViewport(viewportWidth: number): PosterAspect {
  return viewportWidth <= POSTER_PORTRAIT_MAX_VIEWPORT ? "3:4" : "4:3";
}

export interface PosterStatRow {
  /** Left edge of the row and its width. */
  x: number;
  width: number;
  baseline: number;
  label: number;
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
  brand: { baseline: number; size: number };
  title: {
    x: number;
    baseline: number;
    size: number;
    maxWidth: number;
    lines: 1 | 2;
  };
  span: { baseline: number; labelSize: number; valueSize: number } | null;
  map: PosterRect;
  mapNote: {
    x: number;
    baseline: number;
    align: "left" | "right";
    size: number;
  };
  notes: { baseline: number; size: number };
  distance: {
    x: number;
    label: number;
    labelSize: number;
    baseline: number;
    size: number;
    maxWidth: number;
  };
  primary: PosterStatRow;
  secondary: PosterStatRow;
  rules: Array<{ x0: number; x1: number; y: number }>;
  /** Machine-readable-zone style band. */
  mrz: { top: number; lines: [number, number]; size: number };
  /** "Issued by Keepraw Fly". */
  issuer: { baseline: number; size: number };
}

export function createPosterLayout(aspect: PosterAspect): PosterLayout {
  const { width, height } = POSTER_SIZE[aspect];
  const safe = {
    x: POSTER_SAFE_INSET,
    y: POSTER_SAFE_INSET,
    width: width - POSTER_SAFE_INSET * 2,
    height: height - POSTER_SAFE_INSET * 2,
  };
  const left = 96;
  const right = width - 96;
  const base = { aspect, width, height, safe, left, right };

  if (aspect === "3:4")
    return {
      ...base,
      brand: { baseline: 142, size: 28 },
      title: { x: left, baseline: 286, size: 84, maxWidth: 1008, lines: 1 },
      span: { baseline: 342, labelSize: 18, valueSize: 23 },
      map: { x: 52, y: 380, width: 1096, height: 452 },
      mapNote: { x: right, baseline: 870, align: "right", size: 16 },
      notes: { baseline: 870, size: 16 },
      distance: {
        x: left,
        label: 940,
        labelSize: 19,
        baseline: 1066,
        size: 124,
        maxWidth: 1008,
      },
      primary: {
        x: left,
        width: 1008,
        baseline: 1190,
        label: 1230,
        size: 54,
        labelSize: 18,
      },
      secondary: {
        x: left,
        width: 1008,
        baseline: 1334,
        label: 1370,
        size: 38,
        labelSize: 17,
      },
      rules: [
        { x0: left, x1: right, y: 178 },
        { x0: left, x1: right, y: 1110 },
        { x0: left, x1: right, y: 1268 },
      ],
      mrz: { top: 1412, lines: [1442, 1470], size: 22 },
      issuer: { baseline: 1522, size: 19 },
    };
  return {
    ...base,
    brand: { baseline: 130, size: 28 },
    title: { x: left, baseline: 286, size: 80, maxWidth: 440, lines: 2 },
    span: { baseline: 444, labelSize: 18, valueSize: 23 },
    map: { x: 556, y: 196, width: 968, height: 404 },
    mapNote: { x: right, baseline: 640, align: "right", size: 16 },
    notes: { baseline: 640, size: 16 },
    distance: {
      x: left,
      label: 728,
      labelSize: 19,
      baseline: 852,
      size: 120,
      maxWidth: 760,
    },
    primary: {
      x: 920,
      width: 584,
      baseline: 852,
      label: 728,
      size: 58,
      labelSize: 18,
    },
    secondary: {
      x: left,
      width: 1408,
      baseline: 952,
      label: 986,
      size: 38,
      labelSize: 17,
    },
    rules: [
      { x0: left, x1: right, y: 166 },
      { x0: left, x1: right, y: 676 },
      { x0: left, x1: right, y: 900 },
    ],
    mrz: { top: 1018, lines: [1046, 1072], size: 22 },
    issuer: { baseline: 1120, size: 19 },
  };
}
