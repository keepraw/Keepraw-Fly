import { describe, expect, it } from "vitest";
import { routeVisuals } from "./map-route-visuals";

describe("route frequency visuals", () => {
  it("keeps a single flight visible and makes eight flights distinctly stronger", () => {
    const single = routeVisuals(1);
    const frequent = routeVisuals(8);
    expect(single.width).toBeGreaterThanOrEqual(2);
    expect(single.strength).toBeGreaterThanOrEqual(80);
    expect(frequent.width / single.width).toBeGreaterThan(1.7);
    expect(frequent.strength - single.strength).toBeGreaterThan(10);
  });

  it("increases both encodings with frequency and caps dense routes", () => {
    const counts = [1, 2, 3, 4, 8, 16];
    for (let index = 1; index < counts.length; index++) {
      expect(routeVisuals(counts[index]!).width).toBeGreaterThan(routeVisuals(counts[index - 1]!).width);
      expect(routeVisuals(counts[index]!).strength).toBeGreaterThan(routeVisuals(counts[index - 1]!).strength);
    }
    expect(routeVisuals(1_000)).toEqual(routeVisuals(16));
    expect(routeVisuals(1_000).width).toBeLessThanOrEqual(4.4);
    expect(routeVisuals(1_000).strength).toBeLessThanOrEqual(100);
  });
});
