import type { KeeprawFlight } from "@keepraw-fly/schema";
import { canonicalAirlineCode } from "./airline-reference";
import { arrivalDelayMinutes } from "./calculations";
import { aircraftFacts, seatFacts } from "./extensions";
import {
  arrivalIdentity,
  originIdentity,
  type FlightEndpointIdentity,
} from "./flight-airports";
import {
  flightRouteIdentityKey,
  flightRouteTarget,
  type RouteSelectionTarget,
} from "./routes";
import type { RankedAirport, RankedCode } from "./statistics";

/*
 * Read-only derivations for Stats and the flight context. They share the core
 * statistics semantics: cancelled flights are excluded, undetermined
 * historical airports are not merged, and nothing is estimated.
 */

function flown(flights: readonly KeeprawFlight[]): KeeprawFlight[] {
  return flights.filter((flight) => !flight.cancelled);
}

function ranked(counts: Map<string, number>): RankedCode[] {
  return [...counts]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

function countBy(
  flights: readonly KeeprawFlight[],
  key: (flight: KeeprawFlight) => string | null | undefined,
  includeCancelled = false,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const flight of includeCancelled ? flights : flown(flights)) {
    const value = key(flight);
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

/** Use the IATA code when it identifies this carrier, otherwise its ICAO code. */
export function flightAirlineCode(flight: KeeprawFlight): string | null {
  return canonicalAirlineCode(flight.airline) || null;
}

/** The recorded aircraft type of a flight, or null when none is recorded. */
export function flightAircraftType(flight: KeeprawFlight): string | null {
  return aircraftFacts(flight)?.type ?? null;
}

export interface RankOptions {
  /** Count cancelled flights too, as a list that shows them needs. */
  includeCancelled?: boolean;
}

export function rankAirlines(
  flights: readonly KeeprawFlight[],
  { includeCancelled }: RankOptions = {},
): RankedCode[] {
  return ranked(countBy(flights, flightAirlineCode, includeCancelled));
}

export function rankAircraftTypes(
  flights: readonly KeeprawFlight[],
  { includeCancelled }: RankOptions = {},
): RankedCode[] {
  return ranked(countBy(flights, flightAircraftType, includeCancelled));
}

/** Confirmed flight-date physical airports by visits, most visited first. */
export function rankAirports(
  flights: readonly KeeprawFlight[],
): RankedAirport[] {
  const counts = new Map<string, number>();
  const identities = new Map<string, FlightEndpointIdentity>();
  for (const flight of flown(flights))
    for (const identity of [originIdentity(flight), arrivalIdentity(flight)]) {
      if (!identity.confirmed) continue;
      counts.set(
        identity.identityKey,
        (counts.get(identity.identityKey) ?? 0) + 1,
      );
      if (!identities.has(identity.identityKey))
        identities.set(identity.identityKey, identity);
    }
  return [...counts]
    .map(([identityKey, count]) => {
      const identity = identities.get(identityKey)!;
      return { code: identity.iata, identityKey, count, identity };
    })
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.code.localeCompare(b.code) ||
        a.identityKey.localeCompare(b.identityKey),
    );
}

export interface CabinCount {
  /** The recorded cabin, or null for flights without one. */
  cabin: string | null;
  count: number;
}

/** Flights per recorded cabin; flights without a cabin are counted last. */
export function cabinDistribution(
  flights: readonly KeeprawFlight[],
): CabinCount[] {
  const recorded = countBy(flights, (flight) => seatFacts(flight)?.cabin);
  const known = ranked(recorded).map(({ code, count }) => ({
    cabin: code as string | null,
    count,
  }));
  const missing =
    flown(flights).length - known.reduce((sum, item) => sum + item.count, 0);
  return missing ? [...known, { cabin: null, count: missing }] : known;
}

/** Flights per calendar month of the service date, January first. */
export function flightsPerMonth(flights: readonly KeeprawFlight[]): number[] {
  const months = Array.from({ length: 12 }, () => 0);
  for (const flight of flown(flights)) {
    const month = Number(flight.serviceDate.slice(5, 7));
    if (month >= 1 && month <= 12) months[month - 1]! += 1;
  }
  return months;
}

export interface FlightDelayRecord {
  flightId: string;
  minutes: number;
}

/** The flight that arrived latest against its schedule; null when none was late. */
export function longestArrivalDelay(
  flights: readonly KeeprawFlight[],
): FlightDelayRecord | null {
  let longest: FlightDelayRecord | null = null;
  for (const flight of flown(flights)) {
    const minutes = arrivalDelayMinutes(flight);
    if (minutes === null || minutes <= 0) continue;
    if (!longest || minutes > longest.minutes)
      longest = { flightId: flight.id, minutes };
  }
  return longest;
}

export interface RankedRoute {
  /** Directed physical route key. */
  identityKey: string;
  target: RouteSelectionTarget;
  count: number;
}

function routeConfirmed(flight: KeeprawFlight): boolean {
  return originIdentity(flight).confirmed && arrivalIdentity(flight).confirmed;
}

/** The directed route flown most often between confirmed physical airports. */
export function mostFlownRoute(
  flights: readonly KeeprawFlight[],
): RankedRoute | null {
  const counts = new Map<string, number>();
  const targets = new Map<string, RouteSelectionTarget>();
  for (const flight of flown(flights)) {
    if (!routeConfirmed(flight)) continue;
    const key = flightRouteIdentityKey(flight);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!targets.has(key)) targets.set(key, flightRouteTarget(flight));
  }
  const top = ranked(counts)[0];
  return top
    ? {
        identityKey: top.code,
        target: targets.get(top.code)!,
        count: top.count,
      }
    : null;
}

