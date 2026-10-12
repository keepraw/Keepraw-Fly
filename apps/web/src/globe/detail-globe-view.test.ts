import { describe, expect, it } from "vitest";
import { detailGlobeView } from "./detail-globe-view";
import { projectGlobePoint, routeArc } from "./globe-math";

describe("single-flight composition", () => {
  for (const [name, a, b] of [
    ["short", [37.62, -122.38], [33.94, -118.41]],
    ["long", [22.3, 113.92], [19.09, 72.87]],
    ["date line", [20, 179], [30, -179]],
    ["polar", [85, 90], [85, -90]],
    ["polar long haul", [0.1, 0], [0.1, 180]],
    ["asymmetric polar", [79, 25], [85, -158]],
    ["antipodal", [0, 0], [0, 180]],
    ["near antipodal", [37.62, -122.38], [-37.61, 57.61]],
    ["same airport", [0, 0], [0, 0]],
  ] as const) {
    it(`keeps the ${name} arc visible inside margins across Detail aspects`, () => {
      const route = {
        origin: { iata: "AAA", latitude: a[0], longitude: a[1] },
        destination: { iata: "BBB", latitude: b[0], longitude: b[1] },
        flightCount: 1,
      };
      for (const viewport of [
        { width: 280, height: 432 },
        { width: 480, height: 480 },
        { width: 430, height: 368 },
        { width: 670, height: 432 },
        { width: 1240, height: 440 },
      ]) {
        const view = detailGlobeView(route, viewport);
        expect(view).toEqual(detailGlobeView(route, viewport));
        expect(view.direction.every(Number.isFinite)).toBe(true);
        expect(view.distance).toBeGreaterThan(2);
        expect(view.distance).toBeLessThan(40);
        expect(view.fov).toBeGreaterThan(1);
        expect(view.fov).toBeLessThan(90);
        const shortSideRatio =
          1 /
          (Math.sqrt(view.distance ** 2 - 1) *
            Math.tan((view.fov! * Math.PI) / 360) *
            Math.min(1, viewport.width / viewport.height));
        expect(shortSideRatio).toBeLessThan(1);
        // Verify the full physical atmosphere silhouette fits, not just the
        // route or the earth's centre. This catches a clipped default/Home view.
        const atmosphereRatio =
          1.026 /
          (Math.sqrt(view.distance ** 2 - 1.026 ** 2) *
            Math.tan((view.fov! * Math.PI) / 360) *
            Math.min(1, viewport.width / viewport.height));
        expect(atmosphereRatio).toBeLessThanOrEqual(0.97);
        if (name === "short" || name === "same airport")
          expect(shortSideRatio).toBeGreaterThanOrEqual(0.9);
        for (const point of routeArc(route)) {
          const p = projectGlobePoint(point, view, viewport);
          expect(p.visible).toBe(true);
          expect(p.x).toBeGreaterThanOrEqual(0.16);
          expect(p.x).toBeLessThanOrEqual(0.84);
          expect(p.y).toBeGreaterThanOrEqual(0.16);
          expect(p.y).toBeLessThanOrEqual(0.84);
        }
      }
    });
  }
});
