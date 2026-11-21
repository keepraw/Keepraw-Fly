import { describe, expect, it } from "vitest";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import { groupFlightsByYear, sortFlightsNewestFirst } from "../src/sorting";

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