export interface OrdinalOfTotal {
  /** 1-based position in chronological order. */
  ordinal: number;
  total: number;
}

export interface FlightContext {
  /** Which visit to the departure airport this flight is; null when undetermined. */
  origin: OrdinalOfTotal | null;
  /** Which visit to the airport actually arrived at; null when undetermined. */
  arrival: OrdinalOfTotal | null;
  /** Which flight on this directed route; null when either airport is undetermined. */
  route: OrdinalOfTotal | null;
}

/**
 * By departure instant. Local service dates run backwards across the date
 * line, so they only break ties and order flights without a readable time.
 */
function chronological(flights: readonly KeeprawFlight[]): KeeprawFlight[] {
  return flown(flights).sort(
    (a, b) =>
      Date.parse(a.scheduledDeparture) - Date.parse(b.scheduledDeparture) ||
      a.serviceDate.localeCompare(b.serviceDate),
  );
}

/**
 * Where one flight stands in the whole archive. A departure and an arrival
 * each count as a visit, the same way the airport ranking counts them.
 */
export function flightContext(
  flights: readonly KeeprawFlight[],
  flightId: string,
): FlightContext {
  const context: FlightContext = { origin: null, arrival: null, route: null };
  const subject = flights.find((flight) => flight.id === flightId);
  if (!subject || subject.cancelled) return context;
  const origin = originIdentity(subject);
  const arrival = arrivalIdentity(subject);
  const route = routeConfirmed(subject)
    ? flightRouteIdentityKey(subject)
    : null;
  const visits = new Map<string, number>();
  let routeFlights = 0;
  let found: {
    origin: number | null;
    arrival: number | null;
    route: number | null;
  } | null = null;
  const visit = (identity: FlightEndpointIdentity): number | null => {
    if (!identity.confirmed) return null;
    const next = (visits.get(identity.identityKey) ?? 0) + 1;
    visits.set(identity.identityKey, next);
    return next;
  };
  for (const flight of chronological(flights)) {
    const originVisit = visit(originIdentity(flight));
    const arrivalVisit = visit(arrivalIdentity(flight));
    const onRoute =
      route !== null &&
      routeConfirmed(flight) &&
      flightRouteIdentityKey(flight) === route;
    if (onRoute) routeFlights += 1;
    if (flight.id === flightId)
      found = {
        origin: originVisit,
        arrival: arrivalVisit,
        route: onRoute ? routeFlights : null,
      };
  }
  if (!found) return context;
  const of = (ordinal: number | null, total: number): OrdinalOfTotal | null =>
    ordinal === null ? null : { ordinal, total };
  return {
    origin: of(found.origin, visits.get(origin.identityKey) ?? 0),
    arrival: of(found.arrival, visits.get(arrival.identityKey) ?? 0),
    route: of(found.route, routeFlights),
  };
}
