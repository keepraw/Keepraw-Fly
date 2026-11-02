/**
 * Date-aware airport identity for each endpoint of a Keepraw flight.
 *
 * Every statistic, route, distance and display that used to look a code up in
 * the current directory goes through these helpers, so a 1997 HKG flight is Kai
 * Tak and a 2020 HKG flight is Chek Lap Kok, and two physical airports that
 * shared a code are never merged.
 *
 * Dates: the origin uses `serviceDate` (the departure airport's local date).
 * The arrival uses the real arrival instant (`actualArrival ?? scheduledArrival`)
 * converted with the *historical* arrival airport's IANA zone, or the diversion
 * airport when the flight diverted.
 */
import type { KeeprawFlight, JsonValue } from "@keepraw-fly/schema";
import {
  airportHistoryCandidateVersion,
  resolveAirportAtDate,
  SAME_SITE_KILOMETERS,
  formalAirports,
  type AirportHistoryResolution,
  type AirportHistoryStatus,
} from "./airport-history";
import { distanceKilometers } from "./calculations";
import {
  airportByIata,
  airportDirectoryVersion,
  type AirportReference,
  type LocalizedText,
} from "./reference-data";

export type EndpointRole = "origin" | "destination" | "arrival";

export type EndpointIdentityBasis =
  /** Formal layer resolved exactly one airport for this date. */
  | "formal"
  /**
   * Formal layer has exactly one possible airport and the date is only past the
   * formal review horizon; the current directory places the same code at that
   * same physical site. Status stays `uncertain`, flagged in the UI.
   */
  | "formal_open_horizon_current_directory"
  /** No formal history; the current directory (alone or with matching candidates) places it. */
  | "current_directory"
  /** Candidate index not loaded yet; current directory used provisionally. */
  | "current_directory_pending_candidates"
  | "unresolved";

/**
 * What the flight-date code assignment rests on, separate from whether a
 * physical position is usable (`confirmed`):
 * - `historically_verified`: the formal layer resolved the code to exactly one
 *   airport on this date (conservative date rules).
 * - `formal_uncertain`: formal assignments exist but the date is in an
 *   uncertain boundary or past the review horizon; never a historical fact.
 * - `current_directory`: only today's airport directory places the code; the
 *   code's validity on the historical date is not verified.
 * - `historical_candidate`: candidate leads only; the identity is unresolved.
 * - `unknown`: no layer knows the code.
 */
export type AssignmentEvidence =
  | "historically_verified"
  | "formal_uncertain"
  | "current_directory"
  | "historical_candidate"
  | "unknown";

export interface PossibleAirportPosition {
  siteId: string;
  name: string | null;
  latitude: number;
  longitude: number;
  source: "formal_possible" | "historical_candidate";
}

export interface FlightEndpointIdentity {
  role: EndpointRole;
  iata: string;
  localDate: string | null;
  status: AirportHistoryStatus;
  resolution: AirportHistoryResolution | null;
  /** Stable statistic key; confirmed airports never share a key with another physical site. */
  identityKey: string;
  /**
   * True when a physical position is usable: a formal airport or an explicit
   * current-directory site. Usability is not historical verification; see
   * `historicalAssignmentVerified`.
   */
  confirmed: boolean;
  basis: EndpointIdentityBasis;
  /** True only for a formal assignment resolved on this flight date. */
  historicalAssignmentVerified: boolean;
  assignmentEvidence: AssignmentEvidence;
  airportId: string | null;
  point: { latitude: number; longitude: number } | null;
  possiblePositions: PossibleAirportPosition[];
  timezone: string | null;
  /** Candidate zones when the airport is not determined; never auto-picked if several. */
  timezoneOptions: string[];
  name: LocalizedText | null;
  city: LocalizedText | null;
  country: string | null;
  /** True when the historical site differs from today's directory site for the code. */
  differsFromCurrentDirectory: boolean;
}

export const AIRPORT_TIMEZONE_EXTENSION = "keepraw-fly.airport-timezones";

/** User-confirmed zone or `±HH:MM` offset for endpoints Keepraw cannot place. */
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

const OFFSET = /^[+-](?:0\d|1[0-4]):[0-5]\d$/;

export function isFixedOffset(value: string): boolean {
  return OFFSET.test(value);
}

const validZones = new Map<string, boolean>();

export function isTimezoneOrOffset(value: string): boolean {
  if (isFixedOffset(value)) return true;
  const known = validZones.get(value);
  if (known !== undefined) return known;
  let valid: boolean;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    valid = true;
  } catch {
    valid = false;
  }
  if (validZones.size > 512) validZones.clear();
  validZones.set(value, valid);
  return valid;
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(zone: string): Intl.DateTimeFormat {
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
  return formatter;
}

