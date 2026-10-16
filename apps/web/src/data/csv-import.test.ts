import { describe, expect, it } from "vitest";
import { validateKeeprawFly } from "@keepraw-fly/validator";
import airportRows from "@keepraw-fly/core/airport-directory";
import {
  airportByIata,
  installAirportDirectory,
  type CompactAirportRow,
} from "@keepraw-fly/core";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import {
  buildDocumentFromCsv,
  csvFlightFields,
  detectCsvMapping,
  parseCsv,
  preflightCsvImport,
} from "./csv-import";

installAirportDirectory(airportRows as CompactAirportRow[]);

const csv = `Flight Number,Date,From,To,Departure Time,Arrival Time\nMU589,2026-09-02,PVG,SFO,2026-09-02T13:00:00+08:00,2026-09-02T09:20:00-07:00`;

function mappedRow(overrides: Record<string, string> = {}) {
  const fields: Record<string, string> = {
    flightNumber: "UA123",
    serviceDate: "2026-11-01",
    originIata: "JFK",
    destinationIata: "LAX",
    scheduledDeparture: "2026-11-01T00:30-04:00",
    scheduledArrival: "2026-11-01T04:30-08:00",
    ...overrides,
  };
  return parseCsv(
    [Object.keys(fields).join(","), Object.values(fields).join(",")].join("\n"),
  );
}

