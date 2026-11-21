import { describe, expect, it } from "vitest";
import {
  installAirportDirectory,
  resolveAirportAtDate,
  type CompactAirportRow,
  type RoutePoint,
} from "@keepraw-fly/core";
import airportRows from "@keepraw-fly/core/airport-directory";
import { regionalAirportCodes } from "../../../../tests/fixtures/scale-archives";
import {
  fitProjectedPoints,
  passportMapCamera,
  WORLD_CAMERA,
} from "./map-camera";
import {
  greatCirclePath,
  projectPoint,
  regionalCenterLongitude,
  sampleGreatCircle,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./map-geometry";

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

  it("fits all 150,976 samples from 3,080 directed regional routes", () => {
    installAirportDirectory(airportRows as CompactAirportRow[]);
    const airports = regionalAirportCodes.map((iata) => {
      const airport = resolveAirportAtDate(iata, "2025-03-01").airport;
      if (!airport) throw new Error(`Missing coordinates for ${iata}`);
      return { iata, latitude: airport.latitude, longitude: airport.longitude };
    });
    const routes = airports.flatMap((origin) =>
      airports
        .filter((destination) => origin !== destination)
        .map((destination) => ({ origin, destination, flightCount: 1 })),
    );
    expect(airports).toHaveLength(56);
    expect(routes).toHaveLength(3_080);
    const camera = passportMapCamera(routes, airports);
    const center = regionalCenterLongitude(airports);
    const points = [
      ...airports.map((point) => projectPoint(point, center)),
      ...routes.flatMap(({ origin, destination }) =>
        sampleGreatCircle(origin, destination, 48, center),
      ),
    ];
    expect(points).toHaveLength(150_976);
    expect(camera.zoom).toBeGreaterThan(1);
    expect(camera.zoom).toBeLessThanOrEqual(6);
    const horizontalLimit = WORLD_WIDTH * (0.5 - 0.16) + 1e-9;
    const verticalLimit = WORLD_HEIGHT * (0.5 - 0.16) + 1e-9;
    expect(
      points.every(
        ({ x, y }) =>
          Math.abs(x - camera.centerX) * camera.zoom <= horizontalLimit &&
          Math.abs(y - camera.centerY) * camera.zoom <= verticalLimit,
      ),
    ).toBe(true);
  });

  it("handles empty, nonfinite and extreme finite coordinates", () => {
    const fit = { maxZoom: 6, padding: 0.16 };
    expect(fitProjectedPoints([], fit)).toBe(WORLD_CAMERA);
    expect(fitProjectedPoints([{ x: NaN, y: 0 }], fit)).toBe(WORLD_CAMERA);
    const extreme = { x: Number.MAX_VALUE, y: -Number.MAX_VALUE };
    expect(fitProjectedPoints([extreme], fit)).toEqual({
      centerX: extreme.x,
      centerY: extreme.y,
      zoom: 6,
    });
  });
});
