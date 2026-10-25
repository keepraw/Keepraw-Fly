import { airportByIata, resolveAirline } from "@keepraw-fly/core";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import { validateKeeprawFly } from "@keepraw-fly/validator";
import {
  buildDocumentFromCsvPreflight,
  detectCsvMapping,
  preflightCsvImportWork,
  type CsvImportPreflight,
} from "./csv-import";
import {
  assessFlightImportsWork,
  countFlightImportAssessments,
} from "./duplicate-detection";
import { splitFlightNumberInput } from "./flight-editor";
import { assertRecordCount } from "./import-limits";
import { finishImportPreflight } from "./import-preflight-work";
import { createUmetripAirportResolver } from "./umetrip-airports";
import { inferUmetripTimes, umetripClock, umetripDate } from "./umetrip-times";
import type {
  ParsedUmetrip,
  UmetripDiagnostic,
  UmetripRecord,
  UmetripSource,
} from "./umetrip-xls";

export type UmetripExclusionReason =
  "unused" | "open" | "refunded" | "exchanged" | "invalid";
export interface UmetripExclusion extends UmetripSource {
  reason: UmetripExclusionReason;
}
export interface UmetripImportPreflight extends Omit<
  CsvImportPreflight,
  "issues"
> {
  issues: UmetripDiagnostic[];
  excludedRecords: number;
  exclusions: UmetripExclusion[];
  csvPreflight: CsvImportPreflight;
}

const headers = [
  "flightNumber",
  "serviceDate",
  "originIata",
  "destinationIata",
  "scheduledDeparture",
  "scheduledArrival",
  "ticketNumber",
];

export function preflightUmetripImport(
  parsed: ParsedUmetrip,
  existing: KeeprawFlyDocument | null,
  idFactory: () => string = () => crypto.randomUUID(),
  now: number = Date.now(),
): UmetripImportPreflight {
  return finishImportPreflight(
    preflightUmetripImportWork(parsed, existing, idFactory, now),
  );
}