/** Calendar date of an instant in an IANA zone or fixed `±HH:MM` offset. */
export function localDateInZone(iso: string, zone: string): string | null {
  const instant = Date.parse(iso);
  if (Number.isNaN(instant)) return null;
  if (isFixedOffset(zone)) {
    const sign = zone.startsWith("-") ? -1 : 1;
    const minutes =
      sign * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4, 6)));
    return new Date(instant + minutes * 60_000).toISOString().slice(0, 10);
  }
  try {
    const parts = dateFormatter(zone).formatToParts(instant);
    const value = (type: string) =>
      parts.find((part) => part.type === type)?.value;
    return `${value("year")}-${value("month")}-${value("day")}`;
  } catch {
    return null;
  }
}

/** The wall date written in an RFC 3339 timestamp's own offset. */
export function writtenLocalDate(iso: string): string | null {
  return /^\d{4}-\d{2}-\d{2}T/.test(iso) ? iso.slice(0, 10) : null;
}

function near(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
  kilometers = SAME_SITE_KILOMETERS,
): boolean {
  return distanceKilometers(a, b) <= kilometers;
}

/** Two reference points this close describe one physical airport site. */
const IDENTICAL_SITE_KILOMETERS = 3;

const cache = new Map<string, FlightEndpointIdentity>();

function cacheKey(
  iata: string,
  date: string | null,
  role: EndpointRole,
  zone: string | null,
): string {
  // The entry itself is part of the key: callers may replace one directory row.
  const entry = airportByIata.get(iata);
  const place = entry
    ? `${entry.latitude},${entry.longitude},${entry.timezone},${entry.country}`
    : "-";
  return `${airportDirectoryVersion()}|${airportHistoryCandidateVersion()}|${iata}|${date}|${role}|${zone}|${place}`;
}

function directoryNames(directory: AirportReference | null) {
  return directory
    ? { name: directory.name, city: directory.city, country: directory.country }
    : { name: null, city: null, country: null };
}

/** Resolves one endpoint code at its local date. */
export function resolveEndpointIdentity(
  iata: string,
  localDate: string | null,
  role: EndpointRole,
  storedZone: string | null = null,
): FlightEndpointIdentity {
  const key = cacheKey(iata, localDate, role, storedZone);
  const cached = cache.get(key);
  if (cached) return cached;
  const identity = withAssignmentEvidence(
    computeIdentity(iata, localDate, role, storedZone),
  );
  if (cache.size > 4096) cache.clear();
  cache.set(key, identity);
  return identity;
}

type BaseIdentity = Omit<
  FlightEndpointIdentity,
  "historicalAssignmentVerified" | "assignmentEvidence"
>;

export function assignmentEvidenceFor(identity: {
  status: AirportHistoryStatus;
  basis: EndpointIdentityBasis;
}): AssignmentEvidence {
  if (identity.basis === "formal" && identity.status === "resolved")
    return "historically_verified";
  if (
    identity.basis === "formal_open_horizon_current_directory" ||
    identity.status === "uncertain" ||
    identity.status === "ambiguous"
  )
    return "formal_uncertain";
  if (
    identity.basis === "current_directory" ||
    identity.basis === "current_directory_pending_candidates"
  )
    return "current_directory";
  if (identity.status === "historical_candidate") return "historical_candidate";
  return "unknown";
}

function withAssignmentEvidence(
  identity: BaseIdentity,
): FlightEndpointIdentity {
  const assignmentEvidence = assignmentEvidenceFor(identity);
  return {
    ...identity,
    assignmentEvidence,
    historicalAssignmentVerified:
      assignmentEvidence === "historically_verified",
  };
}

