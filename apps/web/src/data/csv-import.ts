import type { KeeprawFlight, KeeprawFlyDocument } from "@keepraw-fly/schema";
import { KEEPRAW_FLY_FORMAT, KEEPRAW_FLY_FORMAT_VERSION } from "@keepraw-fly/schema";
import { airportByIata } from "@keepraw-fly/core";
import { flightFromDraft, localPartsAtAirport, zonedDateTimeToIso, type FlightDraft } from "./flight-editor";
import {
  assessFlightImports,
  countFlightImportAssessments,
  selectFlightsForImport,
  type FlightImportAssessment,
} from "./duplicate-detection";
import type { ImportPreflightCounts } from "./import-preview";

export type CsvFlightField =
  | "flightNumber"
  | "serviceDate"
  | "originIata"
  | "destinationIata"
  | "scheduledDeparture"
  | "scheduledArrival"
  | "actualDeparture" | "actualArrival" | "originTerminal" | "originGate" | "destinationTerminal"
  | "divertedToIata" | "cancelled"
  | "ticketNumber" | "bookingReference" | "baggageCarousel" | "aircraftType" | "aircraftRegistration"
  | "seat" | "bookingClass" | "cabin";

export const csvFlightFields: CsvFlightField[] = [
  "flightNumber",
  "serviceDate",
  "originIata",
  "destinationIata",
  "scheduledDeparture",
  "scheduledArrival",
  "actualDeparture", "actualArrival", "originTerminal", "originGate", "destinationTerminal",
  "divertedToIata", "cancelled",
  "ticketNumber", "bookingReference", "baggageCarousel", "aircraftType", "aircraftRegistration", "seat", "bookingClass", "cabin",
];

export const requiredCsvFlightFields: CsvFlightField[] = [
  "flightNumber", "serviceDate", "originIata", "destinationIata", "scheduledDeparture", "scheduledArrival",
];

export type CsvColumnMapping = Record<CsvFlightField, number | null>;

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

export type CsvImportIssueCode =
  | "incomplete-mapping"
  | "invalid-flight-number"
  | "invalid-date"
  | "unknown-airport"
  | "same-airport"
  | "ambiguous-time"
  | "nonexistent-time"
  | "invalid-time"
  | "date-mismatch"
  | "chronology";

export interface CsvImportIssue {
  code: CsvImportIssueCode;
  lineNumber?: number;
}

export interface CsvImportPreflight extends ImportPreflightCounts {
  flights: KeeprawFlight[];
  assessments: FlightImportAssessment[];
  issues: CsvImportIssue[];
}

const aliases: Record<CsvFlightField, string[]> = {
  flightNumber: ["flightnumber", "flight", "number", "航班号"],
  serviceDate: ["servicedate", "date", "departuredate", "日期", "出发日期"],
  originIata: ["originiata", "origin", "from", "departureairport", "出发机场"],
  destinationIata: ["destinationiata", "destination", "to", "arrivalairport", "到达机场"],
  scheduledDeparture: ["scheduleddeparture", "departuretime", "scheduleddepartureiso", "计划出发时间"],
  scheduledArrival: ["scheduledarrival", "arrivaltime", "scheduledarrivaliso", "计划到达时间"],
  actualDeparture: ["actualdeparture", "actualdepartureiso", "实际出发时间"],
  actualArrival: ["actualarrival", "actualarrivaliso", "实际到达时间"],
  divertedToIata: ["divertedtoiata", "divertedto", "divertedairport", "备降机场"],
  cancelled: ["cancelled", "canceled", "取消"],
  originTerminal: ["originterminal", "departureterminal", "出发航站楼"],
  originGate: ["origingate", "departuregate", "出发登机口"],
  destinationTerminal: ["destinationterminal", "arrivalterminal", "到达航站楼"],
  ticketNumber: ["ticketnumber", "ticket", "票号"],
  bookingReference: ["bookingreference", "pnr", "bookingcode"],
  baggageCarousel: ["baggagecarousel", "baggagebelt"],
  aircraftType: ["aircrafttype", "aircraft"],
  aircraftRegistration: ["aircraftregistration", "registration"],
  seat: ["seat"],
  bookingClass: ["bookingclass"],
  cabin: ["cabin", "cabinclass"],
};

export function parseCsv(text: string): ParsedCsv {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field === "") {
      quoted = true;
    } else if (character === ",") {
      record.push(field.trim());
      field = "";
    } else if (character === "\n") {
      record.push(field.trim());
      if (record.some(Boolean)) records.push(record);
      record = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }
  if (quoted) throw new Error("unterminated-quote");
  record.push(field.trim());
  if (record.some(Boolean)) records.push(record);
  if (records.length < 2) throw new Error("missing-rows");

  const [headers, ...rows] = records;
  headers![0] = headers![0]!.replace(/^\uFEFF/, "");
  if (headers!.some((header) => !header)) throw new Error("empty-header");
  return { headers: headers!, rows };
}

