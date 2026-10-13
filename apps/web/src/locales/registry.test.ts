import { describe, expect, it } from "vitest";
import {
  browserLanguage,
  normalizeLanguage,
  resolveLanguage,
} from "./registry";

describe("locale resolution", () => {
  it.each([
    ["en", "en-US"],
    ["en-US", "en-US"],
    ["EN-gb", "en-GB"],
    ["en-GB-u-hc-h12", "en-GB"],
    ["en-AU", "en-US"],
    ["zh", "zh-CN"],
    ["zh-CN", "zh-CN"],
    ["zh-SG", "zh-CN"],
    ["zh-TW", "zh-TW"],
    ["zh-HK", "zh-TW"],
    ["zh-MO", "zh-TW"],
    ["zh-Hant", "zh-TW"],
    ["zh-Hant-CN", "zh-TW"],
    ["zh-Hans-HK", "zh-CN"],
  ])("resolves %s as %s", (input, expected) => {
    expect(resolveLanguage(input)).toBe(expected);
  });
  it.each(["ja-JP", "fr-FR", "xx-unknown", "en_US", "", null, undefined, 12])(
    "falls back safely for %s",
    (input) => {
      expect(resolveLanguage(input)).toBeUndefined();
      expect(normalizeLanguage(input)).toBe("en-US");
    },
  );
  it("uses the first supported navigator.languages entry before navigator.language", () => {
    expect(
      browserLanguage({
        languages: ["fr-FR", "zh-Hant", "en-GB"],
        language: "en-US",
      }),
    ).toBe("zh-TW");
    expect(browserLanguage({ languages: ["fr-FR"], language: "en-GB" })).toBe(
      "en-GB",
    );
    expect(browserLanguage({ languages: [], language: "ja-JP" })).toBe("en-US");
  });
});
