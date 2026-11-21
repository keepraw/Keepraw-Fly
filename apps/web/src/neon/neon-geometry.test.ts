import { describe, expect, it } from "vitest";
import {
  datelineCrossing,
  greatCirclePath,
  projectionAt,
  routeCenterLongitude,
  routeFrame,
} from "./neon-geometry";
import { NEON_AIRPORTS } from "./sample-network";

const byCode = new Map(NEON_AIRPORTS.map((airport) => [airport.iata, airport]));

describe("Neon sample route geometry", () => {
  it("centers TPE–LAX across the Pacific without splitting the great circle", () => {
    const origin = byCode.get("TPE")!;
    const destination = byCode.get("LAX")!;
    const center = routeCenterLongitude(origin, destination);
    expect(Math.abs(center)).toBeGreaterThan(150);
    expect(
      greatCirclePath(origin, destination, 48, center).match(/M/g),
    ).toHaveLength(1);
  });

  it("identifies date-line crossings only for routes that cross them", () => {
    expect(
      datelineCrossing(byCode.get("TPE")!, byCode.get("LAX")!),
    ).not.toBeNull();
    expect(datelineCrossing(byCode.get("PVG")!, byCode.get("CDG")!)).toBeNull();
  });

  it("fits both route endpoints in the padded view frame", () => {
    const origin = byCode.get("TPE")!;
    const destination = byCode.get("LAX")!;
    const frame = routeFrame(origin, destination, 16 / 9, 0.12);
    const projected = [origin, destination].map((point) => {
      const [x, y] = projectionAt(frame.centerLongitude)([
        point.longitude,
        point.latitude,
      ]) ?? [NaN, NaN];
      return { x, y };
    });
    for (const point of projected) {
      expect(point.x).toBeGreaterThanOrEqual(frame.x);
      expect(point.x).toBeLessThanOrEqual(frame.x + frame.width);
      expect(point.y).toBeGreaterThanOrEqual(frame.y);
      expect(point.y).toBeLessThanOrEqual(frame.y + frame.height);
    }
  });
});