export function detectCsvMapping(headers: readonly string[]): CsvColumnMapping {
  return Object.fromEntries(requiredCsvFlightFields.concat(csvFlightFields.filter((field) => !requiredCsvFlightFields.includes(field))).flatMap((field) => {
    const index = headers.findIndex((header) => aliases[field].includes(normalizeHeader(header)));
    return index === -1 && !requiredCsvFlightFields.includes(field) ? [] : [[field, index === -1 ? null : index]];
  })) as CsvColumnMapping;
}

export function buildDocumentFromCsv(
  parsed: ParsedCsv,
  mapping: CsvColumnMapping,
  existing: KeeprawFlyDocument | null,
  idFactory: () => string = () => crypto.randomUUID(),
  includePossibleDuplicates = false,
): KeeprawFlyDocument {
  const preflight = preflightCsvImport(parsed, mapping, existing, idFactory);
  return buildDocumentFromCsvPreflight(preflight, existing, includePossibleDuplicates);
}

export function buildDocumentFromCsvPreflight(
  preflight: CsvImportPreflight,
  existing: KeeprawFlyDocument | null,
  includePossibleDuplicates = false,
): KeeprawFlyDocument {
  if (!preflight.canImport) throw new Error(formatCsvIssue(preflight.issues[0]!));
  const importedFlights = selectFlightsForImport(preflight.assessments, includePossibleDuplicates);

  return {
    format: KEEPRAW_FLY_FORMAT,
    formatVersion: KEEPRAW_FLY_FORMAT_VERSION,
    profile: existing?.profile ?? {},
    flights: [...(existing?.flights ?? []), ...importedFlights],
    ...(existing?.extensions ? { extensions: existing.extensions } : {}),
  };
}

export function preflightCsvImport(
  parsed: ParsedCsv,
  mapping: CsvColumnMapping,
  existing: KeeprawFlyDocument | null,
  idFactory: () => string = () => crypto.randomUUID(),
): CsvImportPreflight {
  if (requiredCsvFlightFields.some((field) => mapping[field] === null)) {
    return {
      totalRecords: parsed.rows.length,
      validRecords: 0,
      problemRecords: parsed.rows.length,
      newRecords: 0,
      possibleDuplicateRecords: 0,
      exactDuplicateRecords: 0,
      canImport: false,
      flights: [],
      assessments: [],
      issues: [{ code: "incomplete-mapping" }],
    };
  }

  const flights: KeeprawFlight[] = [];
  const issues: CsvImportIssue[] = [];

  parsed.rows.forEach((row, index) => {
    const lineNumber = index + 2;
    try {
      flights.push(flightFromCsvRow(row, mapping, lineNumber, idFactory));
    } catch (error) {
      issues.push(csvIssueFromError(error, lineNumber));
    }
  });

  const assessments = assessFlightImports(flights, existing?.flights ?? []);
  return {
    totalRecords: parsed.rows.length,
    validRecords: flights.length,
    problemRecords: issues.length,
    ...countFlightImportAssessments(assessments),
    canImport: issues.length === 0,
    flights,
    assessments,
    issues,
  };
}

