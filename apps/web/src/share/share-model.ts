import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  buildRouteSegments,
  calculatePassportStatistics,
  distanceForFlight,
  type RouteSegment,
} from "@keepraw-fly/core";

/**
 * Share Data Model: the ONLY data a share image may be rendered from.
 *
 * Built field by field from an explicit whitelist (default deny). It never
 * copies a flight, a document or an extension object, never keeps raw ids,
 * exact dates, times, flight numbers, names, PNRs, ticket or member numbers,
 * seats, gates, terminals, carousels or registrations, and is independent of
 * any Passport exploration state (search, selection, focus).
 *
 * Privacy modes:
 * - "overview" (default): aggregate statistics and the year range only. No
 *   routes, no airport positions, no airport identifiers, so nothing about the
 *   traveller's actual trips can reach the renderer or steer its camera.
 * - "routes": adds real great-circle routes (coordinates and flight counts).
 *   Airport codes are added only when `airportLabels` is explicitly granted.
 */
export type ShareScope = { kind: "lifetime" } | { kind: "year"; year: number };
export type SharePrivacy = "overview" | "routes";

export interface ShareModelOptions {
  scope?: ShareScope;
  privacy?: SharePrivacy;
  /** Separate, explicit consent for airport codes; ignored for "overview". */
  airportLabels?: boolean;
}

export interface ShareGeoPoint {
  latitude: number;
  longitude: number;
}

/** One physical stroke per airport pair; both directions are merged. */
export interface ShareRoute {
  from: ShareGeoPoint;
  to: ShareGeoPoint;
  flights: number;
}

export interface ShareAirport extends ShareGeoPoint {
  flights: number;
  /** Present only when airport labels were explicitly granted. */
  code?: string;
}

export interface ShareStatistics {
  /** Non-cancelled flights in scope, including ones without a known route. */
  flights: number;
  /** Sum over flights whose great-circle distance is reliably known. */
  distanceKilometers: number;
  /** Non-cancelled flights whose distance is known / unknown. */
  distanceKnownFlights: number;
  distanceUnknownFlights: number;
  countries: number;
  airports: number;
  airlines: number;
  /** Longest known great-circle distance; no route or flight identity. */
  longestFlightKilometers: number | null;
}

export interface ShareRenderModel {
  version: 1;
  scope: ShareScope;
  privacy: SharePrivacy;
  airportLabels: boolean;
  /** Service-date years of the counted flights; null when there are none. */
  yearRange: { first: number; last: number } | null;
  statistics: ShareStatistics;
  /** Empty unless privacy is "routes". */
  routes: ShareRoute[];
  /** Empty unless privacy is "routes". */
  airports: ShareAirport[];
}

/** Kept apart from the model; counts only, never source records. */
export interface ShareModelDiagnostics {
  inputFlights: number;
  scopedFlights: number;
  cancelledFlights: number;
  unknownDistanceFlights: number;
  /** Non-cancelled flights whose airports have no reliable coordinates. */
  unplottableFlights: number;
  /** Records whose serviceDate has no four-digit year. */
  invalidServiceDateFlights: number;
}

export interface ShareModelResult {
  model: ShareRenderModel;
  diagnostics: ShareModelDiagnostics;
}

const serviceYear = (flight: KeeprawFlight): number | null => {
  const match = /^(\d{4})-/.exec(flight.serviceDate);
  return match ? Number(match[1]) : null;
};

const point = (latitude: number, longitude: number): ShareGeoPoint => ({
  latitude,
  longitude,
});

/** Same year semantics as the Passport filter: the serviceDate's year. */
export function filterShareScope(
  flights: readonly KeeprawFlight[],
  scope: ShareScope,
): KeeprawFlight[] {
  if (scope.kind === "lifetime") return [...flights];
  const prefix = `${String(scope.year).padStart(4, "0")}-`;
  return flights.filter((flight) => flight.serviceDate.startsWith(prefix));
}

