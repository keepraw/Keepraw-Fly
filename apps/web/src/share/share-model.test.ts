import { describe, expect, it } from "vitest";
import type { KeeprawFlight, KeeprawFlyDocument } from "@keepraw-fly/schema";
import {
  calculatePassportStatistics,
  distanceForFlight,
} from "@keepraw-fly/core";
import { buildShareRenderModel, reliableFlightMinutes } from "./share-model";

// Sentinels: none of these may ever appear in a serialized share model.
const SENTINELS = {
  name: "SENTINEL_LEGAL_NAME",
  romanized: "SENTINEL_ROMANIZED",
  pnr: "SNTPNR",
  ticket: "9990000SENTINEL",
  member: "SENTINEL-MEMBER-778",
  flightNumber: "ZZ9876",
  seat: "88K",
  gate: "SENTGATE",
  terminal: "SENTTERM",
  carousel: "SENTCAROUSEL",
  registration: "B-SENT1",
  extension: "SENTINEL_EXTENSION",
  id: "sentinel-flight-id",
  date: "2024-03-17",
  time: "08:41",
};

const base: KeeprawFlight = {
  id: `${SENTINELS.id}-1`,
  flightNumber: SENTINELS.flightNumber,
  serviceDate: SENTINELS.date,
  airline: { iata: "CA" },
  origin: { iata: "PEK", terminal: SENTINELS.terminal, gate: SENTINELS.gate },
  destination: { iata: "PVG", terminal: "T2" },
  scheduledDeparture: `2024-03-17T${SENTINELS.time}:00+08:00`,
  scheduledArrival: "2024-03-17T11:00:00+08:00",
  actualDeparture: "2024-03-17T08:50:00+08:00",
  actualArrival: "2024-03-17T11:05:00+08:00",
  baggageCarousel: SENTINELS.carousel,
  ticketNumber: SENTINELS.ticket,
  bookingReference: SENTINELS.pnr,
  frequentFlyer: { membershipId: "m1", tierAtFlight: "Gold" },
  extensions: {
    "keepraw-fly.aircraft": {
      type: "Airbus A321",
      registration: SENTINELS.registration,
    },
    "keepraw-fly.seat": { seat: SENTINELS.seat, cabin: "economy" },
    "vendor.private": { note: SENTINELS.extension },
  },
};

function flight(
  overrides: Partial<KeeprawFlight>,
  index: number,
): KeeprawFlight {
  return { ...base, id: `${SENTINELS.id}-${index}`, ...overrides };
}

const flights: KeeprawFlight[] = [
  base,
  // Reverse direction of the same airport pair, same year.
  flight({ origin: { iata: "PVG" }, destination: { iata: "PEK" } }, 2),
  // Duplicate route.
  flight({}, 3),
  // Another year.
  flight(
    {
      serviceDate: "2023-11-02",
      origin: { iata: "SFO" },
      destination: { iata: "NRT" },
      airline: { iata: "UA" },
    },
    4,
  ),
  // Cancelled: no statistics, no route.
  flight(
    {
      cancelled: true,
      origin: { iata: "LHR" },
      destination: { iata: "JFK" },
      actualDeparture: undefined,
      actualArrival: undefined,
    },
    5,
  ),
  // Unknown airport: counted flight, unknown distance, no route.
  flight({ origin: { iata: "QQX" }, destination: { iata: "PVG" } }, 6),
];

const document: KeeprawFlyDocument = {
  format: "keepraw-fly",
  formatVersion: 1,
  profile: {
    name: {
      native: SENTINELS.name,
      romanized: SENTINELS.romanized,
      primary: "native",
    },
  },
  flights,
  frequentFlyerMemberships: [
    {
      id: "m1",
      programId: "phoenixmiles",
      memberNumber: SENTINELS.member,
      associatedAirlines: ["CA"],
    },
  ],
  extensions: { "vendor.root": { secret: SENTINELS.extension } },
} as unknown as KeeprawFlyDocument;

const serialized = (value: unknown) => JSON.stringify(value);

