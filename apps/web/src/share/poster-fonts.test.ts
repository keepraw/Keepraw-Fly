import { describe, expect, it } from "vitest";
import {
  posterCjkLocales,
  posterFontSample,
  preparePosterFonts,
} from "./poster-fonts";
import type { PosterCopy } from "./poster-copy";
import { createPosterLayout } from "./poster-layout";

describe("passport typography and print geometry", () => {
  it("selects regional Han forms and additional native-name scripts", () => {
    expect(posterCjkLocales("en", "Élodie Eriksson")).toEqual([]);
    expect(posterCjkLocales("zh-CN", "飞行护照张三")).toEqual(["zh-CN"]);
    expect(posterCjkLocales("zh-TW", "飛行護照陳怡君")).toEqual(["zh-TW"]);
    expect(posterCjkLocales("ja-JP", "山田太郎")).toEqual(["ja-JP"]);
    expect(posterCjkLocales("en", "山田はるか")).toEqual(["ja-JP"]);
    expect(posterCjkLocales("en", "김하늘")).toEqual(["ko-KR"]);
    expect(posterCjkLocales("zh-TW", "陳怡君 東京はるか 김하늘")).toEqual([
      "zh-TW",
      "ja-JP",
      "ko-KR",
    ]);
  });

  it("measures a regional serif fallback without initiating font requests", async () => {
    for (const [locale, suffix] of [
      ["zh-CN", "SC"],
      ["zh-TW", "TC"],
      ["ja-JP", "JP"],
      ["ko-KR", "KR"],
    ] as const) {
      const fonts = await preparePosterFonts(locale, {
        document: {} as Document,
        disableWebfont: true,
        sample: "旅行姓名",
      });
      expect(fonts.status).toBe("fallback");
      expect(fonts.families.display).toContain(`Noto Serif CJK ${suffix}`);
      expect(fonts.families.text).toContain(`Noto Sans CJK ${suffix}`);
      expect(fonts.families.display).not.toContain("MiSans");
      expect(Object.values(fonts.families).join("")).not.toContain("KRF");
      expect(fonts.families.mono).toContain("monospace");
    }
  });

  it("includes uppercase accented labels, native names and coverage notes before loading", () => {
    const copy = {
      holder: { name: "陳怡君" },
      title: "Passeport de vol",
      labels: { name: "Prénom" },
      notes: ["航程資料不完整"],
      disclaimer: "龘",
    } as unknown as PosterCopy;
    const sample = posterFontSample(copy);
    expect(sample).not.toContain("龘");
    for (const glyph of "陳怡君PRÉNOM航程資料不完整")
      expect(sample).toContain(glyph);
  });

  it("reserves the machine-readable area inside the frame, including print margins", () => {
    const layout = createPosterLayout();
    const { holderPage, holderContent, mrz, achievements } = layout;
    expect(mrz.area.height / holderPage.height).toBeGreaterThanOrEqual(0.16);
    expect(mrz.area.height / holderPage.height).toBeLessThanOrEqual(0.2);
    expect(mrz.area.y + mrz.area.height).toBe(
      holderPage.y + holderPage.height - 24,
    );
    expect(holderContent.y + holderContent.height).toBe(
      mrz.area.y + mrz.area.height - 16,
    );
    expect(mrz.baseline - mrz.size).toBeGreaterThan(mrz.rule + 20);
    expect(mrz.baseline + mrz.lineHeight + mrz.size * 0.25).toBeLessThan(
      holderContent.y + holderContent.height,
    );
    expect(44 * mrz.cellAdvance).toBeLessThan(layout.right - layout.left);
    expect(
      Math.max(...achievements.map((block) => block.baseline)) + 12,
    ).toBeLessThan(layout.notesBaseline);
    expect(layout.notesBaseline + 8).toBeLessThan(mrz.rule);
  });
});
