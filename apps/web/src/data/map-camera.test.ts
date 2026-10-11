import { describe, expect, it } from "vitest";
import type { RoutePoint } from "@keepraw-fly/core";
import {
  fitProjectedPoints,
  passportMapCamera,
  WORLD_CAMERA,
} from "./map-camera";
import { greatCirclePath } from "./map-geometry";

const SZX: RoutePoint = { iata: "SZX", latitude: 22.6393, longitude: 113.8107 };
const TAO: RoutePoint = { iata: "TAO", latitude: 36.2661, longitude: 120.3744 };
const HKG: RoutePoint = { iata: "HKG", latitude: 22.308, longitude: 113.9185 };
const SFO: RoutePoint = { iata: "SFO", latitude: 37.6213, longitude: -122.379 };
const NRT: RoutePoint = { iata: "NRT", latitude: 35.772, longitude: 140.3929 };
const LAX: RoutePoint = {
  iata: "LAX",
  latitude: 33.9416,
  longitude: -118.4085,
};

describe("map camera", () => {
  it("keeps global airports and routes inside a short Passport stage", () => {
    for (const height of [260, 320, 480]) {
      const camera = passportMapCamera(
        [{ origin: NRT, destination: LAX, flightCount: 1 }],
        [NRT, LAX],
        height,
      );
      expect(camera.zoom).toBeLessThan(1);
      expect(camera.zoom * 480).toBeLessThanOrEqual(height * 0.9 + 0.1);
      expect(camera.centerX).toBe(480);
      expect(camera.centerY).toBe(240);
    }
  });
  it("keeps regional passport framing restrained", () => {
    const routes = [
      { origin: SZX, destination: TAO, flightCount: 2 },
      { origin: HKG, destination: SZX, flightCount: 1 },
    ];
    const camera = passportMapCamera(routes, [SZX, TAO, HKG]);

    expect(camera.zoom).toBeGreaterThan(1);
    expect(camera.zoom).toBeGreaterThan(2.5);
    expect(camera.zoom).toBeLessThanOrEqual(8);
  });

  it("retains a regional center when fit zoom is just above world scale", () => {
    const camera = fitProjectedPoints(
      [
        { x: 120, y: 60 },
        { x: 780, y: 396 },
      ],
      { maxZoom: 8, padding: 0.14 },
    );
    expect(camera.zoom).toBeGreaterThan(1);
    expect(camera.centerX).toBe(450);
  });

  it.each([
    [HKG, SFO],
    [NRT, LAX],
  ])(
    "splits Passport geometry when a route crosses the antimeridian",
    (origin, destination) => {
      const path = greatCirclePath(origin, destination);

      expect(path.match(/M/g)?.length).toBeGreaterThan(1);
    },
  );

  it("handles one point and global coverage without invalid cameras", () => {
    const onePoint = fitProjectedPoints([{ x: 700, y: 220 }], {
      maxZoom: 2.5,
      padding: 0.14,
    });
    const global = fitProjectedPoints(
      [
        { x: 12, y: 22 },
        { x: 948, y: 24 },
        { x: 18, y: 458 },
        { x: 942, y: 456 },
        { x: 480, y: 240 },
      ],
      { maxZoom: 2.5, padding: 0.14 },
    );

    expect(Number.isFinite(onePoint.centerX)).toBe(true);
    expect(onePoint.zoom).toBe(2.5);
    expect(global).toEqual(WORLD_CAMERA);
  });
});
