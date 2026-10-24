/** Nominal TD3 dimensions, Doc 9303 Part 4 §3 / Figure 3 and §4.2.1.3.
 * These inform a digital keepsake, not physical OCR certification. */
export const TD3_MM = {
  width: 125,
  height: 88,
  mrzHeight: 23.2,
  mrzPrintWidth: 114,
  firstCharacterInset: 6,
  characterPitch: 2.54,
  linePitch: 6.35,
  firstBaselineFromBottom: 13.6,
} as const;

/** All book geometry is derived from one leaf and its shared print margins. */
export const PASSPORT_GEOMETRY = {
  pageWidth: 1136,
  outerX: 32,
  outerY: 26,
  bindingHeight: 32,
  frameInset: 24,
  printInset: 40,
  contentInset: 58,
  rhythm: 8,
} as const;
const G = PASSPORT_GEOMETRY;
const mm = (value: number) => (value * G.pageWidth) / TD3_MM.width;
const pageHeight = Math.round(mm(TD3_MM.height));
export const POSTER_SIZE = {
  width: G.pageWidth + G.outerX * 2,
  height: pageHeight * 2 + G.bindingHeight + G.outerY * 2,
} as const;
export const POSTER_SAFE_INSET = G.outerX + G.printInset;

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
  unitSize: number;
}
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
  frameInset: number;
  recordPage: PosterRect;
  holderPage: PosterRect;
  recordContent: PosterRect;
  holderContent: PosterRect;
  sections: Record<
    "heading" | "identity" | "metadata" | "statistics",
    PosterRect
  >;
  statsRule: number;
  statsRowPitch: number;
  minStatRowGap: number;
  binding: PosterRect;
  map: PosterRect;
  left: number;
  right: number;
  header: {
    record: number;
    holder: number;
    title: number;
    titleSize: number;
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
    fieldGap: number;
    nameSize: number;
    nameMinSize: number;
    nameWrappedSize: number;
    nameLineHeight: number;
  };
  mrz: {
    /** Full nominal zone extends to the paper edge; ink stays inside print. */
    area: PosterRect;
    print: PosterRect;
    x: number;
    rule: number;
    baseline: number;
    lineHeight: number;
    size: number;
    cellAdvance: number;
  };
  distance: PosterStatBlock;
  achievements: PosterStatBlock[];
}

