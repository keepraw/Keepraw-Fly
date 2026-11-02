import type { KeeprawFlight } from "@keepraw-fly/schema";
import { airportByIata } from "./reference-data";
import { airlineSearchText } from "./airline-reference";
import { normalizeSearchValue } from "./normalization";
import {
  originIdentity,
  plannedDestinationIdentity,
  arrivalIdentity,
} from "./flight-airports";
import type { FlightEndpointIdentity } from "./flight-airports";

function identitySearchText(identity: FlightEndpointIdentity): string {
  return [
    ...Object.values(identity.name ?? {}),
    ...Object.values(identity.city ?? {}),
  ].join(" ");
}

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
  return normalizeSearchValue(
    [
      flight.flightNumber,
      flight.flightNumber.replace(/[\s-]+/g, ""),
      airlineCode,
      flight.serviceDate,
      flight.serviceDate.slice(0, 4),
      airlineSearchText(flight.airline),
      airportSearchText(flight.origin.iata),
      airportSearchText(flight.destination.iata),
      flight.divertedTo ? airportSearchText(flight.divertedTo.iata) : "",
      identitySearchText(originIdentity(flight)),
      identitySearchText(plannedDestinationIdentity(flight)),
      flight.divertedTo ? identitySearchText(arrivalIdentity(flight)) : "",
      extensionSearchText(flight),
    ].join(" "),
  );
}

export function searchFlights(
  flights: KeeprawFlight[],
  query: string,
): KeeprawFlight[] {
  const terms = normalizeSearchValue(query.trim()).split(/\s+/).filter(Boolean);

  if (terms.length === 0) return flights;

  return flights.filter((flight) => {
    const text = flightSearchText(flight);
    return terms.every((term) => text.includes(term));
  });
}
