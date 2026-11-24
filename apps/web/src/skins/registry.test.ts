import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isMapThemeId } from "../map2d/theme-registry";
import { PRIMARY_VIEWS } from "../routing";
import { isPosterTemplateId } from "../share/poster-template-ids";
import {
  DEFAULT_SKIN_ID,
  isSkinId,
  resolveSkin,
  SKIN_IDS,
  SKINS,
  skinAppearance,
  skinHasAppearanceChoice,
  skinMapTheme,
  type SkinDefinition,
} from "./registry";

const lightOnly: SkinDefinition = {
  id: "light-only",
  labelKey: "settings.skinOption.minimal",
  appearances: ["light"],
  landingView: "stats",
  mapTheme: { light: "daylight-chart" },
  passportTemplate: "book",
};

describe("skin registry", () => {
  it("registers skins that only name known views, themes and layouts", () => {
    expect(SKIN_IDS).toContain(DEFAULT_SKIN_ID);
    for (const id of SKIN_IDS) {
      const skin: SkinDefinition = SKINS[id];
      expect(skin.id).toBe(id);
      expect(skin.appearances.length).toBeGreaterThan(0);
      expect(PRIMARY_VIEWS).toContain(skin.landingView);
      for (const appearance of skin.appearances)
        expect(isMapThemeId(skin.mapTheme[appearance])).toBe(true);
      expect(isPosterTemplateId(skin.passportTemplate)).toBe(true);
    }
  });

  it("defines minimal as the contract describes it", () => {
    expect(SKINS.minimal).toMatchObject({
      appearances: ["light", "dark"],
      landingView: "log",
      mapTheme: { light: "daylight-chart", dark: "graphite-chart" },
      passportTemplate: "neon",
    });
  });

  it("defines aviation as the contract describes it, and as the default", () => {
    expect(DEFAULT_SKIN_ID).toBe("aviation");
    expect(SKINS.aviation).toMatchObject({
      appearances: ["dark"],
      landingView: "map",
      mapTheme: { dark: "neon-aviation" },
      passportTemplate: "neon",
    });
  });

  it.each([
    undefined,
    null,
    "",
    "classic",
    "aviation-2",
    7,
    "toString",
    "__proto__",
  ])("falls back to the default for %s", (stored) => {
    expect(isSkinId(stored)).toBe(false);
    expect(resolveSkin(stored).id).toBe(DEFAULT_SKIN_ID);
  });

  it("constrains the appearance to what the skin draws", () => {
    expect(skinAppearance(SKINS.minimal, "light")).toBe("light");
    expect(skinAppearance(SKINS.minimal, "dark")).toBe("dark");
    expect(skinHasAppearanceChoice(SKINS.minimal)).toBe(true);
    expect(skinAppearance(SKINS.aviation, "light")).toBe("dark");
    expect(skinHasAppearanceChoice(SKINS.aviation)).toBe(false);
    expect(skinAppearance(lightOnly, "dark")).toBe("light");
  });

  it("lets every skin own its map theme and passport layout", () => {
    expect(skinMapTheme(SKINS.minimal, "light")).toBe("daylight-chart");
    expect(skinMapTheme(SKINS.minimal, "dark")).toBe("graphite-chart");
    expect(skinMapTheme(SKINS.aviation, "light")).toBe("neon-aviation");
    expect(skinMapTheme(lightOnly, "dark")).toBe("daylight-chart");
    expect(SKINS.minimal.passportTemplate).toBe("neon");
  });
});

describe("first-paint skin table", () => {
  it("mirrors the registry", () => {
    const script = readFileSync(
      new URL("../../public/theme-init.js", import.meta.url),
      "utf8",
    );
    const table = /const SKIN_APPEARANCES = (\{[^;]*\});/.exec(script)?.[1];
    expect(table).toBeDefined();
    const parsed = JSON.parse(
      table!.replace(/(\w+):/g, '"$1":').replace(/,(\s*[}\]])/g, "$1"),
    ) as Record<string, string[]>;
    expect(parsed).toEqual(
      Object.fromEntries(
        SKIN_IDS.map((id) => [id, [...SKINS[id].appearances]]),
      ),
    );
    expect(script).toContain(`SKIN_APPEARANCES.${DEFAULT_SKIN_ID}`);
    const html = readFileSync(
      new URL("../../index.html", import.meta.url),
      "utf8",
    );
    expect(html).toContain(`data-skin="${DEFAULT_SKIN_ID}"`);
  });
});
