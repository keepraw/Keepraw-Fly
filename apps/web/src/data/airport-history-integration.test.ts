/**
 * Application integration against the committed real airport-history package
 * (keepraw/airport-history 19b7b1de). No mocked airport data.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { utils, write } from "xlsx";
import { validateKeeprawFly } from "@keepraw-fly/validator";
import airportRows from "@keepraw-fly/core/airport-directory";
import {
  AIRPORT_TIMEZONE_EXTENSION,
  arrivalIdentity,
  buildRouteSegments,
  calculatePassportStatistics,
  createAirportHistoryLoader,
  distanceForFlight,
  ensureAirportHistoryCodes,
  installAirportDirectory,
  originIdentity,
  type CompactAirportRow,
} from "@keepraw-fly/core";
import type { KeeprawFlight, KeeprawFlyDocument } from "@keepraw-fly/schema";
import {
  AirportTimezoneRequiredError,
  createDefaultDraft,
  flightFromDraft,
  flightToDraft,
  type FlightDraft,
} from "./flight-editor";
import { detectCsvMapping, parseCsv, preflightCsvImport } from "./csv-import";
import {
  buildDocumentFromFlightyPreflight,
  parseFlightyCsv,
  preflightFlightyImport,
} from "./flighty-import";
import { preflightUmetripImport } from "./umetrip-import";
import { parseUmetripXls } from "./umetrip-xls";

const root = fileURLToPath(
  new URL("../../../../packages/core/data/airport-history/", import.meta.url),
);
const loader = createAirportHistoryLoader((path) => readFile(root + path));

beforeAll(async () => {
  installAirportDirectory(airportRows as CompactAirportRow[]);
  await ensureAirportHistoryCodes(
    loader,
    ["HKG", "IST", "SFO", "PEK", "CAN", "ABN", "QQQ", "XQX", "AUS", "LAX"].map(
      (code) => ({ code }),
    ),
  );
}, 120_000);

function draft(overrides: Partial<FlightDraft>): FlightDraft {
  return {
    ...createDefaultDraft("2010-06-01"),
    flightNumber: "CX100",
    ...overrides,
  };
}

function flight(
  id: string,
  origin: string,
  destination: string,
  serviceDate: string,
  scheduledDeparture: string,
  scheduledArrival: string,
): KeeprawFlight {
  return {
    id,
    flightNumber: "CX100",
    serviceDate,
    airline: { iata: "CX" },
    origin: { iata: origin },
    destination: { iata: destination },
    scheduledDeparture,
    scheduledArrival,
  };
}

describe("Flight Editor keeps flights with unknown airports", () => {
  it("never drops a well-formed unknown code; asks for a zone instead of assuming UTC", () => {
    vi.stubGlobal("crypto", { ...crypto, randomUUID: () => "u1" });
    const pending = () =>
      flightFromDraft(
        draft({
          originIata: "QQQ",
          destinationIata: "SFO",
          serviceDate: "2010-06-01",
          arrivalDate: "2010-06-01",
        }),
      );
    expect(pending).toThrow(AirportTimezoneRequiredError);
    try {
      pending();
    } catch (error) {
      expect((error as AirportTimezoneRequiredError).iata).toBe("QQQ");
      expect((error as AirportTimezoneRequiredError).role).toBe("origin");
    }
    const saved = flightFromDraft(
      draft({
        originIata: "QQQ",
        destinationIata: "SFO",
        serviceDate: "2010-06-01",
        departureTime: "08:00",
        arrivalDate: "2010-06-01",
        arrivalTime: "18:00",
        originTimezone: "+09:30",
      }),
    );
    expect(saved.origin.iata).toBe("QQQ");
    expect(saved.scheduledDeparture).toBe("2010-06-01T08:00:00+09:30");
    expect(saved.extensions?.[AIRPORT_TIMEZONE_EXTENSION]).toEqual({
      origin: "+09:30",
    });
    // The confirmed zone survives editing.
    const again = flightToDraft(saved);
    expect(again.originTimezone).toBe("+09:30");
    expect(again.departureTime).toBe("08:00");
    expect(flightFromDraft(again, saved).scheduledDeparture).toBe(
      saved.scheduledDeparture,
    );
    vi.unstubAllGlobals();
  });

  it("does not auto-pick a zone when only historical candidates exist", () => {
    expect(() =>
      flightFromDraft(
        draft({
          originIata: "ABN",
          destinationIata: "SFO",
          serviceDate: "2010-06-01",
        }),
      ),
    ).toThrow(AirportTimezoneRequiredError);
  });

  it("keeps an existing record's RFC 3339 instant for an undetermined airport", () => {
    const record = flight(
      "x",
      "XQX",
      "SFO",
      "2010-06-01",
      "2010-06-01T08:00:00+05:45",
      "2010-06-01T18:00:00-07:00",
    );
    const edited = flightToDraft(record);
    expect(edited.departureTime).toBe("08:00");
    expect(edited.originTimezone).toBe("+05:45");
    expect(flightFromDraft(edited, record).scheduledDeparture).toBe(
      record.scheduledDeparture,
    );
  });

  it("uses the historical airport's zone and identity by flight date", () => {
    const kaiTak = flightFromDraft(
      draft({
        originIata: "HKG",
        destinationIata: "SFO",
        serviceDate: "1997-06-01",
        departureTime: "10:00",
        arrivalDate: "1997-06-01",
        arrivalTime: "08:00",
      }),
    );
    expect(kaiTak.scheduledDeparture).toBe("1997-06-01T10:00:00+08:00");
    expect(originIdentity(kaiTak).name?.en).toBe(
      "Hong Kong International Airport Kai Tak",
    );
    expect(kaiTak.extensions?.[AIRPORT_TIMEZONE_EXTENSION]).toBeUndefined();
  });

  it("still rejects malformed codes and metropolitan city codes", () => {
    expect(() =>
      flightFromDraft(draft({ originIata: "HK", destinationIata: "SFO" })),
    ).toThrow("unknown-airport");
    expect(() =>
      flightFromDraft(draft({ originIata: "TYO", destinationIata: "SFO" })),
    ).toThrow("unknown-airport");
  });

  it("keeps the Keepraw Fly JSON format valid with the extension", () => {
    const saved = flightFromDraft(
      draft({
        originIata: "QQQ",
        destinationIata: "SFO",
        originTimezone: "Asia/Kathmandu",
      }),
    );
    const document: KeeprawFlyDocument = {
      format: "keepraw-fly",
      formatVersion: "0.1.0",
      profile: {},
      flights: [saved],
    };
    expect(validateKeeprawFly(JSON.parse(JSON.stringify(document))).valid).toBe(
      true,
    );
  });
});

const csvHeaders =
  "flightNumber,serviceDate,originIata,destinationIata,scheduledDeparture,scheduledArrival";

describe("CSV / Flighty imports keep unknown-airport flights", () => {
  it("imports an unknown airport whose times carry explicit UTC offsets", () => {
    const parsed = parseCsv(
      [
        csvHeaders,
        "CX100,2010-06-01,XQX,SFO,2010-06-01T08:00+05:45,2010-06-01T18:00-07:00",
      ].join("\n"),
    );
    const result = preflightCsvImport(
      parsed,
      detectCsvMapping(parsed.headers),
      null,
      () => "c1",
    );
    expect(result.issues).toEqual([]);
    expect(result.flights[0]).toMatchObject({
      origin: { iata: "XQX" },
      scheduledDeparture: "2010-06-01T08:00:00+05:45",
    });
  });

  it("holds a wall-clock row as pending until the user supplies a zone", () => {
    const parsed = parseCsv(
      [
        csvHeaders,
        "CX100,2010-06-01,XQX,SFO,2010-06-01T08:00,2010-06-01T18:00",
      ].join("\n"),
    );
    const mapping = detectCsvMapping(parsed.headers);
    const pending = preflightCsvImport(parsed, mapping, null, () => "c2");
    expect(pending.issues).toEqual([
      { code: "airport-timezone-required", lineNumber: 2, airportCode: "XQX" },
    ]);
    const resolved = preflightCsvImport(parsed, mapping, null, () => "c3", {
      timezoneOverrides: { XQX: "Asia/Kathmandu" },
    });
    expect(resolved.issues).toEqual([]);
    expect(resolved.flights[0]?.scheduledDeparture).toBe(
      "2010-06-01T08:00:00+05:45",
    );
    expect(
      resolved.flights[0]?.extensions?.[AIRPORT_TIMEZONE_EXTENSION],
    ).toEqual({ origin: "Asia/Kathmandu" });
  });

  it("dates Flighty flights by their own day and keeps a candidate-only code", () => {
    const csv = [
      "Date,Airline,Flight,From,To,Gate Departure (Scheduled),Gate Arrival (Scheduled)",
      "1997-06-01,CX,100,HKG,SFO,1997-06-01T10:00,1997-06-01T08:00",
      "2010-06-01,CX,101,ABN,SFO,2010-06-01T10:00-03:00,2010-06-01T20:00-07:00",
    ].join("\n");
    let id = 0;
    const preflight = preflightFlightyImport(
      parseFlightyCsv(csv),
      null,
      () => `f${++id}`,
    );
    expect(preflight.issues).toEqual([]);
    const document = buildDocumentFromFlightyPreflight(preflight, null);
    expect(document.flights).toHaveLength(2);
    expect(originIdentity(document.flights[0]!).name?.en).toBe(
      "Hong Kong International Airport Kai Tak",
    );
    expect(originIdentity(document.flights[1]!).status).toBe(
      "historical_candidate",
    );
    expect(validateKeeprawFly(document).valid).toBe(true);
  });
});

describe("Umetrip import keeps unknown-airport flights", () => {
  async function workbook(origin: string) {
    const book = utils.book_new();
    utils.book_append_sheet(
      book,
      utils.aoa_to_sheet([
        [
          "日期",
          "航空公司",
          "航班号",
          "出发城市",
          "出发时间",
          "到达城市",
          "到达时间",
          "里程数",
          "客票号",
          "客票状态",
        ],
        [
          "2010年6月1日",
          "中国国际航空",
          "CA1031",
          origin,
          "10:00",
          "广州白云",
          "13:20",
          "0",
          "9990000000001",
          "已使用",
        ],
      ]),
      "已结束",
    );
    return parseUmetripXls(
      write(book, { type: "array", bookType: "biff8" }) as ArrayBuffer,
    );
  }

  it("reports an unknown code as pending, not dropped, and imports it with a zone", async () => {
    const parsed = await workbook("QQQ");
    const pending = preflightUmetripImport(parsed, null, () => "u");
    expect(
      pending.issues.map((issue) => [issue.code, issue.airportCode]),
    ).toEqual([["airport-timezone-required", "QQQ"]]);
    const resolved = preflightUmetripImport(
      parsed,
      null,
      () => "u",
      Date.parse("2026-01-01T00:00:00Z"),
      { timezoneOverrides: { QQQ: "Asia/Shanghai" } },
    );
    expect(resolved.issues).toEqual([]);
    expect(resolved.flights[0]).toMatchObject({
      origin: { iata: "QQQ" },
      scheduledDeparture: "2010-06-01T10:00:00+08:00",
    });
  });

  it("does not resolve a historical name outside its code's dates", async () => {
    const parsed = await workbook("Hong Kong International Airport Kai Tak");
    const result = preflightUmetripImport(
      parsed,
      null,
      () => "u",
      Date.parse("2026-01-01T00:00:00Z"),
    );
    // 2010: Kai Tak no longer held HKG, so the historical name cannot resolve.
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "unknown-airport",
    ]);
  });
});

describe("statistics, map and distance across imports", () => {
  it("never merges Kai Tak and Chek Lap Kok, and never draws candidate coordinates", () => {
    const flights = [
      flight(
        "a",
        "HKG",
        "SFO",
        "1997-06-01",
        "1997-06-01T10:00:00+08:00",
        "1997-06-01T08:00:00-07:00",
      ),
      flight(
        "b",
        "HKG",
        "SFO",
        "2005-06-01",
        "2005-06-01T10:00:00+08:00",
        "2005-06-01T08:00:00-07:00",
      ),
      flight(
        "c",
        "AUS",
        "LAX",
        "1995-06-01",
        "1995-06-01T10:00:00-05:00",
        "1995-06-01T11:30:00-07:00",
      ),
    ];
    const stats = calculatePassportStatistics(flights);
    expect(stats.airports).toBe(4); // Kai Tak, Chek Lap Kok, SFO, LAX
    expect(stats.unresolvedAirports).toBe(1); // AUS: Mueller vs Bergstrom
    expect(buildRouteSegments(flights)).toHaveLength(2);
    expect(distanceForFlight(flights[2]!)).toBeNull();
    expect(arrivalIdentity(flights[2]!).confirmed).toBe(true);
    expect(originIdentity(flights[0]!).identityKey).not.toBe(
      originIdentity(flights[1]!).identityKey,
    );
  });
});