function computeIdentity(
  iata: string,
  localDate: string | null,
  role: EndpointRole,
  storedZone: string | null,
): BaseIdentity {
  const directory = airportByIata.get(iata) ?? null;
  const unresolved = (
    resolution: AirportHistoryResolution | null,
    status: AirportHistoryStatus,
  ): BaseIdentity => {
    const positions: PossibleAirportPosition[] = [];
    if (resolution) {
      for (const id of resolution.uncertainty.possibleAirportIds) {
        const airport = formalAirports.get(id);
        if (airport)
          positions.push({
            siteId: id,
            name: airport.name,
            latitude: airport.latitude,
            longitude: airport.longitude,
            source: "formal_possible",
          });
      }
      const seen = new Set(positions.map((p) => p.siteId));
      for (const site of [
        ...resolution.candidateSites,
        ...resolution.candidates.flatMap((c) => c.possibleSites),
      ]) {
        if (
          seen.has(site.siteId) ||
          site.latitude === null ||
          site.longitude === null
        )
          continue;
        seen.add(site.siteId);
        positions.push({
          siteId: site.siteId,
          name: site.name,
          latitude: site.latitude,
          longitude: site.longitude,
          source: "historical_candidate",
        });
      }
    }
    const possibleZones = new Set<string>();
    for (const id of resolution?.uncertainty.possibleAirportIds ?? []) {
      const zone = formalAirports.get(id)?.timezone;
      if (zone) possibleZones.add(zone);
    }
    for (const zone of resolution?.uncertainty.candidateTimezones ?? [])
      possibleZones.add(zone);
    const zones = [...possibleZones].sort();
    // A zone is usable only when every formal possibility agrees on it, or the user confirmed one.
    const formalZones = new Set(
      (resolution?.uncertainty.possibleAirportIds ?? [])
        .map((id) => formalAirports.get(id)?.timezone)
        .filter(Boolean),
    );
    // A zone is usable when every possibility agrees: all formal candidates
    // (uncertain), or the current directory and every candidate site that
    // carries a zone (historical_candidate). Several zones are never picked.
    // A site without a zone is an unknown zone, never a vacuous agreement.
    const hypothesisSites = resolution
      ? [
          ...resolution.candidateSites,
          ...resolution.candidates.flatMap((c) => c.possibleSites),
        ]
      : [];
    const agreeingDirectoryZone =
      status === "historical_candidate" &&
      directory &&
      hypothesisSites.length > 0 &&
      hypothesisSites.every((site) => site.timezone === directory.timezone) &&
      zones.every((zone) => zone === directory.timezone)
        ? directory.timezone
        : null;
    const timezone =
      storedZone ??
      (status === "uncertain" && formalZones.size === 1
        ? [...formalZones][0]!
        : agreeingDirectoryZone);
    return {
      role,
      iata,
      localDate,
      status,
      resolution,
      identityKey: `unresolved:${iata}`,
      confirmed: false,
      basis: "unresolved",
      airportId: null,
      point: null,
      possiblePositions: positions,
      timezone,
      timezoneOptions: zones,
      name:
        directory && status === "candidate_index_unavailable"
          ? directory.name
          : null,
      city: null,
      country: null,
      differsFromCurrentDirectory: false,
    };
  };
  if (!localDate) return unresolved(null, "unknown_code");
  const resolution = resolveAirportAtDate(iata, localDate, "IATA");
  const formalView = (
    airportId: string,
    basis: EndpointIdentityBasis,
  ): BaseIdentity => {
    const airport = formalAirports.get(airportId)!;
    const sameAsDirectory = directory ? near(directory, airport) : false;
    // The formal identity (airportId) is authoritative. When the current
    // directory row is the very same physical site (every same-site pair in
    // the formal layer is within 1.7 km; distinct historical sites are 20 km+
    // apart), its established reference point is kept so continuing airports
    // do not shift by survey noise; a distinct historical site always uses
    // its own formal coordinates.
    const identicalSite = directory
      ? near(directory, airport, IDENTICAL_SITE_KILOMETERS)
      : false;
    const sitePoint =
      identicalSite && directory
        ? { latitude: directory.latitude, longitude: directory.longitude }
        : { latitude: airport.latitude, longitude: airport.longitude };
    const sameCity = directory ? near(directory, airport, 150) : false;
    return {
      role,
      iata,
      localDate,
      status: resolution.status,
      resolution,
      identityKey: `airport:${airportId}`,
      confirmed: true,
      basis,
      airportId,
      point: sitePoint,
      possiblePositions: [],
      timezone: airport.timezone,
      timezoneOptions: [airport.timezone],
      // A historical site keeps its own (English) reviewed name; only an
      // identical site may borrow the directory's localized names.
      name:
        sameAsDirectory && directory ? directory.name : { en: airport.name },
      city: sameCity && directory ? directory.city : null,
      country: sameCity && directory ? directory.country : null,
      differsFromCurrentDirectory: Boolean(directory) && !sameAsDirectory,
    };
  };
  switch (resolution.status) {
    case "resolved":
      return formalView(resolution.airportId!, "formal");
    case "uncertain": {
      const ids = resolution.uncertainty.possibleAirportIds;
      if (ids.length === 1 && directory) {
        const only = ids[0]!;
        const airport = formalAirports.get(only);
        const pastHorizonOnly = resolution.formalMatches.every(
          (match) =>
            match.assignment.validFrom.latest !== null &&
            localDate >= match.assignment.validFrom.latest,
        );
        if (airport && pastHorizonOnly && near(directory, airport))
          return formalView(only, "formal_open_horizon_current_directory");
      }
      return unresolved(resolution, "uncertain");
    }
    case "current_directory_only":
    case "candidate_index_unavailable": {
      if (!directory) return unresolved(resolution, resolution.status);
      // Never let a code's current site stand in for a different formal site.
      const formalCollision = [...formalAirports.values()].find((airport) =>
        near(directory, airport, IDENTICAL_SITE_KILOMETERS),
      );
      const names = directoryNames(directory);
      return {
        role,
        iata,
        localDate,
        status: resolution.status,
        resolution,
        identityKey: formalCollision
          ? `airport:${formalCollision.airportId}`
          : `current:${iata}`,
        confirmed: true,
        basis:
          resolution.status === "current_directory_only"
            ? "current_directory"
            : "current_directory_pending_candidates",
        airportId: null,
        point: { latitude: directory.latitude, longitude: directory.longitude },
        possiblePositions: [],
        timezone: directory.timezone,
        timezoneOptions: [directory.timezone],
        ...names,
        differsFromCurrentDirectory: false,
      };
    }
    default:
      return unresolved(resolution, resolution.status);
  }
}

