import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  originIdentity,
  plannedDestinationIdentity,
  arrivalIdentity,
} from "@keepraw-fly/core";
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
  const references = [...existing];
  const byId = new Map(existing.map((flight) => [flight.id, flight]));
  const physicalRoutes = new WeakMap<KeeprawFlight, string>();
  function physicalRoute(flight: KeeprawFlight) {
    let route = physicalRoutes.get(flight);
    if (!route) {
      route = JSON.stringify([
        originIdentity(flight).identityKey,
        plannedDestinationIdentity(flight).identityKey,
        arrivalIdentity(flight).identityKey,
      ]);
      physicalRoutes.set(flight, route);
    }
    return route;
  }
  const assessments: FlightImportAssessment[] = [];
  for (const flight of candidates) {
    let match = byId.get(flight.id);
    let disposition: FlightImportDisposition = "new";
    if (match) {
      disposition = sameJsonFacts(flight, match) ? "exact" : "conflict";
    } else {
      for (const reference of references) {
        if (
          !hasSameCoreIdentity(flight, reference) ||
          physicalRoute(flight) !== physicalRoute(reference)
        )
          continue;
        match ??= reference;
        disposition = "possible";
        // Row imports have generated IDs; native IDs belong to the author.
        if (
          source === "rows" &&
          Date.parse(flight.scheduledDeparture) ===
            Date.parse(reference.scheduledDeparture)
        ) {
          disposition = "exact";
          match = reference;
          break;
        }
        if (source === "archive") break;
      }
    }

    if (source === "rows") {
      references.push(flight);
      byId.set(flight.id, flight);
    }
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

function hasSameCoreIdentity(
  candidate: KeeprawFlight,
  reference: KeeprawFlight,
): boolean {
  return (
    candidate.serviceDate === reference.serviceDate &&
    candidate.flightNumber === reference.flightNumber &&
    (!candidate.airline.icao ||
      !reference.airline.icao ||
      candidate.airline.icao === reference.airline.icao) &&
    candidate.origin.iata === reference.origin.iata &&
    candidate.destination.iata === reference.destination.iata
  );
}
