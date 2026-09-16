import { describe, expect, it } from "vitest";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import { parseKeeprawFlyJson, validateKeeprawFly } from "@keepraw-fly/validator";
import { preflightJsonImport, summarizeImport } from "./import-preview";

describe("import preview", () => {
  it("summarizes the owner, flight count and service-date range", () => {
    expect(summarizeImport(documentWithFlights)).toEqual({
      flightCount: 2,
      firstServiceDate: "2024-01-03",
      lastServiceDate: "2026-08-19",
      profileName: "Fang Chen",
    });
  });

  it("handles an empty archive without inventing dates or an owner", () => {
    expect(summarizeImport({
      format: "keepraw-fly",
      formatVersion: "0.1.0",
      profile: {},
      flights: [],
    })).toEqual({ flightCount: 0 });
  });

  it("preflights a valid archive against an empty collection", () => {
    const text = JSON.stringify(documentWithFlights);
    const preflight = preflightJsonImport(text, parseKeeprawFlyJson(text), null);

    expect(preflight).toMatchObject({
      totalRecords: 2,
      validRecords: 2,
      problemRecords: 0,
      duplicateRecords: 0,
      canImport: true,
      issues: [],
    });
  });

  it("flags possible duplicates when an archive already contains the same flight identity", () => {
    const existing = {
      ...documentWithFlights,
      flights: [structuredClone(documentWithFlights.flights[0]!)],
    };
    const text = JSON.stringify(documentWithFlights);
    const preflight = preflightJsonImport(text, parseKeeprawFlyJson(text), existing);

    expect(preflight.duplicateRecords).toBe(1);
    expect(preflight.canImport).toBe(true);
  });

  it("counts valid and affected records without accepting a partially invalid archive", () => {
    const input = structuredClone(documentWithFlights);
    input.flights[1]!.scheduledArrival = "2024-01-03T07:00:00+08:00";
    const result = validateKeeprawFly(input);
    const preflight = preflightJsonImport(JSON.stringify(input), result, null);

    expect(preflight).toMatchObject({
      totalRecords: 2,
      validRecords: 1,
      problemRecords: 1,
      duplicateRecords: 0,
      canImport: false,
    });
    expect(preflight.issues[0]).toMatchObject({ flightIndex: 1, keyword: "chronology" });
  });

  it("reports an empty or malformed file as a blocking file issue", () => {
    for (const text of ["", '{"format":']) {
      const preflight = preflightJsonImport(text, parseKeeprawFlyJson(text), null);
      expect(preflight).toMatchObject({
        totalRecords: 0,
        validRecords: 0,
        problemRecords: 0,
        canImport: false,
      });
      expect(preflight.issues[0]?.keyword).toBe("parse");
    }
  });
});

const documentWithFlights: KeeprawFlyDocument = {
  format: "keepraw-fly",
  formatVersion: "0.1.0",
  profile: {
    name: {
      native: "陈芳",
      romanized: "Fang Chen",
      primary: "romanized",
    },
  },
  flights: [
    {
      id: "newer",
      flightNumber: "UA123",
      serviceDate: "2026-08-19",
      airline: { iata: "UA" },
      origin: { iata: "SFO" },
      destination: { iata: "LAX" },
      scheduledDeparture: "2026-08-19T10:20:00-07:00",
      scheduledArrival: "2026-08-19T11:52:00-07:00",
    },
    {
      id: "older",
      flightNumber: "MU5101",
      serviceDate: "2024-01-03",
      airline: { iata: "MU" },
      origin: { iata: "PVG" },
      destination: { iata: "PEK" },
      scheduledDeparture: "2024-01-03T08:00:00+08:00",
      scheduledArrival: "2024-01-03T10:20:00+08:00",
    },
  ],
};
