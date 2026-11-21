import { beforeAll, describe, expect, it } from "vitest";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  buildRouteSegments,
  installAirportDirectory,
  routeIdentityKey,
  type CompactAirportRow,
  type RouteSegment,
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
  it("returns an empty scene with a finite center for empty routes", () => {
    const scene = buildMapScene({ routes: [] });
    expect(scene.routes).toEqual([]);
    expect(scene.airports).toEqual([]);
    expect(scene.bounds).toBeNull();
    expect(Number.isFinite(scene.centerLongitude)).toBe(true);
  });

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

  it("bounds every projected airport and route segment point", () => {
    const routes = buildRouteSegments([
      flight("tpe-lax-bounds", "TPE", "LAX"),
      flight("hkg-mfm-bounds", "HKG", "MFM"),
      flight("syd-cdg-bounds", "SYD", "CDG"),
    ]);
    const scene = buildMapScene({ routes });
    const points = [
      ...scene.routes.flatMap((route) => route.segments.flat()),
      ...scene.airports.map(({ x, y }) => ({ x, y })),
    ];
    expect(points.length).toBeGreaterThan(0);
    expect(scene.bounds).not.toBeNull();
    const expectedBounds = {
      x: Math.min(...points.map(({ x }) => x)),
      y: Math.min(...points.map(({ y }) => y)),
      width:
        Math.max(...points.map(({ x }) => x)) -
        Math.min(...points.map(({ x }) => x)),
      height:
        Math.max(...points.map(({ y }) => y)) -
        Math.min(...points.map(({ y }) => y)),
    };
    expect(scene.bounds).toEqual(expectedBounds);
    for (const { x, y } of points) {
      expect(x).toBeGreaterThanOrEqual(scene.bounds!.x);
      expect(x).toBeLessThanOrEqual(scene.bounds!.x + scene.bounds!.width);
      expect(y).toBeGreaterThanOrEqual(scene.bounds!.y);
      expect(y).toBeLessThanOrEqual(scene.bounds!.y + scene.bounds!.height);
    }
  });

  it("marks dateline-crossing and regional routes", () => {
    const routes = buildRouteSegments([
      flight("tpe-lax-dateline", "TPE", "LAX"),
      flight("hkg-mfm-regional", "HKG", "MFM"),
    ]);
    const scene = buildMapScene({ routes });
    expect(
      scene.routes.find(
        ({ origin, destination }) =>
          origin.iata === "TPE" && destination.iata === "LAX",
      )?.crossesDateline,
    ).toBe(true);
    expect(
      scene.routes.find(
        ({ origin, destination }) =>
          origin.iata === "HKG" && destination.iata === "MFM",
      )?.crossesDateline,
    ).toBe(false);
  });

  it("builds bounds for a large route scene without spreading arguments", () => {
    const routes: RouteSegment[] = Array.from({ length: 3000 }, (_, index) => ({
      origin: {
        iata: `O${index}`,
        identityKey: `airport:origin-${index}`,
        latitude: ((index * 37) % 160) - 80,
        longitude: ((index * 71) % 360) - 180,
      },
      destination: {
        iata: `D${index}`,
        identityKey: `airport:destination-${index}`,
        latitude: ((index * 53 + 19) % 160) - 80,
        longitude: ((index * 97 + 43) % 360) - 180,
      },
      flightCount: 1,
    }));
    const scene = buildMapScene({ routes });
    const segmentPointCount = scene.routes.reduce(
      (count, route) =>
        count +
        route.segments.reduce(
          (segmentCount, segment) => segmentCount + segment.length,
          0,
        ),
      0,
    );
    expect(scene.routes).toHaveLength(3000);
    expect(segmentPointCount).toBeGreaterThan(100_000);
    expect(scene.bounds).not.toBeNull();
    expect(
      [
        scene.bounds!.x,
        scene.bounds!.y,
        scene.bounds!.width,
        scene.bounds!.height,
      ].every(Number.isFinite),
    ).toBe(true);
  });
});
