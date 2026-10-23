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

export interface PosterProfileField {
  x: number;
  width: number;
  label: number;
  baseline: number;
}

export interface PosterLayout {
  width: number;
  height: number;
  safe: PosterRect;
  recordPage: PosterRect;
  holderPage: PosterRect;
  /** Inside the paper frame, with a further 16-unit print margin. */
  holderContent: PosterRect;
  statsRule: number;
  notesBaseline: number;
  binding: PosterRect;
  map: PosterRect;
  left: number;
  right: number;
  header: {
    record: number;
    holder: number;
    brandSize: number;
    labelSize: number;
    labelWidth: number;
  };
  profile: {
    name: PosterProfileField;
    number: PosterProfileField;
    authority: PosterProfileField;
    firstFlight: PosterProfileField;
    period: PosterProfileField;
    labelSize: number;
    valueSize: number;
    nameSize: number;
    nameMinSize: number;
    nameWrappedSize: number;
    nameLineHeight: number;
  };
  mrz: {
    area: PosterRect;
    rule: number;
    baseline: number;
    lineHeight: number;
    size: number;
    /** Fixed advance, independent of the available page width. */
    cellAdvance: number;
  };
  distance: PosterStatBlock;
  achievements: PosterStatBlock[];
}

export function createPosterLayout(): PosterLayout {
  const left = 90;
  const right = 1110;
  const nameWidth = 640;
  const columnGap = 48;
  const secondColumn = left + nameWidth + columnGap;
  const field = (
    x: number,
    width: number,
    label: number,
    baseline: number,
  ): PosterProfileField => ({ x, width, label, baseline });
  return {
    ...POSTER_SIZE,
    safe: { x: 72, y: 72, width: 1056, height: 1490 },
    recordPage: { x: 32, y: 26, width: 1136, height: 758 },
    binding: { x: 32, y: 784, width: 1136, height: 32 },
    holderPage: { x: 32, y: 816, width: 1136, height: 758 },
    holderContent: { x: 72, y: 856, width: 1056, height: 678 },
    statsRule: 1246,
    notesBaseline: 1410,
    // Keep the full map width and projection scale beneath the new header.
    map: { x: 82, y: 144, width: 1036, height: 590 },
    left,
    right,
    header: {
      record: 94,
      holder: 878,
      brandSize: 28,
      labelSize: 22,
      labelWidth: 440,
    },
    profile: {
      name: field(left, nameWidth, 1000, 1058),
      number: field(secondColumn, right - secondColumn, 1000, 1058),
      authority: field(left, nameWidth, 1126, 1158),
      firstFlight: field(secondColumn, right - secondColumn, 1126, 1158),
      period: field(left, right - left, 1190, 1224),
      labelSize: 20,
      valueSize: 27,
      nameSize: 50,
      nameMinSize: 34,
      nameWrappedSize: 34,
      nameLineHeight: 38,
    },
    mrz: {
      area: { x: 56, y: 1424, width: 1088, height: 126 },
      rule: 1424,
      baseline: 1474,
      lineHeight: 38,
      size: 26,
      cellAdvance: 18.5,
    },
    distance: {
      x: 90,
      width: 340,
      label: 1278,
      baseline: 1352,
      size: 72,
      labelSize: 24,
    },
    achievements: Array.from({ length: 6 }, (_, index) => ({
      x: 474 + (index % 3) * 218,
      width: 200,
      label: 1278 + Math.floor(index / 3) * 68,
      baseline: 1318 + Math.floor(index / 3) * 68,
      size: 42,
      labelSize: 20,
    })),
  };
}
