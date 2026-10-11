import { describe, expect, it } from "vitest";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import { airportByIata, buildRouteSegments } from "../src/index";

const flight: KeeprawFlight = {
  id: "route",
  flightNumber: "UA123",
  airline: { iata: "UA" },
  serviceDate: "2026-09-22",
  origin: { iata: "SFO" },
  destination: { iata: "LAX" },
  scheduledDeparture: "2026-09-22T18:00:00-07:00",
  scheduledArrival: "2026-09-22T20:00:00-07:00",
};
describe("actual route data", () => {
  it("retains ordinary and diverted endpoints, omitting cancelled and unknown flights", () => {
    expect(buildRouteSegments([flight])[0]?.destination.iata).toBe("LAX");
    expect(
      buildRouteSegments([{ ...flight, divertedTo: { iata: "JFK" } }])[0]
        ?.destination.iata,
    ).toBe("JFK");
    expect(buildRouteSegments([{ ...flight, cancelled: true }])).toEqual([]);
    expect(
      buildRouteSegments([{ ...flight, origin: { iata: "ZZZ" } }]),
    ).toEqual([]);
  });
  it("rejects nonfinite and out-of-range coordinates while retaining zero coordinates", () => {
    const original = airportByIata.get("SFO")!;
    try {
      for (const [latitude, longitude] of [
        [NaN, 1],
        [1, Infinity],
        [91, 0],
        [0, -181],
      ]) {
        airportByIata.set("SFO", {
          ...original,
          latitude: latitude!,
          longitude: longitude!,
        });
        expect(buildRouteSegments([flight])).toEqual([]);
      }
      airportByIata.set("SFO", { ...original, latitude: 0, longitude: 0 });
      expect(buildRouteSegments([flight])[0]?.origin).toEqual({
        iata: "SFO",
        latitude: 0,
        longitude: 0,
      });
    } finally {
      airportByIata.set("SFO", original);
    }
  });
});
