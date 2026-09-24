import { describe, expect, it } from "vitest";
import { validateKeeprawFly } from "@keepraw-fly/validator";
import airportRows from "@keepraw-fly/core/airport-directory";
import { installAirportDirectory, type CompactAirportRow } from "@keepraw-fly/core";
import {
  buildDocumentFromCsv,
  csvFlightFields,
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

  it("resolves naive times in each airport timezone", () => {
    const parsed = parseCsv(csv.replace("2026-09-02T13:00:00+08:00", "2026-09-02T13:00"));
    const document = buildDocumentFromCsv(parsed, detectCsvMapping(parsed.headers), null);
    expect(document.flights[0]).toMatchObject({
      scheduledDeparture: "2026-09-02T13:00:00+08:00",
      scheduledArrival: "2026-09-02T09:20:00-07:00",
    });
  });

  it("uses origin and destination airport timezones independently", () => {
    const parsed = parseCsv("Flight Number,Date,From,To,Departure Time,Arrival Time\nCX123,2026-04-27,HKG,BOM,2026-04-27T20:15,2026-04-28T00:20");
    const document = buildDocumentFromCsv(parsed, detectCsvMapping(parsed.headers), null);
    expect(document.flights[0]).toMatchObject({
      scheduledDeparture: "2026-04-27T20:15:00+08:00",
      scheduledArrival: "2026-04-28T00:20:00+05:30",
      serviceDate: "2026-04-27",
    });
  });

  it("rejects DST gap and ambiguous local times", () => {
    const gap = parseCsv(csv.replace("2026-09-02,PVG,SFO", "2026-03-08,LAX,SFO").replace("2026-09-02T13:00:00+08:00", "2026-03-08T02:30"));
    const gapMapping = detectCsvMapping(gap.headers);
    expect(() => buildDocumentFromCsv(gap, gapMapping, null)).toThrow("line-2:nonexistent-time");
    const ambiguous = parseCsv(csv.replace("2026-09-02,PVG,SFO", "2026-11-01,LAX,SFO").replace("2026-09-02T13:00:00+08:00", "2026-11-01T01:30"));
    const ambiguousMapping = detectCsvMapping(ambiguous.headers);
    expect(() => buildDocumentFromCsv(ambiguous, ambiguousMapping, null)).toThrow("line-2:ambiguous-time");
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
    expect(preflight.issues).toEqual([{ code: "invalid-time", lineNumber: 3 }]);
    expect(() => buildDocumentFromCsv(parsed, mapping, null)).toThrow("line-3:invalid-time");
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
  it("uses the canonical CSV field order and maps endpoint facts symmetrically", () => {
    expect(csvFlightFields).toEqual([
      "flightNumber", "serviceDate", "originIata", "destinationIata", "scheduledDeparture", "scheduledArrival",
      "actualDeparture", "actualArrival", "originTerminal", "originGate", "destinationTerminal", "destinationGate",
      "cancelled", "divertedToIata", "ticketNumber", "bookingReference", "aircraftType", "aircraftRegistration",
      "seat", "bookingClass", "cabin",
    ]);

    const parsed = parseCsv([
      csvFlightFields.join(","),
      "CX123,2026-09-23,TAO,HKG,2026-09-23T14:30,2026-09-23T18:00,2026-09-23T14:40,2026-09-23T17:55,1,12,1,33,false,,781-123,ABC123,A321,B-1234,12A,Y,economy",
    ].join("\n"));
    const document = buildDocumentFromCsv(parsed, detectCsvMapping(parsed.headers), null, () => "target");

    expect(document.flights[0]).toMatchObject({
      origin: { iata: "TAO", terminal: "1", gate: "12" },
      destination: { iata: "HKG", terminal: "1", gate: "33" },
      ticketNumber: "781-123",
    });
  });

  it("imports cancelled flights with empty actual times and treats empty cancelled as false", () => {
    const cancelled = parseCsv([
      csvFlightFields.join(","),
      "CX124,2026-09-23,TAO,HKG,2026-09-23T14:30,2026-09-23T18:00,,,1,12,1,33,true,,781-124,ABC124,A321,B-1234,12B,Y,economy",
    ].join("\n"));
    const cancelledDocument = buildDocumentFromCsv(cancelled, detectCsvMapping(cancelled.headers), null, () => "cancelled");

    expect(cancelledDocument.flights[0]).toMatchObject({ cancelled: true });
    expect(cancelledDocument.flights[0]).not.toHaveProperty("actualDeparture");
    expect(cancelledDocument.flights[0]).not.toHaveProperty("actualArrival");

    const empty = parseCsv([
      csvFlightFields.join(","),
      "CX125,2026-09-24,TAO,HKG,2026-09-24T14:30,2026-09-24T18:00,,,1,12,1,34,,,781-125,ABC125,A321,B-1234,12C,Y,economy",
    ].join("\n"));
    const emptyDocument = buildDocumentFromCsv(empty, detectCsvMapping(empty.headers), null, () => "empty");
    expect(emptyDocument.flights[0]).not.toHaveProperty("cancelled");
  });
  it("imports divertedToIata and leaves the conflict to the canonical validator", () => {
    const parsed = parseCsv([
      csvFlightFields.join(","),
      "CX126,2026-09-23,TAO,HKG,2026-09-23T14:30,2026-09-23T18:00,,2026-09-23T19:00,1,12,1,33,false,KIX,,,,,,,,",
    ].join("\n"));
    const document = buildDocumentFromCsv(parsed, detectCsvMapping(parsed.headers), null, () => "diverted");
    expect(document.flights[0]).toMatchObject({ divertedTo: { iata: "KIX" } });
    expect(validateKeeprawFly(document).valid).toBe(true);

    const conflict = parseCsv([
      csvFlightFields.join(","),
      "CX127,2026-09-23,TAO,HKG,2026-09-23T14:30,2026-09-23T18:00,,,1,12,1,33,true,KIX,,,,,,,,",
    ].join("\n"));
    const conflictDocument = buildDocumentFromCsv(conflict, detectCsvMapping(conflict.headers), null, () => "conflict");
    const result = validateKeeprawFly(conflictDocument);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues).toContainEqual(expect.objectContaining({ keyword: "cancelledDivertedConflict" }));
  });
});
