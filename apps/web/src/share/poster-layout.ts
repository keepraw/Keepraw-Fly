/** An opened passport always has two landscape leaves stacked vertically.
 * Page coordinates are independent; the binding occupies its own full-width box.
 * Screen size only scales this composition, never changes the opening direction. */
export interface PosterRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PosterStatBlock {
  x: number;
  width: number;
  label: number;
  baseline: number;
  size: number;
  labelSize: number;
}

export const POSTER_SIZE = { width: 1200, height: 1600 } as const;
export const POSTER_SAFE_INSET = 72;

export interface PosterLayout {
  width: number;
  height: number;
  safe: PosterRect;
  recordPage: PosterRect;
  holderPage: PosterRect;
  binding: PosterRect;
  map: PosterRect;
  left: number;
  right: number;
  distance: PosterStatBlock;
  achievements: PosterStatBlock[];
}

export function createPosterLayout(): PosterLayout {
  return {
    ...POSTER_SIZE,
    safe: { x: 72, y: 72, width: 1056, height: 1490 },
    recordPage: { x: 32, y: 26, width: 1136, height: 758 },
    binding: { x: 32, y: 784, width: 1136, height: 32 },
    holderPage: { x: 32, y: 816, width: 1136, height: 758 },
    map: { x: 82, y: 222, width: 1036, height: 410 },
    left: 90,
    right: 1110,
    distance: {
      x: 90,
      width: 440,
      label: 1312,
      baseline: 1392,
      size: 76,
      labelSize: 26,
    },
    achievements: Array.from({ length: 6 }, (_, index) => ({
      x: 580 + (index % 3) * 184,
      width: 162,
      label: 1312 + Math.floor(index / 3) * 98,
      baseline: 1356 + Math.floor(index / 3) * 98,
      size: 42,
      labelSize: 22,
    })),
  };
}
