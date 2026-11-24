import { describe, expect, it } from "vitest";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  antimeridianCrossing,
  flightDuration,
  flightTimeline,
  localMidnights,
  plannedActualComparison,
  zoneOffsetMinutes,
} from "../src";

function flight(overrides: Partial<KeeprawFlight> = {}): KeeprawFlight {
  return {
    id: "flight-1",
    flightNumber: "DL275",
    serviceDate: "2026-02-14",
    airline: { iata: "DL" },
    origin: { iata: "LAX" },
    destination: { iata: "HND" },
    scheduledDeparture: "2026-02-14T10:05:00-08:00",
    scheduledArrival: "2026-02-15T15:00:00+09:00",
    ...overrides,
  };
}

describe("planned versus actual comparison", () => {
  it("places both operations on one axis from the earliest time", () => {
    expect(
      plannedActualComparison(
        flight({
          actualDeparture: "2026-02-14T10:42:00-08:00",
          actualArrival: "2026-02-15T15:29:00+09:00",
        }),
      ),
    ).toEqual({
      spanMinutes: 744,
      scheduled: { startMinutes: 0, endMinutes: 715, durationMinutes: 715 },
      actual: { startMinutes: 37, endMinutes: 744, durationMinutes: 707 },
      departureDelayMinutes: 37,
      arrivalDelayMinutes: 29,
      durationDeltaMinutes: -8,
    });
  });

  it("starts the axis at an early departure", () => {
    const comparison = plannedActualComparison(
      flight({
        actualDeparture: "2026-02-14T09:55:00-08:00",
        actualArrival: "2026-02-15T14:40:00+09:00",
      }),
    );
    expect(comparison).toMatchObject({
      spanMinutes: 725,
      scheduled: { startMinutes: 10, endMinutes: 725 },
      actual: { startMinutes: 0, endMinutes: 705 },
      departureDelayMinutes: -10,
      arrivalDelayMinutes: -20,
    });
  });

  it("rounds each duration from its elapsed time, like the flight duration", () => {
    // 119 min 40 s: the ends round to 1 and 120 on the axis, 119 apart.
    const recorded = flight({
      scheduledDeparture: "2026-02-14T10:00:00-08:00",
      scheduledArrival: "2026-02-14T12:00:00-08:00",
      actualDeparture: "2026-02-14T10:00:40-08:00",
      actualArrival: "2026-02-14T12:00:20-08:00",
    });
    const comparison = plannedActualComparison(recorded)!;
    expect(comparison.actual).toEqual({
      startMinutes: 1,
      endMinutes: 120,
      durationMinutes: 120,
    });
    expect(comparison.actual.durationMinutes).toBe(
      flightDuration(recorded).minutes,
    );
    expect(comparison.durationDeltaMinutes).toBe(0);
  });

  it.each([
    ["no actual times", {}],
    ["only an actual departure", { actualDeparture: "2026-02-14T18:05:00Z" }],
    [
      "a cancelled flight",
      {
        cancelled: true,
        actualDeparture: "2026-02-14T18:05:00Z",
        actualArrival: "2026-02-15T06:00:00Z",
      },
    ],
    [
      "a diverted flight",
      {
        divertedTo: { iata: "NRT" },
        actualDeparture: "2026-02-14T18:05:00Z",
        actualArrival: "2026-02-15T06:00:00Z",
      },
    ],
    [
      "an arrival before the departure",
      {
        actualDeparture: "2026-02-15T06:00:00Z",
        actualArrival: "2026-02-14T18:05:00Z",
      },
    ],
    [
      "an unreadable time",
      { actualDeparture: "not a time", actualArrival: "2026-02-15T06:00:00Z" },
    ],
  ] as [string, Partial<KeeprawFlight>][])(
    "is null for %s",
    (_name, overrides) => {
      expect(plannedActualComparison(flight(overrides))).toBeNull();
    },
  );
});

describe("zone offsets", () => {
  it("reads fixed offsets and IANA zones at the instant", () => {
    expect(zoneOffsetMinutes(0, "+05:30")).toBe(330);
    expect(zoneOffsetMinutes(0, "-08:00")).toBe(-480);
    const winter = Date.parse("2026-01-15T12:00:00Z");
    const summer = Date.parse("2026-07-15T12:00:00Z");
    expect(zoneOffsetMinutes(winter, "America/Los_Angeles")).toBe(-480);
    expect(zoneOffsetMinutes(summer, "America/Los_Angeles")).toBe(-420);
    expect(zoneOffsetMinutes(winter, "Asia/Tokyo")).toBe(540);
    expect(zoneOffsetMinutes(winter, "Not/A_Zone")).toBeNull();
    expect(zoneOffsetMinutes(Number.NaN, "Asia/Tokyo")).toBeNull();
  });
});

