import { describe, expect, it } from "vitest";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import { parseKeeprawFlyJson, validateAndMigrateKeeprawFly, validateKeeprawFly } from "../src";
import demoDocument from "../../core/data/demo.keepraw-fly.json";

const validDocument = {
  format: "keepraw-fly",
  formatVersion: "0.1.0",
  profile: {
    name: {
      native: "张鸿川",
      romanized: "Hongchuan Zhang",
      primary: "native",
    },
  },
  flights: [
    {
      id: "demo-ua123-20260819",
      flightNumber: "UA123",
      serviceDate: "2026-08-19",
      airline: { iata: "UA" },
      origin: { iata: "SFO", terminal: "3", gate: "F12" },
      destination: { iata: "LAX" },
      scheduledDeparture: "2026-08-19T10:20:00-07:00",
      scheduledArrival: "2026-08-19T11:52:00-07:00",
      actualDeparture: "2026-08-19T10:57:00-07:00",
      actualArrival: "2026-08-19T12:21:00-07:00",
      extensions: {
        "example.thirdparty": { kept: true, nested: [1, "two"] },
      },
    },
  ],
};

describe("Keepraw Fly validator", () => {
  it("validates the complete 24-flight demo dataset", () => {
    const result = validateKeeprawFly(demoDocument);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.flights).toHaveLength(24);
  });

  it("accepts a valid document and preserves unknown extensions", () => {
    const result = validateKeeprawFly(validDocument);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.flights[0]?.extensions?.["example.thirdparty"]).toEqual(
        { kept: true, nested: [1, "two"] },
      );
    }
  });

  it("migrates the former RawFly identifier without losing facts", () => {
    const legacy = structuredClone(validDocument) as Record<string, unknown>;
    legacy.format = "rawfly";

    const result = validateAndMigrateKeeprawFly(legacy);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.format).toBe("keepraw-fly");
      expect(result.data.flights).toEqual(validDocument.flights);
      expect(result.migrations).toEqual(["rawfly-brand"]);
    }
  });

  it("migrates the 0.1 shorthand but rejects unsupported future versions", () => {
    const shorthand = { ...structuredClone(validDocument), formatVersion: "0.1" };
    const migrated = validateAndMigrateKeeprawFly(shorthand);
    expect(migrated.valid).toBe(true);
    if (migrated.valid) {
      expect(migrated.data.formatVersion).toBe("0.1.0");
      expect(migrated.migrations).toEqual(["version-0.1"]);
    }

    const future = validateAndMigrateKeeprawFly({
      ...structuredClone(validDocument),
      formatVersion: "9.0.0",
    });
    expect(future.valid).toBe(false);
  });

  it("migrates legacy travel extensions into relationship-based flight metadata", () => {
    const legacy = structuredClone(validDocument) as Record<string, any>;
    legacy.extensions = {
      "keepraw-fly.frequent-flyer": {
        memberships: [{
          id: "ff-phoenix-01",
          programName: "PhoenixMiles",
          memberNumber: "ZH-88301924",
          tier: "silver",
          associatedAirlines: "ZH, CCA",
          defaultForAirlines: ["CCA"],
        }],
      },
    };
    legacy.flights[0].extensions = {
      ...legacy.flights[0].extensions,
      "keepraw-fly.baggage": { checkedBaggage: false, carousel: "D05" },
      "keepraw-fly.ticket": { number: "4792401988421" },
      "keepraw-fly.frequent-flyer": {
        membershipId: "ff-phoenix-01",
        programName: "PhoenixMiles",
        memberNumber: "ZH-88301924",
        tier: "gold",
      },
    };

    const result = validateAndMigrateKeeprawFly(legacy);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.migrations).toContain("flight-metadata-v2");
      expect(result.data.frequentFlyerMemberships?.[0]).toMatchObject({
        id: "ff-phoenix-01",
        programId: "phoenixmiles",
        memberNumber: "ZH-88301924",
        tier: "silver",
        associatedAirlines: ["ZH", "CA"],
        defaultAirline: "CA",
      });
      expect(Array.isArray(result.data.frequentFlyerMemberships?.[0]?.associatedAirlines)).toBe(true);
      expect(JSON.stringify(result.data)).not.toContain("defaultForAirlines");
      expect(result.data.flights[0]).toMatchObject({
        baggageCarousel: "D05",
        ticketNumber: "4792401988421",
        frequentFlyer: { membershipId: "ff-phoenix-01", tierAtFlight: "gold" },
      });
      expect(JSON.stringify(result.data)).not.toContain("checkedBaggage");
      expect(result.data.flights[0]?.extensions).not.toHaveProperty("keepraw-fly.baggage");
      expect(result.data.flights[0]?.extensions).not.toHaveProperty("keepraw-fly.ticket");
      expect(result.data.flights[0]?.extensions).not.toHaveProperty("keepraw-fly.frequent-flyer");
    }
  });

  it("accepts nullable string metadata and keeps ticket number separate from PNR", () => {
    const input = structuredClone(validDocument) as Record<string, any>;
    Object.assign(input.flights[0], {
      ticketNumber: "479-2401988421",
      bookingReference: "KY78M9",
      baggageCarousel: null,
    });

    const result = validateKeeprawFly(input);
    expect(result.valid).toBe(true);
  });

  it("accepts cancelled flights without actual timestamps and rejects cancelled diversions", () => {
    const cancelled = structuredClone(validDocument) as { flights: KeeprawFlight[] };
    cancelled.flights[0]!.cancelled = true;
    delete cancelled.flights[0]!.actualDeparture;
    delete cancelled.flights[0]!.actualArrival;
    expect(validateKeeprawFly(cancelled).valid).toBe(true);

    const conflict = structuredClone(cancelled) as { flights: KeeprawFlight[] };
    conflict.flights[0]!.divertedTo = { iata: "KIX" };
    const result = validateKeeprawFly(conflict);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues).toContainEqual(expect.objectContaining({ keyword: "cancelledDivertedConflict", flightIndex: 0 }));
  });

  it("reports the flight and path for a datetime without a timezone", () => {
    const input = structuredClone(validDocument);
    input.flights[0]!.scheduledDeparture = "2026-08-19 10:20";

    const result = validateKeeprawFly(input);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          flightIndex: 0,
          path: "/flights/0/scheduledDeparture",
          received: "2026-08-19 10:20",
          message: expect.stringContaining("explicit timezone"),
        }),
      );
    }
  });

  it("rejects derived statistics stored as flight facts", () => {
    const input = structuredClone(validDocument) as typeof validDocument & {
      flights: Array<(typeof validDocument.flights)[number] & {
        departureDelayMinutes?: number;
      }>;
    };
    input.flights[0]!.departureDelayMinutes = 37;

    const result = validateKeeprawFly(input);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          path: "/flights/0/departureDelayMinutes",
          keyword: "additionalProperties",
        }),
      );
    }
  });

  it("returns a useful issue for malformed JSON", () => {
    const result = parseKeeprawFlyJson('{"format":');

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toEqual(
        expect.objectContaining({ keyword: "parse", path: "/" }),
      );
    }
  });

  it("rejects duplicate flight ids", () => {
    const input = structuredClone(validDocument);
    input.flights.push(structuredClone(input.flights[0]!));
    const result = validateKeeprawFly(input);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          path: "/flights/1/id",
          keyword: "uniqueFlightId",
        }),
      );
    }
  });

  it("rejects impossible flight chronology", () => {
    const input = structuredClone(validDocument);
    input.flights[0]!.scheduledArrival = "2026-08-19T09:52:00-07:00";
    const result = validateKeeprawFly(input);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          path: "/flights/0/scheduledArrival",
          keyword: "chronology",
        }),
      );
    }
  });
});
