import type { KeeprawFlight, KeeprawFlyDocument } from "@keepraw-fly/schema";
import { KEEPRAW_FLY_FORMAT, KEEPRAW_FLY_FORMAT_VERSION } from "@keepraw-fly/schema";
import { airportByIata } from "@keepraw-fly/core";
import { splitFlightNumberInput } from "./flight-editor";

export type CsvFlightField =
  | "flightNumber"
  | "serviceDate"
  | "originIata"
  | "destinationIata"
  | "scheduledDeparture"
  | "scheduledArrival";

export const csvFlightFields: CsvFlightField[] = [
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

const aliases: Record<CsvFlightField, string[]> = {
  flightNumber: ["flightnumber", "flight", "number", "航班号"],
  serviceDate: ["servicedate", "date", "departuredate", "日期", "出发日期"],
  originIata: ["originiata", "origin", "from", "departureairport", "出发机场"],
  destinationIata: ["destinationiata", "destination", "to", "arrivalairport", "到达机场"],
  scheduledDeparture: ["scheduleddeparture", "departuretime", "scheduleddepartureiso", "计划出发时间"],
  scheduledArrival: ["scheduledarrival", "arrivaltime", "scheduledarrivaliso", "计划到达时间"],
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
  return Object.fromEntries(csvFlightFields.map((field) => {
    const index = headers.findIndex((header) => aliases[field].includes(normalizeHeader(header)));
    return [field, index === -1 ? null : index];
  })) as CsvColumnMapping;
}

export function buildDocumentFromCsv(
  parsed: ParsedCsv,
  mapping: CsvColumnMapping,
  existing: KeeprawFlyDocument | null,
  idFactory: () => string = () => crypto.randomUUID(),
): KeeprawFlyDocument {
  if (csvFlightFields.some((field) => mapping[field] === null)) {
    throw new Error("incomplete-mapping");
  }

  const importedFlights = parsed.rows.map((row, index) =>
    flightFromCsvRow(row, mapping, index + 2, idFactory));
  return {
    format: KEEPRAW_FLY_FORMAT,
    formatVersion: KEEPRAW_FLY_FORMAT_VERSION,
    profile: existing?.profile ?? {},
    flights: [...(existing?.flights ?? []), ...importedFlights],
    ...(existing?.extensions ? { extensions: existing.extensions } : {}),
  };
}

function flightFromCsvRow(
  row: string[],
  mapping: CsvColumnMapping,
  lineNumber: number,
  idFactory: () => string,
): KeeprawFlight {
  const value = (field: CsvFlightField) => (row[mapping[field]!] ?? "").trim();
  const flightNumber = value("flightNumber").toUpperCase().replace(/\s+/g, "");
  const identity = splitFlightNumberInput(flightNumber);
  const serviceDate = value("serviceDate");
  const originIata = value("originIata").toUpperCase();
  const destinationIata = value("destinationIata").toUpperCase();
  const scheduledDeparture = value("scheduledDeparture");
  const scheduledArrival = value("scheduledArrival");

  if (!identity) throw new Error(`line-${lineNumber}:invalid-flight-number`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) throw new Error(`line-${lineNumber}:invalid-date`);
  if (!airportByIata.has(originIata) || !airportByIata.has(destinationIata)) {
    throw new Error(`line-${lineNumber}:unknown-airport`);
  }
  if (originIata === destinationIata) throw new Error(`line-${lineNumber}:same-airport`);
  if (!hasExplicitOffset(scheduledDeparture) || !hasExplicitOffset(scheduledArrival)) {
    throw new Error(`line-${lineNumber}:timezone-required`);
  }
  if (scheduledDeparture.slice(0, 10) !== serviceDate) {
    throw new Error(`line-${lineNumber}:date-mismatch`);
  }
  if (Date.parse(scheduledArrival) <= Date.parse(scheduledDeparture)) {
    throw new Error(`line-${lineNumber}:chronology`);
  }

  return {
    id: `flight-${idFactory()}`,
    flightNumber: `${identity.airlineCode}${identity.serviceNumber}`,
    serviceDate,
    airline: identity.airlineCode.length === 2
      ? { iata: identity.airlineCode }
      : { icao: identity.airlineCode },
    origin: { iata: originIata },
    destination: { iata: destinationIata },
    scheduledDeparture,
    scheduledArrival,
  };
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function hasExplicitOffset(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value);
}
