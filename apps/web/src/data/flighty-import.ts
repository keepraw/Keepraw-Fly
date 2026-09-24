import type { KeeprawFlight, KeeprawFlyDocument } from "@keepraw-fly/schema";
import { resolveAirline } from "@keepraw-fly/core";
import {
  buildDocumentFromCsvPreflight,
  csvFlightFields,
  detectCsvMapping,
  parseCsv,
  preflightCsvImport,
  type CsvImportIssueCode,
  type ParsedCsv,
} from "./csv-import";
import type { FlightImportAssessment } from "./duplicate-detection";
import type { ImportPreflightCounts } from "./import-preview";

const flightyFieldNames = [
  "Date", "Airline", "Flight", "From", "To", "Gate Departure (Scheduled)",
  "Gate Arrival (Scheduled)", "Gate Departure (Actual)", "Gate Arrival (Actual)",
  "Dep Terminal", "Dep Gate", "Arr Terminal", "Arr Gate", "Canceled", "Diverted To",
  "PNR", "Aircraft Type Name", "Tail Number", "Seat", "Cabin Class",
] as const;

type FlightyField = typeof flightyFieldNames[number];

const normalizedFlightyHeaders: Record<FlightyField, string> = {
  Date: "date",
  Airline: "airline",
  Flight: "flight",
  From: "from",
  To: "to",
  "Gate Departure (Scheduled)": "gatedeparturescheduled",
  "Gate Arrival (Scheduled)": "gatearrivalscheduled",
  "Gate Departure (Actual)": "gatedepartureactual",
  "Gate Arrival (Actual)": "gatearrivalactual",
  "Dep Terminal": "depterminal",
  "Dep Gate": "depgate",
  "Arr Terminal": "arrterminal",
  "Arr Gate": "arrgate",
  Canceled: "canceled",
  "Diverted To": "divertedto",
  PNR: "pnr",
  "Aircraft Type Name": "aircrafttypename",
  "Tail Number": "tailnumber",
  Seat: "seat",
  "Cabin Class": "cabinclass",
};

const requiredFlightyFields: FlightyField[] = [
  "Date", "Airline", "Flight", "From", "To", "Gate Departure (Scheduled)", "Gate Arrival (Scheduled)",
];

const normalizedHeaderAliases: Partial<Record<string, FlightyField>> = Object.fromEntries(
  flightyFieldNames.map((field) => [normalizedFlightyHeaders[field], field]),
);
normalizedHeaderAliases.cancelled = "Canceled";

export type FlightyDiagnosticSeverity = "error" | "warning";

export type FlightyDiagnosticCode =
  | "missing-required-header"
  | "missing-value"
  | "unknown-airline"
  | "invalid-flight"
  | "invalid-cancelled"
  | "unknown-cabin"
  | CsvImportIssueCode;

export interface FlightyDiagnostic {
  severity: FlightyDiagnosticSeverity;
  code: FlightyDiagnosticCode;
  lineNumber?: number;
  value?: string;
}

export interface FlightyImportPreflight extends ImportPreflightCounts {
  flights: KeeprawFlight[];
  assessments: FlightImportAssessment[];
  issues: FlightyDiagnostic[];
  warnings: FlightyDiagnostic[];
  csvPreflight: ReturnType<typeof preflightCsvImport>;
}

export function isFlightyCsv(parsed: ParsedCsv): boolean {
  const headers = new Set(parsed.headers.map(normalizeHeader));
  return requiredFlightyFields.every((field) => headers.has(normalizedFlightyHeaders[field]));
}

export function preflightFlightyImport(
  parsed: ParsedCsv,
  existing: KeeprawFlyDocument | null,
  idFactory: () => string = () => crypto.randomUUID(),
): FlightyImportPreflight {
  const headerIndexes = flightyHeaderIndexes(parsed.headers);
  const issues: FlightyDiagnostic[] = [];
  const warnings: FlightyDiagnostic[] = [];

  for (const field of requiredFlightyFields) {
    if (headerIndexes[field] === undefined) issues.push({ severity: "error", code: "missing-required-header", value: field });
  }

  const mappedRows: string[][] = [];
  const sourceLines: number[] = [];
  if (issues.length === 0) {
    parsed.rows.forEach((row, rowIndex) => {
      const lineNumber = rowIndex + 2;
      const values = flightyValues(row, headerIndexes);
      const rowIssues = validateFlightyRow(values, lineNumber, warnings);
      if (rowIssues.length) {
        issues.push(...rowIssues);
        return;
      }
      mappedRows.push(toKeeprawCsvRow(values));
      sourceLines.push(lineNumber);
    });
  }

  const mapped: ParsedCsv = { headers: csvFlightFields, rows: mappedRows };
  const csvPreflight = mappedRows.length
    ? preflightCsvImport(mapped, detectCsvMapping(mapped.headers), existing, idFactory)
    : emptyCsvPreflight();
  for (const issue of csvPreflight.issues) {
    issues.push({
      severity: "error",
      code: issue.code,
      lineNumber: issue.lineNumber ? sourceLines[issue.lineNumber - 2] : undefined,
    });
  }

  const allIssues = [...issues];
  return {
    totalRecords: parsed.rows.length,
    validRecords: csvPreflight.validRecords,
    problemRecords: allIssues.length,
    newRecords: csvPreflight.newRecords,
    possibleDuplicateRecords: csvPreflight.possibleDuplicateRecords,
    exactDuplicateRecords: csvPreflight.exactDuplicateRecords,
    canImport: allIssues.length === 0 && csvPreflight.canImport,
    flights: csvPreflight.flights,
    assessments: csvPreflight.assessments,
    issues,
    warnings,
    csvPreflight,
  };
}

