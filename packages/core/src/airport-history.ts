/** Reviewed assignments only. Research candidates never participate in resolution. */
import {
  airportById,
  airportByIata,
  airportIdsBySearchCode,
  localizedAirportName,
  type AirportReference,
  type SupportedLocale,
} from "./reference-data";
import {
  airportHistoryDataVersion,
  airportHistoryQueryHorizon,
  assignmentDateRelation,
  assignmentsByAirportId,
  formalAssignmentsForCode,
  isReviewedAirportClaim,
  type AirportCodeScheme,
  type AssignmentDateRelation,
  type FormalAssignment,
} from "./formal-airport-data";
import { searchAirports } from "./airport-search";
import { normalizeSearchValue } from "./normalization";

export {
  airportHistoryDataVersion,
  airportHistoryQueryHorizon,
  assignmentDateRelation,
  assignmentsByAirportId,
  formalAirportIdByOurAirportsId,
  formalAssignments,
  formalAssignmentsForCode,
  formalHistoricalNames,
  formalSources,
} from "./formal-airport-data";
export type {
  AirportCodeScheme,
  AssignmentDateRelation,
  FormalAssignment,
  UncertainDateBound,
} from "./formal-airport-data";

export type AirportHistoryStatus =
  | "resolved"
  | "uncertain"
  | "ambiguous"
  | "current_directory_only"
  | "unknown_code";
export interface AssignmentMatch {
  assignment: FormalAssignment;
  relation: AssignmentDateRelation;
}
export interface AirportHistoryResolution {
  code: string;
  scheme: AirportCodeScheme;
  queryDate: string;
  status: AirportHistoryStatus;
  airportId: string | null;
  airport: AirportReference | null;
  matchedAssignment: FormalAssignment | null;
  formalMatches: AssignmentMatch[];
  currentDirectoryAirport: AirportReference | null;
  uncertainty: { possibleAirportIds: string[] };
  dataVersion: string;
}
export function isValidAirportCode(
  code: string,
  scheme: AirportCodeScheme = "IATA",
): boolean {
  return (scheme === "IATA" ? /^[A-Z]{3}$/ : /^[A-Z]{4}$/).test(code);
}
export function resolveAirportAtDate(
  rawCode: string,
  date: string,
  scheme: AirportCodeScheme = "IATA",
): AirportHistoryResolution {
  const code = rawCode.trim().toUpperCase();
  const directory =
    scheme === "IATA" ? (airportByIata.get(code) ?? null) : null;
  const result: AirportHistoryResolution = {
    code,
    scheme,
    queryDate: date,
    status: "unknown_code",
    airportId: null,
    airport: null,
    matchedAssignment: null,
    formalMatches: [],
    currentDirectoryAirport: directory,
    uncertainty: { possibleAirportIds: [] },
    dataVersion: airportHistoryDataVersion,
  };
  const instant = Date.parse(`${date}T00:00:00Z`);
  if (
    !isValidAirportCode(code, scheme) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(instant) ||
    new Date(instant).toISOString().slice(0, 10) !== date
  )
    return result;
  const assignments = formalAssignmentsForCode(code, scheme);
  const matches = assignments
    .map((assignment) => ({
      assignment,
      relation: assignmentDateRelation(date, assignment),
    }))
    .filter((match) => match.relation !== "excluded");
  result.formalMatches = matches;
  const ids = [...new Set(matches.map((match) => match.assignment.airportId))];
  result.uncertainty.possibleAirportIds = ids;
  const certain = matches.filter(
    (match) =>
      match.relation === "certain" && isReviewedAirportClaim(match.assignment),
  );
  if (
    ids.length === 1 &&
    certain.length > 0 &&
    matches.every((match) => isReviewedAirportClaim(match.assignment))
  ) {
    result.airportId = ids[0]!;
    result.airport = airportById.get(ids[0]!) ?? null;
    result.matchedAssignment = certain[0]!.assignment;
    result.status = result.airport ? "resolved" : "unknown_code";
  } else if (
    directory &&
    (date < airportHistoryQueryHorizon.fromInclusive ||
      date >= airportHistoryQueryHorizon.toExclusive) &&
    assignments.length > 0 &&
    assignments.every((row) => row.airportId === directory.airportId) &&
    ids.length === 1
  ) {
    // Preserve the directory fallback for a single site beyond the evidence
    // horizon, including flights in older backups.
    result.status = "current_directory_only";
    result.airport = directory;
  } else if (assignments.length) {
    // Known historical reuse cannot fall back to today's site outside reviewed coverage.
    result.status =
      new Set(certain.map((match) => match.assignment.airportId)).size > 1
        ? "ambiguous"
        : "uncertain";
  } else if (directory) {
    const knownSites = airportIdsBySearchCode.get(code);
    if (knownSites && knownSites.size > 1) {
      result.status = "uncertain";
      result.uncertainty.possibleAirportIds = [...knownSites];
    } else {
      result.status = "current_directory_only";
      result.airport = directory;
    }
  }
  return result;
}

export interface HistoricalAirportSearchResult {
  kind: "formal";
  airportId: string;
  name: string;
  matchedName: string;
  latitude: number;
  longitude: number;
  timezone: string | null;
  assignments: FormalAssignment[];
  searchCode?: string;
}

/** Aliases help select an entity; they do not prove a historical allocation. */
export function searchHistoricalAirports(
  query: string,
  limit = 8,
  locale: SupportedLocale = "en",
  date?: string,
): HistoricalAirportSearchResult[] {
  return searchAirports(
    query,
    locale,
    limit,
    (airport) =>
      airport.status !== "operating" ||
      Boolean(airport.historicalNames?.length) ||
      (assignmentsByAirportId.get(airport.airportId) ?? []).some(
        (row) => row.scheme === "IATA" && row.code !== airport.currentIata,
      ),
  ).map((airport) => ({
    kind: "formal",
    airportId: airport.airportId,
    name:
      localizedAirportName(airport.airportId, locale, date) ?? airport.name.en,
    matchedName:
      [
        airport.name.en,
        ...Object.values(airport.name),
        ...(airport.historicalNames ?? []),
        ...(airport.searchAliases ?? []),
      ].find(
        (label) =>
          label &&
          normalizeSearchValue(label).includes(normalizeSearchValue(query)),
      ) ?? query,
    latitude: airport.latitude,
    longitude: airport.longitude,
    timezone: airport.timezone,
    searchCode: airport.iata,
    assignments: assignmentsByAirportId.get(airport.airportId) ?? [],
  }));
}
