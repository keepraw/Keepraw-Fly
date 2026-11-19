import { expect, it, vi } from "vitest";
import type { CompactAirportRow, FormalAssignment } from "../src";

const site = "apt_11111111-1111-4111-8111-111111111111";
const legacy = "apt_22222222-2222-4222-8222-222222222222";
const closed = "apt_33333333-3333-4333-8333-333333333333";
const fly: CompactAirportRow[] = [
  [
    "AAA",
    "Harbor Airport",
    "Harbor",
    "US",
    44,
    -73,
    "America/New_York",
    legacy,
    "KAAA",
  ],
  [
    "CCC",
    "Closed Airport",
    "Harbor",
    "US",
    45,
    -74,
    "America/New_York",
    closed,
    "KCCC",
  ],
];

function assignment(
  code: string,
  scheme: FormalAssignment["scheme"],
  from: string,
  to: string,
  airportId = site,
): FormalAssignment {
  return {
    assignmentId: code,
    airportId,
    scheme,
    code,
    validFrom: { earliest: from, latest: from, precision: "exact" },
    validTo: { earliest: to, latest: to, precision: "exact" },
  };
}

async function install(
  dataVersion: string,
  toExclusive: string,
  assignments: FormalAssignment[],
) {
  vi.resetModules();
  vi.doMock("../data/airport-history/formal/manifest.json", () => ({
    default: {
      queryHorizon: { fromInclusive: "2000-01-01", toExclusive },
    },
  }));
  vi.doMock("../data/airport-history/formal/airports.json", () => ({
    default: {
      schemaVersion: "4.0.0",
      dataVersion,
      airports: [site, closed].map((airportId) => ({
        airportId,
        externalIds: {},
        coordinates: { value: { latitude: 44, longitude: -73 } },
        name: { value: "Harbor Airport" },
        timezone: { value: null },
      })),
      assignments,
      names: [],
    },
  }));
  vi.doMock("../data/airport-history/formal/directory.json", () => ({
    default: {
      [site]: {
        city: "Harbor",
        country: "US",
        status: "operating",
        legacyIds: [legacy],
      },
      [closed]: { city: "Harbor", country: "US", status: "closed" },
    },
  }));
  const core = await import("../src");
  core.installAirportDirectory(fly);
  return core;
}

it("refreshes both indexes for a subsequent upstream code migration", async () => {
  const transition = "2026-11-19";
  const newEnd = "2027-01-01";
  const oldAssignments = [
    assignment("AAA", "IATA", "2000-01-01", transition),
    assignment("KAAA", "ICAO", "2000-01-01", transition),
  ];
  const previous = await install("0.13.0", transition, oldAssignments);
  expect(previous.airportByIata.get("AAA")?.airportId).toBe(site);
  expect(previous.airportByIata.has("BBB")).toBe(false);
  const updated = await install("0.14.0", newEnd, [
    ...oldAssignments,
    assignment("BBB", "IATA", transition, newEnd),
    assignment("KBBB", "ICAO", transition, newEnd),
    assignment("CCC", "IATA", "2000-01-01", newEnd, closed),
  ]);

  expect(updated.airportHistoryDataVersion).toBe("0.14.0");
  expect(updated.airportByIata.get("BBB")).toMatchObject({
    airportId: site,
    currentIata: "BBB",
    icao: "KBBB",
  });
  expect(updated.airportByIata.has("AAA")).toBe(false);
  expect(updated.airportByIata.has("CCC")).toBe(false);
  expect(updated.airportById.get(closed)?.currentIata).toBeUndefined();
  for (const code of ["AAA", "KAAA"]) {
    expect(updated.airportIdsBySearchCode.get(code)).toContain(site);
    expect(
      updated.searchHistoricalAirports(code).map((row) => row.airportId),
    ).toContain(site);
  }
  expect(updated.resolveAirportAtDate("AAA", "2026-11-18").airportId).toBe(
    site,
  );
  expect(updated.resolveAirportAtDate("BBB", transition).airportId).toBe(site);
  expect(
    updated.resolveEndpointIdentity("AAA", transition, "origin", null, legacy)
      .airportId,
  ).toBe(legacy);
  expect(updated.airportById.get(legacy)).toMatchObject({
    airportId: site,
    currentIata: "BBB",
    city: { en: "Harbor" },
    country: "US",
    timezone: "America/New_York",
  });
});
