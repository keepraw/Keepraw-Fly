import type { KeeprawFlight } from "@keepraw-fly/schema";

export type FlightImportDisposition = "new" | "possible" | "exact";

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
): FlightImportAssessment[] {
  const references = [...existing];

  return candidates.map((flight) => {
    const exact = references.find((reference) => isExactDuplicate(flight, reference));
    const possible = exact
      ? undefined
      : references.find((reference) => isPossibleDuplicate(flight, reference));
    const match = exact ?? possible;
    const disposition: FlightImportDisposition = exact
      ? "exact"
      : possible
        ? "possible"
        : "new";

    references.push(flight);
    return {
      flight,
      disposition,
      ...(match ? { matchedFlightId: match.id } : {}),
    };
  });
}

export function countFlightImportAssessments(
  assessments: readonly FlightImportAssessment[],
): FlightImportCounts {
  return assessments.reduce<FlightImportCounts>((counts, assessment) => {
    if (assessment.disposition === "new") counts.newRecords += 1;
    if (assessment.disposition === "possible") counts.possibleDuplicateRecords += 1;
    if (assessment.disposition === "exact") counts.exactDuplicateRecords += 1;
    return counts;
  }, {
    newRecords: 0,
    possibleDuplicateRecords: 0,
    exactDuplicateRecords: 0,
  });
}

export function selectFlightsForImport(
  assessments: readonly FlightImportAssessment[],
  includePossibleDuplicates = false,
): KeeprawFlight[] {
  return assessments
    .filter(({ disposition }) => disposition === "new"
      || (includePossibleDuplicates && disposition === "possible"))
    .map(({ flight }) => flight);
}

function isExactDuplicate(candidate: KeeprawFlight, reference: KeeprawFlight): boolean {
  if (candidate.id === reference.id) return true;
  return hasSameCoreIdentity(candidate, reference)
    && Date.parse(candidate.scheduledDeparture) === Date.parse(reference.scheduledDeparture);
}

function isPossibleDuplicate(candidate: KeeprawFlight, reference: KeeprawFlight): boolean {
  return hasSameCoreIdentity(candidate, reference);
}

function hasSameCoreIdentity(candidate: KeeprawFlight, reference: KeeprawFlight): boolean {
  return candidate.serviceDate === reference.serviceDate
    && candidate.flightNumber === reference.flightNumber
    && candidate.origin.iata === reference.origin.iata
    && candidate.destination.iata === reference.destination.iata;
}
