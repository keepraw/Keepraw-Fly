import { beforeAll, describe, expect, it } from "vitest";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  buildRouteSegments,
  installAirportDirectory,
  routeIdentityKey,
  type CompactAirportRow,
} from "@keepraw-fly/core";
import airportRows from "@keepraw-fly/core/airport-directory";
import { buildMapScene } from "./scene";

beforeAll(() => {
  installAirportDirectory(airportRows as CompactAirportRow[]);
});

function flight(
  id: string,
  origin: string,
  destination: string,
  serviceDate = "2010-06-01",
  overrides: Partial<KeeprawFlight> = {},
): KeeprawFlight {
  return {
    id,
    flightNumber: "CX100",
    serviceDate,
    airline: { iata: "CX" },
    origin: { iata: origin },
    destination: { iata: destination },
    scheduledDeparture: `${serviceDate}T10:00:00Z`,
    scheduledArrival: `${serviceDate}T18:00:00Z`,
    ...overrides,
  };
}

describe("buildMapScene", () => {
  it("skips routes whose endpoints share one physical identity", () => {
    const routes = buildRouteSegments([flight("same", "TPE", "TPE")]);
    expect(routes).toHaveLength(1);
    const scene = buildMapScene({ routes });
    expect(scene.routes).toEqual([]);
    expect(scene.airports).toEqual([]);
    expect(scene.bounds).toBeNull();
  });

  it("omits cancelled flights and their airports through core route building", () => {
    const routes = buildRouteSegments([
      flight("cancelled", "TPE", "LAX", "2010-06-01", { cancelled: true }),
    ]);
    const scene = buildMapScene({ routes });
    expect(routes).toEqual([]);
    expect(scene.routes).toEqual([]);
    expect(scene.airports).toEqual([]);
    expect(scene.bounds).toBeNull();
  });

  it("uses the diverted arrival airport supplied by core", () => {
    const routes = buildRouteSegments([
      flight("diverted", "TPE", "LAX", "2010-06-01", {
        divertedTo: { iata: "SFO" },
      }),
    ]);
    const scene = buildMapScene({ routes });
    expect(scene.routes).toHaveLength(1);
    expect(scene.routes[0]!.destination.iata).toBe("SFO");
    expect(scene.airports.map((airport) => airport.iata)).toContain("SFO");
    expect(scene.airports.map((airport) => airport.iata)).not.toContain("LAX");
  });

  it("keeps historical same-IATA airports and routes physically distinct", () => {
    const routes = buildRouteSegments([
      flight("kai-tak", "HKG", "SFO", "1997-06-01"),
      flight("chek-lap-kok", "HKG", "SFO", "2005-06-01"),
    ]);
    const scene = buildMapScene({ routes });
    const hongKongAirports = scene.airports.filter(
      (airport) => airport.iata === "HKG",
    );
    expect(hongKongAirports).toHaveLength(2);
    expect(
      new Set(hongKongAirports.map((airport) => airport.identityKey)).size,
    ).toBe(2);
    expect(scene.routes.map((route) => route.key)).toEqual(
      routes.map((route) => routeIdentityKey(route)).sort(),
    );
    expect(new Set(scene.routes.map((route) => route.key)).size).toBe(2);
    expect(hongKongAirports.every((airport) => airport.iata === "HKG")).toBe(
      true,
    );
  });

  it("aggregates repeated routes and ranks them for stable drawing order", () => {
    const coreRoutes = buildRouteSegments([
      flight("tpe-lax-1", "TPE", "LAX"),
      flight("tpe-lax-2", "TPE", "LAX"),
      flight("tpe-lax-3", "TPE", "LAX"),
      flight("tpe-lax-4", "TPE", "LAX"),
      flight("pvg-lax-1", "PVG", "LAX"),
      flight("pvg-lax-2", "PVG", "LAX"),
      flight("tpe-nrt-1", "TPE", "NRT"),
    ]);
    const repeated = coreRoutes.find(
      (route) =>
        route.origin.iata === "TPE" && route.destination.iata === "LAX",
    )!;
    const scene = buildMapScene({
      routes: [
        ...coreRoutes.filter((route) => route !== repeated),
        { ...repeated, flightCount: 1 },
        { ...repeated, flightCount: 3 },
      ],
    });
    expect(scene.routes.map(({ flightCount }) => flightCount)).toEqual([
      1, 2, 4,
    ]);
    expect(scene.routes.map(({ rank }) => rank)).toEqual([2, 1, 0]);
    expect(scene.routes.map(({ tier }) => tier)).toEqual([
      "base",
      "base",
      "frequent",
    ]);
    expect(scene.routes.at(-1)!.key).toBe(routeIdentityKey(repeated));
    const busiestAirport = scene.airports.find(
      (airport) => airport.iata === "LAX",
    );
    expect(busiestAirport?.flightCount).toBe(6);
    expect(busiestAirport?.hub).toBe(true);
    expect(scene.bounds).not.toBeNull();
    for (const route of scene.routes)
      for (const endpoint of [route.origin, route.destination]) {
        const airport = scene.airports.find(
          ({ identityKey }) => identityKey === endpoint.identityKey,
        );
        expect(airport).toBeDefined();
        expect(airport!.x).toBeGreaterThanOrEqual(scene.bounds!.x);
        expect(airport!.x).toBeLessThanOrEqual(
          scene.bounds!.x + scene.bounds!.width,
        );
        expect(airport!.y).toBeGreaterThanOrEqual(scene.bounds!.y);
        expect(airport!.y).toBeLessThanOrEqual(
          scene.bounds!.y + scene.bounds!.height,
        );
      }
  });
});
