import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultViewerSettings, normalizeViewerSettings } from "./types";

afterEach(() => vi.unstubAllGlobals());

describe("default viewer distance unit", () => {
  it.each([
    ["zh-CN", "zh-CN"],
    ["zh-TW", "zh-TW"],
    ["zh-HK", "zh-TW"],
  ] as const)("uses kilometers for %s", (browserLanguage, language) => {
    vi.stubGlobal("navigator", { language: browserLanguage });
    expect(defaultViewerSettings()).toMatchObject({
      language,
      distanceUnit: "kilometers",
    });
  });

  it("keeps miles as the English default", () => {
    vi.stubGlobal("navigator", { language: "en-US" });
    expect(defaultViewerSettings()).toMatchObject({
      language: "en-US",
      distanceUnit: "miles",
    });
  });
});

describe("saved locale compatibility", () => {
  it.each(["en", "zh-HK", "ja-JP"])(
    "normalizes %s without losing preferences",
    (language) => {
      const stored = {
        language,
        appearance: "dark" as const,
        distanceUnit: "kilometers" as const,
        timeFormat: "12-hour" as const,
        powerUserMode: true,
        solarMode: "realtime",
        lastBackupAt: "2026-10-10T00:00:00Z",
        futurePreference: "preserved",
      };
      const copy = structuredClone(stored);
      expect(normalizeViewerSettings(stored)).toEqual({
        ...stored,
        language: language === "zh-HK" ? "zh-TW" : "en-US",
      });
      expect(stored).toEqual(copy);
    },
  );
});
