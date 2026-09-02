import type { KeeprawFlight } from "@keepraw-fly/schema";
import { airlineByIata, airportByIata } from "./reference-data";
import { normalizeSearchValue } from "./normalization";

function extensionSearchText(flight: KeeprawFlight): string {
  const aircraft = flight.extensions?.["keepraw-fly.aircraft"];
  if (!aircraft || typeof aircraft !== "object" || Array.isArray(aircraft)) {
    return "";
  }

  const fields = aircraft as Record<string, unknown>;
  return [fields.type, fields.registration]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
}

function airportSearchText(iata: string): string {
  const airport = airportByIata.get(iata);
  if (!airport) return iata;
  return [
    iata,
    ...Object.values(airport.name),
    ...Object.values(airport.city),
  ].join(" ");
}

export function flightSearchText(flight: KeeprawFlight): string {
  const airlineCode = flight.airline.iata ?? flight.airline.icao ?? "";
  const airline = flight.airline.iata
    ? airlineByIata.get(flight.airline.iata)
    : undefined;

  return normalizeSearchValue([
    flight.flightNumber,
    flight.flightNumber.replace(/[\s-]+/g, ""),
    airlineCode,
    flight.serviceDate,
    flight.serviceDate.slice(0, 4),
    airline ? Object.values(airline.name).join(" ") : "",
    airportSearchText(flight.origin.iata),
    airportSearchText(flight.destination.iata),
    extensionSearchText(flight),
  ].join(" "));
}

export function searchFlights(
  flights: KeeprawFlight[],
  query: string,
): KeeprawFlight[] {
  const terms = normalizeSearchValue(query.trim())
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length === 0) return flights;

  return flights.filter((flight) => {
    const text = flightSearchText(flight);
    return terms.every((term) => text.includes(term));
  });
}
