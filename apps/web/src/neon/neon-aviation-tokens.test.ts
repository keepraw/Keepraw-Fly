import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  deviceSnap,
  hatchTile,
  NEON_AVIATION,
  neonCssVariables,
  routeStroke,
  routeTier,
} from "./neon-aviation-tokens";

describe("Neon Aviation token helpers", () => {
  it("keeps label, airport, route, and focus contrast within accessible ranges", () => {
    const { color } = NEON_AVIATION;
    expect(
      contrastRatio(color.label, color.backgroundBottom),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(color.labelMuted, color.backgroundBottom),
    ).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(color.airport, color.ocean)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(color.routeBase, color.ocean)).toBeGreaterThanOrEqual(
      3,
    );
    expect(contrastRatio(color.focus, color.ocean)).toBeGreaterThanOrEqual(3);
  });

  it("exposes one CSS variable for every token leaf", () => {
    const leaves = flatten(NEON_AVIATION);
    const style = neonCssVariables();
    expect(Object.keys(style)).toHaveLength(leaves.length);
    expect(Object.keys(style).every((name) => name.startsWith("--neon-"))).toBe(
      true,
    );
  });

  it("keeps hatch geometry on device pixels at each DPR and zoom", () => {
    for (const dpr of [1, 1.5, 2, 3]) {
      for (const zoom of [1, 2, 6]) {
        const tile = hatchTile(NEON_AVIATION.hatch, dpr, zoom);
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
    const normal = routeStroke("base", "normal");
    const selected = routeStroke("base", "selected");
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
    for (const [name, value] of flatten(NEON_AVIATION)) {
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