export function* preflightUmetripImportWork(
  parsed: ParsedUmetrip,
  existing: KeeprawFlyDocument | null,
  idFactory: () => string = () => crypto.randomUUID(),
  now: number = Date.now(),
): Generator<void, UmetripImportPreflight, void> {
  assertRecordCount(parsed.records.length);
  const issues = [...parsed.issues];
  const exclusions: UmetripExclusion[] = [];
  const rows: string[][] = [];
  const sources: UmetripRecord[] = [];
  const resolveAirport = createUmetripAirportResolver();
  for (const record of parsed.records) {
    try {
      if (record.cellProblem) throw new Error("unsupported-cell");
      const status = String(record.values.status ?? "").trim();
      const exclusion = excludedStatus(status, record.sheetName);
      if (exclusion)
        exclusions.push({ ...sourceOf(record), reason: exclusion });
      else {
        const value = (field: keyof UmetripRecord["values"]) =>
          record.values[field] ?? null;
        const identity = splitFlightNumberInput(
          String(value("flightNumber") ?? ""),
        );
        if (!identity) throw new Error("invalid-flight-number");
        const airline = resolveAirline(identity.airline);
        if (!airline) throw new Error("unknown-airline");
        const origin = resolveAirport(String(value("origin") ?? ""));
        const destination = resolveAirport(String(value("destination") ?? ""));
        if ("code" in origin) throw new Error(origin.code);
        if ("code" in destination) throw new Error(destination.code);
        if (origin.iata === destination.iata) throw new Error("same-airport");
        const serviceDate = umetripDate(value("serviceDate"), record.date1904);
        const times = inferUmetripTimes({
          serviceDate,
          departureTime: umetripClock(value("departureTime")),
          arrivalTime: umetripClock(value("arrivalTime")),
          ...(value("arrivalDate") !== null && value("arrivalDate") !== ""
            ? {
                arrivalDate: umetripDate(value("arrivalDate"), record.date1904),
              }
            : {}),
          origin: airportByIata.get(origin.iata)!,
          destination: airportByIata.get(destination.iata)!,
        });
        if (Date.parse(times.arrival) > now)
          throw new Error("future-used-flight");
        const ticket = value("ticketNumber");
        if (
          typeof ticket === "number" &&
          (!Number.isSafeInteger(ticket) || ticket < 0)
        )
          throw new Error("invalid-row");
        rows.push([
          `${airline.iata || airline.icao}${identity.serviceNumber}`,
          serviceDate,
          origin.iata,
          destination.iata,
          times.departure,
          times.arrival,
          String(ticket ?? ""),
        ]);
        sources.push(record);
      }
    } catch (error) {
      issues.push({ ...sourceOf(record), code: issueCode(error) });
    }
    yield;
  }

  const csvPreflight = yield* preflightCsvImportWork(
    { headers, rows },
    detectCsvMapping(headers),
    existing,
    idFactory,
  );
  const failedLines = new Set(
    csvPreflight.issues.map((issue) => issue.lineNumber),
  );
  const validSources = sources.filter(
    (_, index) => !failedLines.has(index + 2),
  );
  for (const issue of csvPreflight.issues) {
    const source = sources[(issue.lineNumber ?? 2) - 2];
    if (source) issues.push({ ...sourceOf(source), code: issue.code });
  }
  csvPreflight.flights.forEach((flight, index) => {
    const source = validSources[index]!;
    flight.extensions = {
      ...flight.extensions,
      "keepraw-fly.umetrip": {
        version: 1,
        dateSystem: source.date1904 ? "1904" : "1900",
        ...sourceOf(source),
        // Only selected source facts; never copy arbitrary/passenger columns.
        ...Object.fromEntries(
          Object.entries(source.values).filter(
            ([field]) => field !== "ticketNumber",
          ),
        ),
        timeBasis: "unspecified",
        arrivalDateInferred:
          source.values.arrivalDate == null || source.values.arrivalDate === "",
      },
    };
  });
  // CSV conversion checks clocks and chronology; the canonical validator also
  // checks optional fields, extensions and semantic invariants before preview.
  const validation = validateKeeprawFly({
    format: "keepraw-fly",
    formatVersion: "0.1.0",
    profile: {},
    flights: csvPreflight.flights,
  });
  const invalid = new Set<number>();
  if (!validation.valid) {
    for (const issue of validation.issues) {
      if (issue.flightIndex === undefined) continue;
      invalid.add(issue.flightIndex);
    }
    for (const index of invalid) {
      issues.push({ ...sourceOf(validSources[index]!), code: "invalid-row" });
    }
  }
  const flights = csvPreflight.flights.filter(
    (_, index) => !invalid.has(index),
  );
  const assessments = invalid.size
    ? yield* assessFlightImportsWork(flights, existing?.flights ?? [])
    : csvPreflight.assessments;
  const recordLocations = new Set(
    parsed.records.map((record) => `${record.sheetName}\0${record.lineNumber}`),
  );
  return {
    totalRecords: parsed.records.length,
    validRecords: flights.length,
    problemRecords: new Set(
      issues
        .map((issue) => `${issue.sheetName}\0${issue.lineNumber}`)
        .filter((location) => recordLocations.has(location)),
    ).size,
    excludedRecords: exclusions.length,
    ...countFlightImportAssessments(assessments),
    canImport:
      issues.length === 0 && validation.valid && csvPreflight.canImport,
    flights,
    assessments,
    issues,
    exclusions,
    csvPreflight,
  };
}

export function buildDocumentFromUmetripPreflight(
  preflight: UmetripImportPreflight,
  existing: KeeprawFlyDocument | null,
  includePossibleDuplicates = false,
): KeeprawFlyDocument {
  if (!preflight.canImport) throw new Error("invalid-umetrip-import");
  return buildDocumentFromCsvPreflight(
    { ...preflight.csvPreflight, assessments: preflight.assessments },
    existing,
    includePossibleDuplicates,
  );
}

function excludedStatus(
  status: string,
  sheetName: string,
): UmetripExclusionReason | null {
  const normalized = status.normalize("NFKC").toUpperCase().replace(/\s/g, "");
  const sheet = sheetName.normalize("NFKC").toUpperCase().replace(/\s/g, "");
  if (normalized === "已使用") {
    if (/^(待出行|OPEN票|无效票)(?:\d+)?$/.test(sheet))
      throw new Error("conflicting-status");
    return null;
  }
  if (["OPEN", "OPEN票"].includes(normalized)) return "open";
  if (["未使用", "未出行", "待出行"].includes(normalized))
    return /^OPEN票(?:\d+)?$/.test(sheet) ? "open" : "unused";
  if (["已退票", "退票"].includes(normalized)) return "refunded";
  if (["已换开", "换开"].includes(normalized)) return "exchanged";
  if (["无效", "无效票", "已作废", "作废"].includes(normalized))
    return "invalid";
  throw new Error("unknown-status");
}

function sourceOf(source: UmetripSource): UmetripSource {
  return { sheetName: source.sheetName, lineNumber: source.lineNumber };
}

function issueCode(error: unknown): string {
  const code = error instanceof Error ? error.message : "invalid-row";
  if (code === "ambiguous-local-time") return "ambiguous-time";
  if (code === "nonexistent-local-time") return "nonexistent-time";
  return code;
}