function mergeRoutes(segments: RouteSegment[], labels: boolean) {
  const pairs = new Map<
    string,
    { segment: RouteSegment; flights: number; key: string }
  >();
  for (const segment of segments) {
    const codes = [segment.origin.iata, segment.destination.iata].sort();
    const key = codes.join("-");
    const current = pairs.get(key);
    if (current) current.flights += segment.flightCount;
    else pairs.set(key, { segment, flights: segment.flightCount, key });
  }
  const routes = [...pairs.values()]
    .sort((a, b) => b.flights - a.flights || a.key.localeCompare(b.key))
    .map(({ segment, flights }): ShareRoute => ({
      from: point(segment.origin.latitude, segment.origin.longitude),
      to: point(segment.destination.latitude, segment.destination.longitude),
      flights,
    }));
  const airportMap = new Map<
    string,
    { latitude: number; longitude: number; flights: number }
  >();
  for (const segment of segments)
    for (const end of [segment.origin, segment.destination]) {
      const current = airportMap.get(end.iata);
      airportMap.set(end.iata, {
        latitude: end.latitude,
        longitude: end.longitude,
        flights: (current?.flights ?? 0) + segment.flightCount,
      });
    }
  const airports = [...airportMap]
    .sort(
      ([codeA, a], [codeB, b]) =>
        b.flights - a.flights || codeA.localeCompare(codeB),
    )
    .map(([code, value]): ShareAirport => {
      const airport: ShareAirport = {
        latitude: value.latitude,
        longitude: value.longitude,
        flights: value.flights,
      };
      if (labels) airport.code = code;
      return airport;
    });
  return { routes, airports };
}

export function buildShareRenderModel(
  flights: readonly KeeprawFlight[],
  options: ShareModelOptions = {},
): ShareModelResult {
  const scope: ShareScope =
    options.scope?.kind === "year"
      ? { kind: "year", year: Math.trunc(options.scope.year) }
      : { kind: "lifetime" };
  const privacy: SharePrivacy =
    options.privacy === "routes" ? "routes" : "overview";
  const airportLabels = privacy === "routes" && options.airportLabels === true;

  const scoped = filterShareScope(flights, scope);
  const counted = scoped.filter((flight) => !flight.cancelled);
  // Statistics, distance coverage and routes all come from `scoped`.
  const stats = calculatePassportStatistics(scoped);
  const unknownDistance = counted.filter(
    (flight) => distanceForFlight(flight) === null,
  ).length;
  const segments = buildRouteSegments(scoped);
  const plottable = segments.reduce((sum, s) => sum + s.flightCount, 0);
  const years = counted
    .map(serviceYear)
    .filter((year): year is number => year !== null);

  const model: ShareRenderModel = {
    version: 1,
    scope,
    privacy,
    airportLabels,
    yearRange: years.length
      ? { first: Math.min(...years), last: Math.max(...years) }
      : null,
    statistics: {
      flights: stats.flights,
      distanceKilometers: stats.distanceKilometers,
      distanceKnownFlights: counted.length - unknownDistance,
      distanceUnknownFlights: unknownDistance,
      countries: stats.countries,
      airports: stats.airports,
      airlines: stats.airlines,
      longestFlightKilometers: stats.longestFlight?.kilometers ?? null,
    },
    routes: [],
    airports: [],
  };
  if (privacy === "routes") {
    const merged = mergeRoutes(segments, airportLabels);
    model.routes = merged.routes;
    model.airports = merged.airports;
  }
  return {
    model,
    diagnostics: {
      inputFlights: flights.length,
      scopedFlights: scoped.length,
      cancelledFlights: scoped.length - counted.length,
      unknownDistanceFlights: unknownDistance,
      unplottableFlights: counted.length - plottable,
      invalidServiceDateFlights: flights.filter((f) => serviceYear(f) === null)
        .length,
    },
  };
}
