import { describe, expect, it } from "vitest";
import type { RoutePoint } from "@keepraw-fly/core";
import {
  datelineCrossing,
  projectedRoute,
  routeCenterLongitude,
  routeFrame,
} from "./geometry";

const airports: Record<string, RoutePoint> = {
  TPE: {
    iata: "TPE",
    latitude: 25.0797,
    longitude: 121.2342,
  },
  LAX: {
    iata: "LAX",
    latitude: 33.9416,
    longitude: -118.4085,
  },
  JFK: { iata: "JFK", latitude: 40.6413, longitude: -73.7781 },
  HKG: { iata: "HKG", latitude: 22.308, longitude: 113.9185 },
  MFM: { iata: "MFM", latitude: 22.1496, longitude: 113.591 },
};

describe("map2d route geometry", () => {
  it("splits TPE–LAX at the world seam and fits it without a split when centered", () => {
    const origin = airports.TPE!;
    const destination = airports.LAX!;
    expect(projectedRoute(origin, destination, 0)).toHaveLength(2);
    const center = routeCenterLongitude(origin, destination);
    expect(projectedRoute(origin, destination, center)).toHaveLength(1);
    expect(datelineCrossing(origin, destination)).not.toBeNull();
  });

  it("samples finite polar JFK–HKG points in route order", () => {
    const route = projectedRoute(
      airports.JFK!,
      airports.HKG!,
      routeCenterLongitude(airports.JFK!, airports.HKG!),
      96,
    );
    const points = route.flat();
    expect(points).toHaveLength(97);
    expect(
      points.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)),
    ).toBe(true);
    expect(points[0]).not.toEqual(points.at(-1));
  });

  it("keeps a short HKG–MFM route as a finite line with distinct points", () => {
    const route = projectedRoute(
      airports.HKG!,
      airports.MFM!,
      routeCenterLongitude(airports.HKG!, airports.MFM!),
    );
    expect(route).toHaveLength(1);
    expect(route[0]!.length).toBeGreaterThanOrEqual(2);
    expect(
      new Set(route[0]!.map(({ x, y }) => `${x},${y}`)).size,
    ).toBeGreaterThan(1);
    expect(datelineCrossing(airports.HKG!, airports.MFM!)).toBeNull();
  });

  it("frames every sampled route point", () => {
    const origin = airports.TPE!;
    const destination = airports.LAX!;
    const frame = routeFrame(origin, destination, 16 / 9, 0.12);
    const points = projectedRoute(
      origin,
      destination,
      frame.centerLongitude,
      96,
    ).flat();
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(frame.x);
      expect(point.x).toBeLessThanOrEqual(frame.x + frame.width);
      expect(point.y).toBeGreaterThanOrEqual(frame.y);
      expect(point.y).toBeLessThanOrEqual(frame.y + frame.height);
    }
  });
});