describe("local midnights", () => {
  const fractions = (from: string, to: string, zone: string) =>
    localMidnights(Date.parse(from), Date.parse(to), zone);

  it("finds midnight after an offset change earlier in the evening", () => {
    // Midnight on 2 November 2026 in Los Angeles, a day after the clocks
    // went back: 08:00 UTC, not 07:00.
    expect(
      fractions(
        "2026-11-01T06:00:00Z",
        "2026-11-02T12:00:00Z",
        "America/Los_Angeles",
      ),
    ).toEqual([1 / 30, 26 / 30]);
  });

  it("marks the change itself when the clocks skip midnight", () => {
    // Havana goes from 00:00 to 01:00 on 8 March 2026 (05:00 UTC), so the
    // day starts there and 23:00 the evening before is not a midnight.
    expect(
      fractions(
        "2026-03-08T03:00:00Z",
        "2026-03-08T09:00:00Z",
        "America/Havana",
      ),
    ).toEqual([1 / 3]);
  });
});

describe("antimeridian crossing", () => {
  const lax = { latitude: 33.9425, longitude: -118.408 };
  const hnd = { latitude: 35.5523, longitude: 139.7797 };
  const lhr = { latitude: 51.4706, longitude: -0.4619 };

  it("finds where a Pacific route meets the 180° meridian", () => {
    const westbound = antimeridianCrossing(lax, hnd)!;
    expect(westbound).toBeGreaterThan(0.5);
    expect(westbound).toBeLessThan(0.75);
    // The same point seen from the other end.
    expect(antimeridianCrossing(hnd, lax)!).toBeCloseTo(1 - westbound, 6);
  });

  it("is null when the shorter way stays on one side", () => {
    expect(antimeridianCrossing(lax, lhr)).toBeNull();
    expect(antimeridianCrossing(lhr, hnd)).toBeNull();
    expect(antimeridianCrossing(lax, lax)).toBeNull();
    expect(
      antimeridianCrossing(lax, { latitude: Number.NaN, longitude: 0 }),
    ).toBeNull();
  });
});

describe("two-clock timeline", () => {
  it("shows a Pacific crossing on both clocks with the date line", () => {
    const timeline = flightTimeline(flight())!;
    expect(timeline.durationMinutes).toBe(715);
    expect(timeline.origin).toMatchObject({
      iata: "LAX",
      departureDayOffset: 0,
      arrivalDayOffset: 0,
      midnights: [],
    });
    expect(timeline.destination).toMatchObject({
      iata: "HND",
      departureDayOffset: 1,
      arrivalDayOffset: 1,
      midnights: [],
    });
    expect(timeline.dateLineFraction).toBeGreaterThan(0.5);
    expect(timeline.dateLineFraction).toBeLessThan(0.75);
  });

  it("marks the midnights each clock passes", () => {
    // 22:00 in Los Angeles to 05:00+2 in Tokyo, eleven hours later.
    const timeline = flightTimeline(
      flight({
        scheduledDeparture: "2026-02-14T22:00:00-08:00",
        scheduledArrival: "2026-02-16T02:00:00+09:00",
      }),
    )!;
    expect(timeline.durationMinutes).toBe(660);
    expect(timeline.origin.arrivalDayOffset).toBe(1);
    expect(timeline.origin.midnights).toHaveLength(1);
    expect(timeline.origin.midnights[0]).toBeCloseTo(120 / 660, 6);
    expect(timeline.destination.departureDayOffset).toBe(1);
    expect(timeline.destination.arrivalDayOffset).toBe(2);
    expect(timeline.destination.midnights[0]).toBeCloseTo(540 / 660, 6);
  });

  it("uses the actual times when they are recorded", () => {
    const timeline = flightTimeline(
      flight({
        actualDeparture: "2026-02-14T10:42:00-08:00",
        actualArrival: "2026-02-15T15:29:00+09:00",
      }),
    )!;
    expect(timeline.departure).toBe("2026-02-14T10:42:00-08:00");
    expect(timeline.arrival).toBe("2026-02-15T15:29:00+09:00");
    expect(timeline.durationMinutes).toBe(707);
  });

  it("has no date line for a route that stays on one side", () => {
    const timeline = flightTimeline(
      flight({
        origin: { iata: "LHR" },
        destination: { iata: "JFK" },
        scheduledDeparture: "2026-02-14T11:00:00Z",
        scheduledArrival: "2026-02-14T19:00:00Z",
      }),
    )!;
    expect(timeline.dateLineFraction).toBeNull();
    expect(timeline.origin.timezone).toBe("Europe/London");
    expect(timeline.destination.timezone).toBe("America/New_York");
  });

  it.each([
    ["a cancelled flight", { cancelled: true }],
    [
      "airports that keep the same clock",
      {
        origin: { iata: "SFO" },
        destination: { iata: "LAX" },
        scheduledDeparture: "2026-02-14T18:00:00Z",
        scheduledArrival: "2026-02-14T19:30:00Z",
      },
    ],
    [
      "an arrival that is not after the departure",
      { scheduledArrival: "2026-02-14T10:05:00-08:00" },
    ],
    ["an unreadable time", { scheduledArrival: "not a time" }],
    ["an airport without a known zone", { origin: { iata: "ZZZ" } }],
  ] as [string, Partial<KeeprawFlight>][])(
    "is null for %s",
    (_name, overrides) => {
      expect(flightTimeline(flight(overrides))).toBeNull();
    },
  );
});
