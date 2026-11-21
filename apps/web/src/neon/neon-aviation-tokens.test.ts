import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mapThemeCssVariables } from "../map2d/theme-css";
import { NEON_AVIATION_THEME } from "../map2d/themes/neon-aviation";
import {
  contrastRatio,
  deviceSnap,
  hatchTile,
  routeStroke,
  routeTier,
} from "../map2d/theme-style";

const { tokens } = NEON_AVIATION_THEME;

describe("Neon Aviation token helpers", () => {
  it("keeps label, airport, route, and focus contrast within accessible ranges", () => {
    const { color } = tokens;
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
  });

  it("exposes one CSS variable for every token leaf", () => {
    const leaves = flatten(tokens);
    const style = mapThemeCssVariables(NEON_AVIATION_THEME);
    expect(Object.keys(style)).toHaveLength(leaves.length);
    expect(
      Object.keys(style).every((name) => name.startsWith("--map-theme-")),
    ).toBe(true);
  });

  it("keeps hatch geometry on device pixels at each DPR and zoom", () => {
    for (const dpr of [1, 1.5, 2, 3]) {
      for (const zoom of [1, 2, 6]) {
        const tile = hatchTile(tokens.hatch, dpr, zoom);
        expect(tile.size * dpr).toBeCloseTo(Math.round(tile.size * dpr), 8);
        expect(tile.lineWidth * dpr).toBeGreaterThanOrEqual(1);
        expect(tile.lineWidth * dpr).toBeCloseTo(
          Math.round(tile.lineWidth * dpr),
          8,
        );
        expect(deviceSnap(0, dpr) * dpr).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("makes selected routes decisively stronger and tiers monotonic", () => {
    const normal = routeStroke(tokens, "base", "normal");
    const selected = routeStroke(tokens, "base", "selected");
    expect(selected.width / normal.width).toBeGreaterThanOrEqual(2);
    expect(selected.opacity - normal.opacity).toBeGreaterThanOrEqual(0.3);
    expect([0, 1, 2, 3, 5, 8, 13].map((count) => routeTier(count, 13))).toEqual(
      ["base", "base", "base", "frequent", "frequent", "frequent", "frequent"],
    );
  });

  it("keeps every documented token value synchronized with the source", () => {
    const markdown = readFileSync(
      new URL(
        "../../../../docs/neon-aviation-design-system.md",
        import.meta.url,
      ),
      "utf8",
    );
    const documented = new Map(
      [...markdown.matchAll(/^\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|$/gm)].map(
        (match) => [match[1]!, match[2]!.trim()],
      ),
    );
    for (const [name, value] of flatten(tokens)) {
      expect(documented.get(name), `${name} in design system doc`).toBe(value);
    }
  });
});

function flatten(value: unknown, path = ""): Array<[string, string]> {
  if (Array.isArray(value))
    return [[path, value.map((part) => String(part)).join(", ")]];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      flatten(child, path ? `${path}.${key}` : key),
    );
  }
  return [[path, String(value)]];
}
