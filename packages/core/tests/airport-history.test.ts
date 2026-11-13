import { describe, expect, it } from "vitest";
import airportRows from "../data/airports.iata.json";
import formal from "../data/airport-history/formal/airports.json";
import {
  airportById,
  airportByIata,
  installAirportDirectory,
  resolveAirportAtDate,
  resolveEndpointIdentity,
  originIdentity,
  plannedDestinationIdentity,
  arrivalIdentity,
  flightDistanceKilometers,
  calculatePassportStatistics,
  searchHistoricalAirports,
  formalAssignments,
  formalSources,
  assignmentDateRelation,
  type CompactAirportRow,
} from "../src";
import type { KeeprawFlight } from "@keepraw-fly/schema";

installAirportDirectory(airportRows as CompactAirportRow[]);
const kaiTak = "apt_86460159-a072-4a18-afcc-ab376cda7047";
const chekLapKok = "apt_8d89722f-007c-4eb4-aaa0-ec1c61007a09";
const flight = (): KeeprawFlight => ({
  id: "identity",
  flightNumber: "CX100",
  airline: { iata: "CX" },
  serviceDate: "1997-06-01",
  origin: { iata: "HKG" },
  destination: { iata: "SFO" },
  scheduledDeparture: "1997-06-01T10:00:00+08:00",
  scheduledArrival: "1997-06-01T09:00:00-07:00",
});

describe("reviewed code assignments", () => {
  it("distinguishes reused HKG and VHHH physical airports", () => {
    for (const [code, scheme] of [
      ["HKG", "IATA"],
      ["VHHH", "ICAO"],
    ] as const) {
      expect(resolveAirportAtDate(code, "1997-06-01", scheme).airportId).toBe(
        kaiTak,
      );
      expect(resolveAirportAtDate(code, "2020-06-01", scheme).airportId).toBe(
        chekLapKok,
      );
      expect(
        resolveAirportAtDate(code, "1998-07-06", scheme).airportId,
      ).toBeNull();
    }
  });
  it("uses half-open boundaries and preserves unknown dates", () => {
    const old = formalAssignments.find(
      (row) => row.code === "TAO" && row.validTo.earliest === "2021-08-12",
    )!;
    expect(assignmentDateRelation("2021-08-11", old)).toBe("certain");
    expect(assignmentDateRelation("2021-08-12", old)).toBe("excluded");
    expect(resolveAirportAtDate("HKG", "1800-01-01").airportId).toBeNull();
    expect(resolveAirportAtDate("HKG", "2040-01-01").airportId).toBeNull();
    expect(resolveAirportAtDate("HKG", "2024-02-30").airportId).toBeNull();
  });
  it("preserves one entity through a rename and code change", () => {
    expect(resolveAirportAtDate("TSE", "2018-01-01").airportId).toBe(
      resolveAirportAtDate("NQZ", "2024-01-01").airportId,
    );
    expect(searchHistoricalAirports("Kai Tak")[0]?.airportId).toBe(kaiTak);
    expect(airportById.get(kaiTak)?.status).toBe("closed");
  });
  it("keeps every formal identity and traceable evidence", () => {
    for (const airport of formal.airports)
      expect(airportById.has(airport.airportId)).toBe(true);
    for (const assignment of formalAssignments) {
      expect(assignment.sourceIds.length).toBeGreaterThan(0);
      for (const id of assignment.sourceIds)
        expect(formalSources.has(id)).toBe(true);
    }
    for (const a of formalAssignments)
      for (const b of formalAssignments) {
        if (
          a.airportId === b.airportId ||
          a.code !== b.code ||
          a.scheme !== b.scheme
        )
          continue;
        const start = [a.validFrom.latest, b.validFrom.latest]
          .filter((day): day is string => day !== null)
          .sort()
          .at(-1);
        if (start)
          expect(
            assignmentDateRelation(start, a) === "certain" &&
              assignmentDateRelation(start, b) === "certain",
          ).toBe(false);
      }
  });
});

describe("persisted physical identities", () => {
  it("uses the reviewed new-site coordinates even when the directory carried the old site", () => {
    const lyg = airportById.get("apt_64b5eaa6-a984-4816-86d9-d8eb71c91451")!;
    const lzo = airportById.get("apt_f11bdf7d-d81d-46fc-a94f-8c8c42d4e245")!;
    expect(lyg.latitude).toBe(34.41406);
    expect(lzo.latitude).toBe(29.030357);
    expect(
      resolveEndpointIdentity("LYG", "2010-01-01", "origin").point,
    ).toBeNull();
    expect(searchHistoricalAirports("Baitabu")[0]?.airportId).toBe(
      "apt_6f1a6ff3-98db-4e58-95fc-cc78bd5aa836",
    );
  });
  it("saved identity wins over date, code and directory changes", () => {
    const record = flight();
    record.origin.airportId = kaiTak;
    record.serviceDate = "2024-01-01";
    expect(originIdentity(record).airportId).toBe(kaiTak);
    expect(originIdentity(record).basis).toBe("user");
    const changed = airportRows.map((row) => [...row]) as CompactAirportRow[];
    const current = changed.find((row) => row[0] === "HKG")!;
    current[4] += 0.001;
    installAirportDirectory(changed);
    expect(originIdentity(JSON.parse(JSON.stringify(record))).airportId).toBe(
      kaiTak,
    );
    expect(record.origin.iata).toBe("HKG");
    installAirportDirectory(airportRows as CompactAirportRow[]);
  });
  it("keeps an unavailable ID without substituting today's airport", () => {
    const record = flight();
    record.origin.airportId = "apt_unavailable";
    expect(originIdentity(record)).toMatchObject({
      airportId: "apt_unavailable",
      point: null,
      confirmed: false,
    });
    expect(record.origin.iata).toBe("HKG");
  });
  it("resolves origin, planned destination and diversion independently", () => {
    const record = flight();
    record.origin.airportId = kaiTak;
    record.destination = { iata: "HKG", airportId: chekLapKok };
    record.divertedTo = {
      iata: "SFO",
      airportId: airportByIata.get("SFO")!.airportId,
    };
    expect(originIdentity(record).airportId).toBe(kaiTak);
    expect(plannedDestinationIdentity(record).airportId).toBe(chekLapKok);
    expect(arrivalIdentity(record).airportId).toBe(record.divertedTo.airportId);
    expect(flightDistanceKilometers(record)).toBeGreaterThan(10_000);
  });
  it("counts distinct sites sharing a code and works without research data", () => {
    const old = flight();
    old.origin.airportId = kaiTak;
    const current = flight();
    current.id = "current";
    current.origin.airportId = chekLapKok;
    expect(calculatePassportStatistics([old, current]).airports).toBe(3);
    expect(
      resolveEndpointIdentity("SFO", "2020-01-01", "origin").confirmed,
    ).toBe(true);
    expect(
      resolveEndpointIdentity("XQX", "2020-01-01", "origin").point,
    ).toBeNull();
  });
});