export function buildDocumentFromFlightyPreflight(
  preflight: FlightyImportPreflight,
  existing: KeeprawFlyDocument | null,
  includePossibleDuplicates = false,
): KeeprawFlyDocument {
  if (!preflight.canImport) throw new Error(preflight.issues[0]?.code ?? "flighty-import-invalid");
  return buildDocumentFromCsvPreflight(preflight.csvPreflight, existing, includePossibleDuplicates);
}

function flightyHeaderIndexes(headers: readonly string[]): Partial<Record<FlightyField, number>> {
  const indexes: Partial<Record<FlightyField, number>> = {};
  headers.forEach((header, index) => {
    const field = normalizedHeaderAliases[normalizeHeader(header)];
    if (field && indexes[field] === undefined) indexes[field] = index;
  });
  return indexes;
}

function flightyValues(row: string[], indexes: Partial<Record<FlightyField, number>>): Record<FlightyField, string> {
  return Object.fromEntries(flightyFieldNames.map((field) => [field, (row[indexes[field] ?? -1] ?? "").trim()])) as Record<FlightyField, string>;
}

function validateFlightyRow(
  values: Record<FlightyField, string>,
  lineNumber: number,
  warnings: FlightyDiagnostic[],
): FlightyDiagnostic[] {
  const issues: FlightyDiagnostic[] = [];
  for (const field of requiredFlightyFields) {
    if (!values[field]) issues.push({ severity: "error", code: "missing-value", lineNumber, value: field });
  }

  const airline = resolveAirline(values.Airline);
  if (!airline && values.Airline) issues.push({ severity: "error", code: "unknown-airline", lineNumber, value: values.Airline });
  if (values.Flight && !/^[A-Z0-9]+$/i.test(values.Flight)) issues.push({ severity: "error", code: "invalid-flight", lineNumber, value: values.Flight });

  const cancelled = parseFlightyBoolean(values.Canceled);
  if (cancelled === undefined) issues.push({ severity: "error", code: "invalid-cancelled", lineNumber, value: values.Canceled });

  const cabin = normalizeCabin(values["Cabin Class"]);
  if (values["Cabin Class"] && !cabin) warnings.push({ severity: "warning", code: "unknown-cabin", lineNumber, value: values["Cabin Class"] });
  return issues;
}

function toKeeprawCsvRow(values: Record<FlightyField, string>): string[] {
  const airline = resolveAirline(values.Airline)!;
  const cancelled = parseFlightyBoolean(values.Canceled) ?? false;
  const cabin = normalizeCabin(values["Cabin Class"]) ?? "";
  return [
    `${airline.iata}${values.Flight}`,
    values.Date,
    values.From.toUpperCase(),
    values.To.toUpperCase(),
    values["Gate Departure (Scheduled)"],
    values["Gate Arrival (Scheduled)"],
    values["Gate Departure (Actual)"],
    values["Gate Arrival (Actual)"],
    values["Dep Terminal"],
    values["Dep Gate"],
    values["Arr Terminal"],
    values["Arr Gate"],
    cancelled ? "true" : "false",
    values["Diverted To"].toUpperCase(),
    "",
    values.PNR,
    values["Aircraft Type Name"],
    values["Tail Number"],
    values.Seat,
    "",
    cabin,
  ];
}

function parseFlightyBoolean(value: string): boolean | undefined {
  if (!value) return false;
  if (/^(true|1|yes)$/i.test(value)) return true;
  if (/^(false|0|no)$/i.test(value)) return false;
  return undefined;
}

function normalizeCabin(value: string): string | undefined {
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, " ");
  if (normalized === "economy") return "economy";
  if (normalized === "premium economy") return "premium economy";
  if (normalized === "business") return "business";
  if (normalized === "first") return "first";
  return undefined;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_()-]+/g, "");
}

function emptyCsvPreflight(): ReturnType<typeof preflightCsvImport> {
  return {
    totalRecords: 0,
    validRecords: 0,
    problemRecords: 0,
    newRecords: 0,
    possibleDuplicateRecords: 0,
    exactDuplicateRecords: 0,
    canImport: true,
    flights: [],
    assessments: [],
    issues: [],
  };
}

export function parseFlightyCsv(text: string): ParsedCsv {
  return parseCsv(text);
}

export function flightyIgnoredFields(headers: readonly string[]): string[] {
  const known = new Set(Object.keys(normalizedHeaderAliases));
  return headers.filter((header) => !known.has(normalizeHeader(header)));
}
