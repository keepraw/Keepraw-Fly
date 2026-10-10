import { describe, expect, it } from "vitest";
import {
  FIXED_SUN_DIRECTION,
  msUntilNextUtcMinute,
  solarDirectionFromUtc,
  solarSubpointFromUtc,
} from "./globe-solar";
import { solarRegion } from "./globe-lighting";
import { geographicPoint, spherePoint } from "./globe-math";

describe("fixed solar baseline", () => {
  it("preserves the historical Demo sun independent of camera and data", () => {
    expect([...FIXED_SUN_DIRECTION]).toEqual([
      -0.2926889023874383, 0.290121517531001, 0.9111326530669097,
    ]);
    expect(Math.hypot(...FIXED_SUN_DIRECTION)).toBeCloseTo(1, 12);
  });

  it("is deterministic for the same instant and stable across repeated reads", () => {
    const instant = new Date("2026-06-21T12:00:00.000Z");
    expect(solarDirectionFromUtc(instant)).toEqual(
      solarDirectionFromUtc(new Date("2026-06-21T12:00:00.000Z")),
    );
    expect([...FIXED_SUN_DIRECTION]).toEqual([...FIXED_SUN_DIRECTION]);
  });
});

describe("real-time solar direction from the UTC clock", () => {
  it("places the March equinox near the equator at midday UTC", () => {
    const subpoint = solarSubpointFromUtc(new Date("2026-03-20T12:00:00Z"));
    expect(Math.abs(subpoint.latitude)).toBeLessThan(0.6);
    expect(Math.abs(subpoint.longitude)).toBeLessThan(3);
  });

  it("places solstices near opposite tropics", () => {
    const june = solarSubpointFromUtc(new Date("2026-06-21T12:00:00Z"));
    const december = solarSubpointFromUtc(new Date("2026-12-21T12:00:00Z"));
    expect(june.latitude).toBeCloseTo(23.44, 0);
    expect(december.latitude).toBeCloseTo(-23.44, 0);
    expect(june.latitude).toBeGreaterThan(22.5);
    expect(december.latitude).toBeLessThan(-22.5);
  });

  it("rotates daily while keeping seasonal declination", () => {
    const midnight = solarSubpointFromUtc(new Date("2026-06-21T00:00:00Z"));
    const midday = solarSubpointFromUtc(new Date("2026-06-21T12:00:00Z"));
    expect(Math.abs(midnight.latitude - midday.latitude)).toBeLessThan(0.6);
    const delta = Math.abs(midnight.longitude - midday.longitude);
    expect(Math.min(delta, 360 - delta)).toBeCloseTo(180, -1);
  });

  it("treats the clock as an absolute UTC instant, not local wall time", () => {
    const iso = new Date("2026-09-22T06:00:00.000Z");
    const epoch = new Date(Date.UTC(2026, 8, 22, 6, 0, 0));
    expect(iso.getTime()).toBe(epoch.getTime());
    expect(solarDirectionFromUtc(iso)).toEqual(solarDirectionFromUtc(epoch));
    expect(
      solarDirectionFromUtc(new Date("2026-09-22T06:01:00.000Z")),
    ).not.toEqual(solarDirectionFromUtc(iso));
  });

  it("returns unit directions consistent with the shared sphere mapping", () => {
    for (const iso of [
      "2026-03-20T12:00:00Z",
      "2026-06-21T00:00:00Z",
      "2026-12-21T18:00:00Z",
    ]) {
      const direction = solarDirectionFromUtc(new Date(iso));
      expect(Math.hypot(...direction)).toBeCloseTo(1, 12);
      const back = geographicPoint(direction);
      const roundtrip = spherePoint(back);
      roundtrip.forEach((value, axis) =>
        expect(value).toBeCloseTo(direction[axis]!, 8),
      );
    }
  });
});

describe("shared solar geography across themes", () => {
  it("classifies the same day/night regions for Light and Dark at one instant", () => {
    const sun = solarDirectionFromUtc(new Date("2026-06-21T12:00:00Z"));
    // solarRegion has no theme input by contract; the same sun must drive
    // both themes. Recompute per theme call to guard against divergence.
    const lightDay = solarRegion(sun, sun);
    const darkDay = solarRegion(sun, sun);
    expect(lightDay).toEqual(darkDay);
    expect(lightDay.region).toBe("day");
    const antisun = sun.map((value) => -value) as unknown as Parameters<
      typeof solarRegion
    >[0];
    expect(solarRegion(antisun, sun).region).toBe("night");
    expect(solarRegion(antisun, sun)).toEqual(solarRegion(antisun, sun));
  });
});

describe("minute update cadence", () => {
  it("schedules the next UTC minute boundary without continuous polling", () => {
    expect(msUntilNextUtcMinute(new Date("2026-10-10T12:00:30.000Z"))).toBe(
      30000,
    );
    expect(msUntilNextUtcMinute(new Date("2026-10-10T12:00:00.000Z"))).toBe(
      60000,
    );
    for (const iso of [
      "2026-10-10T00:00:00.123Z",
      "2026-06-21T12:34:56.789Z",
      "2026-12-21T23:59:59.999Z",
    ]) {
      const delay = msUntilNextUtcMinute(new Date(iso));
      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThanOrEqual(60000);
    }
  });
});
