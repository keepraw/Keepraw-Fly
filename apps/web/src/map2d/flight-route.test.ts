import { beforeAll, describe, expect, it } from "vitest";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  installAirportDirectory,
  type CompactAirportRow,
} from "@keepraw-fly/core";
import airportRows from "@keepraw-fly/core/airport-directory";
import { WORLD_CAMERA } from "../data/map-camera";
import {
  projectPoint,
  sampleGreatCircle,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "../data/map-geometry";
import {
  FLIGHT_ROUTE_MAX_ZOOM,
  flightRouteCamera,
  flightRouteScene,
} from "./flight-route";

beforeAll(() => {
  installAirportDirectory(airportRows as CompactAirportRow[]);
});

function flight(
  origin: string,
  destination: string,
  overrides: Partial<KeeprawFlight> = {},
): KeeprawFlight {
  return {
    id: `${origin}-${destination}`,
    flightNumber: "CX100",
    serviceDate: "2019-06-01",
    airline: { iata: "CX" },
    origin: { iata: origin },
    destination: { iata: destination },
    scheduledDeparture: "2019-06-01T10:00:00Z",
    scheduledArrival: "2019-06-01T18:00:00Z",
    ...overrides,
  };
}

/** Every sampled route point must land inside the framed viewport. */
function expectFramed(value: KeeprawFlight, height = WORLD_HEIGHT) {
  const scene = flightRouteScene(value);
  const camera = flightRouteCamera(scene, height);
  const points = sampleGreatCircle(
    scene.origin!,
    scene.arrival!,
    96,
    scene.centerLongitude,
  );
  if (scene.planned)
    points.push(projectPoint(scene.planned, scene.centerLongitude));
  for (const point of points) {
    const x = (point.x - camera.centerX) * camera.zoom + WORLD_WIDTH / 2;
    const y = (point.y - camera.centerY) * camera.zoom + height / 2;
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(WORLD_WIDTH);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(height);
  }
  return { scene, camera, points };
}

describe("flightRouteScene", () => {
  it("frames a short flight tightly without exceeding the zoom cap", () => {
    const { camera } = expectFramed(flight("TSA", "KHH"));
    expect(camera.zoom).toBeGreaterThan(6);
    expect(camera.zoom).toBeLessThanOrEqual(FLIGHT_ROUTE_MAX_ZOOM);
  });

  it("keeps a date-line route continuous around its own center", () => {
    const { scene, camera, points } = expectFramed(flight("TPE", "LAX"));
    expect(Math.abs(scene.centerLongitude)).toBeGreaterThan(120);
    expect(camera.zoom).toBeGreaterThan(1);
    // No horizontal jump: the route is one unbroken line in this projection.
    for (let index = 1; index < points.length; index += 1)
      expect(Math.abs(points[index]!.x - points[index - 1]!.x)).toBeLessThan(
        WORLD_WIDTH / 4,
      );
  });

  it("frames transoceanic and polar routes inside the viewport", () => {
    expectFramed(flight("LHR", "JFK"));
    expectFramed(flight("JFK", "HKG"));
    expectFramed(flight("DXB", "LAX"), 720);
  });

  it("draws a diversion to the actual arrival and keeps the planned airport", () => {
    const { scene } = expectFramed(
      flight("TPE", "LAX", { divertedTo: { iata: "SFO" } }),
    );
    expect(scene.status).toBe("diverted");
    expect(scene.arrival?.iata).toBe("SFO");
    expect(scene.planned?.iata).toBe("LAX");
  });

  it("has no flown route for a cancelled flight", () => {
    const scene = flightRouteScene(flight("TPE", "LAX", { cancelled: true }));
    expect(scene.status).toBe("cancelled");
    expect(scene.origin).toBeUndefined();
    expect(flightRouteCamera(scene)).toBe(WORLD_CAMERA);
  });

  it("reports an unknown airport as unavailable", () => {
    const scene = flightRouteScene(flight("TPE", "ZZZ"));
    expect(scene.status).toBe("unavailable");
    expect(scene.arrival).toBeUndefined();
  });

  it("uses the flight-date physical identity of a relocated airport", () => {
    const schedule = (serviceDate: string) => ({
      serviceDate,
      scheduledDeparture: `${serviceDate}T10:00:00Z`,
      scheduledArrival: `${serviceDate}T18:00:00Z`,
    });
    const before = flightRouteScene(
      flight("SFO", "HKG", schedule("1997-06-01")),
    );
    const after = flightRouteScene(
      flight("SFO", "HKG", schedule("2005-06-01")),
    );
    expect(before.arrival?.iata).toBe("HKG");
    expect(after.arrival?.iata).toBe("HKG");
    expect(before.arrival?.identityKey).not.toBe(after.arrival?.identityKey);
  });
});
