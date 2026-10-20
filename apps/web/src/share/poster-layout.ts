import type { PosterAspect, PosterTemplate } from "./poster-data";

/**
 * Poster layout descriptions in artboard units (always 1080 wide). Preview
 * and export draw from the same description; only the pixel scale differs.
 * Each template/aspect pair is composed on its own, never scaled from another.
 */
export interface PosterRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const POSTER_WIDTH = 1080;
export const POSTER_HEIGHT: Record<PosterAspect, number> = {
  "4:5": 1350,
  "9:16": 1920,
};
/** Nothing may be drawn closer to the artboard edge than this (except the
 * full-bleed background). */
export const POSTER_SAFE_INSET = 64;

export interface PosterLayout {
  template: PosterTemplate;
  aspect: PosterAspect;
  width: number;
  height: number;
  safe: PosterRect;
  /** Content column. */
  left: number;
  right: number;
  /** Baselines and boxes, in artboard units. */
  header: number;
  title: { baseline: number; size: number };
  year: { baseline: number; size: number } | null;
  span: { baseline: number } | null;
  distance: { label: number; baseline: number; size: number };
  primary: { label: number; baseline: number; size: number };
  duration: { label: number; baseline: number; size: number } | null;
  secondary: { baseline: number; label: number; size: number } | null;
  rules: number[];
  airports: {
    title: number;
    firstRow: number;
    rowHeight: number;
    inline: boolean;
  } | null;
  chart: { title: number; bars: PosterRect; labels: number };
  highlights: { label: number; baseline: number; size: number } | null;
  footer: { rule: number; baseline: number };
}

export interface PosterLayoutOptions {
  airports?: boolean;
}

export function createPosterLayout(
  template: PosterTemplate,
  aspect: PosterAspect,
  options: PosterLayoutOptions = {},
): PosterLayout {
  const width = POSTER_WIDTH;
  const height = POSTER_HEIGHT[aspect];
  const safe = {
    x: POSTER_SAFE_INSET,
    y: POSTER_SAFE_INSET,
    width: width - POSTER_SAFE_INSET * 2,
    height: height - POSTER_SAFE_INSET * 2,
  };
  const left = 88;
  const right = width - 88;
  const airports = options.airports === true;
  const base = { template, aspect, width, height, safe, left, right };
  const bars = (top: number, bottom: number): PosterRect => ({
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  });

  if (template === "passport" && aspect === "4:5")
    return {
      ...base,
      header: 124,
      title: { baseline: 214, size: 72 },
      year: null,
      span: { baseline: 318 },
      distance: { label: 390, baseline: 530, size: 144 },
      primary: { label: 632, baseline: 716, size: 78 },
      duration: null,
      secondary: { baseline: 838, label: 876, size: 50 },
      rules: [262, 580, 766],
      airports: airports
        ? { title: 950, firstRow: 950, rowHeight: 0, inline: true }
        : null,
      chart: airports
        ? { title: 1010, bars: bars(1040, 1168), labels: 1200 }
        : { title: 956, bars: bars(992, 1168), labels: 1200 },
      highlights: null,
      footer: { rule: 1228, baseline: 1266 },
    };
  if (template === "passport")
    return {
      ...base,
      header: 140,
      title: { baseline: 300, size: 92 },
      year: null,
      span: { baseline: 368 },
      distance: { label: 506, baseline: 676, size: 168 },
      primary: { label: 826, baseline: 920, size: 90 },
      duration: null,
      secondary: { baseline: 1080, label: 1122, size: 60 },
      rules: [430, 756, 990],
      airports: airports
        ? { title: 1210, firstRow: 1262, rowHeight: 50, inline: false }
        : null,
      chart: airports
        ? { title: 1446, bars: bars(1484, 1660), labels: 1694 }
        : { title: 1250, bars: bars(1296, 1640), labels: 1676 },
      highlights: null,
      footer: { rule: 1746, baseline: 1800 },
    };
  if (aspect === "4:5")
    return {
      ...base,
      header: 124,
      title: { baseline: 124, size: 22 },
      year: { baseline: 410, size: 300 },
      span: null,
      distance: { label: 506, baseline: 592, size: 84 },
      primary: { label: 506, baseline: 592, size: 84 },
      duration: { label: 652, baseline: 652, size: 30 },
      secondary: null,
      rules: [466, 700],
      airports: airports
        ? { title: 1206, firstRow: 1206, rowHeight: 0, inline: true }
        : null,
      chart: airports
        ? { title: 752, bars: bars(782, 948), labels: 980 }
        : { title: 756, bars: bars(788, 990), labels: 1024 },
      highlights: airports
        ? { label: 1062, baseline: 1124, size: 44 }
        : { label: 1110, baseline: 1176, size: 48 },
      footer: { rule: 1228, baseline: 1266 },
    };
  return {
    ...base,
    header: 140,
    title: { baseline: 140, size: 24 },
    year: { baseline: 560, size: 400 },
    span: null,
    distance: { label: 706, baseline: 812, size: 112 },
    primary: { label: 890, baseline: 982, size: 96 },
    duration: { label: 1052, baseline: 1112, size: 52 },
    secondary: null,
    rules: [626, 1170],
    airports: airports
      ? { title: 1702, firstRow: 1702, rowHeight: 0, inline: true }
      : null,
    chart: airports
      ? { title: 1232, bars: bars(1272, 1468), labels: 1502 }
      : { title: 1240, bars: bars(1284, 1540), labels: 1576 },
    highlights: airports
      ? { label: 1566, baseline: 1636, size: 50 }
      : { label: 1646, baseline: 1722, size: 54 },
    footer: { rule: 1760, baseline: 1812 },
  };
}
