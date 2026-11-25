import { describe, expect, it } from "vitest";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  cabinDistribution,
  flightContext,
  flightsPerMonth,
  longestArrivalDelay,
  mostFlownRoute,
  rankAircraftTypes,
  rankAirlines,
  rankAirports,
} from "../src";

let sequence = 0;
function flight(overrides: Partial<KeeprawFlight> = {}): KeeprawFlight {
  sequence += 1;
  return {
    id: `flight-${sequence}`,
    flightNumber: "CX123",
    serviceDate: "2026-01-01",
    airline: { iata: "CX" },
    origin: { iata: "HKG" },
    destination: { iata: "LHR" },
    scheduledDeparture: "2026-01-01T10:00:00Z",
    scheduledArrival: "2026-01-01T22:00:00Z",
    ...overrides,
  };
}

const aircraft = (type: string) => ({ "keepraw-fly.aircraft": { type } });
const cabin = (value: string) => ({ "keepraw-fly.seat": { cabin: value } });

describe("ranked airlines, aircraft types and airports", () => {
  const flights = [
    flight({ extensions: aircraft("A359") }),
    flight({ extensions: aircraft("A359") }),
    flight({ airline: { iata: "BA" }, extensions: aircraft("B789") }),
    flight({ airline: { icao: "KLM" } }),
    flight({ airline: { iata: "BA" }, cancelled: true }),
  ];

  it("counts flown flights, most frequent first, then by code", () => {
    expect(rankAirlines(flights)).toEqual([
      { code: "CX", count: 2 },
      { code: "BA", count: 1 },
      { code: "KL", count: 1 },
    ]);
  });

  it("counts cancelled flights only on request", () => {
    expect(rankAirlines(flights, { includeCancelled: true })).toEqual([
      { code: "BA", count: 2 },
      { code: "CX", count: 2 },
      { code: "KL", count: 1 },
    ]);
  });

  it("leaves out flights without a recorded aircraft type", () => {
    expect(rankAircraftTypes(flights)).toEqual([
      { code: "A359", count: 2 },
      { code: "B789", count: 1 },
    ]);
  });

  it("counts a departure and an arrival as one visit each", () => {
    const airports = rankAirports([
      flight(),
      flight({ origin: { iata: "LHR" }, destination: { iata: "SFO" } }),
      flight({ origin: { iata: "SFO" }, cancelled: true }),
    ]);
    expect(airports.map(({ code, count }) => [code, count])).toEqual([
      ["LHR", 2],
      ["HKG", 1],
      ["SFO", 1],
    ]);
    expect(airports[0]!.identityKey).toBe(airports[0]!.identity.identityKey);
  });
});

describe("cabin distribution", () => {
  it("keeps flights without a cabin as their own last entry", () => {
    expect(
      cabinDistribution([
        flight({ extensions: cabin("business") }),
        flight({ extensions: cabin("economy") }),
        flight({ extensions: cabin("economy") }),
        flight(),
        flight({ extensions: cabin("first"), cancelled: true }),
      ]),
    ).toEqual([
      { cabin: "economy", count: 2 },
      { cabin: "business", count: 1 },
      { cabin: null, count: 1 },
    ]);
  });

  it("has no unrecorded entry when every flight records a cabin", () => {
    expect(cabinDistribution([flight({ extensions: cabin("first") })])).toEqual(
      [{ cabin: "first", count: 1 }],
    );
    expect(cabinDistribution([])).toEqual([]);
  });
});

describe("flights per month", () => {
  it("groups by the month of the service date across years", () => {
    const months = flightsPerMonth([
      flight({ serviceDate: "2024-03-09" }),
      flight({ serviceDate: "2026-03-30" }),
      flight({ serviceDate: "2026-12-31" }),
      flight({ serviceDate: "2026-07-01", cancelled: true }),
    ]);
    expect(months).toHaveLength(12);
    expect(months[2]).toBe(2);
    expect(months[11]).toBe(1);
    expect(months.reduce((sum, count) => sum + count, 0)).toBe(3);
  });
});

