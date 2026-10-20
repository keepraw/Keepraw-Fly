import { describe, expect, it } from "vitest";
import { shareFontFamily, shareTextTokens, wrapShareText } from "./share-text";

// Deterministic metric: CJK glyphs are 2 units, everything else 1.
const measure = (text: string) =>
  Array.from(text).reduce(
    (sum, char) => sum + (/[\u3000-\u9fff\uff00-\uffef]/u.test(char) ? 2 : 1),
    0,
  );

describe("share text", () => {
  it("breaks Latin by words and CJK by characters, keeping closing punctuation", () => {
    expect(shareTextTokens("Year in Flight")).toEqual([
      "Year ",
      "in ",
      "Flight",
    ]);
    expect(shareTextTokens("飞行护照。")).toEqual(["飞", "行", "护", "照。"]);
    expect(shareTextTokens("2025 年飛行")).toEqual(["2025 ", "年", "飛", "行"]);
  });

  it("never exceeds the width and splits over-long tokens", () => {
    const result = wrapShareText("Supercalifragilistic words", measure, 8);
    expect(result.lines.every((line) => measure(line) <= 8)).toBe(true);
    expect(result.lines.join("")).toBe("Supercalifragilisticwords");
  });

  it("wraps mixed Chinese and English deterministically", () => {
    const text = "我的 2025 年度飞行 Flight Passport 总结";
    const first = wrapShareText(text, measure, 12);
    const second = wrapShareText(text, measure, 12);
    expect(first).toEqual(second);
    expect(first.lines.every((line) => measure(line) <= 12)).toBe(true);
    expect(first.lines.join("").replaceAll(" ", "")).toBe(
      text.replaceAll(" ", ""),
    );
  });

  it("truncates with an ellipsis that still fits", () => {
    const result = wrapShareText(
      "繁體中文的飛行年度摘要內容很長",
      measure,
      10,
      2,
    );
    expect(result.truncated).toBe(true);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[1]!.endsWith("…")).toBe(true);
    expect(measure(result.lines[1]!)).toBeLessThanOrEqual(10);
  });

  it("names the webfont only when it is available, with a fixed fallback stack", () => {
    expect(shareFontFamily("zh-CN", true)).toContain('"MiSans"');
    expect(shareFontFamily("zh-TW", true)).toContain('"MiSans TC"');
    expect(shareFontFamily("zh-CN", false)).not.toContain("MiSans");
    expect(shareFontFamily("zh-TW", false)).toContain('"PingFang TC"');
    expect(shareFontFamily("en", true)).not.toContain("MiSans");
    expect(shareFontFamily("zh-CN", false).endsWith("sans-serif")).toBe(true);
  });
});
