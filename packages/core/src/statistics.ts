import type { KeeprawFlight } from "@keepraw-fly/schema";
import { arrivalDelayMinutes, flightDuration } from "./calculations";
import type { SupportedLocale } from "./reference-data";
import {
  arrivalIdentity,
  flightDistanceKilometers,
  originIdentity,
  plannedDestinationIdentity,
  type FlightEndpointIdentity,
} from "./flight-airports";
import { airlineNames, resolveAirline } from "./airline-reference";

export interface RankedCode {
  code: string;
  count: number;
}

export interface RankedAirport extends RankedCode {
  /** Stable physical identity (`airport:<apt_>` or `current:<IATA>`). */
  identityKey: string;
  identity: FlightEndpointIdentity;
}

export interface FlightDistanceRecord {
  flightId: string;
  kilometers: number;
}

export interface PassportStatistics {
  flights: number;
  distanceKilometers: number;
  durationMinutes: number;
  totalDelayMinutes: number | null;
  countries: number;
  /** Distinct confirmed physical airports (formal airportId or explicit current-directory site). */
  airports: number;
  /** Distinct endpoint codes whose physical airport is not determined at the flight date. */
  unresolvedAirports: number;
  airlines: number;
  aircraftTypes: number;
  mostFlownAirline: RankedCode | null;
  mostVisitedAirport: RankedAirport | null;
  longestFlight: FlightDistanceRecord | null;
  shortestFlight: FlightDistanceRecord | null;
}

export interface YearStatistics {
  year: number;
  flights: number;
  distanceKilometers: number;
  durationMinutes: number;
  airlines: number;
  airports: number;
  routes: number;
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function topCount(counts: Map<string, number>): RankedCode | null {
  const top = [...counts].sort(
    ([codeA, countA], [codeB, countB]) =>
      countB - countA || codeA.localeCompare(codeB),
  )[0];
  return top ? { code: top[0], count: top[1] } : null;
}

function aircraftType(flight: KeeprawFlight): string | null {
  const extension = flight.extensions?.["keepraw-fly.aircraft"];
  if (!extension || typeof extension !== "object" || Array.isArray(extension)) {
    return null;
  }
  const type = (extension as Record<string, unknown>).type;
  return typeof type === "string" ? type : null;
}

/** Great-circle distance between the flight-date physical airports, or null when either is undetermined. */
export function distanceForFlight(flight: KeeprawFlight): number | null {
  return flightDistanceKilometers(flight);
}

export function calculatePassportStatistics(
  flights: KeeprawFlight[],
): PassportStatistics {
  const airlineCounts = new Map<string, number>();
  const airportCounts = new Map<string, number>();
  const airportIdentities = new Map<string, FlightEndpointIdentity>();
  const unresolved = new Set<string>();
  const countryCodes = collectVisitedCountryCodes(flights);
  const aircraftTypes = new Set<string>();
  const distances: FlightDistanceRecord[] = [];
  let durationMinutes = 0;
  let totalDelayMinutes = 0;
  let delayCoverage = 0;

  for (const flight of flights) {
    if (flight.cancelled) continue;
    const airlineCode = flight.airline.iata ?? flight.airline.icao;
    if (airlineCode) increment(airlineCounts, airlineCode);
    for (const identity of [originIdentity(flight), arrivalIdentity(flight)]) {
      if (!identity.confirmed) {
        unresolved.add(identity.identityKey);
        continue;
      }
      increment(airportCounts, identity.identityKey);
      if (!airportIdentities.has(identity.identityKey))
        airportIdentities.set(identity.identityKey, identity);
    }

    const type = aircraftType(flight);
    if (type) aircraftTypes.add(type);

    const kilometers = distanceForFlight(flight);
    if (kilometers !== null)
      distances.push({ flightId: flight.id, kilometers });
    durationMinutes += flightDuration(flight).minutes;
    const arrivalDelay = arrivalDelayMinutes(flight);
    if (arrivalDelay !== null) {
      delayCoverage += 1;
      totalDelayMinutes += Math.max(0, arrivalDelay);
    }
  }

  const rankedDistances = [...distances].sort(
    (a, b) => a.kilometers - b.kilometers,
  );

  return {
    flights: flights.filter((flight) => !flight.cancelled).length,
    distanceKilometers: distances.reduce(
      (sum, item) => sum + item.kilometers,
      0,
    ),
    durationMinutes,
    totalDelayMinutes: delayCoverage ? totalDelayMinutes : null,
    countries: countryCodes.size,
    airports: airportCounts.size,
    unresolvedAirports: unresolved.size,
    airlines: airlineCounts.size,
    aircraftTypes: aircraftTypes.size,
    mostFlownAirline: topCount(airlineCounts),
    mostVisitedAirport: rankedAirport(airportCounts, airportIdentities),
    shortestFlight: rankedDistances[0] ?? null,
    longestFlight: rankedDistances.at(-1) ?? null,
  };
}

function rankedAirport(
  counts: Map<string, number>,
  identities: Map<string, FlightEndpointIdentity>,
): RankedAirport | null {
  const top = topCount(counts);
  if (!top) return null;
  const identity = identities.get(top.code)!;
  return {
    code: identity.iata,
    count: top.count,
    identityKey: top.code,
    identity,
  };
}

/** Countries of confirmed flight-date airports only; unresolved codes add none. */
export function collectVisitedCountryCodes(
  flights: KeeprawFlight[],
): Set<string> {
  const countryCodes = new Set<string>();
  for (const flight of flights) {
    if (flight.cancelled) continue;
    for (const identity of [originIdentity(flight), arrivalIdentity(flight)]) {
      if (identity.confirmed && identity.country)
        countryCodes.add(identity.country);
    }
  }
  return countryCodes;
}

export function calculateYearStatistics(
  flights: KeeprawFlight[],
): YearStatistics[] {
  const years = new Map<number, KeeprawFlight[]>();
  for (const flight of flights) {
    const year = Number(flight.serviceDate.slice(0, 4));
    years.set(year, [...(years.get(year) ?? []), flight]);
  }

  return [...years]
    .map(([year, yearFlights]) => {
      const stats = calculatePassportStatistics(yearFlights);
      return {
        year,
        flights: stats.flights,
        distanceKilometers: stats.distanceKilometers,
        durationMinutes: stats.durationMinutes,
        airlines: stats.airlines,
        airports: stats.airports,
        // Routes join physical identities, so HKG-1997 and HKG-1999 differ.
        routes: new Set(
          yearFlights
            .filter((flight) => !flight.cancelled)
            .map(
              (flight) =>
                `${originIdentity(flight).identityKey}>${plannedDestinationIdentity(flight).identityKey}`,
            ),
        ).size,
      };
    })
    .sort((a, b) => b.year - a.year);
}

export function airlineDisplayName(
  code: string,
  locale: SupportedLocale,
): string {
  const airline = resolveAirline(code);
  return airline ? airlineNames(airline, locale)[0] : code;
}
