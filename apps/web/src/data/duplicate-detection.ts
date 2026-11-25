import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  originIdentity,
  plannedDestinationIdentity,
  arrivalIdentity,
  resolveAirline,
} from "@keepraw-fly/core";
import { splitFlightNumberInput } from "./flight-editor";
import { finishImportPreflight } from "./import-preflight-work";

export type FlightImportDisposition = "new" | "possible" | "exact" | "conflict";

export interface FlightImportAssessment {
  flight: KeeprawFlight;
  disposition: FlightImportDisposition;
  matchedFlightId?: string;
}

export interface FlightImportCounts {
  newRecords: number;
  possibleDuplicateRecords: number;
  exactDuplicateRecords: number;
}

interface FlightReference {
  flight: KeeprawFlight;
  order: number;
}

interface ReferenceBucket {
  references: FlightReference[];
  matches?: Map<string, FlightReference>;
}

export function assessFlightImports(
  candidates: readonly KeeprawFlight[],
  existing: readonly KeeprawFlight[],
  source: "rows" | "archive" = "rows",
): FlightImportAssessment[] {
  return finishImportPreflight(
    assessFlightImportsWork(candidates, existing, source),
  );
}

export function* assessFlightImportsWork(
  candidates: readonly KeeprawFlight[],
  existing: readonly KeeprawFlight[],
  source: "rows" | "archive" = "rows",
): Generator<void, FlightImportAssessment[], void> {
  if (!candidates.length) return [];
  const byId = new Map<string, KeeprawFlight>();
  const byCore = new Map<string, ReferenceBucket>();
  let order = 0;

  function indexRoute(
    matches: Map<string, FlightReference>,
    reference: FlightReference,
    route = physicalRoute(reference.flight),
  ) {
    const airline = reference.flight.airline.icao || "";
    // A missing candidate ICAO matches any carrier. A missing reference ICAO
    // is also eligible when the candidate has a specific carrier.
    function remember(departure: number | null) {
      for (const code of [airline, null]) {
        const key = routeMatchKey(route, code, departure);
        if (!matches.has(key)) matches.set(key, reference);
      }
    }
    remember(null);
    if (source === "rows") {
      const departure = Date.parse(reference.flight.scheduledDeparture);
      if (Number.isFinite(departure)) remember(departure);
    }
  }

  function addReference(flight: KeeprawFlight, key: string, route?: string) {
    byId.set(flight.id, flight);
    let bucket = byCore.get(key);
    if (!bucket) {
      bucket = { references: [] };
      byCore.set(key, bucket);
    }
    const reference = { flight, order: order++ };
    if (bucket.matches) indexRoute(bucket.matches, reference, route);
    else bucket.references.push(reference);
  }

  for (const flight of existing) {
    addReference(flight, coreKey(flight));
    yield;
  }

  const assessments: FlightImportAssessment[] = [];
  for (const flight of candidates) {
    const key = coreKey(flight);
    let match = byId.get(flight.id);
    let route: string | undefined;
    let disposition: FlightImportDisposition = "new";
    if (match) {
      disposition = sameJsonFacts(flight, match) ? "exact" : "conflict";
    } else {
      const bucket = byCore.get(key);
      if (bucket) {
        // Resolve physical identities only for buckets that receive a query.
        // Yield between references even when every record shares a core key.
        if (!bucket.matches) {
          bucket.matches = new Map();
          for (const reference of bucket.references) {
            indexRoute(bucket.matches, reference);
            yield;
          }
          bucket.references = [];
        }
        route = physicalRoute(flight);
        const airline = flight.airline.icao || null;
        const exact =
          source === "rows"
            ? firstRouteMatch(
                bucket.matches,
                route,
                airline,
                Date.parse(flight.scheduledDeparture),
              )
            : undefined;
        match =
          exact?.flight ??
          firstRouteMatch(bucket.matches, route, airline, null)?.flight;
        if (match) disposition = exact ? "exact" : "possible";
      }
    }

    // Row imports have generated IDs; native IDs belong to the author.
    if (source === "rows") addReference(flight, key, route);
    assessments.push({
      flight,
      disposition,
      ...(match ? { matchedFlightId: match.id } : {}),
    });
    yield;
  }
  return assessments;
}

export function countFlightImportAssessments(
  assessments: readonly FlightImportAssessment[],
): FlightImportCounts {
  return assessments.reduce<FlightImportCounts>(
    (counts, assessment) => {
      if (assessment.disposition === "new") counts.newRecords += 1;
      if (assessment.disposition === "possible")
        counts.possibleDuplicateRecords += 1;
      if (assessment.disposition === "exact") counts.exactDuplicateRecords += 1;
      return counts;
    },
    {
      newRecords: 0,
      possibleDuplicateRecords: 0,
      exactDuplicateRecords: 0,
    },
  );
}

export function selectFlightsForImport(
  assessments: readonly FlightImportAssessment[],
  includePossibleDuplicates = false,
): KeeprawFlight[] {
  if (assessments.some(({ disposition }) => disposition === "conflict"))
    throw new Error("conflicting-flight-id");
  return assessments
    .filter(
      ({ disposition }) =>
        disposition === "new" ||
        (includePossibleDuplicates && disposition === "possible"),
    )
    .map(({ flight }) => flight);
}

// Compare portable JSON facts, not property insertion order or optional JS
// properties that disappear on serialization. Array order is significant.
function sameJsonFacts(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, i) => sameJsonFacts(item, b[i]))
    );
  const left = Object.entries(a).filter(([, v]) => v !== undefined);
  const right = b as Record<string, unknown>;
  return (
    left.length ===
      Object.values(right).filter((v) => v !== undefined).length &&
    left.every(
      ([k, v]) => Object.hasOwn(right, k) && sameJsonFacts(v, right[k]),
    )
  );
}

function coreKey(flight: KeeprawFlight): string {
  let flightNumber = flight.flightNumber;
  const parsed = splitFlightNumberInput(flightNumber);
  if (parsed) {
    const recorded = resolveAirline(flight.airline);
    const carrier =
      recorded?.iata === parsed.airlineCode
        ? recorded.icao
        : (parsed.airline.icao ?? parsed.airlineCode);
    flightNumber = carrier + parsed.serviceNumber;
  }
  return JSON.stringify([
    flight.serviceDate,
    flightNumber,
    flight.origin.iata,
    flight.destination.iata,
  ]);
}

function physicalRoute(flight: KeeprawFlight): string {
  return JSON.stringify([
    originIdentity(flight).identityKey,
    plannedDestinationIdentity(flight).identityKey,
    arrivalIdentity(flight).identityKey,
  ]);
}

function routeMatchKey(
  route: string,
  airline: string | null,
  departure: number | null,
): string {
  return JSON.stringify([route, airline, departure]);
}

function firstRouteMatch(
  matches: Map<string, FlightReference>,
  route: string,
  airline: string | null,
  departure: number | null,
): FlightReference | undefined {
  if (departure !== null && !Number.isFinite(departure)) return undefined;
  const matchingCarrier = matches.get(routeMatchKey(route, airline, departure));
  if (airline === null) return matchingCarrier;
  const missingCarrier = matches.get(routeMatchKey(route, "", departure));
  return !matchingCarrier ||
    (missingCarrier && missingCarrier.order < matchingCarrier.order)
    ? missingCarrier
    : matchingCarrier;
}
