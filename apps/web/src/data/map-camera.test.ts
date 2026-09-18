import { describe, expect, it } from "vitest";
import type { RoutePoint } from "@keepraw-fly/core";
import {
  fitProjectedPoints,
  flightRouteCamera,
  passportMapCamera,
  WORLD_CAMERA,
} from "./map-camera";
import { greatCirclePath } from "./map-geometry";

const SZX: RoutePoint = { iata: "SZX", latitude: 22.6393, longitude: 113.8107 };
const TAO: RoutePoint = { iata: "TAO", latitude: 36.2661, longitude: 120.3744 };
const HKG: RoutePoint = { iata: "HKG", latitude: 22.308, longitude: 113.9185 };
const LHR: RoutePoint = { iata: "LHR", latitude: 51.47, longitude: -0.4543 };
const SFO: RoutePoint = { iata: "SFO", latitude: 37.6213, longitude: -122.379 };
const NRT: RoutePoint = { iata: "NRT", latitude: 35.772, longitude: 140.3929 };
const LAX: RoutePoint = { iata: "LAX", latitude: 33.9416, longitude: -118.4085 };

describe("map camera", () => {
  it("keeps regional passport framing restrained", () => {
    const routes = [
      { origin: SZX, destination: TAO, flightCount: 2 },
      { origin: HKG, destination: SZX, flightCount: 1 },
    ];
    const camera = passportMapCamera(routes, [SZX, TAO, HKG]);

    expect(camera.zoom).toBeGreaterThan(1);
    expect(camera.zoom).toBeLessThanOrEqual(2.5);
  });

  it("frames a short flight more tightly than a passport", () => {
    const detail = flightRouteCamera(SZX, TAO);
    const passport = passportMapCamera(
      [{ origin: SZX, destination: TAO, flightCount: 1 }],
      [SZX, TAO],
    );

    expect(detail.zoom).toBeGreaterThan(passport.zoom);
    expect(detail.zoom).toBeLessThanOrEqual(7.5);
  });

  it("fits a long-haul route with surrounding geography", () => {
    const camera = flightRouteCamera(HKG, LHR);

    expect(camera.zoom).toBeGreaterThan(1);
    expect(camera.zoom).toBeLessThan(4);
  });

  it.each([
    [HKG, SFO],
    [NRT, LAX],
  ])("keeps the fixed world camera when a route crosses the antimeridian", (origin, destination) => {
    const camera = flightRouteCamera(origin, destination);
    const path = greatCirclePath(origin, destination);

    expect(camera).toEqual(WORLD_CAMERA);
    expect(path.match(/M/g)?.length).toBeGreaterThan(1);
  });

  it("handles one point and global coverage without invalid cameras", () => {
    const onePoint = fitProjectedPoints([{ x: 700, y: 220 }], { maxZoom: 2.5, padding: 0.14 });
    const global = fitProjectedPoints([
      { x: 12, y: 22 },
      { x: 948, y: 24 },
      { x: 18, y: 458 },
      { x: 942, y: 456 },
      { x: 480, y: 240 },
    ], { maxZoom: 2.5, padding: 0.14 });

    expect(Number.isFinite(onePoint.centerX)).toBe(true);
    expect(onePoint.zoom).toBe(2.5);
    expect(global).toEqual(WORLD_CAMERA);
  });
});
