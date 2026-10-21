import { geoInterpolate } from "d3-geo";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  airportByIata,
  distanceForFlight,
  localizedText,
  type SupportedLocale,
} from "@keepraw-fly/core";
import {
  buildShareRenderModel,
  filterShareScope,
  type ShareGeoPoint,
  type ShareScope,
} from "./share-model";

/**
 * Poster Data Model (stage 3B): the ONLY data the Canvas 2D poster pipeline
 * may be built from. Like the 3A Share Data Model it is assembled field by
 * field (default deny) from the complete local archive for the chosen scope,
 * never from Passport exploration state, and never holds a flight object,
 * id, flight number, exact date or time, seat, PNR, ticket, member number,
 * name, gate, terminal or coordinate.
 *
 * Privacy (each step needs its own explicit opt-in):
 * - "overview" (default): the base world map plus aggregate numbers and
 *   year/month trends. No routes, no airport positions, no identifiers; the
 *   map framing never depends on the archive.
 * - "routes": additionally the real great-circle routes of the chosen scope
 *   and unlabelled airport dots (public airport coordinates and flight
 *   counts per airport pair; no dates, no flight identity).
 * - "airports": "routes" plus airport IATA codes and display names for the
 *   busiest airports. Codes and names exist in the model only in this mode.
 */
export type PosterTemplate = "passport" | "year";
/** 3:4 phone portrait (1200×1600) or 4:3 desktop landscape (1600×1200). */
export type PosterAspect = "3:4" | "4:3";
export type PosterPrivacy = "overview" | "routes" | "airports";

export interface PosterModelOptions {
  template: PosterTemplate;
  scope: ShareScope;
  privacy?: PosterPrivacy;
  /** Locale for airport display names (airport mode only). */
  locale?: SupportedLocale;
}

export interface PosterStatistics {
  flights: number;
  distanceKilometers: number;
  distanceKnownFlights: number;
  distanceUnknownFlights: number;
  durationMinutes: number;
  durationKnownFlights: number;
  durationUnknownFlights: number;
  airports: number;
  airlines: number;
  countries: number;
  longestFlightKilometers: number | null;
}

/** One bar: a calendar year (lifetime) or a month 1–12 (year scope). */
export interface PosterTrendPoint {
  label: number;
  flights: number;
  distanceKilometers: number;
}

export interface PosterTrend {
  kind: "year" | "month";
  points: PosterTrendPoint[];
  /** Counted flights whose service date has no usable year/month. */
  undatedFlights: number;
  /** Lifetime only: earlier years left out because the span is too long. */
  omittedYears: number;
}

export type PosterHighlight =
  | { kind: "longestFlight"; kilometers: number }
  | { kind: "busiestMonth"; month: number; flights: number }
  | { kind: "airportsVisited"; count: number };

export interface PosterAirport {
  code: string;
  name: string;
  visits: number;
}

/** One stroke per airport pair (both directions merged). */
export interface PosterRoute {
  from: ShareGeoPoint;
  to: ShareGeoPoint;
  flights: number;
}

export interface PosterMapAirport extends ShareGeoPoint {
  flights: number;
  /** Present only in "airports" privacy, for the labelled busiest airports. */
  code?: string;
}

/**
 * Real routes for the map. Present only when routes were explicitly enabled.
 * When the scope has more airport pairs than a poster can draw legibly, only
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
  version: 1;
  template: PosterTemplate;
  scope: ShareScope;
  privacy: PosterPrivacy;
  yearRange: { first: number; last: number } | null;
  statistics: PosterStatistics;
  trend: PosterTrend;
  /** At most two, each backed by real data; empty rather than invented. */
  highlights: PosterHighlight[];
  /** Empty unless privacy is "airports". At most three. */
  airports: PosterAirport[];
  /** Null unless privacy is "routes" or "airports". */
  map: PosterMap | null;
  /** Year scope: months (1–12) with at least one flight. */
  activeMonths: number | null;
}

/** Bars a 1080 px wide artboard can draw legibly. */
export const MAX_TREND_YEARS = 30;
export const MAX_POSTER_AIRPORTS = 3;
/** Routes a poster map draws before it switches to a curated selection. */
export const MAX_POSTER_ROUTES = 60;
/** Airport dots drawn on the map; labels go to the busiest few only. */
export const MAX_POSTER_MAP_AIRPORTS = 120;
export const MAX_POSTER_MAP_LABELS = 5;

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

const datePart = (flight: KeeprawFlight) =>
  /^(\d{4})-(\d{2})-\d{2}/.exec(flight.serviceDate);

export function posterServiceYear(flight: KeeprawFlight): number | null {
  const match = datePart(flight);
  return match ? Number(match[1]) : null;
}

export function posterServiceMonth(flight: KeeprawFlight): number | null {
  const match = datePart(flight);
  const month = match ? Number(match[2]) : NaN;
  return month >= 1 && month <= 12 ? month : null;
}

/** Years (newest first) that hold at least one non-cancelled flight. */
export function posterYears(flights: readonly KeeprawFlight[]): number[] {
  const years = new Set<number>();
  for (const flight of flights) {
    if (flight.cancelled) continue;
    const year = posterServiceYear(flight);
    if (year !== null) years.add(year);
  }
  return [...years].sort((a, b) => b - a);
}

