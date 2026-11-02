import type { KeeprawFlight, KeeprawFlyDocument } from "@keepraw-fly/schema";
import {
  KEEPRAW_FLY_FORMAT,
  KEEPRAW_FLY_FORMAT_VERSION,
} from "@keepraw-fly/schema";
import { isFixedOffset } from "@keepraw-fly/core";
import {
  AirportTimezoneRequiredError,
  airportTimeFormatter,
  endpointZone,
  flightFromDraft,
  isAirportCodeFormat,
  type EndpointZoneRole,
  localPartsAtAirport,
  zonedDateTimeToIso,
  type FlightDraft,
} from "./flight-editor";
import {
  assessFlightImportsWork,
  countFlightImportAssessments,
  selectFlightsForImport,
  type FlightImportAssessment,
} from "./duplicate-detection";
import type { ImportPreflightCounts } from "./import-preview";
import { finishImportPreflight } from "./import-preflight-work";

export type CsvFlightField =
  | "flightNumber"
  | "serviceDate"
  | "originIata"
  | "destinationIata"
  | "scheduledDeparture"
  | "scheduledArrival"
  | "actualDeparture"
  | "actualArrival"
  | "originTerminal"
  | "originGate"
  | "destinationTerminal"
  | "destinationGate"
  | "divertedToIata"
  | "cancelled"
  | "ticketNumber"
  | "bookingReference"
  | "aircraftType"
  | "aircraftRegistration"
  | "seat"
  | "bookingClass"
  | "cabin";

export const csvFlightFields: CsvFlightField[] = [
  "flightNumber",
  "serviceDate",
  "originIata",
  "destinationIata",
  "scheduledDeparture",
  "scheduledArrival",
  "actualDeparture",
  "actualArrival",
  "originTerminal",
  "originGate",
  "destinationTerminal",
  "destinationGate",
  "cancelled",
  "divertedToIata",
  "ticketNumber",
  "bookingReference",
  "aircraftType",
  "aircraftRegistration",
  "seat",
  "bookingClass",
  "cabin",
];

