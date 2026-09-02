import type { KeeprawFlight } from "@keepraw-fly/schema";
import { describe, expect, it } from "vitest";
import {
  airportByIata,
  aircraftFacts,
  buildRouteSegments,
  calculateYearStatistics,
  calculatePassportStatistics,
  departureDelayMinutes,
  distanceKilometers,
  formatTimeAtAirport,
  formatDuration,
  flightDuration,
  groupFlightsByYear,
  searchFlights,
} from "../src";

const flight: KeeprawFlight = {
  id: "ua123",
  flightNumber: "UA123",
  serviceDate: "2026-08-19",
  airline: { iata: "UA" },
  origin: { iata: "SFO" },
  destination: { iata: "LAX" },
  scheduledDeparture: "2026-08-19T10:20:00-07:00",
  scheduledArrival: "2026-08-19T11:52:00-07:00",
  actualDeparture: "2026-08-19T10:57:00-07:00",
  actualArrival: "2026-08-19T12:21:00-07:00",
  extensions: {
    "keepraw-fly.aircraft": { type: "B789", registration: "N12345" },
  },
};

describe("flight calculations", () => {
  it("derives delay and actual duration from offset datetimes", () => {
    expect(departureDelayMinutes(flight)).toBe(37);
    expect(flightDuration(flight)).toEqual({ minutes: 84, source: "actual" });
  });

  it("falls back to scheduled duration when actual times are incomplete", () => {
    expect(flightDuration({ ...flight, actualArrival: undefined })).toEqual({
      minutes: 92,
      source: "scheduled",
    });
  });

  it("uses reference coordinates for great-circle distance", () => {
    const sfo = airportByIata.get("SFO")!;
    const lax = airportByIata.get("LAX")!;
    expect(Math.round(distanceKilometers(sfo, lax))).toBe(544);
  });

  it("formats the stored instant in airport-local time", () => {
    expect(
      formatTimeAtAirport(flight.scheduledDeparture, "SFO", "en", "24-hour"),
    ).toBe("10:20");
  });

  it("formats duration without coupling it to distance units", () => {
    expect(formatDuration(84, "en")).toBe("1h 24m");
    expect(formatDuration(84, "zh-CN")).toBe("1小时 24分");
  });

  it("reads known UI facts without disturbing the extension map", () => {
    expect(aircraftFacts(flight)).toEqual({
      type: "B789",
      registration: "N12345",
    });
    expect(flight.extensions?.["keepraw-fly.aircraft"]).toEqual({
      type: "B789",
      registration: "N12345",
    });
  });
});

describe("search and grouping", () => {
  const tokyoFlights: KeeprawFlight[] = [
    {
      ...flight,
      id: "nrt-flight",
      flightNumber: "JL58",
      airline: { iata: "JL" },
      origin: { iata: "NRT" },
      destination: { iata: "SFO" },
    },
    {
      ...flight,
      id: "hnd-flight",
      flightNumber: "NH107",
      airline: { iata: "NH" },
      origin: { iata: "LAX" },
      destination: { iata: "HND" },
    },
  ];
  const flights = [flight, ...tokyoFlights];

  it.each([
    ["UA123", ["ua123"]],
    ["UA", ["ua123"]],
    ["United", ["ua123"]],
    ["美国联合航空", ["ua123"]],
    ["LAX", ["ua123", "hnd-flight"]],
    ["Los Angeles International Airport", ["ua123", "hnd-flight"]],
    ["洛杉矶", ["ua123", "hnd-flight"]],
    ["2026", ["ua123", "nrt-flight", "hnd-flight"]],
    ["B789", ["ua123", "nrt-flight", "hnd-flight"]],
    ["N12345", ["ua123", "nrt-flight", "hnd-flight"]],
  ] as const)("matches %s in core", (query, expectedIds) => {
    expect(searchFlights(flights, query).map((item) => item.id)).toEqual(expectedIds);
  });

  it.each(["Tokyo", "东京"])("finds both Tokyo airports for %s", (query) => {
    expect(searchFlights(flights, query).map((item) => item.id)).toEqual([
      "nrt-flight",
      "hnd-flight",
    ]);
  });

  it("normalizes full-width user input and supports multiple terms", () => {
    expect(searchFlights(flights, "ＵＡ１２３ SFO").map((item) => item.id)).toEqual([
      "ua123",
    ]);
  });

  it("sorts year groups newest first", () => {
    const older = { ...flight, id: "older", serviceDate: "2025-01-02" };
    expect(groupFlightsByYear([older, flight]).map((group) => group.year)).toEqual([
      "2026",
      "2025",
    ]);
  });
});

describe("passport statistics", () => {
  it("derives aggregate facts without storing them", () => {
    const stats = calculatePassportStatistics([flight]);
    expect(stats.flights).toBe(1);
    expect(stats.durationMinutes).toBe(84);
    expect(Math.round(stats.distanceKilometers)).toBe(544);
    expect(stats.airports).toBe(2);
    expect(stats.countries).toBe(1);
    expect(stats.mostFlownAirline).toEqual({ code: "UA", count: 1 });
    expect(stats.aircraftTypes).toBe(1);
  });

  it("builds yearly summaries and map-ready route interfaces", () => {
    const older = { ...flight, id: "older", serviceDate: "2025-01-02" };
    expect(calculateYearStatistics([flight, older]).map((item) => item.year)).toEqual([
      2026,
      2025,
    ]);
    expect(buildRouteSegments([flight, { ...flight, id: "second" }])).toEqual([
      expect.objectContaining({
        origin: expect.objectContaining({ iata: "SFO" }),
        destination: expect.objectContaining({ iata: "LAX" }),
        flightCount: 2,
      }),
    ]);
  });
});
