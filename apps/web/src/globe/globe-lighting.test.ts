import { describe, expect, it } from "vitest";
import {
  globeSunDirection,
  solarRegion,
  twilightReviewView,
} from "./globe-lighting";
import {
  geographicPoint,
  normalize,
  cross,
  spherePoint,
  type Vec3,
} from "./globe-math";

describe("world solar contract", () => {
  const home: Vec3 = normalize([
    -1.1462179214868498, 0.5012782172755569, -1.6866845067609426,
  ]);
  const sun = globeSunDirection(home);
  const direction = sun.toArray() as unknown as Vec3;
  const horizon = normalize(cross(direction, [0, 1, 0]));
  it("keeps the historical world sun and a terminator-centered review camera", () => {
    expect(direction[0]).toBeCloseTo(-0.2926889023874383, 12);
    expect(direction[1]).toBeCloseTo(0.290121517531001, 12);
    expect(direction[2]).toBeCloseTo(0.9111326530669097, 12);
    const review = twilightReviewView(sun, home);
    expect(solarRegion(review.direction, direction).cosine).toBeCloseTo(0, 12);
    expect(review.distance).toBe(3.6);
  });
  it("classifies actual geographic points without theme or art inputs", () => {
    const cases = [
      [direction, "day"],
      [horizon, "twilight"],
      [direction.map((v) => -v) as unknown as Vec3, "night"],
    ] as const;
    for (const [normal, expected] of cases) {
      const geographic = geographicPoint(normal);
      const sample = spherePoint(geographic);
      const solar = solarRegion(sample, direction);
      expect(solar.region).toBe(expected);
      if (expected === "day") {
        expect(solar.day).toBe(1);
        expect(solar.night).toBe(0);
      }
      if (expected === "twilight") {
        expect(solar.twilight).toBeCloseTo(1, 12);
      }
      if (expected === "night") {
        expect(solar.day).toBe(0);
        expect(solar.night).toBe(1);
      }
    }
  });
  it("transitions smoothly around the horizon rather than midday", () => {
    expect(solarRegion(horizon, direction).twilight).toBeCloseTo(1, 12);
    expect(solarRegion(direction, direction).twilight).toBe(0);
    expect(
      solarRegion(direction.map((v) => -v) as unknown as Vec3, direction)
        .twilight,
    ).toBe(0);
  });
});
