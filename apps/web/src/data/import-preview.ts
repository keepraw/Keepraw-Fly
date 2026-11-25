import type {
  FrequentFlyerMembership,
  KeeprawFlight,
  KeeprawFlyDocument,
  ProfileName,
} from "@keepraw-fly/schema";
import type {
  KeeprawFlyMigration,
  ValidationIssue,
  ValidationResult,
  validateAndMigrateKeeprawFly,
} from "@keepraw-fly/validator";
import {
  assessFlightImportsWork,
  countFlightImportAssessments,
  selectFlightsForImport,
  type FlightImportAssessment,
  type FlightImportCounts,
} from "./duplicate-detection";
import { assertRecordCount, exceedsAppendLimit } from "./import-limits";
import {
  finishImportPreflight,
  type ImportPreflightWork,
} from "./import-preflight-work";

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
  base: KeeprawFlyDocument | null;
  document?: KeeprawFlyDocument;
  assessments: FlightImportAssessment[];
  issues: ValidationIssue[];
  migrations: KeeprawFlyMigration[];
}

export function summarizeImport(
  document: KeeprawFlyDocument,
): ImportPreviewSummary {
  let firstServiceDate: string | undefined;
  let lastServiceDate: string | undefined;
  for (const { serviceDate } of document.flights) {
    if (!firstServiceDate || serviceDate < firstServiceDate)
      firstServiceDate = serviceDate;
    if (!lastServiceDate || serviceDate > lastServiceDate)
      lastServiceDate = serviceDate;
  }
  const profileName = displayProfileName(document.profile.name);

  return {
    flightCount: document.flights.length,
    ...(firstServiceDate ? { firstServiceDate } : {}),
    ...(lastServiceDate ? { lastServiceDate } : {}),
    ...(profileName ? { profileName } : {}),
  };
}

export function preflightJsonImport(
  text: string,
  result: ValidationResult,
  existing: KeeprawFlyDocument | null,
): JsonImportPreflight {
  return finishImportPreflight(
    preflightJsonImportWork(
      result,
      existing,
      result.valid ? result.data.flights.length : countJsonFlightRecords(text),
    ),
  );
}

export function* preflightJsonFileWork(
  text: string,
  existing: KeeprawFlyDocument | null,
  validate: typeof validateAndMigrateKeeprawFly,
): ImportPreflightWork<JsonImportPreflight> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return yield* preflightJsonImportWork(
      {
        valid: false,
        reason: "invalid",
        issues: [
          {
            path: "/",
            keyword: "parse",
            message: "The file is not valid JSON.",
          },
        ],
      },
      existing,
      0,
    );
  }
  const recordCount = rawFlightCount(raw);
  assertRecordCount(recordCount);
  yield;
  const result = validate(raw);
  yield;
  return yield* preflightJsonImportWork(result, existing, recordCount);
}

