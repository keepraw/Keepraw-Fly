import { describe, expect, it } from "vitest";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  explorePassportFlights,
  initialPassportView,
  passportVisibleFlights,
} from "./passport-exploration";

describe("passport exploration", () => {
  it("shares period, search and exploration filtering with detail navigation", () => {
    expect(
      passportVisibleFlights(flights, {
        ...initialPassportView,
        year: 2026,
      }).map((f) => f.id),
    ).toEqual(["recent"]);
    expect(
      passportVisibleFlights(flights, {
        ...initialPassportView,
        airline: "UA",
      }).map((f) => f.id),
    ).toEqual(["recent", "first"]);
    expect(
      passportVisibleFlights(flights, {
        ...initialPassportView,
        query: "UA123",
      }).map((f) => f.id),
    ).toEqual(["first"]);
    expect(
      passportVisibleFlights(flights, {
        ...initialPassportView,
        year: 2025,
        airline: "UA",
      }),
    ).toEqual([]);
  });

  it("combines airline, aircraft type and selection, then applies the order", () => {
    const typed = flights.map((flight) =>
      flight.id === "return"
        ? flight
        : {
            ...flight,
            extensions: {
              "keepraw-fly.aircraft": {
                type: flight.id === "first" ? "B738" : "A320",
              },
            },
          },
    );
    const ids = (view: Partial<typeof initialPassportView>) =>
      passportVisibleFlights(typed, { ...initialPassportView, ...view }).map(
        (flight) => flight.id,
      );
    expect(ids({ aircraft: "A320" })).toEqual(["recent"]);
    expect(ids({ airline: "UA", aircraft: "B738" })).toEqual(["first"]);
    expect(ids({ airline: "AA", aircraft: "B738" })).toEqual([]);
    expect(
      ids({ airline: "UA", selection: { kind: "airport", code: "LAX" } }),
    ).toEqual(["recent", "first"]);
    expect(ids({ sort: "oldest" })).toEqual(["first", "return", "recent"]);
    expect(ids({ airline: "UA", sort: "oldest" })).toEqual(["first", "recent"]);
  });
  it("collects an airport's arrivals and departures once per flight", () => {
    const result = explorePassportFlights(flights, {
      kind: "airport",
      code: "SFO",
    });

    expect(result?.flights.map((flight) => flight.id)).toEqual([
      "recent",
      "return",
      "first",
    ]);
    expect(result?.firstServiceDate).toBe("2024-04-03");
    expect(result?.lastServiceDate).toBe("2026-08-19");
  });

  it("keeps opposite directions as separate route histories", () => {
    const outbound = explorePassportFlights(flights, {
      kind: "route",
      origin: "SFO",
      destination: "LAX",
    });
    const inbound = explorePassportFlights(flights, {
      kind: "route",
      origin: "LAX",
      destination: "SFO",
    });

    expect(outbound?.flights.map((flight) => flight.id)).toEqual([
      "recent",
      "first",
    ]);
    expect(inbound?.flights.map((flight) => flight.id)).toEqual(["return"]);
  });

  it("returns no exploration for a value absent from the selected period", () => {
    expect(
      explorePassportFlights(flights, { kind: "airport", code: "JFK" }),
    ).toBeUndefined();
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