describe("records", () => {
  it("reports the longest arrival delay and ignores early or unrecorded arrivals", () => {
    const late = flight({ actualArrival: "2026-01-01T22:50:00Z" });
    const flights = [
      flight({ actualArrival: "2026-01-01T21:00:00Z" }),
      flight({ actualArrival: "2026-01-01T22:20:00Z" }),
      late,
      flight(),
      flight({ actualArrival: "2026-01-02T08:00:00Z", cancelled: true }),
    ];
    expect(longestArrivalDelay(flights)).toEqual({
      flightId: late.id,
      minutes: 50,
    });
    expect(longestArrivalDelay([flight(), flights[0]!])).toBeNull();
  });

  it("reports the most flown directed route", () => {
    const route = mostFlownRoute([
      flight(),
      flight({ origin: { iata: "LHR" }, destination: { iata: "HKG" } }),
      flight(),
      flight({ origin: { iata: "LHR" }, destination: { iata: "HKG" } }),
      flight({ cancelled: true }),
      flight(),
    ]);
    expect(route?.count).toBe(3);
    expect(route?.target).toMatchObject({
      kind: "route",
      origin: "HKG",
      destination: "LHR",
    });
    expect(mostFlownRoute([flight({ cancelled: true })])).toBeNull();
  });
});

describe("flight context", () => {
  const first = flight({ serviceDate: "2024-05-01" });
  const back = flight({
    serviceDate: "2024-05-20",
    origin: { iata: "LHR" },
    destination: { iata: "HKG" },
  });
  const cancelled = flight({ serviceDate: "2025-01-01", cancelled: true });
  const second = flight({ serviceDate: "2025-02-01" });
  const diverted = flight({
    serviceDate: "2026-03-01",
    divertedTo: { iata: "LGW" },
  });
  // Stored newest first: the context must not depend on archive order.
  const flights = [diverted, second, cancelled, back, first];

  it("numbers visits and route flights in chronological order", () => {
    expect(flightContext(flights, first.id)).toEqual({
      origin: { ordinal: 1, total: 4 },
      arrival: { ordinal: 1, total: 3 },
      route: { ordinal: 1, total: 2 },
    });
    expect(flightContext(flights, back.id)).toEqual({
      origin: { ordinal: 2, total: 3 },
      arrival: { ordinal: 2, total: 4 },
      route: { ordinal: 1, total: 1 },
    });
    expect(flightContext(flights, second.id)).toEqual({
      origin: { ordinal: 3, total: 4 },
      arrival: { ordinal: 3, total: 3 },
      route: { ordinal: 2, total: 2 },
    });
  });

  it("uses the airport actually arrived at for a diverted flight", () => {
    expect(flightContext(flights, diverted.id)).toEqual({
      origin: { ordinal: 4, total: 4 },
      arrival: { ordinal: 1, total: 1 },
      route: { ordinal: 1, total: 1 },
    });
  });

  it("orders an eastbound date-line connection by instant, not local date", () => {
    const inbound = flight({
      serviceDate: "2025-03-02",
      origin: { iata: "HND" },
      destination: { iata: "HNL" },
      scheduledDeparture: "2025-03-02T00:30:00+09:00",
      scheduledArrival: "2025-03-01T12:30:00-10:00",
    });
    const onward = flight({
      serviceDate: "2025-03-01",
      origin: { iata: "HNL" },
      destination: { iata: "LAX" },
      scheduledDeparture: "2025-03-01T14:00:00-10:00",
      scheduledArrival: "2025-03-01T22:00:00-08:00",
    });
    const connection = [onward, inbound];
    expect(flightContext(connection, inbound.id).arrival).toEqual({
      ordinal: 1,
      total: 2,
    });
    expect(flightContext(connection, onward.id).origin).toEqual({
      ordinal: 2,
      total: 2,
    });
  });

  it("has no context for a cancelled or unknown flight", () => {
    const empty = { origin: null, arrival: null, route: null };
    expect(flightContext(flights, cancelled.id)).toEqual(empty);
    expect(flightContext(flights, "missing")).toEqual(empty);
  });
});