describe("CSV flight import", () => {
  it.each(["-04:00", "-05:00"])(
    "preserves an explicit DST overlap instant with offset %s",
    (offset) => {
      const parsed = parseCsv(
        `flightNumber,serviceDate,originIata,destinationIata,scheduledDeparture,scheduledArrival\nUA123,2026-11-01,JFK,LAX,2026-11-01T01:30:45${offset},2026-11-01T04:30:20-08:00`,
      );
      const preflight = preflightCsvImport(
        parsed,
        detectCsvMapping(parsed.headers),
        null,
      );
      expect(preflight.issues).toEqual([]);
      const document = buildDocumentFromCsv(
        parsed,
        detectCsvMapping(parsed.headers),
        null,
      );
      expect(document.flights[0]).toMatchObject({
        scheduledDeparture: `2026-11-01T01:30:00${offset}`,
        scheduledArrival: "2026-11-01T04:30:00-08:00",
      });
      expect(validateKeeprawFly(document).valid).toBe(true);
    },
  );

  it.each([
    "2026-02-30T10:00",
    "2026-09-02T24:00",
    "2026-09-02T13:60",
    "2026-09-02T13:00:60",
    "2026-09-02T13:00:15",
  ])("rejects malformed local time %s as a format error", (time) => {
    const parsed = parseCsv(csv.replace("2026-09-02T13:00:00+08:00", time));
    const mapping = detectCsvMapping(parsed.headers);
    expect(preflightCsvImport(parsed, mapping, null).issues).toEqual([
      { code: "invalid-time", lineNumber: 2 },
    ]);
    expect(() => buildDocumentFromCsv(parsed, mapping, null)).toThrow(
      "line-2:invalid-time",
    );
  });

  it.each([
    "scheduledDeparture",
    "scheduledArrival",
    "actualDeparture",
    "actualArrival",
  ])("diagnoses DST errors in %s without importing the row", (field) => {
    for (const [serviceDate, time, code] of [
      ["2026-03-08", "2026-03-08T02:30", "nonexistent-time"],
      ["2026-11-01", "2026-11-01T01:30", "ambiguous-time"],
    ]) {
      const parsed = mappedRow({
        serviceDate: serviceDate!,
        scheduledDeparture: `${serviceDate}T00:30`,
        scheduledArrival: `${serviceDate}T04:30`,
        [field]: time!,
      });
      const mapping = detectCsvMapping(parsed.headers);
      const result = preflightCsvImport(parsed, mapping, null);
      expect(result).toMatchObject({
        canImport: false,
        flights: [],
        issues: [{ code, lineNumber: 2 }],
      });
      expect(() => buildDocumentFromCsv(parsed, mapping, null)).toThrow(
        `line-2:${code}`,
      );
    }
  });

  it.each([
    ["2026-03-08T01:59", "2026-03-08T01:59:00-05:00"],
    ["2026-03-08T03:00", "2026-03-08T03:00:00-04:00"],
    ["2026-11-01T00:59", "2026-11-01T00:59:00-04:00"],
    ["2026-11-01T02:00", "2026-11-01T02:00:00-05:00"],
    ["2026-03-08T02:30-05:00", "2026-03-08T03:30:00-04:00"],
    ["2026-11-01T05:30:59Z", "2026-11-01T01:30:00-04:00"],
    ["2026-11-01T08:30:59+02:00", "2026-11-01T01:30:00-05:00"],
  ])("preserves the instant and minute precision for %s", (input, expected) => {
    const serviceDate = expected.slice(0, 10);
    const parsed = mappedRow({
      serviceDate,
      scheduledDeparture: input,
      scheduledArrival: `${serviceDate}T08:30`,
    });
    const document = buildDocumentFromCsv(
      parsed,
      detectCsvMapping(parsed.headers),
      null,
    );
    expect(document.flights[0]?.scheduledDeparture).toBe(expected);
    expect(validateKeeprawFly(document).valid).toBe(true);
  });

  it("retains explicitly disambiguated scheduled arrival and diverted actual times", () => {
    const parsed = mappedRow({
      originIata: "LAX",
      destinationIata: "JFK",
      divertedToIata: "ORD",
      serviceDate: "2026-10-31",
      scheduledDeparture: "2026-10-31T20:00-07:00",
      scheduledArrival: "2026-11-01T01:30-05:00",
      actualDeparture: "2026-11-01T01:10-07:00",
      actualArrival: "2026-11-01T01:40-06:00",
    });
    // The original actual departure is later in UTC than actual arrival.
    const mapping = detectCsvMapping(parsed.headers);
    expect(preflightCsvImport(parsed, mapping, null).issues).toEqual([
      { code: "chronology", lineNumber: 2 },
    ]);
    parsed.rows[0]![parsed.headers.indexOf("actualDeparture")] =
      "2026-10-31T20:10-07:00";
    const document = buildDocumentFromCsv(parsed, mapping, null);
    expect(document.flights[0]).toMatchObject({
      scheduledArrival: "2026-11-01T01:30:00-05:00",
      actualDeparture: "2026-10-31T20:10:00-07:00",
      actualArrival: "2026-11-01T01:40:00-06:00",
    });
    expect(validateKeeprawFly(document).valid).toBe(true);
  });

  it.each(["Z", "+08:00", ""])(
    "reports invalid airport timezones with offset '%s'",
    (offset) => {
      const airport = airportByIata.get("PVG")!;
      airportByIata.set("PVG", { ...airport, timezone: "Invalid/Timezone" });
      try {
        const parsed = parseCsv(
          csv.replace("2026-09-02T13:00:00+08:00", `2026-09-02T13:00${offset}`),
        );
        const mapping = detectCsvMapping(parsed.headers);
        expect(preflightCsvImport(parsed, mapping, null).issues).toEqual([
          { code: "invalid-timezone", lineNumber: 2 },
        ]);
        expect(() => buildDocumentFromCsv(parsed, mapping, null)).toThrow(
          "line-2:invalid-timezone",
        );
      } finally {
        airportByIata.set("PVG", airport);
      }
    },
  );

  it.each([
    "2026-11-01T01:30+24:00",
    "2026-11-01T01:30+04:60",
    "2026-11-01T01:30:60-04:00",
    "2026-11-01T01:30:00.5-04:00",
  ])("rejects invalid explicit time %s", (time) => {
    const parsed = mappedRow({ scheduledDeparture: time });
    expect(
      preflightCsvImport(parsed, detectCsvMapping(parsed.headers), null),
    ).toMatchObject({
      canImport: false,
      flights: [],
      issues: [{ code: "invalid-time", lineNumber: 2 }],
    });
  });

  it("keeps identity, date mismatch, chronology and other row errors distinct", () => {
    for (const [overrides, code] of [
      [{ flightNumber: "UA#123" }, "invalid-flight-number"],
      [{ scheduledDeparture: "2026-11-01T01:30+08:00" }, "date-mismatch"],
      [{ scheduledArrival: "2026-11-01T00:30Z" }, "chronology"],
      [{ bookingClass: "invalid" }, "invalid-row"],
    ] as const) {
      const parsed = mappedRow(overrides);
      const mapping = detectCsvMapping(parsed.headers);
      expect(preflightCsvImport(parsed, mapping, null)).toMatchObject({
        canImport: false,
        flights: [],
        issues: [{ code, lineNumber: 2 }],
      });
      expect(() => buildDocumentFromCsv(parsed, mapping, null)).toThrow(
        `line-2:${code}`,
      );
    }
  });

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
    const document = buildDocumentFromCsv(
      parsed,
      detectCsvMapping(parsed.headers),
      {
        format: "keepraw-fly",
        formatVersion: "0.1.0",
        profile: { name: { romanized: "Yuan Lin" } },
        flights: [],
      },
      () => "csv-id",
    );
    expect(document.profile.name?.romanized).toBe("Yuan Lin");
    expect(document.flights[0]).toMatchObject({
      id: "flight-csv-id",
      flightNumber: "MU589",
      origin: { iata: "PVG" },
      destination: { iata: "SFO" },
    });
  });

  it("resolves naive times in each airport timezone", () => {
    const parsed = parseCsv(
      csv.replace("2026-09-02T13:00:00+08:00", "2026-09-02T13:00"),
    );
    const document = buildDocumentFromCsv(
      parsed,
      detectCsvMapping(parsed.headers),
      null,
    );
    expect(document.flights[0]).toMatchObject({
      scheduledDeparture: "2026-09-02T13:00:00+08:00",
      scheduledArrival: "2026-09-02T09:20:00-07:00",
    });
  });

  it("uses origin and destination airport timezones independently", () => {
    const parsed = parseCsv(
      "Flight Number,Date,From,To,Departure Time,Arrival Time\nCX123,2026-04-27,HKG,BOM,2026-04-27T20:15,2026-04-28T00:20",
    );
    const document = buildDocumentFromCsv(
      parsed,
      detectCsvMapping(parsed.headers),
      null,
    );
    expect(document.flights[0]).toMatchObject({
      scheduledDeparture: "2026-04-27T20:15:00+08:00",
      scheduledArrival: "2026-04-28T00:20:00+05:30",
      serviceDate: "2026-04-27",
    });
  });

  it("rejects DST gap and ambiguous local times", () => {
    const gap = parseCsv(
      csv
        .replace("2026-09-02,PVG,SFO", "2026-03-08,LAX,SFO")
        .replace("2026-09-02T13:00:00+08:00", "2026-03-08T02:30"),
    );
    const gapMapping = detectCsvMapping(gap.headers);
    expect(() => buildDocumentFromCsv(gap, gapMapping, null)).toThrow(
      "line-2:nonexistent-time",
    );
    const ambiguous = parseCsv(
      csv
        .replace("2026-09-02,PVG,SFO", "2026-11-01,LAX,SFO")
        .replace("2026-09-02T13:00:00+08:00", "2026-11-01T01:30"),
    );
    const ambiguousMapping = detectCsvMapping(ambiguous.headers);
    expect(() =>
      buildDocumentFromCsv(ambiguous, ambiguousMapping, null),
    ).toThrow("line-2:ambiguous-time");
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

    expect(invalidDatePreflight.issues[0]).toEqual({
      code: "invalid-date",
      lineNumber: 2,
    });
    expect(invalidTimePreflight.issues[0]).toEqual({
      code: "invalid-time",
      lineNumber: 2,
    });
  });

  it("preflights valid rows when there is no existing archive", () => {
    const parsed = parseCsv(csv);
    const preflight = preflightCsvImport(
      parsed,
      detectCsvMapping(parsed.headers),
      null,
      () => "preview",
    );

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
    const imported = buildDocumentFromCsv(
      parsed,
      detectCsvMapping(parsed.headers),
      null,
      () => "existing",
    );
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
    expect(
      buildDocumentFromCsv(parsed, detectCsvMapping(parsed.headers), imported)
        .flights,
    ).toHaveLength(1);
  });

  it("requires an explicit opt-in to import a possible duplicate", () => {
    const parsed = parseCsv(csv);
    const existing = buildDocumentFromCsv(
      parsed,
      detectCsvMapping(parsed.headers),
      null,
      () => "existing",
    );
    const changedTime = parseCsv(
      csv.replace("13:00:00", "14:00:00").replace("09:20:00", "10:20:00"),
    );
    const mapping = detectCsvMapping(changedTime.headers);
    const preflight = preflightCsvImport(
      changedTime,
      mapping,
      existing,
      () => "possible",
    );

    expect(preflight).toMatchObject({
      newRecords: 0,
      possibleDuplicateRecords: 1,
      exactDuplicateRecords: 0,
    });
    expect(
      buildDocumentFromCsv(changedTime, mapping, existing, () => "skipped")
        .flights,
    ).toHaveLength(1);
    expect(
      buildDocumentFromCsv(
        changedTime,
        mapping,
        existing,
        () => "included",
        true,
      ).flights,
    ).toHaveLength(2);
  });

  it("counts partial row failures and blocks the whole CSV import", () => {
    const parsed = parseCsv(
      `${csv}\nUA123,2026-08-19,SFO,LAX,2026-08-19T10:20:00-07:00,not-a-time`,
    );
    const mapping = detectCsvMapping(parsed.headers);
    const preflight = preflightCsvImport(
      parsed,
      mapping,
      null,
      () => "preview",
    );

    expect(preflight).toMatchObject({
      totalRecords: 2,
      validRecords: 1,
      problemRecords: 1,
      canImport: false,
    });
    expect(preflight.issues).toEqual([{ code: "invalid-time", lineNumber: 3 }]);
    expect(() => buildDocumentFromCsv(parsed, mapping, null)).toThrow(
      "line-3:invalid-time",
    );
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

    expect(numberPreflight.issues[0]).toEqual({
      code: "invalid-flight-number",
      lineNumber: 2,
    });
    expect(airportPreflight.issues[0]).toEqual({
      code: "unknown-airport",
      lineNumber: 2,
    });
  });

  it("rejects empty and malformed CSV files before preview", () => {
    expect(() => parseCsv("")).toThrow("missing-rows");
    expect(() => parseCsv('Flight Number,Date\n"UA123,2026-08-19')).toThrow(
      "unterminated-quote",
    );
  });
  it("uses the canonical CSV field order and maps endpoint facts symmetrically", () => {
    expect(csvFlightFields).toEqual([
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
    ]);

    const parsed = parseCsv(
      [
        csvFlightFields.join(","),
        "CX123,2026-09-23,TAO,HKG,2026-09-23T14:30,2026-09-23T18:00,2026-09-23T14:40,2026-09-23T17:55,1,12,1,33,false,,781-123,ABC123,A321,B-1234,12A,Y,economy",
      ].join("\n"),
    );
    const document = buildDocumentFromCsv(
      parsed,
      detectCsvMapping(parsed.headers),
      null,
      () => "target",
    );

    expect(document.flights[0]).toMatchObject({
      origin: { iata: "TAO", terminal: "1", gate: "12" },
      destination: { iata: "HKG", terminal: "1", gate: "33" },
      ticketNumber: "781-123",
    });
  });

  it("preserves memberships and existing references when appending", () => {
    const membership = {
      id: "ff-1",
      programId: "mileageplus",
      memberNumber: "UA001",
      tier: "gold",
      associatedAirlines: ["UA"],
      defaultAirline: "UA",
    };
    const existing: KeeprawFlyDocument = {
      format: "keepraw-fly",
      formatVersion: "0.1.0",
      profile: { name: { romanized: "Existing traveler" } },
      extensions: { "keepraw-fly.test": { preserved: true } },
      frequentFlyerMemberships: [membership],
      flights: [
        {
          id: "existing-flight",
          flightNumber: "UA123",
          serviceDate: "2026-08-19",
          airline: { iata: "UA", icao: "UAL" },
          origin: { iata: "SFO" },
          destination: { iata: "LAX" },
          scheduledDeparture: "2026-08-19T10:20:00-07:00",
          scheduledArrival: "2026-08-19T11:50:00-07:00",
          frequentFlyer: { membershipId: "ff-1", tierAtFlight: "gold" },
        },
      ],
    };
    const membershipBefore = structuredClone(existing.frequentFlyerMemberships);
    const parsed = parseCsv(
      [
        csvFlightFields.join(","),
        "CX124,2026-09-23,TAO,HKG,2026-09-23T14:30,2026-09-23T18:00,2026-09-23T14:40,2026-09-23T17:55,1,12,1,33,false,,781-124,ABC124,A321,B-1234,12B,Y,economy",
      ].join("\n"),
    );
    const appended = buildDocumentFromCsv(
      parsed,
      detectCsvMapping(parsed.headers),
      existing,
      () => "csv-append",
    );

    expect(appended.frequentFlyerMemberships).toEqual(membershipBefore);
    expect(appended.flights[0]?.frequentFlyer).toEqual({
      membershipId: "ff-1",
      tierAtFlight: "gold",
    });
    expect(appended.flights[1]?.frequentFlyer).toBeUndefined();
    expect(appended.extensions).toEqual(existing.extensions);
    expect(validateKeeprawFly(appended).valid).toBe(true);
  });

  it("imports cancelled flights with empty actual times and treats empty cancelled as false", () => {
    const cancelled = parseCsv(
      [
        csvFlightFields.join(","),
        "CX124,2026-09-23,TAO,HKG,2026-09-23T14:30,2026-09-23T18:00,,,1,12,1,33,true,,781-124,ABC124,A321,B-1234,12B,Y,economy",
      ].join("\n"),
    );
    const cancelledDocument = buildDocumentFromCsv(
      cancelled,
      detectCsvMapping(cancelled.headers),
      null,
      () => "cancelled",
    );

    expect(cancelledDocument.flights[0]).toMatchObject({ cancelled: true });
    expect(cancelledDocument.flights[0]).not.toHaveProperty("actualDeparture");
    expect(cancelledDocument.flights[0]).not.toHaveProperty("actualArrival");

    const empty = parseCsv(
      [
        csvFlightFields.join(","),
        "CX125,2026-09-24,TAO,HKG,2026-09-24T14:30,2026-09-24T18:00,,,1,12,1,34,,,781-125,ABC125,A321,B-1234,12C,Y,economy",
      ].join("\n"),
    );
    const emptyDocument = buildDocumentFromCsv(
      empty,
      detectCsvMapping(empty.headers),
      null,
      () => "empty",
    );
    expect(emptyDocument.flights[0]).not.toHaveProperty("cancelled");
  });
  it("imports divertedToIata and leaves the conflict to the canonical validator", () => {
    const parsed = parseCsv(
      [
        csvFlightFields.join(","),
        "CX126,2026-09-23,TAO,HKG,2026-09-23T14:30,2026-09-23T18:00,,2026-09-23T19:00,1,12,1,33,false,KIX,,,,,,,,",
      ].join("\n"),
    );
    const document = buildDocumentFromCsv(
      parsed,
      detectCsvMapping(parsed.headers),
      null,
      () => "diverted",
    );
    expect(document.flights[0]).toMatchObject({ divertedTo: { iata: "KIX" } });
    expect(validateKeeprawFly(document).valid).toBe(true);

    const conflict = parseCsv(
      [
        csvFlightFields.join(","),
        "CX127,2026-09-23,TAO,HKG,2026-09-23T14:30,2026-09-23T18:00,,,1,12,1,33,true,KIX,,,,,,,,",
      ].join("\n"),
    );
    const conflictDocument = buildDocumentFromCsv(
      conflict,
      detectCsvMapping(conflict.headers),
      null,
      () => "conflict",
    );
    const result = validateKeeprawFly(conflictDocument);
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.issues).toContainEqual(
        expect.objectContaining({ keyword: "cancelledDivertedConflict" }),
      );
  });
});
