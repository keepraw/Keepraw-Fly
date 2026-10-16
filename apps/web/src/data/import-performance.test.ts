import { afterEach, describe, expect, it, vi } from "vitest";
import airportRows from "@keepraw-fly/core/airport-directory";
import {
  installAirportDirectory,
  type CompactAirportRow,
} from "@keepraw-fly/core";
import {
  buildDocumentFromCsvPreflight,
  detectCsvMapping,
  parseCsv,
  preflightCsvImport,
  preflightCsvImportWork,
} from "./csv-import";
import {
  preflightFlightyImport,
  preflightFlightyImportWork,
} from "./flighty-import";
import { runImportPreflight } from "./import-preflight-work";

installAirportDirectory(airportRows as CompactAirportRow[]);
afterEach(() => vi.restoreAllMocks());

const headers =
  "flightNumber,serviceDate,originIata,destinationIata,scheduledDeparture,scheduledArrival,actualDeparture,actualArrival";
const row =
  "UA123,2026-11-01,JFK,LAX,2026-11-01T01:30:59-04:00,2026-11-01T04:30:59-08:00,2026-11-01T01:30:59-05:00,2026-11-01T05:00:59-08:00";
const ids = () => {
  let id = 0;
  return () => String(++id);
};

describe("import performance regressions", () => {
  it("constructs formatters per zone rather than per row or offset candidate", async () => {
    // A fresh module cache makes this independent of earlier formatter use.
    vi.resetModules();
    const core = await import("@keepraw-fly/core");
    core.installAirportDirectory(airportRows as CompactAirportRow[]);
    const api = await import("./csv-import");
    const NativeDateTimeFormat = Intl.DateTimeFormat;
    const constructor = vi
      .spyOn(Intl, "DateTimeFormat")
      .mockImplementation(
        (locales, options) => new NativeDateTimeFormat(locales, options),
      );
    const parsed = api.parseCsv(
      [
        headers,
        ...Array.from({ length: 100 }, (_, i) => {
          const date = new Date(Date.UTC(2026, 0, i + 1))
            .toISOString()
            .slice(0, 10);
          return `UA${i + 1},${date},JFK,LAX,${date}T09:00,${date}T12:00,${date}T09:15,${date}T12:15`;
        }),
      ].join("\n"),
    );
    const result = api.preflightCsvImport(
      parsed,
      api.detectCsvMapping(parsed.headers),
      null,
      ids(),
    );
    expect(result).toMatchObject({
      canImport: true,
      newRecords: 100,
      issues: [],
    });
    expect(constructor).toHaveBeenCalledTimes(2);
    expect(
      new Set(constructor.mock.calls.map(([, options]) => options?.timeZone)),
    ).toEqual(new Set(["America/New_York", "America/Los_Angeles"]));
  });

  it("keeps CSV results, DST instants, duplicate priority and row errors identical across slices", async () => {
    const parsed = parseCsv(
      [
        headers,
        row,
        row, // Exact duplicate within the file.
        row.replace("01:30:59-04:00", "01:45:59-04:00"), // Possible duplicate.
        row.replace("01:30:59-04:00", "01:30"), // Ambiguous time.
        row.replace("UA123", "UA124").replace(",JFK,", ",XXX,"),
        row.replace("UA123", "UA125"),
      ].join("\n"),
    );
    const mapping = detectCsvMapping(parsed.headers);
    const reference = preflightCsvImport(parsed, mapping, null, ids());
    const result = await runImportPreflight(
      preflightCsvImportWork(parsed, mapping, null, ids()),
    );
    expect(result).toEqual(reference);
    expect(result).toMatchObject({
      newRecords: 2,
      exactDuplicateRecords: 1,
      possibleDuplicateRecords: 1,
      issues: [
        { code: "ambiguous-time", lineNumber: 5 },
        { code: "unknown-airport", lineNumber: 6 },
      ],
    });
    expect(result.flights[0]).toMatchObject({
      scheduledDeparture: "2026-11-01T01:30:00-04:00",
      actualDeparture: "2026-11-01T01:30:00-05:00",
    });
    const valid = parseCsv([headers, row].join("\n"));
    const existing = buildDocumentFromCsvPreflight(
      preflightCsvImport(valid, mapping, null, ids()),
      null,
    );
    expect(
      await runImportPreflight(
        preflightCsvImportWork(valid, mapping, existing, ids()),
      ),
    ).toEqual(preflightCsvImport(valid, mapping, existing, ids()));
  });

  it("keeps Flighty warnings and original source line numbers through shared CSV slices", async () => {
    const parsed = parseCsv(
      [
        "Date,Airline,Flight,From,To,Gate Departure (Scheduled),Gate Arrival (Scheduled),Cabin Class",
        "2026-11-01,UA,123,JFK,LAX,2026-11-01T01:30-04:00,2026-11-01T04:30-08:00,Unknown",
        "2026-11-01,XXX,124,JFK,LAX,2026-11-01T00:30,2026-11-01T04:30,Economy",
        "2026-11-01,UA,125,JFK,LAX,2026-11-01T01:30,2026-11-01T04:30,Economy",
        "2026-11-01,UA,123,JFK,LAX,2026-11-01T01:30-04:00,2026-11-01T04:30-08:00,Economy",
      ].join("\n"),
    );
    const result = await runImportPreflight(
      preflightFlightyImportWork(parsed, null, ids()),
    );
    expect(result).toEqual(preflightFlightyImport(parsed, null, ids()));
    expect(result).toMatchObject({
      exactDuplicateRecords: 1,
      issues: [
        { code: "unknown-airline", lineNumber: 3 },
        { code: "ambiguous-time", lineNumber: 4 },
      ],
      warnings: [{ code: "unknown-cabin", lineNumber: 2 }],
    });
  });
});
