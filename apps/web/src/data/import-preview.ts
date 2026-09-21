import type { FrequentFlyerMembership, KeeprawFlight, KeeprawFlyDocument, ProfileName } from "@keepraw-fly/schema";
import type {
  KeeprawFlyMigration,
  ValidationIssue,
  ValidationResult,
} from "@keepraw-fly/validator";
import {
  assessFlightImports,
  countFlightImportAssessments,
  selectFlightsForImport,
  type FlightImportAssessment,
  type FlightImportCounts,
} from "./duplicate-detection";

export interface ImportPreviewSummary {
  flightCount: number;
  firstServiceDate?: string;
  lastServiceDate?: string;
  profileName?: string;
}

export interface ImportPreflightCounts extends FlightImportCounts {
  totalRecords: number;
  validRecords: number;
  problemRecords: number;
  canImport: boolean;
}

export interface JsonImportPreflight extends ImportPreflightCounts {
  document?: KeeprawFlyDocument;
  assessments: FlightImportAssessment[];
  issues: ValidationIssue[];
  migrations: KeeprawFlyMigration[];
}

export function summarizeImport(document: KeeprawFlyDocument): ImportPreviewSummary {
  const dates = document.flights
    .map((flight) => flight.serviceDate)
    .sort((left, right) => left.localeCompare(right));

  return {
    flightCount: document.flights.length,
    ...(dates[0] ? { firstServiceDate: dates[0] } : {}),
    ...(dates.at(-1) ? { lastServiceDate: dates.at(-1) } : {}),
    ...(displayProfileName(document.profile.name)
      ? { profileName: displayProfileName(document.profile.name) }
      : {}),
  };
}

export function preflightJsonImport(
  text: string,
  result: ValidationResult,
  existing: KeeprawFlyDocument | null,
): JsonImportPreflight {
  const rawRecordCount = countJsonFlightRecords(text);

  if (result.valid) {
    const assessments = assessFlightImports(result.data.flights, existing?.flights ?? []);
    return {
      document: result.data,
      totalRecords: result.data.flights.length,
      validRecords: result.data.flights.length,
      problemRecords: 0,
      ...countFlightImportAssessments(assessments),
      canImport: true,
      assessments,
      issues: [],
      migrations: result.migrations,
    };
  }

  const problemIndexes = new Set(
    result.issues
      .map((issue) => issue.flightIndex)
      .filter((index): index is number => index !== undefined && index < rawRecordCount),
  );

  return {
    totalRecords: rawRecordCount,
    validRecords: Math.max(0, rawRecordCount - problemIndexes.size),
    problemRecords: problemIndexes.size,
    newRecords: 0,
    possibleDuplicateRecords: 0,
    exactDuplicateRecords: 0,
    canImport: false,
    assessments: [],
    issues: result.issues,
    migrations: [],
  };
}

export function buildDocumentFromJsonImport(
  preflight: JsonImportPreflight,
  existing: KeeprawFlyDocument | null,
  includePossibleDuplicates = false,
): KeeprawFlyDocument {
  if (!preflight.document) throw new Error("invalid-import-preflight");
  const importedFlights = selectFlightsForImport(preflight.assessments, includePossibleDuplicates);

  if (existing) {
    const merged = mergeFrequentFlyerMemberships(
      existing.frequentFlyerMemberships ?? [],
      preflight.document.frequentFlyerMemberships ?? [],
      importedFlights,
    );
    return {
      ...existing,
      flights: [...existing.flights, ...merged.flights],
      ...(merged.memberships.length ? { frequentFlyerMemberships: merged.memberships } : {}),
    };
  }

  return {
    ...preflight.document,
    flights: importedFlights,
  };
}

function mergeFrequentFlyerMemberships(
  existing: readonly FrequentFlyerMembership[],
  imported: readonly FrequentFlyerMembership[],
  flights: readonly KeeprawFlight[],
): { memberships: FrequentFlyerMembership[]; flights: KeeprawFlight[] } {
  const memberships: FrequentFlyerMembership[] = existing.map((membership) => structuredClone(membership));
  const selectedIds = new Set(flights.flatMap((flight) => flight.frequentFlyer?.membershipId ?? []));
  const idMap = new Map<string, string>();

  for (const membership of imported.filter((item) => selectedIds.has(item.id))) {
    const current = memberships.find((item) => item.id === membership.id);
    if (!current) {
      memberships.push(structuredClone(membership));
      idMap.set(membership.id, membership.id);
      continue;
    }
    if (sameMembership(current, membership)) {
      idMap.set(membership.id, current.id);
      continue;
    }
    let suffix = 2;
    let nextId = `${membership.id}-imported`;
    while (memberships.some((item) => item.id === nextId)) nextId = `${membership.id}-imported-${suffix++}`;
    memberships.push({ ...structuredClone(membership), id: nextId });
    idMap.set(membership.id, nextId);
  }

  return {
    memberships,
    flights: flights.map((flight) => {
      if (!flight.frequentFlyer) return flight;
      const membershipId = idMap.get(flight.frequentFlyer.membershipId);
      return membershipId && membershipId !== flight.frequentFlyer.membershipId
        ? { ...flight, frequentFlyer: { ...flight.frequentFlyer, membershipId } }
        : flight;
    }),
  };
}

function sameMembership(left: FrequentFlyerMembership, right: FrequentFlyerMembership): boolean {
  return left.programId === right.programId && left.memberNumber === right.memberNumber;
}

function countJsonFlightRecords(text: string): number {
  try {
    const input = JSON.parse(text) as unknown;
    if (!input || typeof input !== "object" || Array.isArray(input)) return 0;
    const flights = (input as { flights?: unknown }).flights;
    return Array.isArray(flights) ? flights.length : 0;
  } catch {
    return 0;
  }
}

function displayProfileName(name: ProfileName | undefined): string | undefined {
  if (!name) return undefined;
  if (name.primary === "native" && name.native) return name.native;
  if (name.primary === "romanized" && name.romanized) return name.romanized;
  return name.native ?? name.romanized;
}