export const requiredCsvFlightFields: CsvFlightField[] = [
  "flightNumber",
  "serviceDate",
  "originIata",
  "destinationIata",
  "scheduledDeparture",
  "scheduledArrival",
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
  | "invalid-timezone"
  | "invalid-row"
  | "date-mismatch"
  | "chronology"
  | "airport-timezone-required";

/** Zones the user confirmed for airports Keepraw cannot place, by IATA code. */
export interface ImportAirportOptions {
  timezoneOverrides?: Readonly<Record<string, string>>;
}

export interface CsvImportIssue {
  code: CsvImportIssueCode;
  lineNumber?: number;
  /** For `airport-timezone-required`: the endpoint code waiting for a zone. */
  airportCode?: string;
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
  destinationIata: [
    "destinationiata",
    "destination",
    "to",
    "arrivalairport",
    "到达机场",
  ],
  scheduledDeparture: [
    "scheduleddeparture",
    "departuretime",
    "scheduleddepartureiso",
    "计划出发时间",
  ],
  scheduledArrival: [
    "scheduledarrival",
    "arrivaltime",
    "scheduledarrivaliso",
    "计划到达时间",
  ],
  actualDeparture: ["actualdeparture", "actualdepartureiso", "实际出发时间"],
  actualArrival: ["actualarrival", "actualarrivaliso", "实际到达时间"],
  divertedToIata: [
    "divertedtoiata",
    "divertedto",
    "divertedairport",
    "备降机场",
  ],
  cancelled: ["cancelled", "canceled", "取消"],
  originTerminal: ["originterminal", "departureterminal", "出发航站楼"],
  originGate: ["origingate", "departuregate", "出发登机口"],
  destinationTerminal: ["destinationterminal", "arrivalterminal", "到达航站楼"],
  destinationGate: ["destinationgate", "arrivalgate", "到达登机口"],
  ticketNumber: ["ticketnumber", "ticket", "票号"],
  bookingReference: ["bookingreference", "pnr", "bookingcode"],
  aircraftType: ["aircrafttype", "aircraft"],
  aircraftRegistration: ["aircraftregistration", "registration"],
  seat: ["seat"],
  bookingClass: ["bookingclass"],
  cabin: ["cabin", "cabinclass"],
};

export type CsvDelimiter = "," | ";" | "\t";
const csvDelimiters: CsvDelimiter[] = [",", ";", "\t"];

/**
 * Picks the delimiter from the header record: spreadsheet exports use ";" in
 * locales with a decimal comma (fr, de, es, pt-BR) and Tab for "text" exports.
 * Only characters outside quotes count; ties prefer comma (RFC 4180).
 */
export function detectCsvDelimiter(text: string): CsvDelimiter {
  const counts = new Map<CsvDelimiter, number>(
    csvDelimiters.map((d) => [d, 0]),
  );
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (character === '"') {
      if (quoted && text[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && (character === "\n" || character === "\r")) {
      break;
    } else if (!quoted && counts.has(character as CsvDelimiter)) {
      counts.set(
        character as CsvDelimiter,
        counts.get(character as CsvDelimiter)! + 1,
      );
    }
  }
  let best: CsvDelimiter = ",";
  for (const delimiter of csvDelimiters)
    if (counts.get(delimiter)! > counts.get(best)!) best = delimiter;
  return best;
}

/**
 * RFC 4180 parser with spreadsheet-friendly leniencies:
 * - delimiter auto-detected (comma, semicolon or Tab), or given explicitly;
 * - CRLF, LF and lone CR line breaks; a UTF-8 BOM before the header;
 * - quoted fields may contain delimiters, line breaks and "" escapes and are
 *   kept verbatim (meaningful leading/trailing spaces survive); unquoted fields
 *   are trimmed, as before, to tolerate aligned columns;
 * - blank lines are skipped.
 * Malformed quoting is an error instead of being silently concatenated:
 * "unterminated-quote" (no closing quote) and "unexpected-quote" (a quote
 * inside an unquoted field, or text after a closing quote).
 */
export function parseCsv(
  text: string,
  delimiter: CsvDelimiter = detectCsvDelimiter(text.replace(/^\uFEFF/, "")),
): ParsedCsv {
  const source = text.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let fieldQuoted = false;
  let quoted = false;
  let afterClosingQuote = false;

  const endField = () => {
    record.push(fieldQuoted ? field : field.trim());
    field = "";
    fieldQuoted = false;
    afterClosingQuote = false;
  };
  const endRecord = () => {
    endField();
    if (record.some((value) => value !== "")) records.push(record);
    record = [];
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    if (quoted) {
      if (character !== '"') field += character;
      else if (source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = false;
        afterClosingQuote = true;
      }
      continue;
    }
    if (character === delimiter) endField();
    else if (character === "\n") endRecord();
    else if (character === "\r") {
      if (source[index + 1] === "\n") index += 1;
      endRecord();
    } else if (afterClosingQuote) {
      // Only spaces may separate a closing quote from the next delimiter.
      if (character !== " " && character !== "\t")
        throw new Error("unexpected-quote");
    } else if (character === '"') {
      if (field.trim() !== "") throw new Error("unexpected-quote");
      field = "";
      fieldQuoted = true;
      quoted = true;
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("unterminated-quote");
  endRecord();
  if (records.length < 2) throw new Error("missing-rows");

  const [headers, ...rows] = records;
  if (headers!.some((header) => !header.trim()))
    throw new Error("empty-header");
  return { headers: headers!.map((header) => header.trim()), rows };
}

export function detectCsvMapping(headers: readonly string[]): CsvColumnMapping {
  return Object.fromEntries(
    requiredCsvFlightFields
      .concat(
        csvFlightFields.filter(
          (field) => !requiredCsvFlightFields.includes(field),
        ),
      )
      .flatMap((field) => {
        const index = headers.findIndex((header) =>
          aliases[field].includes(normalizeHeader(header)),
        );
        return index === -1 && !requiredCsvFlightFields.includes(field)
          ? []
          : [[field, index === -1 ? null : index]];
      }),
  ) as CsvColumnMapping;
}

export function buildDocumentFromCsv(
  parsed: ParsedCsv,
  mapping: CsvColumnMapping,
  existing: KeeprawFlyDocument | null,
  idFactory: () => string = () => crypto.randomUUID(),
  includePossibleDuplicates = false,
): KeeprawFlyDocument {
  const preflight = preflightCsvImport(parsed, mapping, existing, idFactory);
  return buildDocumentFromCsvPreflight(
    preflight,
    existing,
    includePossibleDuplicates,
  );
}

export function buildDocumentFromCsvPreflight(
  preflight: CsvImportPreflight,
  existing: KeeprawFlyDocument | null,
  includePossibleDuplicates = false,
): KeeprawFlyDocument {
  if (!preflight.canImport)
    throw new Error(formatCsvIssue(preflight.issues[0]!));
  const importedFlights = selectFlightsForImport(
    preflight.assessments,
    includePossibleDuplicates,
  );

  return {
    ...(existing ?? {}),
    format: KEEPRAW_FLY_FORMAT,
    formatVersion: KEEPRAW_FLY_FORMAT_VERSION,
    profile: existing?.profile ?? {},
    flights: [...(existing?.flights ?? []), ...importedFlights],
  };
}

export function preflightCsvImport(
  parsed: ParsedCsv,
  mapping: CsvColumnMapping,
  existing: KeeprawFlyDocument | null,
  idFactory: () => string = () => crypto.randomUUID(),
  options: ImportAirportOptions = {},
): CsvImportPreflight {
  return finishImportPreflight(
    preflightCsvImportWork(parsed, mapping, existing, idFactory, options),
  );
}

export function* preflightCsvImportWork(
  parsed: ParsedCsv,
  mapping: CsvColumnMapping,
  existing: KeeprawFlyDocument | null,
  idFactory: () => string = () => crypto.randomUUID(),
  options: ImportAirportOptions = {},
): Generator<void, CsvImportPreflight, void> {
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

  for (const [index, row] of parsed.rows.entries()) {
    const lineNumber = index + 2;
    try {
      flights.push(
        flightFromCsvRow(row, mapping, lineNumber, idFactory, options),
      );
    } catch (error) {
      issues.push(csvIssueFromError(error, lineNumber));
    }
    yield;
  }

  const assessments = yield* assessFlightImportsWork(
    flights,
    existing?.flights ?? [],
  );
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
  options: ImportAirportOptions,
): KeeprawFlight {
  const value = (field: CsvFlightField) => (row[mapping[field]!] ?? "").trim();
  const flightNumber = value("flightNumber");
  const normalizedFlightNumber = flightNumber
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "");
  const serviceDate = value("serviceDate");
  const originIata = value("originIata");
  const destinationIata = value("destinationIata");
  const scheduledDeparture = value("scheduledDeparture");
  const scheduledArrival = value("scheduledArrival");

  if (normalizedFlightNumber !== flightNumber)
    throw new Error(`line-${lineNumber}:invalid-flight-number`);

  if (!isCalendarDate(serviceDate))
    throw new Error(`line-${lineNumber}:invalid-date`);
  // Well-formed codes are kept even when no layer knows them (the flight is
  // never dropped); their zone comes from the flight-date historical airport,
  // the user's explicit override, or the timestamp's own UTC offset.
  if (!isAirportCodeFormat(originIata) || !isAirportCodeFormat(destinationIata))
    throw new Error(`line-${lineNumber}:unknown-airport`);
  if (originIata === destinationIata)
    throw new Error(`line-${lineNumber}:same-airport`);
  const overrides = options.timezoneOverrides ?? {};
  const zoneOf = (iata: string, date: string, role: EndpointZoneRole) =>
    endpointZone(iata, date, role, overrides[iata]).zone;
  const writtenDate = (raw: string) =>
    /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : "";
  const originZone = zoneOf(originIata, serviceDate, "origin");
  const destinationZone = zoneOf(
    destinationIata,
    writtenDate(scheduledArrival),
    "destination",
  );
  const departureIso = parseImportTime(
    scheduledDeparture,
    originZone,
    lineNumber,
    originIata,
  );
  const arrivalIso = parseImportTime(
    scheduledArrival,
    destinationZone,
    lineNumber,
    destinationIata,
  );
  const partsIn = (iso: string, zone: string | null) =>
    zone
      ? localPartsAtAirport(iso, zone)
      : { date: iso.slice(0, 10), time: iso.slice(11, 16) };
  const departure = partsIn(departureIso, originZone);
  if (departure.date !== serviceDate)
    throw new Error(`line-${lineNumber}:date-mismatch`);
  const arrival = partsIn(arrivalIso, destinationZone);
  const actual = (
    field: "actualDeparture" | "actualArrival",
    timezone: string | null,
    iata: string,
  ) => {
    const raw = value(field);
    if (!raw) return undefined;
    return parseImportTime(raw, timezone, lineNumber, iata);
  };
  const actualDeparture = actual("actualDeparture", originZone, originIata);
  const divertedToIata = value("divertedToIata");
  if (divertedToIata && !isAirportCodeFormat(divertedToIata))
    throw new Error(`line-${lineNumber}:unknown-airport`);
  const arrivalZone = divertedToIata
    ? zoneOf(
        divertedToIata,
        writtenDate(value("actualArrival") || scheduledArrival),
        "divertedTo",
      )
    : destinationZone;
  const actualArrival = actual(
    "actualArrival",
    arrivalZone,
    divertedToIata || destinationIata,
  );
  const actualDepartureParts = actualDeparture
    ? partsIn(actualDeparture, originZone)
    : { date: "", time: "" };
  const actualArrivalParts = actualArrival
    ? partsIn(actualArrival, arrivalZone)
    : { date: "", time: "" };
  const draft: FlightDraft = {
    flightNumber,
    serviceDate,
    originIata,
    destinationIata,
    departureTime: departure.time,
    arrivalDate: arrival.date,
    arrivalTime: arrival.time,
    actualDepartureDate: actualDepartureParts.date,
    actualDepartureTime: actualDepartureParts.time,
    actualArrivalDate: actualArrivalParts.date,
    actualArrivalTime: actualArrivalParts.time,
    originTerminal: value("originTerminal"),
    originGate: value("originGate"),
    destinationTerminal: value("destinationTerminal"),
    destinationGate: value("destinationGate"),
    aircraftType: value("aircraftType"),
    aircraftRegistration: value("aircraftRegistration"),
    seat: value("seat"),
    cabin: value("cabin"),
    bookingClass: value("bookingClass"),
    baggageCarousel: "",
    ticketNumber: value("ticketNumber"),
    bookingReference: value("bookingReference"),
    frequentFlyerMembershipId: "",
    frequentFlyerTierAtFlight: "",
    cancelled: /^(true|1|yes)$/i.test(value("cancelled")),
    divertedToIata,
    originTimezone: overrides[originIata] ?? "",
    destinationTimezone: overrides[destinationIata] ?? "",
    divertedTimezone: divertedToIata ? (overrides[divertedToIata] ?? "") : "",
  };
  // Let the canonical validator report cancelled/diverted conflicts after import preview.
  const flight = flightFromDraft({ ...draft, cancelled: false }, undefined, {
    scheduledDeparture: departureIso,
    scheduledArrival: arrivalIso,
    actualDeparture,
    actualArrival,
  });
  if (draft.cancelled) flight.cancelled = true;
  flight.id = `flight-${idFactory()}`;
  return flight;
}

function csvIssueFromError(
  error: unknown,
  fallbackLineNumber: number,
): CsvImportIssue {
  const message = error instanceof Error ? error.message : "";
  const match = /^line-(\d+):(.+)$/.exec(message);
  const timezoneMatch =
    /^line-(\d+):airport-timezone-required:([A-Z]{3})$/.exec(message);
  if (timezoneMatch)
    return {
      code: "airport-timezone-required",
      lineNumber: Number(timezoneMatch[1]),
      airportCode: timezoneMatch[2]!,
    };
  if (error instanceof AirportTimezoneRequiredError)
    return {
      code: "airport-timezone-required",
      lineNumber: fallbackLineNumber,
      airportCode: error.iata,
    };
  const rawCode = match?.[2] ?? message;
  const editorCodes: Record<string, CsvImportIssueCode> = {
    "invalid-local-time": "invalid-time",
    "incomplete-actual-time": "invalid-time",
    "ambiguous-local-time": "ambiguous-time",
    "nonexistent-local-time": "nonexistent-time",
    "arrival-before-departure": "chronology",
    "actual-arrival-before-departure": "chronology",
  };
  return {
    code: isCsvIssueCode(rawCode)
      ? rawCode
      : Object.hasOwn(editorCodes, rawCode)
        ? editorCodes[rawCode]!
        : "invalid-row",
    lineNumber: match?.[1] ? Number(match[1]) : fallbackLineNumber,
  };
}

function formatCsvIssue(issue: CsvImportIssue): string {
  return issue.lineNumber
    ? `line-${issue.lineNumber}:${issue.code}`
    : issue.code;
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
    "invalid-timezone",
    "invalid-row",
    "date-mismatch",
    "chronology",
    "airport-timezone-required",
  ].includes(value);
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function parseImportTime(
  value: string,
  timezone: string | null,
  lineNumber: number,
  iata = "",
): string {
  const match =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2})?)(Z|[+-]\d{2}:\d{2})?$/.exec(
      value,
    );
  if (!match || !isCalendarDate(match[1]!) || !isValidClockTime(match[2]!))
    throw new Error(`line-${lineNumber}:invalid-time`);
  const [, date, time, offset] = match;
  if (!offset && time!.length !== 5)
    throw new Error(`line-${lineNumber}:invalid-time`);
  if (offset && !Number.isFinite(Date.parse(value)))
    throw new Error(`line-${lineNumber}:invalid-time`);
  if (timezone === null) {
    // Undetermined airport: an explicit offset is kept as written; a bare wall
    // clock is never guessed into UTC. The row waits for a user zone.
    if (offset) return minuteIsoAtOffset(value);
    throw new Error(`line-${lineNumber}:airport-timezone-required:${iata}`);
  }
  try {
    // Validate the airport's IANA zone independently of the timestamp format.
    if (!isFixedOffset(timezone)) airportTimeFormatter(timezone);
  } catch {
    throw new Error(`line-${lineNumber}:invalid-timezone`);
  }
  if (offset)
    return isFixedOffset(timezone)
      ? minuteIsoAtOffset(value)
      : minuteIsoAtAirport(value, timezone);
  try {
    return zonedDateTimeToIso(date!, time!.slice(0, 5), timezone);
  } catch (error) {
    const issue = csvIssueFromError(error, lineNumber);
    throw new Error(formatCsvIssue(issue));
  }
}

/** Keeps the written offset; truncates seconds per the import convention. */
function minuteIsoAtOffset(value: string): string {
  const match =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::\d{2})?(Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    )!;
  return `${match[1]}:00${match[2] === "Z" ? "+00:00" : match[2]}`;
}

function minuteIsoAtAirport(value: string, timezone: string): string {
  // Keep the supplied instant, truncating seconds per the import convention.
  // Formatting that instant in the airport zone also retains the chosen side
  // of a DST overlap, unlike resolving its local clock time a second time.
  const instant = Math.floor(Date.parse(value) / 60_000) * 60_000;
  const { date, time } = localPartsAtAirport(
    new Date(instant).toISOString(),
    timezone,
  );
  const offsetMinutes = Math.round(
    (Date.parse(`${date}T${time}:00Z`) - instant) / 60_000,
  );
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const result = `${date}T${time}:00${sign}${String(Math.floor(absoluteOffset / 60)).padStart(2, "0")}:${String(absoluteOffset % 60).padStart(2, "0")}`;
  if (Date.parse(result) !== instant) throw new Error("invalid-local-time");
  return result;
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
  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value
  );
}
