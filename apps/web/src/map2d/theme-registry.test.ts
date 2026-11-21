import { describe, expect, it } from "vitest";
import { mapThemeCssVariables } from "./theme-css";
import {
  DEFAULT_MAP_THEME_ID,
  isMapThemeId,
  listMapThemes,
  MAP_THEMES,
  resolveMapTheme,
} from "./theme-registry";
import { contrastRatio } from "./theme-style";

describe("map theme registry", () => {
  it("resolves the registered default and falls back for unknown IDs", () => {
    expect(DEFAULT_MAP_THEME_ID).toBe("neon-aviation");
    expect(resolveMapTheme(DEFAULT_MAP_THEME_ID)).toBe(
      MAP_THEMES["neon-aviation"],
    );
    expect(resolveMapTheme("unknown")).toBe(
      resolveMapTheme(DEFAULT_MAP_THEME_ID),
    );
    expect(resolveMapTheme(null)).toBe(resolveMapTheme(DEFAULT_MAP_THEME_ID));
  });

  it("recognizes only registered IDs", () => {
    expect(isMapThemeId("neon-aviation")).toBe(true);
    expect(isMapThemeId("unknown")).toBe(false);
    expect(isMapThemeId(null)).toBe(false);
  });

  it("maps every registered token leaf to a theme-neutral CSS variable", () => {
    for (const theme of listMapThemes()) {
      const leaves = flatten(theme.tokens);
      const variables = mapThemeCssVariables(theme);
      const keys = Object.keys(variables);
      expect(keys).toHaveLength(leaves.length);
      expect(keys.every((key) => key.startsWith("--map-theme-"))).toBe(true);
    }
  });

  it("keeps label and map-state contrast accessible over the bottom background", () => {
    for (const theme of listMapThemes()) {
      const { color } = theme.tokens;
      expect(
        contrastRatio(
          color.label,
          color.backgroundBottom,
          color.backgroundBottom,
        ),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(
          color.labelMuted,
          color.backgroundBottom,
          color.backgroundBottom,
        ),
      ).toBeGreaterThanOrEqual(4.5);
      for (const foreground of [
        color.routeBase,
        color.routeFrequent,
        color.routeHighlight,
        color.routeSelected,
        color.routeGlow,
        color.airport,
        color.airportHub,
        color.airportSelected,
        color.focus,
      ])
        expect(
          contrastRatio(
            foreground,
            color.backgroundBottom,
            color.backgroundBottom,
          ),
        ).toBeGreaterThanOrEqual(3);
    }
  });
});

function flatten(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) return [path];
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([key, child]) =>
      flatten(child, path ? `${path}.${key}` : key),
    );
  return [path];
}
