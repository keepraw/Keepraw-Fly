import { describe, expect, it } from "vitest";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  buildRouteSegments,
  calculatePassportStatistics,
  flightDuration,
  flightTimeDisplay,
  formatDuration,
  localCalendarDayOffset,
} from "../src";

const flight: KeeprawFlight = {
  id: "zh9911",
  flightNumber: "ZH9911",
  serviceDate: "2026-09-21",
  airline: { iata: "ZH" },
  origin: { iata: "SZX" },
  destination: { iata: "TAO" },
  scheduledDeparture: "2026-09-21T20:45:00+08:00",
  actualDeparture: "2026-09-21T20:56:00+08:00",
  scheduledArrival: "2026-09-22T00:05:00+08:00",
  actualArrival: "2026-09-21T23:30:00+08:00",
};

describe("shared flight time display", () => {
  it.each([
    ["LHR", "HND", "2025-01-01T11:00:00Z", "2025-01-01T23:30:00Z", "08:30", 1],
    ["HND", "HNL", "2025-01-01T15:30:00Z", "2025-01-01T22:30:00Z", "12:30", -1],
    ["LHR", "HND", "2025-01-01T11:00:00Z", "2025-01-02T23:30:00Z", "08:30", 2],
  ])(
    "marks %s → %s by the displayed local dates",
    (origin, destination, departure, arrival, time, dayOffset) => {
      const times = flightTimeDisplay(
        {
          ...flight,
          serviceDate: departure.slice(0, 10),
          origin: { iata: origin },
          destination: { iata: destination },
          scheduledDeparture: departure,
          scheduledArrival: arrival,
          actualDeparture: undefined,
          actualArrival: undefined,
        },
        "en",
        "24-hour",
      );
      expect(times.arrival.primary).toMatchObject({ time, dayOffset });
      expect(times.scheduled.arrival.dayOffset).toBe(dayOffset);
      expect(times.overnight).toBe(dayOffset > 0);
    },
  );

  it("uses the diversion's own clock and date while retaining the planned date", () => {
    const times = flightTimeDisplay(
      {
        ...flight,
        serviceDate: "2025-01-01",
        origin: { iata: "LHR" },
        destination: { iata: "HND" },
        divertedTo: { iata: "HNL" },
        scheduledDeparture: "2025-01-01T11:00:00Z",
        scheduledArrival: "2025-01-01T23:30:00Z",
        actualDeparture: undefined,
        actualArrival: "2025-01-02T00:30:00Z",
      },
      "en",
      "24-hour",
    );
    expect(times.arrival.primary).toMatchObject({
      time: "14:30",
      dayOffset: 0,
    });
    expect(times.scheduled.arrival).toMatchObject({
      time: "08:30",
      dayOffset: 1,
    });
  });

  it("uses the written offset dates when the airport zones are undetermined", () => {
    const times = flightTimeDisplay(
      {
        ...flight,
        serviceDate: "2025-01-02",
        origin: { iata: "XXQ" },
        destination: { iata: "XXJ" },
        scheduledDeparture: "2025-01-02T00:30:00+09:00",
        scheduledArrival: "2025-01-01T12:30:00-10:00",
        actualDeparture: undefined,
        actualArrival: undefined,
      },
      "en",
      "24-hour",
    );
    expect(times.departure.primary.time).toBe("00:30");
    expect(times.arrival.primary).toMatchObject({
      time: "12:30",
      dayOffset: -1,
    });
  });

  it("does not turn an invalid instant into a duration, delay or displayed time", () => {
    const invalid = "2016-12-31T23:59:60Z";
    const broken = {
      ...flight,
      scheduledArrival: invalid,
      actualArrival: invalid,
    };
    const times = flightTimeDisplay(broken, "en", "24-hour");
    expect(times.arrival.primary).toMatchObject({ time: "—", dayOffset: 0 });
    expect(times.arrival.delayMinutes).toBeNull();
    expect(flightDuration(broken).minutes).toBeNull();
    expect(formatDuration(flightDuration(broken).minutes)).toBe("—");
    expect(calculatePassportStatistics([flight, broken]).durationMinutes).toBe(
      154,
    );
    expect(flightDuration({ ...flight, actualArrival: invalid })).toEqual({
      minutes: 200,
      source: "scheduled",
    });
  });

  it("pairs actual with scheduled and compares offset instants for delay", () => {
    const times = flightTimeDisplay(flight, "zh-CN", "24-hour");
    expect(times.departure.primary).toMatchObject({
      time: "20:56",
      source: "actual",
      dayOffset: 0,
    });
    expect(times.departure.scheduled).toMatchObject({
      time: "20:45",
      source: "scheduled",
    });
    expect(times.departure.delayMinutes).toBe(11);
    expect(times.arrival.primary).toMatchObject({
      time: "23:30",
      dayOffset: 0,
    });
    expect(times.arrival.scheduled).toMatchObject({
      time: "00:05",
      dayOffset: 1,
      timestamp: flight.scheduledArrival,
    });
    expect(times.arrival.delayMinutes).toBe(-35);
    expect(times.overnight).toBe(false);
    expect(flightDuration(flight)).toEqual({ minutes: 154, source: "actual" });
  });
  it("marks 23:28 to next-day 06:50 and falls back to scheduled times", () => {
    const times = flightTimeDisplay(
      {
        ...flight,
        actualDeparture: undefined,
        actualArrival: undefined,
        scheduledDeparture: "2026-09-21T23:28:00+08:00",
        scheduledArrival: "2026-09-22T06:50:00+08:00",
      },
      "en",
      "24-hour",
    );
    expect(times.departure.primary.source).toBe("scheduled");
    expect(times.arrival.primary).toMatchObject({
      time: "06:50",
      source: "scheduled",
      dayOffset: 1,
    });
    expect(times.arrival.scheduled).toBeUndefined();
    expect(times.overnight).toBe(true);
  });
  it("uses local calendar days across offsets while preserving elapsed arithmetic", () => {
    const zoned: KeeprawFlight = {
      ...flight,
      origin: { iata: "HKG" },
      destination: { iata: "LHR" },
      scheduledDeparture: "2026-09-21T23:28:00+08:00",
      actualDeparture: "2026-09-21T23:28:00+08:00",
      scheduledArrival: "2026-09-22T06:50:00+01:00",
      actualArrival: "2026-09-22T06:15:00+01:00",
    };
    expect(
      flightTimeDisplay(zoned, "en", "24-hour").arrival.primary.dayOffset,
    ).toBe(1);
    expect(flightTimeDisplay(zoned, "en", "24-hour").arrival.delayMinutes).toBe(
      -35,
    );
    expect(flightDuration(zoned).minutes).toBe(827);
    expect(
      localCalendarDayOffset(
        "2026-09-21T23:00:00-07:00",
        "2026-09-22T08:00:00+01:00",
      ),
    ).toBe(1);
    expect(
      localCalendarDayOffset(
        "2026-09-21T01:00:00+08:00",
        "2026-09-20T19:00:00-07:00",
      ),
    ).toBe(-1);
  });
  it("omits redundant scheduled instants and handles partial actuals", () => {
    const times = flightTimeDisplay(
      {
        ...flight,
        actualDeparture: "2026-09-21T12:45:00Z",
        actualArrival: undefined,
      },
      "en",
      "24-hour",
    );
    expect(times.departure.scheduled).toBeUndefined();
    expect(times.departure.delayMinutes).toBe(0);
    expect(times.arrival.primary.source).toBe("scheduled");
    expect(flightDuration({ ...flight, actualArrival: undefined }).source).toBe(
      "scheduled",
    );
  });
  it("keeps the planned day offset when the actual departure moves past midnight", () => {
    const times = flightTimeDisplay(
      {
        ...flight,
        actualDeparture: "2026-09-22T00:01:00+08:00",
        actualArrival: flight.scheduledArrival,
      },
      "en",
      "24-hour",
    );
    expect(times.arrival.primary.dayOffset).toBe(0);
    expect(times.arrival.scheduled).toBeUndefined();
    expect(times.scheduled.arrival.dayOffset).toBe(1);
    expect(times.scheduled.arrival.source).toBe("scheduled");
  });
});
describe("passport arrival-delay and aircraft accounting", () => {
  it("maps only flown routes and uses the recorded diversion endpoint", () => {
    const routes = buildRouteSegments([
      { ...flight, cancelled: true },
      { ...flight, divertedTo: { iata: "PEK" } },
    ]);
    expect(routes).toHaveLength(1);
    expect(routes[0]?.destination.iata).toBe("PEK");
  });
  it("adds positive arrival delays without subtracting early arrivals or cancellations/diversions", () => {
    const late = {
      ...flight,
      id: "late",
      actualArrival: "2026-09-22T00:16:00+08:00",
    };
    expect(calculatePassportStatistics([flight, late]).totalDelayMinutes).toBe(
      11,
    );
    expect(calculatePassportStatistics([flight]).totalDelayMinutes).toBe(0);
    expect(
      calculatePassportStatistics([
        { ...late, cancelled: true },
        { ...late, divertedTo: { iata: "PEK" } },
      ]).totalDelayMinutes,
    ).toBeNull();
  });
  it("counts stored types, ignoring registrations and retaining subtype distinctions", () => {
    const withAircraft = (type: string, registration: string) => ({
      ...flight,
      extensions: { "keepraw-fly.aircraft": { type, registration } },
    });
    expect(
      calculatePassportStatistics([
        withAircraft("737-8", "B5379"),
        withAircraft("737-8", "B1234"),
        withAircraft("737-8 AL", "B5678"),
      ]).aircraftTypes,
    ).toBe(2);
  });
});
