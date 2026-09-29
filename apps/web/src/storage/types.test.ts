import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultViewerSettings } from "./types";

afterEach(() => vi.unstubAllGlobals());

describe("default viewer distance unit", () => {
  it.each([
    ["zh-CN", "zh-CN"],
    ["zh-TW", "zh-TW"],
    ["zh-HK", "zh-TW"],
  ] as const)("uses kilometers for %s", (browserLanguage, language) => {
    vi.stubGlobal("navigator", { language: browserLanguage });
    expect(defaultViewerSettings()).toMatchObject({ language, distanceUnit: "kilometers" });
  });

  it("keeps miles as the English default", () => {
    vi.stubGlobal("navigator", { language: "en-US" });
    expect(defaultViewerSettings()).toMatchObject({ language: "en", distanceUnit: "miles" });
  });
});
