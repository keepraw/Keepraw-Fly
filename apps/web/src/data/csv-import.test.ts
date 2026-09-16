import { describe, expect, it } from "vitest";
import airportRows from "@keepraw-fly/core/airport-directory";
import { installAirportDirectory, type CompactAirportRow } from "@keepraw-fly/core";
import {
  buildDocumentFromCsv,
  detectCsvMapping,
  parseCsv,
  preflightCsvImport,
} from "./csv-import";

installAirportDirectory(airportRows as CompactAirportRow[]);

const csv = `Flight Number,Date,From,To,Departure Time,Arrival Time\nMU589,2026-09-02,PVG,SFO,2026-09-02T13:00:00+08:00,2026-09-02T09:20:00-07:00`;

describe("CSV flight import", () => {
  it("parses quoted cells and detects common header aliases", () => {
    const parsed = parseCsv(csv.replace("MU589", '"MU589"'));
    expect(parsed.rows[0]?.[0]).toBe("MU589");
    expect(detectCsvMapping(parsed.headers)).toEqual({
      flightNumber: 0,
      serviceDate: 1,
      originIata: 2,
      destinationIata: 3,
      scheduledDeparture: 4,
      scheduledArrival: 5,
    });
  });

  it("builds canonical flights and appends without changing the base profile", () => {
    const parsed = parseCsv(csv);
    const document = buildDocumentFromCsv(parsed, detectCsvMapping(parsed.headers), {
      format: "keepraw-fly",
      formatVersion: "0.1.0",
      profile: { name: { romanized: "Yuan Lin" } },
      flights: [],
    }, () => "csv-id");
    expect(document.profile.name?.romanized).toBe("Yuan Lin");
    expect(document.flights[0]).toMatchObject({
      id: "flight-csv-id",
      flightNumber: "MU589",
      origin: { iata: "PVG" },
      destination: { iata: "SFO" },
    });
  });

  it("requires explicit timezone offsets", () => {
    const parsed = parseCsv(csv.replace("2026-09-02T13:00:00+08:00", "2026-09-02T13:00:00"));
    expect(() => buildDocumentFromCsv(parsed, detectCsvMapping(parsed.headers), null))
      .toThrow("line-2:timezone-required");
  });

  it("reports impossible calendar dates and timestamps during preflight", () => {
    const invalidDate = parseCsv(csv.replace("2026-09-02", "2026-02-30"));
    const invalidDatePreflight = preflightCsvImport(
      invalidDate,
      detectCsvMapping(invalidDate.headers),
      null,
      () => "preview",
    );
    const invalidTime = parseCsv(csv.replace("13:00:00", "29:00:00"));
    const invalidTimePreflight = preflightCsvImport(
      invalidTime,
      detectCsvMapping(invalidTime.headers),
      null,
      () => "preview",
    );

    expect(invalidDatePreflight.issues[0]).toEqual({ code: "invalid-date", lineNumber: 2 });
    expect(invalidTimePreflight.issues[0]).toEqual({ code: "invalid-time", lineNumber: 2 });
  });

  it("preflights valid rows when there is no existing archive", () => {
    const parsed = parseCsv(csv);
    const preflight = preflightCsvImport(parsed, detectCsvMapping(parsed.headers), null, () => "preview");

    expect(preflight).toMatchObject({
      totalRecords: 1,
      validRecords: 1,
      problemRecords: 0,
      newRecords: 1,
      possibleDuplicateRecords: 0,
      exactDuplicateRecords: 0,
      canImport: true,
      issues: [],
    });
  });

  it("skips an exact duplicate in a non-empty archive", () => {
    const parsed = parseCsv(csv);
    const imported = buildDocumentFromCsv(parsed, detectCsvMapping(parsed.headers), null, () => "existing");
    const preflight = preflightCsvImport(
      parsed,
      detectCsvMapping(parsed.headers),
      imported,
      () => "preview",
    );

    expect(preflight).toMatchObject({
      newRecords: 0,
      possibleDuplicateRecords: 0,
      exactDuplicateRecords: 1,
      canImport: true,
    });
    expect(buildDocumentFromCsv(parsed, detectCsvMapping(parsed.headers), imported).flights).toHaveLength(1);
  });

  it("requires an explicit opt-in to import a possible duplicate", () => {
    const parsed = parseCsv(csv);
    const existing = buildDocumentFromCsv(parsed, detectCsvMapping(parsed.headers), null, () => "existing");
    const changedTime = parseCsv(csv
      .replace("13:00:00", "14:00:00")
      .replace("09:20:00", "10:20:00"));
    const mapping = detectCsvMapping(changedTime.headers);
    const preflight = preflightCsvImport(changedTime, mapping, existing, () => "possible");

    expect(preflight).toMatchObject({
      newRecords: 0,
      possibleDuplicateRecords: 1,
      exactDuplicateRecords: 0,
    });
    expect(buildDocumentFromCsv(changedTime, mapping, existing, () => "skipped").flights).toHaveLength(1);
    expect(buildDocumentFromCsv(changedTime, mapping, existing, () => "included", true).flights).toHaveLength(2);
  });

  it("counts partial row failures and blocks the whole CSV import", () => {
    const parsed = parseCsv(`${csv}\nUA123,2026-08-19,SFO,LAX,2026-08-19T10:20:00-07:00,not-a-time`);
    const mapping = detectCsvMapping(parsed.headers);
    const preflight = preflightCsvImport(parsed, mapping, null, () => "preview");

    expect(preflight).toMatchObject({
      totalRecords: 2,
      validRecords: 1,
      problemRecords: 1,
      canImport: false,
    });
    expect(preflight.issues).toEqual([{ code: "timezone-required", lineNumber: 3 }]);
    expect(() => buildDocumentFromCsv(parsed, mapping, null)).toThrow("line-3:timezone-required");
  });

  it("does not silently normalize flight numbers or airport codes", () => {
    const spacedFlightNumber = parseCsv(csv.replace("MU589", "MU 589"));
    const numberPreflight = preflightCsvImport(
      spacedFlightNumber,
      detectCsvMapping(spacedFlightNumber.headers),
      null,
      () => "preview",
    );
    const lowercaseAirport = parseCsv(csv.replace(",PVG,SFO,", ",pvg,SFO,"));
    const airportPreflight = preflightCsvImport(
      lowercaseAirport,
      detectCsvMapping(lowercaseAirport.headers),
      null,
      () => "preview",
    );

    expect(numberPreflight.issues[0]).toEqual({ code: "invalid-flight-number", lineNumber: 2 });
    expect(airportPreflight.issues[0]).toEqual({ code: "unknown-airport", lineNumber: 2 });
  });

  it("rejects empty and malformed CSV files before preview", () => {
    expect(() => parseCsv("")).toThrow("missing-rows");
    expect(() => parseCsv('Flight Number,Date\n"UA123,2026-08-19')).toThrow("unterminated-quote");
  });
});