export function createPosterLayout(): PosterLayout {
  const page = (y: number): PosterRect => ({
    x: G.outerX,
    y,
    width: G.pageWidth,
    height: pageHeight,
  });
  const recordPage = page(G.outerY);
  const binding = {
    x: G.outerX,
    y: recordPage.y + pageHeight,
    width: G.pageWidth,
    height: G.bindingHeight,
  };
  const holderPage = page(binding.y + binding.height);
  const inset = (rect: PosterRect, amount: number): PosterRect => ({
    x: rect.x + amount,
    y: rect.y + amount,
    width: rect.width - amount * 2,
    height: rect.height - amount * 2,
  });
  const recordContent = inset(recordPage, G.printInset);
  const holderContent = inset(holderPage, G.printInset);
  const left = holderPage.x + G.contentInset;
  const right = holderPage.x + holderPage.width - G.contentInset;
  const contentWidth = right - left;
  const r = G.rhythm;
  const y = (local: number) => holderPage.y + local;
  const region = (top: number, bottom: number): PosterRect => ({
    x: left,
    y: y(top),
    width: contentWidth,
    height: bottom - top,
  });

  // Nominal holder positions. The Canvas renderer resolves the name,
  // metadata and statistics against actual ink after fonts have loaded.
  // The paper, header and TD3 machine-readable zone stay fixed.
  const recordBrand = 8 * r;
  const brand = 9 * r;
  const title = 18 * r;
  const nameLabel = title + 6.5 * r;
  const nameValue = nameLabel + 7 * r;
  const nameLineHeight = 5 * r;
  const metadataLabel = nameValue + 8 * r;
  const fieldGap = 4 * r;
  const metadataValue = metadataLabel + fieldGap;
  const statsRule = metadataValue + 3 * r;
  const statLabel = statsRule + 5 * r;
  const statValue = statLabel + 5 * r;
  const statsRowPitch = 13 * r;
  // A shared first baseline lets the smaller number rest in the same
  // visual row as the name, rather than floating at its cap height.
  const numberValue = nameValue;
  const field = (
    x: number,
    width: number,
    label: number,
    baseline: number,
  ): PosterProfileField => ({
    x,
    width,
    label: y(label),
    baseline: y(baseline),
  });
  const metadataGap = 4.5 * r;
  const authorityWidth = 35 * r;
  const firstWidth = 30 * r;
  const firstX = left + authorityWidth + metadataGap;
  const periodX = firstX + firstWidth + metadataGap;
  const nameWidth = 80 * r;
  const numberX = left + nameWidth + 6 * r;
  const distanceWidth = 40 * r;
  const statX = left + distanceWidth + 5 * r;
  const statGap = 3 * r;
  const statWidth = (right - statX - statGap * 2) / 3;
  const mrzTop = holderPage.height - mm(TD3_MM.mrzHeight);
  const printX = holderPage.x + mm(TD3_MM.firstCharacterInset);
  const mrzRule = y(mrzTop);

  return {
    ...POSTER_SIZE,
    safe: {
      x: recordContent.x,
      y: recordContent.y,
      width: recordContent.width,
      height: holderContent.y + holderContent.height - recordContent.y,
    },
    frameInset: G.frameInset,
    recordPage,
    holderPage,
    recordContent,
    holderContent,
    binding,
    sections: {
      heading: region(G.printInset, title + 2 * r),
      identity: region(nameLabel - 3 * r, metadataLabel - 3 * r),
      metadata: region(metadataLabel - 3 * r, metadataValue + r),
      statistics: region(statsRule, statValue + statsRowPitch + r),
    },
    statsRule: y(statsRule),
    statsRowPitch,
    minStatRowGap: 3 * r,
    // Width still controls the existing uniform map projection. The taller
    // fitting box recentres it without stretching either geographic axis.
    map: {
      x: recordPage.x + 50,
      y: recordPage.y + recordBrand + 8 * r,
      width: recordPage.width - 100,
      height: recordPage.height - recordBrand - 8 * r - 6 * r,
    },
    left,
    right,
    header: {
      record: recordPage.y + recordBrand,
      holder: y(brand),
      title: y(title),
      titleSize: 48,
      brandSize: 28,
      labelSize: 22,
      labelWidth: 440,
    },
    profile: {
      name: field(left, nameWidth, nameLabel, nameValue),
      number: field(numberX, right - numberX, nameLabel, numberValue),
      authority: field(left, authorityWidth, metadataLabel, metadataValue),
      firstFlight: field(firstX, firstWidth, metadataLabel, metadataValue),
      period: field(periodX, right - periodX, metadataLabel, metadataValue),
      labelSize: 20,
      valueSize: 26,
      fieldGap,
      nameSize: 48,
      nameMinSize: 34,
      nameWrappedSize: 34,
      nameLineHeight,
    },
    mrz: {
      area: {
        x: holderPage.x,
        y: mrzRule,
        width: holderPage.width,
        height: mm(TD3_MM.mrzHeight),
      },
      print: {
        x: printX,
        y: mrzRule + 3 * r,
        width: mm(TD3_MM.mrzPrintWidth),
        height: holderContent.y + holderContent.height - mrzRule - 3 * r,
      },
      x: printX,
      rule: mrzRule,
      baseline: y(holderPage.height - mm(TD3_MM.firstBaselineFromBottom)),
      lineHeight: mm(TD3_MM.linePitch),
      size: 36,
      cellAdvance: mm(TD3_MM.characterPitch),
    },
    distance: {
      x: left,
      width: distanceWidth,
      label: y(statLabel),
      baseline: y(statValue + 6 * r),
      size: 68,
      labelSize: 24,
      unitSize: 24,
    },
    achievements: Array.from({ length: 6 }, (_, index) => ({
      x: statX + (index % 3) * (statWidth + statGap),
      width: statWidth,
      label: y(statLabel + Math.floor(index / 3) * statsRowPitch),
      baseline: y(statValue + Math.floor(index / 3) * statsRowPitch),
      size: 42,
      labelSize: 20,
      unitSize: 22,
    })),
  };
}