function* preflightJsonImportWork(
  result: ValidationResult,
  existing: KeeprawFlyDocument | null,
  rawRecordCount: number,
): ImportPreflightWork<JsonImportPreflight> {
  if (result.valid) {
    const assessments = existing
      ? yield* assessFlightImportsWork(
          result.data.flights,
          existing.flights,
          "archive",
        )
      : [];
    const issues: ValidationIssue[] = [];
    if (assessments.length) {
      const accounts = new Map<string, FrequentFlyerMembership>();
      for (const membership of existing?.frequentFlyerMemberships ?? []) {
        accounts.set(membership.id, membership);
        yield;
      }
      const importedAccounts = new Map<string, FrequentFlyerMembership>();
      for (const membership of result.data.frequentFlyerMemberships ?? []) {
        importedAccounts.set(membership.id, membership);
        yield;
      }
      for (const [flightIndex, assessment] of assessments.entries()) {
        // An otherwise identical flight can refer to a different account.
        const id = assessment.flight.frequentFlyer?.membershipId;
        if (assessment.disposition === "exact" && id) {
          const local = accounts.get(id);
          const incoming = importedAccounts.get(id);
          if (local && incoming && !sameMembership(local, incoming))
            assessment.disposition = "conflict";
        }
        if (assessment.disposition === "conflict") {
          issues.push({
            path: `/flights/${flightIndex}/id`,
            flightIndex,
            keyword: "conflictingFlightId",
            received: assessment.flight.id,
            message:
              "An existing flight with this ID has different facts. Nothing will be appended.",
          });
        }
        yield;
      }
    }
    const counts = countFlightImportAssessments(assessments);
    return {
      base: existing,
      document: result.data,
      totalRecords: result.data.flights.length,
      validRecords: result.data.flights.length,
      problemRecords: issues.length,
      ...counts,
      ...(!existing ? { newRecords: result.data.flights.length } : {}),
      canImport:
        issues.length === 0 && !exceedsAppendLimit(existing, counts.newRecords),
      assessments,
      issues,
      migrations: result.migrations,
    };
  }

  const problemIndexes = new Set<number>();
  for (const { flightIndex } of result.issues) {
    if (flightIndex !== undefined && flightIndex < rawRecordCount)
      problemIndexes.add(flightIndex);
    yield;
  }

  return {
    base: existing,
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
  if (
    !preflight.canImport ||
    !preflight.document ||
    existing !== preflight.base
  )
    throw new Error("invalid-import-preflight");
  // Welcome and confirmed recovery both replace from the validated document.
  if (!existing) return preflight.document;
  const importedFlights = selectFlightsForImport(
    preflight.assessments,
    includePossibleDuplicates,
  );
  assertRecordCount(existing.flights.length + importedFlights.length);

  const merged = mergeFrequentFlyerMemberships(
    existing.frequentFlyerMemberships ?? [],
    preflight.document.frequentFlyerMemberships ?? [],
    importedFlights,
  );
  return {
    ...existing,
    flights: [...existing.flights, ...merged.flights],
    ...(merged.memberships.length
      ? { frequentFlyerMemberships: merged.memberships }
      : {}),
  };
}

function mergeFrequentFlyerMemberships(
  existing: readonly FrequentFlyerMembership[],
  imported: readonly FrequentFlyerMembership[],
  flights: readonly KeeprawFlight[],
): { memberships: FrequentFlyerMembership[]; flights: KeeprawFlight[] } {
  const memberships: FrequentFlyerMembership[] = existing.map((membership) =>
    structuredClone(membership),
  );
  const selectedIds = new Set(
    flights.flatMap((flight) => flight.frequentFlyer?.membershipId ?? []),
  );
  const idMap = new Map<string, string>();

  for (const membership of imported.filter((item) =>
    selectedIds.has(item.id),
  )) {
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
    while (memberships.some((item) => item.id === nextId))
      nextId = `${membership.id}-imported-${suffix++}`;
    memberships.push({ ...structuredClone(membership), id: nextId });
    idMap.set(membership.id, nextId);
  }

  return {
    memberships,
    flights: flights.map((flight) => {
      if (!flight.frequentFlyer) return flight;
      const membershipId = idMap.get(flight.frequentFlyer.membershipId);
      return membershipId && membershipId !== flight.frequentFlyer.membershipId
        ? {
            ...flight,
            frequentFlyer: { ...flight.frequentFlyer, membershipId },
          }
        : flight;
    }),
  };
}

function sameMembership(
  left: FrequentFlyerMembership,
  right: FrequentFlyerMembership,
): boolean {
  return (
    left.programId === right.programId &&
    left.memberNumber === right.memberNumber
  );
}

function countJsonFlightRecords(text: string): number {
  try {
    return rawFlightCount(JSON.parse(text));
  } catch {
    return 0;
  }
}

function rawFlightCount(input: unknown): number {
  if (!input || typeof input !== "object" || Array.isArray(input)) return 0;
  const flights = (input as { flights?: unknown }).flights;
  return Array.isArray(flights) ? flights.length : 0;
}

function displayProfileName(name: ProfileName | undefined): string | undefined {
  if (!name) return undefined;
  if (name.primary === "native" && name.native) return name.native;
  if (name.primary === "romanized" && name.romanized) return name.romanized;
  return name.native ?? name.romanized;
}
