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
        mapTheme: "neon-aviation",
        passportTemplate: "neon",
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

  it("still loads the map theme and layout an earlier version stored", () => {
    expect(
      normalizeViewerSettings({
        ...base,
        skin: "minimal",
        mapTheme: "daylight-chart",
        passportTemplate: "book",
      }),
    ).toMatchObject({
      skin: "minimal",
      mapTheme: "daylight-chart",
      passportTemplate: "book",
    });
  });
});

describe("map theme preference", () => {
  const base = {
    language: "en-US",
    appearance: "dark" as const,
    distanceUnit: "kilometers" as const,
    timeFormat: "12-hour" as const,
    powerUserMode: false,
  };

  it("defaults to the registered default theme", () => {
    expect(defaultViewerSettings().mapTheme).toBe("neon-aviation");
    expect(normalizeViewerSettings(base).mapTheme).toBe("neon-aviation");
  });

  it("keeps a registered theme and replaces an unknown one", () => {
    expect(
      normalizeViewerSettings({ ...base, mapTheme: "daylight-chart" }).mapTheme,
    ).toBe("daylight-chart");
    for (const mapTheme of ["removed-theme", 7, null])
      expect(normalizeViewerSettings({ ...base, mapTheme }).mapTheme).toBe(
        "neon-aviation",
      );
  });

  it("falls back to the default passport layout for unknown stored ids", () => {
    const base = defaultViewerSettings();
    expect(base.passportTemplate).toBe("neon");
    expect(
      normalizeViewerSettings({ ...base, passportTemplate: "book" })
        .passportTemplate,
    ).toBe("book");
    for (const passportTemplate of ["retired", 3, null, undefined])
      expect(
        normalizeViewerSettings({ ...base, passportTemplate }).passportTemplate,
      ).toBe("neon");
  });
});
