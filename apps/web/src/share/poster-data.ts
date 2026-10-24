import { geoInterpolate } from "d3-geo";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  buildShareRenderModel,
  type ShareGeoPoint,
  type ShareScope,
} from "./share-model";

/**
 * Poster Data Model: the ONLY data the Canvas 2D Flight Passport is built
 * from. Like the 3A Share Data Model it is assembled field by field (default
 * deny) from the complete local archive, never from Passport exploration
 * state (year filter, search, airport selection), and never holds a flight
 * object, id, flight number, time, seat, PNR, ticket, member
 * number, name, gate, terminal, airport code or airport name. Only the first
 * and last non-cancelled service dates are explicitly allowed for this journal.
 *
 * The passport always shows the lifetime totals and the real great-circle
 * routes of every plottable airport pair, with unlabelled airport dots
 * (public airport coordinates and flight counts per pair; no dates, no flight
 * identity). Airport codes and names never enter the model.
 */
export interface PosterStatistics {
  flights: number;
  distanceKilometers: number;
  durationMinutes: number;
  airports: number;
  airlines: number;
  countries: number;
  longestFlightKilometers: number | null;
}

/** One stroke per airport pair (both directions merged). */
export interface PosterRoute {
  from: ShareGeoPoint;
  to: ShareGeoPoint;
  flights: number;
}

export interface PosterMapAirport extends ShareGeoPoint {
  flights: number;
}

/**
 * Real routes for the map. When the archive has more airport pairs than a poster can draw legibly, only
 * the busiest `MAX_POSTER_ROUTES` are kept and `curated` is true, so the
 * poster can say it shows a selection rather than every route.
 */
export interface PosterMap {
  routes: PosterRoute[];
  totalRoutes: number;
  curated: boolean;
  airports: PosterMapAirport[];
  /** Longitude the map is centred on so the routes are not cut at the seam. */
  centerLongitude: number;
}

export interface PosterDataModel {
  version: 3;
  /** Recorded airport pairs, including unplottable ones; directions merged. */
  routeCount: number;
  recordPeriod: { first: string; last: string } | null;
  yearRange: { first: number; last: number } | null;
  statistics: PosterStatistics;
  map: PosterMap;
}

/** Routes a poster map draws before it switches to a curated selection. */
export const MAX_POSTER_ROUTES = 60;
/** Unlabelled airport dots drawn on the map. */
export const MAX_POSTER_MAP_AIRPORTS = 120;

const wrapLongitude = (value: number) =>
  ((((value + 180) % 360) + 360) % 360) - 180;

/** Does the great circle cross the map seam (center ± 180°)? */
function crossesSeam(route: PosterRoute, center: number): boolean {
  const interpolate = geoInterpolate(
    [route.from.longitude, route.from.latitude],
    [route.to.longitude, route.to.latitude],
  );
  let previous: number | null = null;
  for (let index = 0; index <= 24; index += 1) {
    const relative = wrapLongitude(interpolate(index / 24)[0] - center);
    if (previous !== null && Math.abs(relative - previous) > 180) return true;
    previous = relative;
  }
  return false;
}

/**
 * Centre longitude for a routes map: the 5° step whose seam cuts the fewest
 * flights, then the one that keeps airports farthest from the seam, then the
 * one closest to 0°. Deterministic; 0 when there is nothing to frame.
 */
export function posterCenterLongitude(
  routes: readonly PosterRoute[],
  points: readonly ShareGeoPoint[] = [],
): number {
  if (!routes.length && !points.length) return 0;
  let best = { center: 0, cut: Infinity, clearance: -Infinity };
  for (let center = -175; center <= 180; center += 5) {
    let cut = 0;
    for (const route of routes)
      if (crossesSeam(route, center)) cut += route.flights;
    const clearance = Math.min(
      180,
      ...points.map(
        (point) => 180 - Math.abs(wrapLongitude(point.longitude - center)),
      ),
    );
    const better =
      cut < best.cut ||
      (cut === best.cut && clearance > best.clearance + 1e-9) ||
      (cut === best.cut &&
        Math.abs(clearance - best.clearance) <= 1e-9 &&
        Math.abs(center) < Math.abs(best.center));
    if (better) best = { center, cut, clearance };
  }
  return best.center;
}

export function buildPosterModel(
  flights: readonly KeeprawFlight[],
): PosterDataModel {
  const scope: ShareScope = { kind: "lifetime" };
  // Reuse the 3A whitelist for every shared number and the route geometry.
  // Airport labels are never requested, so no code reaches the model.
  const { model: share } = buildShareRenderModel(flights, {
    scope,
    privacy: "routes",
    airportLabels: false,
  });
  const source = share.statistics;
  const statistics: PosterStatistics = {
    flights: source.flights,
    distanceKilometers: source.distanceKilometers,
    durationMinutes: source.durationMinutes,
    airports: source.airports,
    airlines: source.airlines,
    countries: source.countries,
    longestFlightKilometers: source.longestFlightKilometers,
  };
  const routes = share.routes.slice(0, MAX_POSTER_ROUTES).map((route) => ({
    from: { latitude: route.from.latitude, longitude: route.from.longitude },
    to: { latitude: route.to.latitude, longitude: route.to.longitude },
    flights: route.flights,
  }));
  const airports = share.airports
    .slice(0, MAX_POSTER_MAP_AIRPORTS)
    .map((airport): PosterMapAirport => ({
      latitude: airport.latitude,
      longitude: airport.longitude,
      flights: airport.flights,
    }));
  const dates = flights
    .filter(
      (flight) =>
        !flight.cancelled && /^\d{4}-\d{2}-\d{2}$/.test(flight.serviceDate),
    )
    .map((flight) => flight.serviceDate)
    .sort();
  return {
    version: 3,
    routeCount: new Set(
      flights
        .filter((flight) => !flight.cancelled)
        .map((flight) =>
          [flight.origin.iata, (flight.divertedTo ?? flight.destination).iata]
            .sort()
            .join("–"),
        ),
    ).size,
    recordPeriod: dates.length
      ? { first: dates[0]!, last: dates.at(-1)! }
      : null,
    yearRange: share.yearRange
      ? { first: share.yearRange.first, last: share.yearRange.last }
      : null,
    statistics,
    map: {
      routes,
      totalRoutes: share.routes.length,
      curated: share.routes.length > routes.length,
      airports,
      centerLongitude: posterCenterLongitude(share.routes, share.airports),
    },
  };
}
