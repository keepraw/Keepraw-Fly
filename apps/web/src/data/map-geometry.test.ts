import { describe, expect, it } from "vitest";
import {
  greatCirclePath,
  projectPoint,
  WORLD_GRATICULE_PATH,
  WORLD_HEIGHT,
  WORLD_LAND_PATH,
  WORLD_SPHERE_PATH,
  WORLD_WIDTH,
} from "./map-geometry";

describe("passport map geometry", () => {
  it("projects geographic coordinates onto the world canvas", () => {
    expect(projectPoint({ latitude: 0, longitude: 0 })).toEqual({
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT / 2,
    });
  });

  it("draws a curved great-circle path between airports", () => {
    const path = greatCirclePath(
      { iata: "PVG", latitude: 31.1443, longitude: 121.8083 },
      { iata: "LHR", latitude: 51.47, longitude: -0.4543 },
      8,
    );
    expect(path.startsWith("M")).toBe(true);
    expect(path.match(/L/g)?.length).toBeGreaterThan(8);
  });

  it("splits paths that cross the international date line", () => {
    const path = greatCirclePath(
      { iata: "SFO", latitude: 37.6213, longitude: -122.379 },
      { iata: "HND", latitude: 35.5494, longitude: 139.7798 },
      20,
    );
    expect(path.match(/M/g)?.length).toBe(2);
  });

  it("bundles detailed generated globe geometry", () => {
    expect(WORLD_SPHERE_PATH.length).toBeGreaterThan(500);
    expect(WORLD_GRATICULE_PATH.length).toBeGreaterThan(10_000);
    expect(WORLD_LAND_PATH.length).toBeGreaterThan(50_000);
  });
});