function arrivalLocalDate(
  iata: string,
  iso: string,
  role: EndpointRole,
  storedZone: string | null,
): string | null {
  if (storedZone) return localDateInZone(iso, storedZone);
  // Iterate: the arrival airport depends on the local date and the local date
  // on the airport's zone. Start from the date written in the RFC 3339 offset.
  let date = writtenLocalDate(iso);
  for (let round = 0; round < 3 && date; round++) {
    const zone = resolveEndpointIdentity(iata, date, role).timezone;
    if (!zone) return date;
    const next = localDateInZone(iso, zone);
    if (!next || next === date) return date;
    date = next;
  }
  return date;
}

export function originIdentity(flight: KeeprawFlight): FlightEndpointIdentity {
  return resolveEndpointIdentity(
    flight.origin.iata,
    flight.serviceDate,
    "origin",
    storedEndpointTimezone(flight, "origin"),
  );
}

/** Planned destination at the scheduled arrival instant. */
export function plannedDestinationIdentity(
  flight: KeeprawFlight,
): FlightEndpointIdentity {
  const zone = storedEndpointTimezone(flight, "destination");
  const date = arrivalLocalDate(
    flight.destination.iata,
    flight.scheduledArrival,
    "destination",
    zone,
  );
  return resolveEndpointIdentity(
    flight.destination.iata,
    date,
    "destination",
    zone,
  );
}

/** Where the flight actually ended: the diversion airport when diverted. */
export function arrivalIdentity(flight: KeeprawFlight): FlightEndpointIdentity {
  if (!flight.divertedTo) {
    const zone = storedEndpointTimezone(flight, "destination");
    const instant = flight.actualArrival ?? flight.scheduledArrival;
    const date = arrivalLocalDate(
      flight.destination.iata,
      instant,
      "arrival",
      zone,
    );
    return resolveEndpointIdentity(
      flight.destination.iata,
      date,
      "arrival",
      zone,
    );
  }
  const zone = storedEndpointTimezone(flight, "divertedTo");
  const instant = flight.actualArrival ?? flight.scheduledArrival;
  const date = arrivalLocalDate(
    flight.divertedTo.iata,
    instant,
    "arrival",
    zone,
  );
  return resolveEndpointIdentity(flight.divertedTo.iata, date, "arrival", zone);
}

export function flightEndpointIdentities(flight: KeeprawFlight) {
  return {
    origin: originIdentity(flight),
    destination: plannedDestinationIdentity(flight),
    arrival: arrivalIdentity(flight),
  };
}

/** Distance only between two confirmed physical airports; candidates never stand in. */
export function flightDistanceKilometers(flight: KeeprawFlight): number | null {
  const origin = originIdentity(flight);
  const arrival = arrivalIdentity(flight);
  return origin.point && arrival.point
    ? distanceKilometers(origin.point, arrival.point)
    : null;
}

/** Codes (with their scheme) the archive needs from the candidate index. */
export function flightAirportCodes(
  flights: readonly KeeprawFlight[],
): { code: string; scheme: "IATA" }[] {
  const codes = new Set<string>();
  for (const flight of flights) {
    codes.add(flight.origin.iata);
    codes.add(flight.destination.iata);
    if (flight.divertedTo) codes.add(flight.divertedTo.iata);
  }
  return [...codes]
    .filter((code) => /^[A-Z]{3}$/.test(code))
    .sort()
    .map((code) => ({ code, scheme: "IATA" as const }));
}