function trendFor(
  counted: readonly KeeprawFlight[],
  scope: ShareScope,
  yearRange: PosterDataModel["yearRange"],
): PosterTrend {
  const add = (
    map: Map<number, PosterTrendPoint>,
    label: number,
    flight: KeeprawFlight,
  ) => {
    const point = map.get(label);
    if (!point) return false;
    point.flights += 1;
    point.distanceKilometers += distanceForFlight(flight) ?? 0;
    return true;
  };
  const points = new Map<number, PosterTrendPoint>();
  let undated = 0;
  if (scope.kind === "year") {
    for (let month = 1; month <= 12; month += 1)
      points.set(month, { label: month, flights: 0, distanceKilometers: 0 });
    for (const flight of counted) {
      const month = posterServiceMonth(flight);
      if (month === null || !add(points, month, flight)) undated += 1;
    }
    return {
      kind: "month",
      points: [...points.values()],
      undatedFlights: undated,
      omittedYears: 0,
    };
  }
  let omitted = 0;
  if (yearRange) {
    const first = Math.max(
      yearRange.first,
      yearRange.last - MAX_TREND_YEARS + 1,
    );
    omitted = first - yearRange.first;
    for (let year = first; year <= yearRange.last; year += 1)
      points.set(year, { label: year, flights: 0, distanceKilometers: 0 });
  }
  for (const flight of counted) {
    const year = posterServiceYear(flight);
    if (year === null) undated += 1;
    else add(points, year, flight);
  }
  return {
    kind: "year",
    points: [...points.values()],
    undatedFlights: undated,
    omittedYears: omitted,
  };
}

function highlightsFor(
  statistics: PosterStatistics,
  trend: PosterTrend,
): PosterHighlight[] {
  const candidates: PosterHighlight[] = [];
  if (statistics.longestFlightKilometers !== null)
    candidates.push({
      kind: "longestFlight",
      kilometers: statistics.longestFlightKilometers,
    });
  if (trend.kind === "month") {
    const max = Math.max(0, ...trend.points.map((point) => point.flights));
    const top = trend.points.filter((point) => point.flights === max);
    // A "busiest month" only exists when one month clearly leads.
    if (max >= 2 && top.length === 1)
      candidates.push({
        kind: "busiestMonth",
        month: top[0]!.label,
        flights: max,
      });
  }
  if (statistics.airports > 0)
    candidates.push({ kind: "airportsVisited", count: statistics.airports });
  return candidates.slice(0, 2);
}

function topAirports(
  counted: readonly KeeprawFlight[],
  locale: SupportedLocale,
): PosterAirport[] {
  const visits = new Map<string, number>();
  for (const flight of counted)
    for (const code of [
      flight.origin.iata,
      (flight.divertedTo ?? flight.destination).iata,
    ])
      if (airportByIata.has(code))
        visits.set(code, (visits.get(code) ?? 0) + 1);
  return [...visits]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .slice(0, MAX_POSTER_AIRPORTS)
    .map(([code, count]) => ({
      code,
      name: localizedText(airportByIata.get(code)!.name, locale),
      visits: count,
    }));
}

export function buildPosterModel(
  flights: readonly KeeprawFlight[],
  options: PosterModelOptions,
): PosterDataModel {
  const scope: ShareScope =
    options.scope.kind === "year"
      ? { kind: "year", year: Math.trunc(options.scope.year) }
      : { kind: "lifetime" };
  const privacy: PosterPrivacy =
    options.privacy === "airports" || options.privacy === "routes"
      ? options.privacy
      : "overview";
  // Reuse the 3A whitelist for every shared number (overview: no routes).
  const share = buildShareRenderModel(flights, { scope, privacy: "overview" });
  const source = share.model.statistics;
  const statistics: PosterStatistics = {
    flights: source.flights,
    distanceKilometers: source.distanceKilometers,
    distanceKnownFlights: source.distanceKnownFlights,
    distanceUnknownFlights: source.distanceUnknownFlights,
    durationMinutes: source.durationMinutes,
    durationKnownFlights: source.durationKnownFlights,
    durationUnknownFlights: source.durationUnknownFlights,
    airports: source.airports,
    airlines: source.airlines,
    countries: source.countries,
    longestFlightKilometers: source.longestFlightKilometers,
  };
  const counted = filterShareScope(flights, scope).filter(
    (flight) => !flight.cancelled,
  );
  const yearRange = share.model.yearRange
    ? { first: share.model.yearRange.first, last: share.model.yearRange.last }
    : null;
  const trend = trendFor(counted, scope, yearRange);
  let map: PosterMap | null = null;
  if (privacy !== "overview") {
    // Routes come from the same 3A whitelist, now with explicit consent.
    const routed = buildShareRenderModel(flights, {
      scope,
      privacy: "routes",
      airportLabels: privacy === "airports",
    }).model;
    const routes = routed.routes.slice(0, MAX_POSTER_ROUTES).map((route) => ({
      from: { ...route.from },
      to: { ...route.to },
      flights: route.flights,
    }));
    const airports = routed.airports
      .slice(0, MAX_POSTER_MAP_AIRPORTS)
      .map((airport, index): PosterMapAirport => {
        const value: PosterMapAirport = {
          latitude: airport.latitude,
          longitude: airport.longitude,
          flights: airport.flights,
        };
        if (
          privacy === "airports" &&
          airport.code &&
          index < MAX_POSTER_MAP_LABELS
        )
          value.code = airport.code;
        return value;
      });
    map = {
      routes,
      totalRoutes: routed.routes.length,
      curated: routed.routes.length > routes.length,
      airports,
      centerLongitude: posterCenterLongitude(routed.routes, routed.airports),
    };
  }
  return {
    version: 1,
    template: options.template === "year" ? "year" : "passport",
    scope,
    privacy,
    yearRange,
    statistics,
    trend,
    highlights: highlightsFor(statistics, trend),
    airports:
      privacy === "airports"
        ? topAirports(counted, options.locale ?? "en-US")
        : [],
    map,
    activeMonths:
      trend.kind === "month"
        ? trend.points.filter((point) => point.flights > 0).length
        : null,
  };
}
