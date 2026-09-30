import { describe, expect, it } from "vitest";
import {
  greatCirclePath,
  greatCircleMidpoint,
  projectPoint,
  regionalCenterLongitude,
  regionalWorldPaths,
  WORLD_COUNTRIES,
  WORLD_GRATICULE_PATH,
  WORLD_HEIGHT,
  WORLD_LAND_PATH,
  WORLD_SPHERE_PATH,
  WORLD_WIDTH,
} from "./map-geometry";

describe("passport map geometry", () => {
  it("centers regional geography without collapsing a northeast route into a meridian", () => {
    const origin = { latitude: 22.6393, longitude: 113.8107 };
    const destination = { latitude: 36.2661, longitude: 120.3744 };
    const center = regionalCenterLongitude([origin, destination]);
    const start = projectPoint(origin, center);
    const end = projectPoint(destination, center);
    expect(end.x - start.x).toBeGreaterThan(Math.abs(end.y - start.y) * 0.25);
    const paths = regionalWorldPaths(center);
    expect(paths.countries).toHaveLength(WORLD_COUNTRIES.length);
    expect(paths.countries.find(country => country.code === "CN")?.path).not.toBe(WORLD_COUNTRIES.find(country => country.code === "CN")?.path);
    const antarctica = paths.countries.find(country => country.code === "AQ")!.path;
    const numbers = antarctica.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    const ys = numbers.filter((_, index) => index % 2 === 1);
    expect(Math.min(...ys)).toBeGreaterThan(400);
    expect(regionalCenterLongitude([{ latitude: 30, longitude: -122 }, { latitude: 35, longitude: 140 }])).toBe(0);
  });
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

  it("projects the spherical midpoint of a route", () => {
    const midpoint = greatCircleMidpoint(
      { iata: "SFO", latitude: 37.6213, longitude: -122.379 },
      { iata: "HND", latitude: 35.5494, longitude: 139.7798 },
    );
    expect(midpoint.x).toBeGreaterThan(0);
    expect(midpoint.y).toBeGreaterThan(0);
  });

  it("bundles detailed generated globe geometry", () => {
    expect(WORLD_SPHERE_PATH.length).toBeGreaterThan(500);
    expect(WORLD_GRATICULE_PATH.length).toBeGreaterThan(10_000);
    expect(WORLD_LAND_PATH.length).toBeGreaterThan(50_000);
    expect(WORLD_COUNTRIES.length).toBeGreaterThan(170);
    expect(WORLD_COUNTRIES.find((country) => country.code === "CN")?.path.length).toBeGreaterThan(100);
  });
});
