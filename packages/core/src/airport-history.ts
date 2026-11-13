/** Reviewed assignments only. Research candidates never participate in resolution. */
import formalPackage from "../data/airport-history/formal/airports.json";
import {
  airportById,
  airportByIata,
  airportIdsBySearchCode,
  type AirportReference,
} from "./reference-data";

export type AirportCodeScheme = "IATA" | "ICAO";
export type AirportHistoryStatus =
  | "resolved"
  | "uncertain"
  | "ambiguous"
  | "current_directory_only"
  | "unknown_code";
export interface UncertainDateBound {
  earliest: string | null;
  latest: string | null;
  precision: string;
}
export interface FormalAssignment {
  assignmentId: string;
  airportId: string;
  scheme: AirportCodeScheme;
  code: string;
  evidenceType: string;
  verificationStatus: string;
  verifiedOn?: string;
  sourceIds: string[];
  validFrom: UncertainDateBound;
  validTo: UncertainDateBound;
  note?: string;
}
export type AssignmentDateRelation = "certain" | "possible" | "excluded";
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
export const airportHistoryDataVersion = formalPackage.dataVersion;
export const formalAssignments =
  formalPackage.assignments as FormalAssignment[];
export const formalSources = new Map(
  formalPackage.sources.map((source) => [source.sourceId, source]),
);
export const formalHistoricalNames = formalPackage.names;
const assignmentsByCode = new Map<string, FormalAssignment[]>();
for (const row of formalAssignments) {
  const key = `${row.scheme}:${row.code}`;
  assignmentsByCode.set(key, [...(assignmentsByCode.get(key) ?? []), row]);
}
export function formalAssignmentsForCode(
  code: string,
  scheme: AirportCodeScheme = "IATA",
) {
  return assignmentsByCode.get(`${scheme}:${code.trim().toUpperCase()}`) ?? [];
}
/** Certain [latest-start, earliest-end); null bounds never invent dates. */
export function assignmentDateRelation(
  day: string,
  row: FormalAssignment,
): AssignmentDateRelation {
  if (
    (row.validFrom.earliest !== null && day < row.validFrom.earliest) ||
    (row.validTo.latest !== null && day >= row.validTo.latest)
  )
    return "excluded";
  return row.validFrom.latest !== null &&
    day >= row.validFrom.latest &&
    row.validTo.earliest !== null &&
    day < row.validTo.earliest
    ? "certain"
    : "possible";
}
function reviewed(row: FormalAssignment): boolean {
  return (
    row.verificationStatus === "verified" &&
    Boolean(row.verifiedOn) &&
    row.sourceIds.length > 0 &&
    row.sourceIds.every(
      (id) => formalSources.get(id)?.verificationStatus === "verified",
    )
  );
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
    (match) => match.relation === "certain" && reviewed(match.assignment),
  );
  if (
    ids.length === 1 &&
    certain.length > 0 &&
    matches.every((match) => reviewed(match.assignment))
  ) {
    result.airportId = ids[0]!;
    result.airport = airportById.get(ids[0]!) ?? null;
    result.matchedAssignment = certain[0]!.assignment;
    result.status = result.airport ? "resolved" : "unknown_code";
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
  timezone: string;
  assignments: FormalAssignment[];
  searchCode: string;
}
/** Aliases help select an entity; they never prove a historical allocation. */
export function searchHistoricalAirports(
  query: string,
  limit = 8,
): HistoricalAirportSearchResult[] {
  const fold = (text: string) =>
    text
      .normalize("NFKD")
      .replace(/\p{M}+/gu, "")
      .toLowerCase();
  const term = fold(query.trim());
  if (!term || limit <= 0) return [];
  return [...airportById.values()]
    .flatMap((airport) => {
      if (
        !airport.historicalNames?.length &&
        airport.status !== "closed" &&
        airport.status !== "unknown"
      )
        return [];
      const names = [
        airport.name.en,
        ...(airport.historicalNames ?? []),
        ...(airport.searchAliases ?? []),
      ];
      const match = names.find((name) => fold(name).includes(term));
      return match
        ? [
            {
              kind: "formal" as const,
              airportId: airport.airportId,
              name: airport.name.en,
              matchedName: match,
              latitude: airport.latitude,
              longitude: airport.longitude,
              timezone: airport.timezone,
              searchCode: airport.iata,
              assignments: formalAssignments.filter(
                (row) => row.airportId === airport.airportId,
              ),
            },
          ]
        : [];
    })
    .slice(0, limit);
}
