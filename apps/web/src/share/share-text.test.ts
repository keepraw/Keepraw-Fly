import { describe, expect, it } from "vitest";
import {
  shareFontFamily,
  shareLocaleForLanguage,
  shareTextTokens,
  wrapShareText,
} from "./share-text";

const OPENING = "（「『【〔〈《“‘([{";
const CLOSING = "），。、；：！？」』】〕〉》”’,.;:!?)]}";
const visible = (value: string) => value.replace(/\s/gu, "");

/** Width, content and punctuation invariants for every wrapped result. */
function expectWrapInvariants(text: string, lines: string[], maxWidth: number) {
  for (const line of lines) expect(measure(line)).toBeLessThanOrEqual(maxWidth);
  // Same non-whitespace characters, same order, nothing lost or duplicated.
  expect(visible(lines.join(""))).toBe(visible(text));
  for (const [index, line] of lines.entries()) {
    if (index < lines.length - 1)
      expect(OPENING).not.toContain(Array.from(line).at(-1) ?? "");
    if (index > 0) expect(CLOSING).not.toContain(Array.from(line)[0] ?? "");
  }
}

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

  describe("regressions", () => {
    it("splits an overlong token that follows existing text", () => {
      const text = "Hello Supercalifragilistic";
      const result = wrapShareText(text, measure, 8);
      // Before the fix the second line was the whole 20-unit token.
      expect(result.lines).toEqual(["Hello", "Supercal", "ifragili", "stic"]);
      expectWrapInvariants(text, result.lines, 8);
    });

    it("splits an overlong token after several words", () => {
      const text = "to be or Pneumonoultramicroscopic ok";
      const result = wrapShareText(text, measure, 9);
      expect(result.lines).toEqual([
        "to be or",
        "Pneumonou",
        "ltramicro",
        "scopic ok",
      ]);
      expectWrapInvariants(text, result.lines, 9);
    });

    it("keeps an opening bracket with the following character", () => {
      // Width 4 fits 甲（ (4 units); naive greedy wrapping left 「甲（」 then 「乙」.
      const result = wrapShareText("甲（乙", measure, 4);
      expect(result.lines).toEqual(["甲", "（乙"]);
      expectWrapInvariants("甲（乙", result.lines, 4);
      expect(shareTextTokens("甲（乙")).toEqual(["甲", "（乙"]);
    });

    it("never starts a line with closing punctuation", () => {
      const text = "甲乙（丙丁）戊";
      for (const width of [4, 5, 6, 7, 8, 10]) {
        const result = wrapShareText(text, measure, width);
        expectWrapInvariants(text, result.lines, width);
      }
      // Tokens: 甲 乙 （丙 丁） 戊 — the brackets travel with their neighbours.
      expect(wrapShareText(text, measure, 6).lines).toEqual([
        "甲乙",
        "（丙",
        "丁）戊",
      ]);
    });

    it("wraps mixed English, digits, Chinese and punctuation deterministically", () => {
      const text =
        "2025 年「飞行护照」Flight Passport（12 段航程），共 18,000 km！";
      for (const width of [6, 8, 11, 14, 20, 30]) {
        const first = wrapShareText(text, measure, width);
        expect(wrapShareText(text, measure, width)).toEqual(first);
        expectWrapInvariants(text, first.lines, width);
      }
      expect(wrapShareText(text, measure, 14).lines).toEqual([
        "2025 年「飞行",
        "护照」Flight",
        "Passport（12",
        "段航程），共",
        "18,000 km！",
      ]);
    });

    it("keeps ASCII brackets with their words and handles empty input", () => {
      expect(shareTextTokens("see (map) now")).toEqual([
        "see ",
        "(map) ",
        "now",
      ]);
      expect(wrapShareText("", measure, 4)).toEqual({
        lines: [""],
        truncated: false,
      });
      const narrow = wrapShareText("ab（c）", measure, 1);
      expect(visible(narrow.lines.join(""))).toBe("ab（c）");
    });
  });

  describe("opening punctuation followed by whitespace", () => {
    it("keeps （ with the next character across a space", () => {
      // Before the fix: ["甲", "（", "乙"] — the mark was stranded alone.
      const result = wrapShareText("甲（ 乙", measure, 4);
      expect(result.lines).toEqual(["甲", "（乙"]);
      expectWrapInvariants("甲（ 乙", result.lines, 4);
    });

    it("applies to other opening marks", () => {
      for (const mark of ["「", "《", "【"]) {
        const text = `甲${mark} 乙`;
        const result = wrapShareText(text, measure, 4);
        expect(result.lines).toEqual(["甲", `${mark}乙`]);
        expectWrapInvariants(text, result.lines, 4);
      }
    });

    it("keeps the space when the group fits on the line", () => {
      expect(wrapShareText("甲（ 乙", measure, 7).lines).toEqual(["甲（ 乙"]);
      expect(shareTextTokens("甲（ 乙")).toEqual(["甲", "（ 乙"]);
    });

    it("keeps opening marks with following text in mixed content", () => {
      const text = "Flight 「 Passport」 来自（ 2025 年）的航程";
      for (const width of [8, 10, 12, 16, 24, 40]) {
        const first = wrapShareText(text, measure, width);
        expect(wrapShareText(text, measure, width)).toEqual(first);
        expectWrapInvariants(text, first.lines, width);
      }
      // 「 Passport」 is 13 units: at 12 the inner space collapses instead of
      // stranding 「; at 14 the group fits and the space is kept.
      expect(wrapShareText(text, measure, 12).lines).toEqual([
        "Flight",
        "「Passport」",
        "来自（ 2025",
        "年）的航程",
      ]);
      expect(wrapShareText(text, measure, 14).lines[1]).toBe("「 Passport」");
    });

    it("respects the width when the mark and next character cannot fit together", () => {
      // Width 2 holds one full-width character: the pair is impossible, so
      // the width wins and the mark stands alone rather than overflowing.
      const result = wrapShareText("甲（ 乙", measure, 2);
      expect(result.lines).toEqual(["甲", "（", "乙"]);
      for (const line of result.lines)
        expect(measure(line)).toBeLessThanOrEqual(2);
      expect(visible(result.lines.join(""))).toBe("甲（乙");
    });
  });
});

describe("share typography locales", () => {
  it("maps every UI language to a share typography locale", () => {
    expect(shareLocaleForLanguage("zh-CN")).toBe("zh-CN");
    expect(shareLocaleForLanguage("zh-TW")).toBe("zh-TW");
    expect(shareLocaleForLanguage("ja-JP")).toBe("ja-JP");
    expect(shareLocaleForLanguage("ko-KR")).toBe("ko-KR");
    for (const language of ["en-US", "en-GB", "fr-FR", "de-DE", "es", "pt-BR"])
      expect(shareLocaleForLanguage(language)).toBe("en");
  });

  it("uses system CJK stacks for Japanese and Korean without a webfont", () => {
    const ja = shareFontFamily("ja-JP", true);
    const ko = shareFontFamily("ko-KR", true);
    expect(ja).toContain('"Noto Sans CJK JP"');
    expect(ja).toContain('"Hiragino Sans"');
    expect(ko).toContain('"Malgun Gothic"');
    expect(ko).toContain('"Noto Sans CJK KR"');
    for (const family of [ja, ko]) {
      expect(family).not.toContain("MiSans");
      expect(family.indexOf('"Inter"')).toBe(0);
      expect(family.endsWith("sans-serif")).toBe(true);
    }
  });
});
