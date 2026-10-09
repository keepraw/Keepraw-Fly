import { describe, expect, it } from "vitest";
import type { RoutePoint, RouteSegment } from "@keepraw-fly/core";
import {
  defaultGlobeView,
  dot,
  geographicPoint,
  globeAirports,
  interpolateSphere,
  routeArc,
  selectedRouteView,
  spherePoint,
  visibleFrom,
} from "./globe-math";
const airport = (
  iata: string,
  latitude: number,
  longitude: number,
): RoutePoint => ({ iata, latitude, longitude });
const SFO = airport("SFO", 37.62, -122.38),
  LAX = airport("LAX", 33.94, -118.41),
  JFK = airport("JFK", 40.64, -73.78);
const PVG = airport("PVG", 31.14, 121.8),
  HKG = airport("HKG", 22.3, 113.92),
  NRT = airport("NRT", 35.76, 140.39),
  SYD = airport("SYD", -33.95, 151.18);
const route = (
  origin: RoutePoint,
  destination: RoutePoint,
  flightCount = 1,
): RouteSegment => ({ origin, destination, flightCount });
describe("globe geodesy", () => {
  it("roundtrips geographic coordinates including poles and the date line", () => {
    for (const point of [
      SFO,
      PVG,
      SYD,
      airport("E", 0, 180),
      airport("N", 90, 20),
      airport("S", -90, -55),
    ]) {
      const v = spherePoint(point),
        back = geographicPoint(v);
      expect(Math.hypot(...v)).toBeCloseTo(1, 10);
      expect(back.latitude).toBeCloseTo(point.latitude, 8);
      if (Math.abs(point.latitude) < 90)
        expect(Math.abs(back.longitude - point.longitude) % 360).toBeCloseTo(
          0,
          8,
        );
    }
    expect(spherePoint(airport("G", 0, 0))).toEqual([1, 0, -0]);
  });
  it("takes the short path over ±180, retaining both endpoints and bounded altitude", () => {
    const r = route(airport("A", 10, 179), airport("B", 10, -179)),
      arc = routeArc(r);
    const midpoint = geographicPoint(arc[48]!);
    expect(Math.abs(midpoint.longitude)).toBeCloseTo(180, 6);
    expect(Math.hypot(...arc[48]!)).toBeLessThan(1.04);
    expect(dot(arc[0]!, spherePoint(r.origin))).toBeCloseTo(1.002, 8);
    expect(dot(arc[96]!, spherePoint(r.destination))).toBeCloseTo(1.002, 8);
  });
  it("has finite coincident, antipodal and polar arcs", () => {
    for (const r of [
      route(PVG, PVG),
      route(airport("A", 0, 0), airport("B", 0, 180)),
      route(airport("A", 80, 170), airport("B", 80, -170)),
    ]) {
      expect(
        routeArc(r).every(
          (p) =>
            p.every(Number.isFinite) &&
            Math.hypot(...p) >= 1.001 &&
            Math.hypot(...p) < 1.13,
        ),
      ).toBe(true);
    }
    expect(
      Math.hypot(...interpolateSphere(spherePoint(PVG), spherePoint(PVG), 0.5)),
    ).toBeCloseTo(1);
  });
  it("occludes back-side points and arcs but permits clear elevated horizon points", () => {
    expect(visibleFrom([0, 0, 1.005], [0, 0, 3])).toBe(true);
    expect(visibleFrom([0, 0, -1.1], [0, 0, 3])).toBe(false);
    expect(visibleFrom([1.12, 0, 0], [0, 0, 3])).toBe(true);
    expect(visibleFrom([1, 0, 0], [0, 0, 3])).toBe(false);
  });
  it("retains directed frequency and combines airport visits", () => {
    const airports = globeAirports([route(PVG, HKG, 3), route(HKG, PVG, 2)]);
    expect(airports.map((a) => a.flightCount)).toEqual([5, 5]);
  });
});
describe("intelligent globe camera", () => {
  it("faces dense Asia despite a sparse North American outlier", () => {
    const view = defaultGlobeView([
      route(PVG, HKG, 12),
      route(HKG, NRT, 7),
      route(SFO, JFK),
    ]);
    expect(dot(view.direction, spherePoint(PVG))).toBeGreaterThan(0.8);
    expect(dot(view.direction, spherePoint(HKG))).toBeGreaterThan(0.8);
  });
  it("faces dense North America instead of assuming Asia", () => {
    const view = defaultGlobeView([
      route(SFO, LAX, 12),
      route(SFO, JFK, 8),
      route(PVG, HKG),
    ]);
    expect(dot(view.direction, spherePoint(SFO))).toBeGreaterThan(0.75);
    expect(dot(view.direction, spherePoint(JFK))).toBeGreaterThan(0.65);
  });
  it("is deterministic for globally dispersed routes and permutation invariant", () => {
    const routes = [
      route(SFO, JFK),
      route(PVG, HKG),
      route(HKG, SYD),
      route(JFK, airport("LHR", 51.47, -0.45)),
    ];
    expect(defaultGlobeView(routes)).toEqual(
      defaultGlobeView([...routes].reverse()),
    );
    expect(Math.hypot(...defaultGlobeView(routes).direction)).toBeCloseTo(
      1,
      10,
    );
  });
  it("faces the Pacific for date-line activity and a transpacific selection", () => {
    const r = route(airport("A", 20, 175), airport("B", 30, -175), 6);
    expect(
      Math.abs(geographicPoint(defaultGlobeView([r]).direction).longitude),
    ).toBeGreaterThan(160);
    const view = selectedRouteView(route(SFO, NRT));
    for (const p of [SFO, NRT])
      expect(dot(view.direction, spherePoint(p))).toBeGreaterThan(
        1 / view.distance,
      );
  });
  it("supports one flight, empty data, and southern hemisphere activity", () => {
    expect(defaultGlobeView([]).distance).toBeGreaterThan(2);
    const single = defaultGlobeView([route(SFO, LAX)]);
    expect(dot(single.direction, spherePoint(SFO))).toBeGreaterThan(0.9);
    const south = defaultGlobeView([route(SYD, airport("AKL", -37, 174.8), 8)]);
    expect(geographicPoint(south.direction).latitude).toBeLessThan(-25);
  });
});
