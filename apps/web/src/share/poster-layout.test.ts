import { describe, expect, it } from "vitest";
import { createPosterLayout, POSTER_SIZE, TD3_MM } from "./poster-layout";

const layout = createPosterLayout();
describe("TD3 opened-book geometry", () => {
  it("derives equal 125:88 leaves, book edges and an integer PNG artboard", () => {
    expect(POSTER_SIZE).toEqual({ width: 1200, height: 1684 });
    for (const page of [layout.recordPage, layout.holderPage]) {
      expect(page.width / page.height).toBeCloseTo(125 / 88, 3);
      expect(page.width).toBe(1136);
      expect(page.height).toBe(800);
    }
    expect(layout.recordPage.y + layout.recordPage.height).toBe(
      layout.binding.y,
    );
    expect(layout.binding.y + layout.binding.height).toBe(layout.holderPage.y);
    expect(layout.height - layout.holderPage.y - layout.holderPage.height).toBe(
      layout.recordPage.y,
    );
  });

  it("anchors the MRZ to the paper's 6mm start, 114mm reference width and 10cpi cells", () => {
    const unitsPerMm = layout.holderPage.width / TD3_MM.width;
    expect((layout.mrz.x - layout.holderPage.x) / unitsPerMm).toBeCloseTo(6, 6);
    expect(layout.mrz.print.width / unitsPerMm).toBeCloseTo(114, 6);
    expect(layout.mrz.area.height / unitsPerMm).toBeCloseTo(23.2, 6);
    expect(layout.mrz.cellAdvance / unitsPerMm).toBeCloseTo(2.54, 6);
    expect(layout.mrz.lineHeight / unitsPerMm).toBeCloseTo(6.35, 6);
    expect(44 * layout.mrz.cellAdvance).toBeLessThan(layout.mrz.print.width);
    expect(
      (44 * layout.mrz.cellAdvance) / layout.holderPage.width,
    ).toBeGreaterThan(0.89);
    expect(
      layout.mrz.baseline + layout.mrz.lineHeight + layout.mrz.size * 0.25,
    ).toBeLessThan(layout.holderContent.y + layout.holderContent.height);
  });

  it("uses one metadata row, uniform field spacing and a spacious statistics grid", () => {
    const fields = [
      layout.profile.authority,
      layout.profile.firstFlight,
      layout.profile.period,
    ];
    expect(new Set(fields.map((field) => field.label)).size).toBe(1);
    expect(new Set(fields.map((field) => field.baseline)).size).toBe(1);
    expect(
      fields.every(
        (field) => field.baseline - field.label === layout.profile.fieldGap,
      ),
    ).toBe(true);
    for (let column = 0; column < 3; column++) {
      const first = layout.achievements[column]!;
      const second = layout.achievements[column + 3]!;
      expect(second.x).toBe(first.x);
      expect(second.label - first.label).toBe(layout.statsRowPitch);
      expect(second.baseline - first.baseline).toBe(layout.statsRowPitch);
      expect(
        second.label - second.labelSize - first.baseline - first.size * 0.2,
      ).toBeGreaterThan(layout.minStatRowGap);
    }
    const sections = Object.values(layout.sections);
    for (let index = 1; index < sections.length; index++)
      expect(sections[index]!.y).toBeGreaterThanOrEqual(
        sections[index - 1]!.y + sections[index - 1]!.height,
      );
    expect(Object.keys(layout.sections)).toEqual([
      "heading",
      "identity",
      "metadata",
      "statistics",
    ]);
    expect(
      layout.sections.statistics.y + layout.sections.statistics.height,
    ).toBeLessThan(layout.mrz.area.y);
  });

  it("keeps the nominal number on the first name baseline", () => {
    const { name, number } = layout.profile;
    expect(number.label).toBe(name.label);
    expect(number.baseline).toBe(name.baseline);
    expect(number.x).toBe(name.x + name.width + 48);
  });
});
