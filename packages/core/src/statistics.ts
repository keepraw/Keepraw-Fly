import type { KeeprawFlight } from "@keepraw-fly/schema";
import { distanceKilometers, flightDuration } from "./calculations";
import { airlineByIata, airportByIata } from "./reference-data";

export interface RankedCode {
  code: string;
  count: number;
}

export interface FlightDistanceRecord {
  flightId: string;
  kilometers: number;
}

export interface PassportStatistics {
  flights: number;
  distanceKilometers: number;
  durationMinutes: number;
  countries: number;
  airports: number;
  airlines: number;
  aircraftTypes: number;
  mostFlownAirline: RankedCode | null;
  mostVisitedAirport: RankedCode | null;
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
    ([codeA, countA], [codeB, countB]) => countB - countA || codeA.localeCompare(codeB),
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

export function distanceForFlight(flight: KeeprawFlight): number | null {
  const origin = airportByIata.get(flight.origin.iata);
  const destination = airportByIata.get(flight.destination.iata);
  return origin && destination ? distanceKilometers(origin, destination) : null;
}

export function calculatePassportStatistics(
  flights: KeeprawFlight[],
): PassportStatistics {
  const airlineCounts = new Map<string, number>();
  const airportCounts = new Map<string, number>();
  const countryCodes = new Set<string>();
  const aircraftTypes = new Set<string>();
  const distances: FlightDistanceRecord[] = [];
  let durationMinutes = 0;

  for (const flight of flights) {
    const airlineCode = flight.airline.iata ?? flight.airline.icao;
    if (airlineCode) increment(airlineCounts, airlineCode);
    increment(airportCounts, flight.origin.iata);
    increment(airportCounts, flight.destination.iata);

    for (const iata of [flight.origin.iata, flight.destination.iata]) {
      const country = airportByIata.get(iata)?.country;
      if (country) countryCodes.add(country);
    }

    const type = aircraftType(flight);
    if (type) aircraftTypes.add(type);

    const kilometers = distanceForFlight(flight);
    if (kilometers !== null) distances.push({ flightId: flight.id, kilometers });
    durationMinutes += flightDuration(flight).minutes;
  }

  const rankedDistances = [...distances].sort((a, b) => a.kilometers - b.kilometers);

  return {
    flights: flights.length,
    distanceKilometers: distances.reduce((sum, item) => sum + item.kilometers, 0),
    durationMinutes,
    countries: countryCodes.size,
    airports: airportCounts.size,
    airlines: airlineCounts.size,
    aircraftTypes: aircraftTypes.size,
    mostFlownAirline: topCount(airlineCounts),
    mostVisitedAirport: topCount(airportCounts),
    shortestFlight: rankedDistances[0] ?? null,
    longestFlight: rankedDistances.at(-1) ?? null,
  };
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
        routes: new Set(
          yearFlights.map(
            (flight) => `${flight.origin.iata}-${flight.destination.iata}`,
          ),
        ).size,
      };
    })
    .sort((a, b) => b.year - a.year);
}

export function airlineDisplayName(code: string, locale: "en" | "zh-CN"): string {
  return airlineByIata.get(code)?.name[locale] ?? code;
}
