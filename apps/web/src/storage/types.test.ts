import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SKIN_ID } from "../skins/registry";
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
  it.each(["en", "zh-HK", "it-IT"])(
    "normalizes %s without losing preferences",
    (language) => {
      const stored = {
        language,
        appearance: "dark" as const,
        distanceUnit: "kilometers" as const,
        timeFormat: "12-hour" as const,
        powerUserMode: true,
        lastBackupAt: "2026-10-10T00:00:00Z",
        futurePreference: "preserved",
      };
      const copy = structuredClone(stored);
      expect(normalizeViewerSettings(stored)).toEqual({
        ...stored,
        language: language === "zh-HK" ? "zh-TW" : "en-US",
        skin: DEFAULT_SKIN_ID,
      });
      expect(stored).toEqual(copy);
    },
  );
});

describe("skin preference", () => {
  const base = {
    language: "en-US",
    appearance: "system" as const,
    distanceUnit: "kilometers" as const,
    timeFormat: "24-hour" as const,
    powerUserMode: false,
  };

  it("starts on the default skin", () => {
    vi.stubGlobal("navigator", { language: "en-US" });
    expect(defaultViewerSettings().skin).toBe(DEFAULT_SKIN_ID);
  });

  it("keeps a registered skin", () => {
    expect(normalizeViewerSettings({ ...base, skin: "minimal" }).skin).toBe(
      "minimal",
    );
  });

  it.each([undefined, null, 3, "", "retired-skin"])(
    "resolves %s to the default without losing other preferences",
    (skin) => {
      expect(normalizeViewerSettings({ ...base, skin })).toMatchObject({
        ...base,
        skin: DEFAULT_SKIN_ID,
      });
    },
  );

  it("resolves the v0.3.0 look an earlier version stored to the default", () => {
    expect(normalizeViewerSettings({ ...base, skin: "classic" }).skin).toBe(
      DEFAULT_SKIN_ID,
    );
  });

  it("loads a record with the map theme and layout an earlier version stored, without them", () => {
    const loaded = normalizeViewerSettings({
      ...base,
      skin: "minimal",
      mapTheme: "daylight-chart",
      passportTemplate: "book",
    });
    expect(loaded).toEqual({ ...base, skin: "minimal" });
    expect(defaultViewerSettings()).not.toHaveProperty("mapTheme");
    expect(defaultViewerSettings()).not.toHaveProperty("passportTemplate");
  });
});
