import { afterEach, describe, expect, it, vi } from "vitest";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  migrateKeeprawFly,
  parseKeeprawFlyJson,
  validateAndMigrateKeeprawFly,
  validateKeeprawFly,
} from "../src";
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

afterEach(() => vi.restoreAllMocks());

describe("Keepraw Fly validator", () => {
  it("validates the complete 24-flight demo dataset", () => {
    const result = validateKeeprawFly(demoDocument);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.flights).toHaveLength(24);
  });

  it("accepts optional destination terminal and gate fields", () => {
    const withGate = structuredClone(validDocument) as {
      flights: KeeprawFlight[];
    };
    withGate.flights[0]!.destination = {
      iata: "HKG",
      terminal: "1",
      gate: "33",
    };
    const result = validateKeeprawFly(withGate);
    expect(result.valid).toBe(true);
    const roundTripped = parseKeeprawFlyJson(JSON.stringify(withGate));
    expect(roundTripped.valid).toBe(true);
    if (roundTripped.valid)
      expect(roundTripped.data.flights[0]!.destination).toEqual({
        iata: "HKG",
        terminal: "1",
        gate: "33",
      });

    const withoutGate = structuredClone(withGate) as {
      flights: KeeprawFlight[];
    };
    delete withoutGate.flights[0]!.destination.gate;
    expect(validateKeeprawFly(withoutGate).valid).toBe(true);
  });

  it("accepts a valid document and preserves unknown extensions", () => {
    const result = validateKeeprawFly(validDocument);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(
        result.data.flights[0]?.extensions?.["example.thirdparty"],
      ).toEqual({ kept: true, nested: [1, "two"] });
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
    expect(legacy.format).toBe("rawfly");
  });

  it("migrates the 0.1 shorthand but rejects unsupported future versions", () => {
    const shorthand = {
      ...structuredClone(validDocument),
      formatVersion: "0.1",
    };
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
    expect(future).toMatchObject({
      reason: "unsupported-version",
      formatVersion: "9.0.0",
    });
  });

  it.each([
    ["keepraw-fly", "99.0.0"],
    ["rawfly", "99.0.0"],
    ["keepraw-fly", "experimental"],
  ])(
    "rejects unsupported %s version %s before migration",
    (format, formatVersion) => {
      const raw = {
        ...structuredClone(validDocument),
        format,
        formatVersion,
        futureField: { kept: true },
      };
      const clone = vi.spyOn(globalThis, "structuredClone");

      expect(validateAndMigrateKeeprawFly(raw)).toMatchObject({
        valid: false,
        reason: "unsupported-version",
        formatVersion,
        issues: [{ path: "/formatVersion", keyword: "unsupportedVersion" }],
      });
      expect(migrateKeeprawFly(raw)).toEqual({ data: raw, migrations: [] });
      expect(clone).not.toHaveBeenCalled();
      expect(raw.formatVersion).toBe(formatVersion);
      expect(raw.futureField).toEqual({ kept: true });
    },
  );

  it.each([undefined, null, 99])(
    "treats missing or malformed version %s as invalid without guessing a migration",
    (formatVersion) => {
      const raw = {
        ...structuredClone(validDocument),
        format: "rawfly",
        formatVersion,
      };
      expect(validateAndMigrateKeeprawFly(raw)).toMatchObject({
        valid: false,
        reason: "invalid",
      });
      expect(migrateKeeprawFly(raw)).toEqual({ data: raw, migrations: [] });
    },
  );

  it("does not identify an unrelated format as an unsupported Keepraw Fly version", () => {
    const raw = {
      ...structuredClone(validDocument),
      format: "another-format",
      formatVersion: "99.0.0",
    };
    expect(validateAndMigrateKeeprawFly(raw)).toMatchObject({
      valid: false,
      reason: "invalid",
    });
    expect(migrateKeeprawFly(raw)).toEqual({ data: raw, migrations: [] });
  });

  it("returns a recovery issue if migration throws without mutating its source", () => {
    const raw = { ...structuredClone(validDocument), format: "rawfly" };
    vi.spyOn(globalThis, "structuredClone").mockImplementationOnce(() => {
      throw new Error("Cannot clone archive");
    });
    expect(validateAndMigrateKeeprawFly(raw)).toMatchObject({
      valid: false,
      reason: "invalid",
      issues: [{ path: "/", keyword: "migration" }],
    });
    expect(raw.format).toBe("rawfly");
  });

  it("does not mutate the legacy source when migrated validation fails", () => {
    const raw = {
      format: "rawfly",
      formatVersion: "0.1",
      profile: {},
      flights: [{ broken: true }],
      extensions: { "example.unknown": { preserved: true } },
    };
    const snapshot = structuredClone(raw);
    expect(validateAndMigrateKeeprawFly(raw)).toMatchObject({
      valid: false,
      reason: "invalid",
    });
    expect(raw).toEqual(snapshot);
  });

  it.each([
    { frequentFlyerMemberships: [null] },
    { frequentFlyerMemberships: [{ broken: true }] },
    { frequentFlyerMemberships: { broken: true } },
    {
      frequentFlyerMemberships: [
        { id: "ff", programId: "custom", memberNumber: "123" },
      ],
    },
    {
      frequentFlyerMemberships: [
        {
          id: "ff",
          programId: "custom",
          memberNumber: "123",
          associatedAirlines: [7],
        },
      ],
    },
    {
      frequentFlyerMemberships: [
        {
          id: "ff",
          programId: "custom",
          memberNumber: "123",
          associatedAirlines: ["UA"],
          defaultAirline: "CA",
        },
      ],
    },
    {
      frequentFlyerMemberships: [
        {
          id: "ff",
          programId: "custom",
          memberNumber: "123",
          associatedAirlines: [],
          unexpected: true,
        },
      ],
    },
    { extensions: null },
  ])(
    "retains malformed canonical facts rather than silently repairing them: %j",
    (malformed) => {
      const raw = { ...structuredClone(validDocument), ...malformed };
      const snapshot = structuredClone(raw);
      expect(validateAndMigrateKeeprawFly(raw)).toMatchObject({
        valid: false,
        reason: "invalid",
      });
      expect(raw).toEqual(snapshot);
    },
  );

  it("leaves canonical optional fields intact when no migration is needed", () => {
    const raw = {
      ...structuredClone(validDocument),
      extensions: {},
      frequentFlyerMemberships: [
        {
          id: "ff",
          programId: "custom",
          memberNumber: "123",
          associatedAirlines: ["UA"],
        },
      ],
    };
    (raw.flights[0] as KeeprawFlight).extensions = {};
    const result = validateAndMigrateKeeprawFly(raw);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.migrations).toEqual([]);
      expect(result.data).toEqual(raw);
    }
  });

  it("recovers legacy ticket, carousel and membership values behind empty fields", () => {
    const archive = {
      ...validDocument,
      flights: [
        {
          ...validDocument.flights[0],
          ticketNumber: null,
          baggageCarousel: "",
          frequentFlyer: null,
          extensions: {
            "keepraw-fly.ticket": { number: "9991234567890" },
            "keepraw-fly.baggage": { carousel: "7B" },
            "keepraw-fly.frequent-flyer": {
              programName: "MileagePlus",
              memberNumber: "01642",
            },
          },
        },
      ],
    };
    const result = validateAndMigrateKeeprawFly(archive);
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    const [membership] = result.data.frequentFlyerMemberships!;
    expect(membership!.memberNumber).toBe("01642");
    expect(result.data.flights[0]).toMatchObject({
      ticketNumber: "9991234567890",
      baggageCarousel: "7B",
      frequentFlyer: { membershipId: membership!.id },
    });
    expect(result.data.flights[0]?.extensions).toBeUndefined();
  });

  it("migrates legacy travel extensions into relationship-based flight metadata", () => {
    const legacy = structuredClone(validDocument) as Record<string, any>;
    legacy.extensions = {
      "keepraw-fly.frequent-flyer": {
        memberships: [
          {
            id: "ff-phoenix-01",
            programName: "PhoenixMiles",
            memberNumber: "ZH-88301924",
            tier: "silver",
            associatedAirlines: "ZH, CCA",
            defaultForAirlines: ["CCA"],
          },
        ],
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
      expect(
        Array.isArray(
          result.data.frequentFlyerMemberships?.[0]?.associatedAirlines,
        ),
      ).toBe(true);
      expect(JSON.stringify(result.data)).not.toContain("defaultForAirlines");
      expect(result.data.flights[0]).toMatchObject({
        baggageCarousel: "D05",
        ticketNumber: "4792401988421",
        frequentFlyer: { membershipId: "ff-phoenix-01", tierAtFlight: "gold" },
      });
      expect(JSON.stringify(result.data)).not.toContain("checkedBaggage");
      expect(result.data.flights[0]?.extensions).not.toHaveProperty(
        "keepraw-fly.baggage",
      );
      expect(result.data.flights[0]?.extensions).not.toHaveProperty(
        "keepraw-fly.ticket",
      );
      expect(result.data.flights[0]?.extensions).not.toHaveProperty(
        "keepraw-fly.frequent-flyer",
      );
    }
  });

  it.each([false, true])(
    "migrates mixed membership sources without losing accounts (existing accounts: %s)",
    (withCanonical) => {
      const canonical = {
        id: "local",
        programId: "custom",
        memberNumber: "001",
        associatedAirlines: ["UA"],
      };
      const shared = { ...canonical, id: "shared" };
      const legacy = {
        id: "legacy",
        programName: "PhoenixMiles",
        memberNumber: "002",
        associatedAirlines: "CA",
      };
      const raw = {
        ...structuredClone(validDocument),
        frequentFlyerMemberships: withCanonical ? [canonical, shared] : [],
        extensions: {
          "keepraw-fly.frequent-flyer": {
            memberships: [
              legacy,
              ...(withCanonical ? [{ ...shared, tier: "Gold" }] : []),
            ],
            preserved: true,
          },
        },
        flights: validDocument.flights.map((flight) => ({
          ...flight,
          frequentFlyer: { membershipId: legacy.id },
        })),
      };
      const snapshot = structuredClone(raw);
      const migrated = validateAndMigrateKeeprawFly(raw);
      expect(migrated).toMatchObject({
        valid: true,
        migrations: ["flight-metadata-v2"],
      });
      if (!migrated.valid)
        throw new Error("Expected a safely migrated archive");
      expect(migrated.data.frequentFlyerMemberships).toEqual([
        ...(withCanonical ? [canonical, { ...shared, tier: "Gold" }] : []),
        {
          id: "legacy",
          programId: "phoenixmiles",
          programName: "PhoenixMiles",
          memberNumber: "002",
          associatedAirlines: ["CA"],
          defaultAirline: "CA",
        },
      ]);
      expect(migrated.data.extensions).toEqual({
        "keepraw-fly.frequent-flyer": { preserved: true },
      });
      expect(migrated.data.formatVersion).toBe(raw.formatVersion);
      expect(migrated.data.flights).toEqual(raw.flights);
      expect(validateAndMigrateKeeprawFly(migrated.data)).toEqual({
        ...migrated,
        migrations: [],
      });
      expect(raw).toEqual(snapshot);
    },
  );

  it.each([
    "different account",
    "duplicate legacy ID",
    "malformed legacy list",
  ])("refuses destructive membership migration: %s", (problem) => {
    const account = {
      id: "shared",
      programId: "custom",
      memberNumber: "001",
      associatedAirlines: ["UA"],
    };
    const raw = {
      ...structuredClone(validDocument),
      frequentFlyerMemberships: [account],
      extensions: {
        "keepraw-fly.frequent-flyer": {
          memberships:
            problem === "malformed legacy list"
              ? account
              : problem === "duplicate legacy ID"
                ? [account, account]
                : [{ ...account, memberNumber: "002" }],
        },
      },
    };
    const snapshot = structuredClone(raw);
    expect(validateAndMigrateKeeprawFly(raw)).toMatchObject({
      valid: false,
      issues: [{ keyword: "membershipMigrationConflict" }],
    });
    expect(raw).toEqual(snapshot);
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
    const cancelled = structuredClone(validDocument) as {
      flights: KeeprawFlight[];
    };
    cancelled.flights[0]!.cancelled = true;
    delete cancelled.flights[0]!.actualDeparture;
    delete cancelled.flights[0]!.actualArrival;
    expect(validateKeeprawFly(cancelled).valid).toBe(true);

    const conflict = structuredClone(cancelled) as { flights: KeeprawFlight[] };
    conflict.flights[0]!.divertedTo = { iata: "KIX" };
    const result = validateKeeprawFly(conflict);
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          keyword: "cancelledDivertedConflict",
          flightIndex: 0,
        }),
      );
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

  it.each([
    "scheduledDeparture",
    "scheduledArrival",
    "actualDeparture",
    "actualArrival",
  ] as const)(
    "rejects a real leap second at %s as an unsupported instant",
    (field) => {
      const raw = structuredClone(validDocument);
      const timestamp = "2016-12-31T23:59:60Z";
      raw.flights[0]![field] = timestamp;
      raw.flights[0]!.serviceDate = raw.flights[0]!.scheduledDeparture.slice(
        0,
        10,
      );
      expect(parseKeeprawFlyJson(JSON.stringify(raw))).toMatchObject({
        valid: false,
        issues: [
          {
            flightIndex: 0,
            path: `/flights/0/${field}`,
            keyword: "unsupportedLeapSecond",
            received: timestamp,
            message: expect.stringContaining("Leap seconds"),
          },
        ],
      });
    },
  );

  it("accepts both explicitly offset sides of a DST overlap in chronological order", () => {
    const raw = structuredClone(validDocument);
    Object.assign(raw.flights[0]!, {
      serviceDate: "2026-11-01",
      scheduledDeparture: "2026-11-01T01:30:00-04:00",
      scheduledArrival: "2026-11-01T01:15:00-05:00",
      actualDeparture: "2026-11-01T01:30:00-04:00",
      actualArrival: "2026-11-01T01:15:00-05:00",
    });
    expect(validateKeeprawFly(raw)).toMatchObject({ valid: true, data: raw });
  });

  it("reports an unparseable instant even when there is no other actual timestamp", () => {
    const raw = structuredClone(validDocument) as { flights: KeeprawFlight[] };
    delete raw.flights[0]!.actualDeparture;
    raw.flights[0]!.actualArrival = "2026-08-19T12:21:00-07";
    expect(validateKeeprawFly(raw)).toMatchObject({
      valid: false,
      issues: [
        {
          path: "/flights/0/actualArrival",
          flightIndex: 0,
          keyword: "runtimeInstant",
        },
      ],
    });
  });

  it("rejects derived statistics stored as flight facts", () => {
    const input = structuredClone(validDocument) as typeof validDocument & {
      flights: Array<
        (typeof validDocument.flights)[number] & {
          departureDelayMinutes?: number;
        }
      >;
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