describe("buildShareRenderModel", () => {
  it("defaults to overview: aggregates only, no routes, airports or codes", () => {
    const { model } = buildShareRenderModel(document.flights);
    expect(model.privacy).toBe("overview");
    expect(model.routes).toEqual([]);
    expect(model.airports).toEqual([]);
    expect(model.airportLabels).toBe(false);
    const json = serialized(model);
    for (const code of ["PEK", "PVG", "SFO", "NRT", "QQX", "CA", "UA"])
      expect(json).not.toContain(`"${code}"`);
    expect(json).not.toMatch(/latitude|longitude/);
    expect(Object.keys(model).sort()).toEqual(
      [
        "airportLabels",
        "airports",
        "privacy",
        "routes",
        "scope",
        "statistics",
        "version",
        "yearRange",
      ].sort(),
    );
  });

  it("never carries sentinel identifiers in any mode", () => {
    for (const options of [
      {},
      { privacy: "routes" as const },
      { privacy: "routes" as const, airportLabels: true },
      {
        privacy: "routes" as const,
        scope: { kind: "year" as const, year: 2024 },
      },
    ]) {
      const result = buildShareRenderModel(document.flights, options);
      const json = serialized(result);
      for (const value of Object.values(SENTINELS))
        expect(json).not.toContain(value);
      expect(json).not.toMatch(
        /"(id|flightNumber|serviceDate|ticketNumber|bookingReference|extensions|profile|seat|gate|terminal)"/,
      );
    }
  });

  it("leaves the source document unchanged", () => {
    const before = structuredClone(document);
    buildShareRenderModel(document.flights, {
      privacy: "routes",
      airportLabels: true,
    });
    expect(document).toEqual(before);
  });

  it("uses one filtered set for statistics and routes", () => {
    const year = buildShareRenderModel(document.flights, {
      scope: { kind: "year", year: 2024 },
      privacy: "routes",
      airportLabels: true,
    });
    const scoped = flights.filter((f) => f.serviceDate.startsWith("2024-"));
    const expected = calculatePassportStatistics(scoped);
    expect(year.model.statistics.flights).toBe(expected.flights);
    expect(year.model.statistics.flights).toBe(4);
    expect(year.model.statistics.distanceKilometers).toBeCloseTo(
      expected.distanceKilometers,
      6,
    );
    expect(year.model.yearRange).toEqual({ first: 2024, last: 2024 });
    // PEK⇄PVG merged into one stroke (3 flights); SFO-NRT (2023) excluded,
    // LHR-JFK cancelled, QQX unknown.
    expect(year.model.routes).toHaveLength(1);
    expect(year.model.routes[0]!.flights).toBe(3);
    expect(year.model.airports.map((a) => a.code).sort()).toEqual([
      "PEK",
      "PVG",
    ]);
    expect(year.diagnostics).toMatchObject({
      scopedFlights: 5,
      cancelledFlights: 1,
      unknownDistanceFlights: 1,
      unplottableFlights: 1,
    });

    const lifetime = buildShareRenderModel(document.flights, {
      privacy: "routes",
    });
    expect(lifetime.model.statistics.flights).toBe(5);
    expect(lifetime.model.yearRange).toEqual({ first: 2023, last: 2024 });
    expect(lifetime.model.routes).toHaveLength(2);
    expect(lifetime.model.routes.reduce((s, r) => s + r.flights, 0)).toBe(4);
  });

  it("excludes cancelled flights from statistics and routes", () => {
    const { model } = buildShareRenderModel([flights[4]!], {
      privacy: "routes",
    });
    expect(model.statistics.flights).toBe(0);
    expect(model.routes).toEqual([]);
    expect(model.yearRange).toBeNull();
  });

  it("keeps unknown-coordinate flights counted without inventing distance", () => {
    const { model, diagnostics } = buildShareRenderModel([flights[5]!], {
      privacy: "routes",
    });
    expect(distanceForFlight(flights[5]!)).toBeNull();
    expect(model.statistics.flights).toBe(1);
    expect(model.statistics.distanceKilometers).toBe(0);
    expect(model.statistics.distanceKnownFlights).toBe(0);
    expect(model.statistics.distanceUnknownFlights).toBe(1);
    expect(model.statistics.longestFlightKilometers).toBeNull();
    expect(model.routes).toEqual([]);
    expect(diagnostics.unplottableFlights).toBe(1);
  });

  it("requires explicit consent for airport labels", () => {
    const routes = buildShareRenderModel(document.flights, {
      privacy: "routes",
    });
    expect(routes.model.airports.length).toBeGreaterThan(0);
    expect(routes.model.airports.every((a) => !("code" in a))).toBe(true);
    expect(serialized(routes.model)).not.toContain('"PEK"');
    const overviewWithLabels = buildShareRenderModel(document.flights, {
      airportLabels: true,
    });
    expect(overviewWithLabels.model.airportLabels).toBe(false);
    expect(overviewWithLabels.model.airports).toEqual([]);
    const labelled = buildShareRenderModel(document.flights, {
      privacy: "routes",
      airportLabels: true,
    });
    expect(
      labelled.model.airports.every((a) => typeof a.code === "string"),
    ).toBe(true);
  });

  it("routes carry only whitelisted fields", () => {
    const { model } = buildShareRenderModel(document.flights, {
      privacy: "routes",
      airportLabels: true,
    });
    for (const route of model.routes) {
      expect(Object.keys(route).sort()).toEqual(["flights", "from", "to"]);
      expect(Object.keys(route.from).sort()).toEqual(["latitude", "longitude"]);
    }
    for (const airport of model.airports)
      expect(Object.keys(airport).sort()).toEqual(
        ["code", "flights", "latitude", "longitude"].sort(),
      );
  });

  it("handles empty archives, single flights and coincident endpoints", () => {
    const empty = buildShareRenderModel([], { privacy: "routes" });
    expect(empty.model.statistics.flights).toBe(0);
    expect(empty.model.routes).toEqual([]);
    expect(empty.model.yearRange).toBeNull();

    const single = buildShareRenderModel([base], { privacy: "routes" });
    expect(single.model.statistics.flights).toBe(1);
    expect(single.model.routes).toHaveLength(1);

    const loop = buildShareRenderModel(
      [flight({ origin: { iata: "PEK" }, destination: { iata: "PEK" } }, 9)],
      { privacy: "routes" },
    );
    expect(loop.model.routes).toHaveLength(1);
    expect(loop.model.routes[0]!.from).toEqual(loop.model.routes[0]!.to);
    expect(loop.model.statistics.distanceKilometers).toBe(0);
  });

  it("counts diversions at the diverted airport like the core statistics", () => {
    const diverted = flight({ divertedTo: { iata: "NRT" } }, 10);
    const { model } = buildShareRenderModel([diverted], {
      privacy: "routes",
      airportLabels: true,
    });
    expect(model.airports.map((a) => a.code).sort()).toEqual(["NRT", "PEK"]);
    expect(model.statistics.distanceKilometers).toBeCloseTo(
      distanceForFlight(diverted)!,
      6,
    );
  });

  it("ignores malformed service dates for the year range but still counts them", () => {
    const odd = flight({ serviceDate: "unknown" }, 11);
    const { model, diagnostics } = buildShareRenderModel([odd, base]);
    expect(model.statistics.flights).toBe(2);
    expect(model.yearRange).toEqual({ first: 2024, last: 2024 });
    expect(diagnostics.invalidServiceDateFlights).toBe(1);
    const year = buildShareRenderModel([odd, base], {
      scope: { kind: "year", year: 2024 },
    });
    expect(year.model.statistics.flights).toBe(1);
  });

  it("totals reliable flight time and reports unknown durations separately", () => {
    // base: actual 08:50 → 11:05 (+08:00) = 135 minutes.
    expect(buildShareRenderModel([base]).model.statistics).toMatchObject({
      durationMinutes: 135,
      durationKnownFlights: 1,
      durationUnknownFlights: 0,
    });
    const scheduledOnly = flight(
      { actualDeparture: undefined, actualArrival: undefined },
      20,
    );
    const invalid = flight(
      {
        actualDeparture: undefined,
        actualArrival: undefined,
        scheduledDeparture: "not-a-time",
      },
      21,
    );
    const reversed = flight(
      {
        actualDeparture: undefined,
        actualArrival: undefined,
        scheduledDeparture: "2024-03-17T12:00:00+08:00",
        scheduledArrival: "2024-03-17T10:00:00+08:00",
      },
      22,
    );
    const implausible = flight(
      {
        actualDeparture: undefined,
        actualArrival: undefined,
        scheduledDeparture: "2024-03-17T08:00:00+08:00",
        scheduledArrival: "2024-03-20T08:00:00+08:00",
      },
      23,
    );
    const cancelled = flight({ cancelled: true }, 24);
    const { model } = buildShareRenderModel([
      base,
      scheduledOnly,
      invalid,
      reversed,
      implausible,
      cancelled,
    ]);
    // scheduledOnly: 08:41 → 11:00 = 139 minutes.
    expect(model.statistics.durationMinutes).toBe(135 + 139);
    expect(model.statistics.durationKnownFlights).toBe(2);
    expect(model.statistics.durationUnknownFlights).toBe(3);
    expect(model.statistics.flights).toBe(5);
    expect(Number.isFinite(model.statistics.durationMinutes)).toBe(true);
    expect(reliableFlightMinutes(invalid)).toBeNull();
    expect(reliableFlightMinutes(reversed)).toBeNull();
    expect(reliableFlightMinutes(implausible)).toBeNull();
  });
});
