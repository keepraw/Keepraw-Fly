import { describe, expect, it } from "vitest";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  groupFlightsByYear,
  sortFlights,
  sortFlightsNewestFirst,
} from "../src/sorting";

function flight(id: string, scheduledDeparture: string): KeeprawFlight {
  return {
    id,
    flightNumber: "UA123",
    airline: { iata: "UA" },
    serviceDate: scheduledDeparture.slice(0, 10),
    origin: { iata: "SFO" },
    destination: { iata: "LAX" },
    scheduledDeparture,
    scheduledArrival: new Date(
      Date.parse(scheduledDeparture) + 3_600_000,
    ).toISOString(),
  };
}

describe("newest-first flight sorting", () => {
  it("orders the same service date by UTC instants, not offset strings", () => {
    const flights = [
      flight("A", "2026-09-01T10:00:00+09:00"),
      flight("B", "2026-09-01T09:00:00Z"),
    ];
    expect(sortFlightsNewestFirst(flights).map(({ id }) => id)).toEqual([
      "B",
      "A",
    ]);
    expect(flights.map(({ id }) => id)).toEqual(["A", "B"]);
  });

  it("keeps equal instants stable regardless of their offset representation", () => {
    const flights = [
      flight("first", "2026-09-01T01:00:00Z"),
      flight("second", "2026-09-01T10:00:00+09:00"),
      flight("third", "2026-09-01T02:00:00+01:00"),
    ];
    expect(sortFlightsNewestFirst(flights)).toEqual(flights);
    expect(sortFlightsNewestFirst([...flights].reverse())).toEqual(
      [...flights].reverse(),
    );
    expect(groupFlightsByYear(flights)[0]?.flights).toEqual(flights);
  });

  it("sorts several timezones within a date while keeping service date primary", () => {
    const flights = [
      flight("tokyo", "2026-09-01T10:00:00+09:00"),
      flight("previous-date", "2026-08-31T23:30:00-12:00"),
      flight("utc", "2026-09-01T09:00:00Z"),
      flight("los-angeles", "2026-09-01T04:00:00-07:00"),
      flight("next-date", "2026-09-02T00:00:00+14:00"),
    ];
    expect(sortFlightsNewestFirst(flights).map(({ id }) => id)).toEqual([
      "next-date",
      "los-angeles",
      "utc",
      "tokyo",
      "previous-date",
    ]);
    expect(groupFlightsByYear(flights)[0]?.flights).toEqual(
      sortFlightsNewestFirst(flights),
    );
  });
});

describe("selectable flight orders", () => {
  const route = (
    id: string,
    departure: string,
    origin: string,
    destination: string,
  ): KeeprawFlight => ({
    ...flight(id, departure),
    origin: { iata: origin },
    destination: { iata: destination },
  });
  const flights = [
    route("short-old", "2024-03-01T09:00:00Z", "SFO", "LAX"),
    route("long", "2025-06-01T09:00:00Z", "LAX", "SYD"),
    route("unknown", "2025-07-01T09:00:00Z", "ZZX", "ZZY"),
    route("short-new", "2026-01-01T09:00:00Z", "SFO", "LAX"),
    route("medium", "2026-02-01T09:00:00Z", "SFO", "JFK"),
  ];
  const ids = (order: Parameters<typeof sortFlights>[1]) =>
    sortFlights(flights, order).map(({ id }) => id);

  it("orders by date in both directions without changing the input", () => {
    expect(ids("newest")).toEqual([
      "medium",
      "short-new",
      "unknown",
      "long",
      "short-old",
    ]);
    expect(ids("oldest")).toEqual([
      "short-old",
      "long",
      "unknown",
      "short-new",
      "medium",
    ]);
    expect(flights[0]!.id).toBe("short-old");
  });

  it("orders by distance, newest first on ties and undetermined distances last", () => {
    expect(ids("longest")).toEqual([
      "long",
      "medium",
      "short-new",
      "short-old",
      "unknown",
    ]);
    expect(ids("shortest")).toEqual([
      "short-new",
      "short-old",
      "medium",
      "long",
      "unknown",
    ]);
  });

  it("lists cancelled flights with the undetermined distances", () => {
    const cancelled = {
      ...route("cancelled", "2026-03-01T09:00:00Z", "LAX", "SYD"),
      cancelled: true,
    };
    const order = (direction: "longest" | "shortest") =>
      sortFlights([cancelled, ...flights], direction).map(({ id }) => id);
    expect(order("longest").slice(-2)).toEqual(["cancelled", "unknown"]);
    expect(order("shortest").slice(-2)).toEqual(["cancelled", "unknown"]);
    expect(order("longest")[0]).toBe("long");
  });

  it("groups years oldest first on request", () => {
    expect(
      groupFlightsByYear(flights, "oldest").map(({ year, flights }) => [
        year,
        flights.map(({ id }) => id),
      ]),
    ).toEqual([
      ["2024", ["short-old"]],
      ["2025", ["long", "unknown"]],
      ["2026", ["short-new", "medium"]],
    ]);
  });
});
