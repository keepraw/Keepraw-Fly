import { describe, expect, it } from "vitest";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  calculatePassportHighlights,
  calculatePassportStatistics,
} from "../src";

const flight: KeeprawFlight = {
  id: "one",
  flightNumber: "CX123",
  serviceDate: "2026-01-01",
  airline: { iata: "CX" },
  origin: { iata: "HKG" },
  destination: { iata: "TAO" },
  scheduledDeparture: "2026-01-01T10:00:00Z",
  scheduledArrival: "2026-01-01T12:00:00Z",
};

describe("Passport highlight data", () => {
  it("groups by service year, keeps unknown distinct from zero, and never offsets positive delay", () => {
    const flights = [
      {
        ...flight,
        serviceDate: "2023-12-31",
        actualArrival: "2026-01-01T12:40:00Z",
      },
      {
        ...flight,
        serviceDate: "2023-12-31",
        actualArrival: "2026-01-01T11:40:00Z",
      },
      {
        ...flight,
        serviceDate: "2024-01-01",
        actualArrival: flight.scheduledArrival,
      },
      { ...flight, serviceDate: "2025-01-01" },
      { ...flight, actualArrival: "2026-01-01T12:10:00Z" },
      {
        ...flight,
        cancelled: true,
        serviceDate: "2022-01-01",
        actualArrival: "2026-01-01T13:00:00Z",
      },
      {
        ...flight,
        divertedTo: { iata: "PEK" },
        actualArrival: "2026-01-01T14:00:00Z",
      },
    ];
    const { annualArrivalDelays } = calculatePassportHighlights(flights);
    expect(annualArrivalDelays).toEqual([
      { year: 2023, minutes: 40, recordedArrivals: 2 },
      { year: 2024, minutes: 0, recordedArrivals: 1 },
      { year: 2025, minutes: null, recordedArrivals: 0 },
      { year: 2026, minutes: 10, recordedArrivals: 1 },
    ]);
    expect(
      annualArrivalDelays.reduce((sum, year) => sum + (year.minutes ?? 0), 0),
    ).toBe(calculatePassportStatistics(flights).totalDelayMinutes);
    expect(
      calculatePassportHighlights([{ ...flight, cancelled: true }])
        .annualArrivalDelays,
    ).toEqual([]);
    expect(calculatePassportHighlights([]).annualArrivalDelays).toEqual([]);
  });

  it("ranks actual endpoints, excludes cancellations and limits to four with stable alphabetical ties", () => {
    const flights = [
      flight,
      { ...flight, destination: { iata: "LAX" }, divertedTo: { iata: "SFO" } },
      { ...flight, origin: { iata: "PEK" }, destination: { iata: "PVG" } },
      {
        ...flight,
        origin: { iata: "ZZZ" },
        destination: { iata: "ZZZ" },
        cancelled: true,
      },
    ];
    const expected = [
      { code: "HKG", count: 2 },
      { code: "PEK", count: 1 },
      { code: "PVG", count: 1 },
      { code: "SFO", count: 1 },
    ];
    expect(calculatePassportHighlights(flights).mostVisitedAirports).toEqual(
      expected,
    );
    expect(
      calculatePassportHighlights([...flights].reverse()).mostVisitedAirports,
    ).toEqual(expected);
    expect(calculatePassportHighlights([flight]).mostVisitedAirports).toEqual([
      { code: "HKG", count: 1 },
      { code: "TAO", count: 1 },
    ]);
    expect(calculatePassportHighlights([]).mostVisitedAirports).toEqual([]);
  });
});
