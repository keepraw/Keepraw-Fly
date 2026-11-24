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
  skinPassportTemplate,
  type SkinDefinition,
} from "./registry";

const darkOnly: SkinDefinition = {
  id: "dark-only",
  labelKey: "settings.skinOption.minimal",
  appearances: ["dark"],
  landingView: "map",
  mapTheme: { dark: "neon-aviation" },
  passportTemplate: "neon",
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
        if (skin.mapTheme)
          expect(isMapThemeId(skin.mapTheme[appearance])).toBe(true);
      if (skin.passportTemplate)
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

  it.each([undefined, null, "", "aviation-2", 7, "toString", "__proto__"])(
    "falls back to the default for %s",
    (stored) => {
      expect(isSkinId(stored)).toBe(false);
      expect(resolveSkin(stored).id).toBe(DEFAULT_SKIN_ID);
    },
  );

  it("constrains the appearance to what the skin draws", () => {
    expect(skinAppearance(SKINS.minimal, "light")).toBe("light");
    expect(skinAppearance(SKINS.minimal, "dark")).toBe("dark");
    expect(skinHasAppearanceChoice(SKINS.minimal)).toBe(true);
    expect(skinAppearance(darkOnly, "light")).toBe("dark");
    expect(skinHasAppearanceChoice(darkOnly)).toBe(false);
  });

  it("lets a skin own the map theme and the passport layout", () => {
    expect(skinMapTheme(SKINS.minimal, "light", "neon-aviation")).toBe(
      "daylight-chart",
    );
    expect(skinMapTheme(SKINS.minimal, "dark", "daylight-chart")).toBe(
      "graphite-chart",
    );
    expect(skinMapTheme(darkOnly, "light", "daylight-chart")).toBe(
      "neon-aviation",
    );
    expect(skinPassportTemplate(SKINS.minimal, "book")).toBe("neon");
  });

  it("keeps the stored choices for the transitional classic skin only", () => {
    expect(skinMapTheme(SKINS.classic, "dark", "daylight-chart")).toBe(
      "daylight-chart",
    );
    expect(skinPassportTemplate(SKINS.classic, "book")).toBe("book");
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
