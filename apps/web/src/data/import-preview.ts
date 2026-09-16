import type { KeeprawFlight, KeeprawFlyDocument, ProfileName } from "@keepraw-fly/schema";
import type {
  KeeprawFlyMigration,
  ValidationIssue,
  ValidationResult,
} from "@keepraw-fly/validator";

export interface ImportPreviewSummary {
  flightCount: number;
  firstServiceDate?: string;
  lastServiceDate?: string;
  profileName?: string;
}

export interface ImportPreflightCounts {
  totalRecords: number;
  validRecords: number;
  problemRecords: number;
  duplicateRecords: number;
  canImport: boolean;
}

export interface JsonImportPreflight extends ImportPreflightCounts {
  document?: KeeprawFlyDocument;
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
    return {
      document: result.data,
      totalRecords: result.data.flights.length,
      validRecords: result.data.flights.length,
      problemRecords: 0,
      duplicateRecords: countPossibleDuplicateFlights(result.data.flights, existing?.flights ?? []),
      canImport: true,
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
    duplicateRecords: 0,
    canImport: false,
    issues: result.issues,
    migrations: [],
  };
}

export function countPossibleDuplicateFlights(
  candidates: readonly KeeprawFlight[],
  existing: readonly KeeprawFlight[],
): number {
  const seen = new Set(existing.map(flightDuplicateKey));
  let duplicates = 0;

  for (const flight of candidates) {
    const key = flightDuplicateKey(flight);
    if (seen.has(key)) duplicates += 1;
    seen.add(key);
  }

  return duplicates;
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

function flightDuplicateKey(flight: KeeprawFlight): string {
  return [
    flight.serviceDate,
    flight.flightNumber,
    flight.origin.iata,
    flight.destination.iata,
  ].join("\u001f");
}

function displayProfileName(name: ProfileName | undefined): string | undefined {
  if (!name) return undefined;
  if (name.primary === "native" && name.native) return name.native;
  if (name.primary === "romanized" && name.romanized) return name.romanized;
  return name.native ?? name.romanized;
}
