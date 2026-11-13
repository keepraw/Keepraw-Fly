import type { KeeprawFlight, JsonValue } from "@keepraw-fly/schema";
import {
  resolveAirportAtDate,
  type AirportHistoryResolution,
  type AirportHistoryStatus,
} from "./airport-history";
import {
  airportById,
  airportByIata,
  type AirportReference,
  type LocalizedText,
} from "./reference-data";
import { distanceKilometers } from "./calculations";

export type EndpointRole = "origin" | "destination" | "arrival";
export type EndpointIdentityBasis =
  "user" | "formal" | "current_directory" | "unresolved";
export type AssignmentEvidence =
  | "user_confirmed"
  | "historically_verified"
  | "formal_uncertain"
  | "current_directory"
  | "unknown";
export interface PossibleAirportPosition {
  siteId: string;
  name: string | null;
  latitude: number;
  longitude: number;
  source: "formal_possible";
}
export interface FlightEndpointIdentity {
  role: EndpointRole;
  iata: string;
  localDate: string | null;
  status: AirportHistoryStatus;
  resolution: AirportHistoryResolution | null;
  identityKey: string;
  confirmed: boolean;
  basis: EndpointIdentityBasis;
  historicalAssignmentVerified: boolean;
  assignmentEvidence: AssignmentEvidence;
  airportId: string | null;
  point: { latitude: number; longitude: number } | null;
  possiblePositions: PossibleAirportPosition[];
  timezone: string | null;
  timezoneOptions: string[];
  name: LocalizedText | null;
  city: LocalizedText | null;
  country: string | null;
  differsFromCurrentDirectory: boolean;
}
export const AIRPORT_TIMEZONE_EXTENSION = "keepraw-fly.airport-timezones";
export function storedEndpointTimezone(
  flight: Pick<KeeprawFlight, "extensions">,
  role: "origin" | "destination" | "divertedTo",
): string | null {
  const extension = flight.extensions?.[AIRPORT_TIMEZONE_EXTENSION];
  if (!extension || typeof extension !== "object" || Array.isArray(extension))
    return null;
  const value = (extension as Record<string, JsonValue>)[role];
  return typeof value === "string" && isTimezoneOrOffset(value) ? value : null;
}
export function isFixedOffset(value: string): boolean {
  return /^[+-](?:0\d|1[0-4]):[0-5]\d$/.test(value);
}
export function isTimezoneOrOffset(value: string): boolean {
  if (isFixedOffset(value)) return true;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
export function localDateInZone(iso: string, zone: string): string | null {
  const instant = Date.parse(iso);
  if (!Number.isFinite(instant)) return null;
  if (isFixedOffset(zone)) {
    const minutes =
      (zone.startsWith("-") ? -1 : 1) *
      (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4, 6)));
    return new Date(instant + minutes * 60_000).toISOString().slice(0, 10);
  }
  try {
    let formatter = dateFormatters.get(zone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      if (dateFormatters.size > 256) dateFormatters.clear();
      dateFormatters.set(zone, formatter);
    }
    const parts = formatter.formatToParts(instant);
    const value = (type: string) =>
      parts.find((part) => part.type === type)?.value;
    return `${value("year")}-${value("month")}-${value("day")}`;
  } catch {
    return null;
  }
}
export function writtenLocalDate(iso: string): string | null {
  return /^\d{4}-\d{2}-\d{2}T/.test(iso) ? iso.slice(0, 10) : null;
}
export function assignmentEvidenceFor(identity: {
  status: AirportHistoryStatus;
  basis: EndpointIdentityBasis;
}): AssignmentEvidence {
  if (identity.basis === "user") return "user_confirmed";
  if (identity.basis === "formal") return "historically_verified";
  if (identity.basis === "current_directory") return "current_directory";
  return identity.status === "uncertain" || identity.status === "ambiguous"
    ? "formal_uncertain"
    : "unknown";
}
/** Saved identity is authoritative, including when its ID is temporarily unavailable. */
export function resolveEndpointIdentity(
  iata: string,
  localDate: string | null,
  role: EndpointRole,
  storedZone: string | null = null,
  airportId?: string,
): FlightEndpointIdentity {
  const resolution =
    !airportId && localDate ? resolveAirportAtDate(iata, localDate) : null;
  let airport: AirportReference | undefined;
  let basis: EndpointIdentityBasis = "unresolved";
  if (airportId) {
    airport = airportById.get(airportId);
    if (airport) basis = "user";
  } else if (resolution?.status === "resolved") {
    airport = resolution.airport ?? undefined;
    basis = "formal";
  } else if (resolution?.status === "current_directory_only") {
    airport = resolution.airport ?? undefined;
    basis = "current_directory";
  }
  const status =
    airportId && airport ? "resolved" : (resolution?.status ?? "unknown_code");
  const possible = (resolution?.uncertainty.possibleAirportIds ?? []).flatMap(
    (id) => {
      const entity = airportById.get(id);
      return entity ? [entity] : [];
    },
  );
  const zones = [
    ...new Set(possible.map((entity) => entity.timezone).filter(Boolean)),
  ];
  const timezone =
    airport?.timezone || storedZone || (zones.length === 1 ? zones[0]! : null);
  const id = airportId ?? airport?.airportId ?? null;
  return {
    role,
    iata,
    localDate,
    status,
    resolution,
    basis,
    identityKey: id ? `airport:${id}` : `unresolved:${iata}`,
    confirmed: Boolean(airport),
    airportId: id,
    historicalAssignmentVerified: basis === "formal",
    assignmentEvidence: assignmentEvidenceFor({ status, basis }),
    point: airport
      ? { latitude: airport.latitude, longitude: airport.longitude }
      : null,
    possiblePositions: airport
      ? []
      : possible.map((entity) => ({
          siteId: entity.airportId!,
          name: entity.name.en,
          latitude: entity.latitude,
          longitude: entity.longitude,
          source: "formal_possible",
        })),
    timezone,
    timezoneOptions: timezone ? [timezone] : zones,
    name: airport?.name ?? null,
    city: airport?.city ?? null,
    country: airport?.country ?? null,
    differsFromCurrentDirectory: Boolean(
      airport && airportByIata.get(iata)?.airportId !== airport.airportId,
    ),
  };
}
function endpointAtArrival(
  flight: KeeprawFlight,
  endpoint: "destination" | "divertedTo",
  role: EndpointRole,
  iso: string,
): FlightEndpointIdentity {
  const value = flight[endpoint]!;
  const zone = storedEndpointTimezone(flight, endpoint);
  let date = writtenLocalDate(iso);
  let identity = resolveEndpointIdentity(
    value.iata,
    date,
    role,
    zone,
    value.airportId,
  );
  for (let round = 0; round < 3 && identity.timezone; round++) {
    const next = localDateInZone(iso, identity.timezone);
    if (!next || next === date) break;
    date = next;
    identity = resolveEndpointIdentity(
      value.iata,
      date,
      role,
      zone,
      value.airportId,
    );
  }
  return identity;
}
export function originIdentity(flight: KeeprawFlight): FlightEndpointIdentity {
  return resolveEndpointIdentity(
    flight.origin.iata,
    flight.serviceDate,
    "origin",
    storedEndpointTimezone(flight, "origin"),
    flight.origin.airportId,
  );
}
export function plannedDestinationIdentity(
  flight: KeeprawFlight,
): FlightEndpointIdentity {
  return endpointAtArrival(
    flight,
    "destination",
    "destination",
    flight.scheduledArrival,
  );
}
export function arrivalIdentity(flight: KeeprawFlight): FlightEndpointIdentity {
  return endpointAtArrival(
    flight,
    flight.divertedTo ? "divertedTo" : "destination",
    "arrival",
    flight.actualArrival ?? flight.scheduledArrival,
  );
}
export function flightEndpointIdentities(flight: KeeprawFlight) {
  return {
    origin: originIdentity(flight),
    destination: plannedDestinationIdentity(flight),
    arrival: arrivalIdentity(flight),
  };
}
export function flightDistanceKilometers(flight: KeeprawFlight): number | null {
  const origin = originIdentity(flight);
  const arrival = arrivalIdentity(flight);
  return origin.point && arrival.point
    ? distanceKilometers(origin.point, arrival.point)
    : null;
}
