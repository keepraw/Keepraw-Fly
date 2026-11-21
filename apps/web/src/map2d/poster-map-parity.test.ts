import { geoDistance, geoInterpolate } from "d3-geo";
import { describe, expect, it } from "vitest";
import { projectionAt, WORLD_WIDTH } from "../data/map-geometry";
import {
  framePoint,
  posterMapFrame,
  routePolylines,
  type PosterMapFrame,
} from "../share/poster-map";
import type { ShareGeoPoint } from "../share/share-model";
import { projectedRoute } from "./geometry";

const routes: Array<[string, ShareGeoPoint, ShareGeoPoint]> = [
  [
    "TPE–LAX",
    { latitude: 25.0797, longitude: 121.2342 },
    { latitude: 33.9416, longitude: -118.4085 },
  ],
  [
    "JFK–HKG polar",
    { latitude: 40.6413, longitude: -73.7781 },
    { latitude: 22.308, longitude: 113.9185 },
  ],
  [
    "SYD–SCL",
    { latitude: -33.9399, longitude: 151.1753 },
    { latitude: -33.393, longitude: -70.7858 },
  ],
  [
    "HKG–MFM short",
    { latitude: 22.308, longitude: 113.9185 },
    { latitude: 22.1496, longitude: 113.591 },
  ],
  [
    "same point",
    { latitude: 22.308, longitude: 113.9185 },
    { latitude: 22.308, longitude: 113.9185 },
  ],
];

describe("poster-map route geometry parity", () => {
  it("matches the frozen routePolylines implementation across the route matrix", () => {
    for (const [name, from, to] of routes) {
      const frame = posterMapFrame(
        { x: 15, y: 25, width: 880, height: 660 },
        0,
      );
      const frozen = frozenRoutePolylines(frame, from, to);
      const current = routePolylines(frame, from, to);
      expect(JSON.stringify(current), `${name} poster baseline`).toBe(
        JSON.stringify(frozen),
      );
      const degrees =
        (geoDistance(
          [from.longitude, from.latitude],
          [to.longitude, to.latitude],
        ) *
          180) /
        Math.PI;
      const steps = Math.max(12, Math.ceil(degrees / 1.5));
      const shared = projectedRoute(
        { iata: "", ...from },
        { iata: "", ...to },
        frame.centerLongitude,
        steps,
      ).map((segment) => segment.map((point) => framePoint(frame, point)));
      expect(JSON.stringify(shared), `${name} shared geometry`).toBe(
        JSON.stringify(frozen),
      );
    }
  });
});

function frozenRoutePolylines(
  frame: PosterMapFrame,
  from: ShareGeoPoint,
  to: ShareGeoPoint,
): Array<Array<{ x: number; y: number }>> {
  const a: [number, number] = [from.longitude, from.latitude];
  const b: [number, number] = [to.longitude, to.latitude];
  const degrees = (geoDistance(a, b) * 180) / Math.PI;
  const steps = Math.max(12, Math.ceil(degrees / 1.5));
  const interpolate = geoInterpolate(a, b);
  const projection = projectionAt(frame.centerLongitude);
  const lines: Array<Array<{ x: number; y: number }>> = [[]];
  let previous: [number, number] | null = null;
  for (let index = 0; index <= steps; index += 1) {
    const projected = projection(interpolate(index / steps));
    if (!projected) continue;
    if (previous && Math.abs(projected[0] - previous[0]) > WORLD_WIDTH * 0.4)
      lines.push([]);
    lines[lines.length - 1]!.push(
      framePoint(frame, { x: projected[0], y: projected[1] }),
    );
    previous = projected;
  }
  return lines.filter((line) => line.length > 1);
}