function flightFromCsvRow(
  row: string[],
  mapping: CsvColumnMapping,
  lineNumber: number,
  idFactory: () => string,
): KeeprawFlight {
  const value = (field: CsvFlightField) => (row[mapping[field]!] ?? "").trim();
  const flightNumber = value("flightNumber");
  const normalizedFlightNumber = flightNumber.trim().toUpperCase().replace(/[\s-]+/g, "");
  const serviceDate = value("serviceDate");
  const originIata = value("originIata");
  const destinationIata = value("destinationIata");
  const scheduledDeparture = value("scheduledDeparture");
  const scheduledArrival = value("scheduledArrival");

  if (normalizedFlightNumber !== flightNumber) throw new Error(`line-${lineNumber}:invalid-flight-number`);

  if (!isCalendarDate(serviceDate)) throw new Error(`line-${lineNumber}:invalid-date`);
  if (!airportByIata.has(originIata) || !airportByIata.has(destinationIata)) {
    throw new Error(`line-${lineNumber}:unknown-airport`);
  }
  if (originIata === destinationIata) throw new Error(`line-${lineNumber}:same-airport`);
  const origin = airportByIata.get(originIata)!;
  const destination = airportByIata.get(destinationIata)!;
  const departureIso = parseImportTime(scheduledDeparture, origin.timezone, lineNumber);
  const arrivalIso = parseImportTime(scheduledArrival, destination.timezone, lineNumber);
  if (localPartsAtAirport(departureIso, origin.timezone).date !== serviceDate) throw new Error(`line-${lineNumber}:date-mismatch`);
  if (Date.parse(arrivalIso) <= Date.parse(departureIso)) throw new Error(`line-${lineNumber}:chronology`);
  const departure = localPartsAtAirport(departureIso, origin.timezone);
  const arrival = localPartsAtAirport(arrivalIso, destination.timezone);
  const actual = (field: "actualDeparture" | "actualArrival", timezone: string) => {
    const raw = value(field);
    if (!raw) return { date: "", time: "" };
    return localPartsAtAirport(parseImportTime(raw, timezone, lineNumber), timezone);
  };
  const actualDeparture = actual("actualDeparture", origin.timezone);
  const divertedToIata = value("divertedToIata");
  const divertedTo = divertedToIata ? airportByIata.get(divertedToIata) : undefined;
  if (divertedToIata && !divertedTo) throw new Error(`line-${lineNumber}:unknown-airport`);
  const actualArrival = actual("actualArrival", (divertedTo ?? destination).timezone);
  const draft: FlightDraft = {
    flightNumber, serviceDate, originIata, destinationIata,
    departureTime: departure.time, arrivalDate: arrival.date, arrivalTime: arrival.time,
    actualDepartureDate: actualDeparture.date, actualDepartureTime: actualDeparture.time,
    actualArrivalDate: actualArrival.date, actualArrivalTime: actualArrival.time,
    originTerminal: value("originTerminal"), originGate: value("originGate"), destinationTerminal: value("destinationTerminal"),
    aircraftType: value("aircraftType"), aircraftRegistration: value("aircraftRegistration"), seat: value("seat"),
    cabin: value("cabin"), bookingClass: value("bookingClass"), baggageCarousel: value("baggageCarousel"),
    ticketNumber: value("ticketNumber"), bookingReference: value("bookingReference"),
    frequentFlyerMembershipId: "", frequentFlyerTierAtFlight: "",
    cancelled: /^(true|1|yes)$/i.test(value("cancelled")),
    divertedToIata: divertedTo?.iata ?? "",
  };
  const flight = flightFromDraft(draft);
  flight.id = `flight-${idFactory()}`;
  return flight;
}

function csvIssueFromError(error: unknown, fallbackLineNumber: number): CsvImportIssue {
  const message = error instanceof Error ? error.message : "";
  const match = /^line-(\d+):(.+)$/.exec(message);
  const code = match?.[2] as CsvImportIssueCode | undefined;
  return {
    code: code && isCsvIssueCode(code) ? code : "invalid-flight-number",
    lineNumber: match?.[1] ? Number(match[1]) : fallbackLineNumber,
  };
}

function formatCsvIssue(issue: CsvImportIssue): string {
  return issue.lineNumber ? `line-${issue.lineNumber}:${issue.code}` : issue.code;
}

function isCsvIssueCode(value: string): value is CsvImportIssueCode {
  return [
    "incomplete-mapping",
    "invalid-flight-number",
    "invalid-date",
    "unknown-airport",
    "same-airport",
    "ambiguous-time",
    "nonexistent-time",
    "invalid-time",
    "date-mismatch",
    "chronology",
  ].includes(value);
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function hasExplicitOffset(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value);
}

function parseImportTime(value: string, timezone: string, lineNumber: number): string {
  if (hasExplicitOffset(value)) {
    const explicitTime = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2})?)(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
    if (!explicitTime || !isCalendarDate(explicitTime[1]!) || !isValidClockTime(explicitTime[2]!)) throw new Error(`line-${lineNumber}:invalid-time`);
    if (!Number.isFinite(Date.parse(value))) throw new Error(`line-${lineNumber}:invalid-time`);
    return value;
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) throw new Error(`line-${lineNumber}:invalid-time`);
  const [date, time] = value.split("T");
  try { return zonedDateTimeToIso(date!, time!, timezone); } catch (error) {
    throw new Error(`line-${lineNumber}:${error instanceof Error && error.message === "ambiguous-local-time" ? "ambiguous-time" : error instanceof Error && error.message === "nonexistent-local-time" ? "nonexistent-time" : "invalid-time"}`);
  }
}

function isValidClockTime(value: string): boolean {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] ? Number(match[3]) : 0;
  return hour <= 23 && minute <= 59 && second <= 59;
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}
