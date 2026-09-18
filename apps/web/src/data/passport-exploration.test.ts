import { describe, expect, it } from "vitest";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import { explorePassportFlights } from "./passport-exploration";

describe("passport exploration", () => {
  it("collects an airport's arrivals and departures once per flight", () => {
    const result = explorePassportFlights(flights, { kind: "airport", code: "SFO" });

    expect(result?.flights.map((flight) => flight.id)).toEqual(["recent", "return", "first"]);
    expect(result?.firstServiceDate).toBe("2024-04-03");
    expect(result?.lastServiceDate).toBe("2026-08-19");
  });

  it("uses the stored airline identity without inferring a carrier", () => {
    const result = explorePassportFlights(flights, { kind: "airline", code: "UA" });

    expect(result?.flights.map((flight) => flight.id)).toEqual(["recent", "first"]);
  });

  it("keeps opposite directions as separate route histories", () => {
    const outbound = explorePassportFlights(flights, { kind: "route", origin: "SFO", destination: "LAX" });
    const inbound = explorePassportFlights(flights, { kind: "route", origin: "LAX", destination: "SFO" });

    expect(outbound?.flights.map((flight) => flight.id)).toEqual(["recent", "first"]);
    expect(inbound?.flights.map((flight) => flight.id)).toEqual(["return"]);
  });

  it("returns no exploration for a value absent from the selected period", () => {
    expect(explorePassportFlights(flights, { kind: "airport", code: "JFK" })).toBeUndefined();
  });
});

const flights: KeeprawFlight[] = [
  {
    id: "first",
    flightNumber: "UA123",
    serviceDate: "2024-04-03",
    airline: { iata: "UA" },
    origin: { iata: "SFO" },
    destination: { iata: "LAX" },
    scheduledDeparture: "2024-04-03T09:00:00-07:00",
    scheduledArrival: "2024-04-03T10:30:00-07:00",
  },
  {
    id: "return",
    flightNumber: "AA178",
    serviceDate: "2025-02-07",
    airline: { iata: "AA" },
    origin: { iata: "LAX" },
    destination: { iata: "SFO" },
    scheduledDeparture: "2025-02-07T14:00:00-08:00",
    scheduledArrival: "2025-02-07T15:30:00-08:00",
  },
  {
    id: "recent",
    flightNumber: "UA456",
    serviceDate: "2026-08-19",
    airline: { iata: "UA" },
    origin: { iata: "SFO" },
    destination: { iata: "LAX" },
    scheduledDeparture: "2026-08-19T11:00:00-07:00",
    scheduledArrival: "2026-08-19T12:30:00-07:00",
  },
];
