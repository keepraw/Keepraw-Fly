import { describe, expect, it } from "vitest";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import { validateAndMigrateKeeprawFly } from "@keepraw-fly/validator";
import demo from "@keepraw-fly/core/demo";
import {
  SHAREABLE_EXTENSION_FIELDS,
  SHAREABLE_FIELD_MAX_LENGTH,
  redactSensitiveData,
} from "./redacted-export";
import { serializeKeeprawFly } from "./export";
import { preflightJsonImport } from "./import-preview";

const secrets = {
  native: "张三丰",
  romanized: "Sanfeng Zhang",
  member: "MU-123456789",
  legacyMember: "LEGACY-998877",
  snapshotMember: "SNAP-445566",
  ticket: "7812345678901",
  legacyTicket: "7819999999999",
  pnr: "QX7Z9K",
  custom: "PASSPORT-E12345678",
};

function sensitiveArchive(): KeeprawFlyDocument {
  const base = structuredClone(demo) as KeeprawFlyDocument;
  const [first, second] = base.flights;
  return {
    ...base,
    profile: {
      name: {
        native: secrets.native,
        romanized: secrets.romanized,
        primary: "native",
      },
    },
    frequentFlyerMemberships: [
      {
        id: "membership-1",
        programId: "custom",
        programName: "Eastern Miles",
        memberNumber: secrets.member,
        tier: "Gold",
        associatedAirlines: ["MU"],
        defaultAirline: "MU",
      },
    ],
    extensions: { "example.tracker": { owner: secrets.custom } },
    flights: [
      {
        ...first!,
        ticketNumber: secrets.ticket,
        bookingReference: secrets.pnr,
        frequentFlyer: { membershipId: "membership-1", tierAtFlight: "Gold" },
        extensions: {
          ...(first!.extensions ?? {}),
          "keepraw-fly.seat": { seat: "32A", cabin: "economy" },
          "keepraw-fly.ticket": { number: secrets.legacyTicket },
          "keepraw-fly.frequent-flyer": {
            membershipId: "membership-1",
            memberNumber: secrets.snapshotMember,
          },
          "example.passport": { number: secrets.custom },
          "keepraw-fly.future-field": { value: secrets.custom },
        },
      },
      second!,
      ...base.flights.slice(2),
    ],
  };
}

describe("shareable (redacted) export", () => {
  it("removes every personal identifier, including nested and unknown extensions", async () => {
    const text = await serializeKeeprawFly(sensitiveArchive(), "shareable");
    for (const value of Object.values(secrets))
      expect(text).not.toContain(value);
    const exported = JSON.parse(text) as KeeprawFlyDocument;
    expect(exported.profile).toEqual({});
    expect(exported.extensions).toBeUndefined();
    const flight = exported.flights[0]!;
    expect(flight.ticketNumber).toBeUndefined();
    expect(flight.bookingReference).toBeUndefined();
    expect(Object.keys(flight.extensions ?? {}).sort()).toEqual(
      expect.not.arrayContaining([
        "keepraw-fly.ticket",
        "keepraw-fly.frequent-flyer",
        "example.passport",
        "keepraw-fly.future-field",
      ]),
    );
  });

  it("keeps statistics-relevant facts, programs, tiers and links", async () => {
    const source = sensitiveArchive();
    const exported = JSON.parse(
      await serializeKeeprawFly(source, "shareable"),
    ) as KeeprawFlyDocument;
    expect(exported.flights).toHaveLength(source.flights.length);
    expect(exported.flights[0]!.extensions?.["keepraw-fly.seat"]).toEqual({
      seat: "32A",
      cabin: "economy",
    });
    expect(exported.flights[0]!.frequentFlyer).toEqual({
      membershipId: "membership-1",
      tierAtFlight: "Gold",
    });
    expect(exported.frequentFlyerMemberships).toEqual([
      expect.objectContaining({
        id: "membership-1",
        programName: "Eastern Miles",
        tier: "Gold",
        memberNumber: "",
        associatedAirlines: ["MU"],
      }),
    ]);
    for (const [index, flight] of exported.flights.entries()) {
      const original = source.flights[index]!;
      expect(flight.flightNumber).toBe(original.flightNumber);
      expect(flight.origin).toEqual(original.origin);
      expect(flight.destination).toEqual(original.destination);
      expect(flight.scheduledDeparture).toBe(original.scheduledDeparture);
      expect(flight.actualArrival).toBe(original.actualArrival);
    }
  });

  it("never modifies the stored archive", () => {
    const source = sensitiveArchive();
    const snapshot = structuredClone(source);
    redactSensitiveData(source);
    expect(source).toEqual(snapshot);
  });

  it("passes schema and semantic validation and can be imported", async () => {
    const text = await serializeKeeprawFly(sensitiveArchive(), "shareable");
    const validation = validateAndMigrateKeeprawFly(JSON.parse(text));
    expect(validation.valid).toBe(true);
    const preview = preflightJsonImport(text, validation, null);
    expect(preview.canImport).toBe(true);
    expect(preview.validRecords).toBe(preview.totalRecords);
    // Importing it next to the original archive reports duplicates, not errors.
    const beside = preflightJsonImport(text, validation, sensitiveArchive());
    expect(beside.canImport).toBe(true);
    expect(beside.problemRecords).toBe(0);
  });

  it("redacts legacy membership extensions while keeping their programs", () => {
    const legacy = structuredClone(demo) as KeeprawFlyDocument;
    delete legacy.frequentFlyerMemberships;
    legacy.extensions = {
      "keepraw-fly.frequent-flyer": {
        memberships: [
          {
            id: "legacy-1",
            programName: "Mileage Plus",
            memberNumber: secrets.legacyMember,
            associatedAirlines: ["UA"],
          },
        ],
      },
    };
    const { document, summary } = redactSensitiveData(legacy);
    expect(JSON.stringify(document)).not.toContain(secrets.legacyMember);
    expect(document.frequentFlyerMemberships).toEqual([
      expect.objectContaining({ id: "legacy-1", memberNumber: "" }),
    ]);
    expect(summary.memberNumbers).toBe(1);
    expect(validateAndMigrateKeeprawFly(document).valid).toBe(true);
  });

  it("full backups keep every identifier the current format stores", async () => {
    const source = sensitiveArchive();
    const text = await serializeKeeprawFly(source, "backup");
    // Legacy per-flight ticket/frequent-flyer snapshots duplicate canonical
    // fields; the existing flight-metadata-v2 migration folds them on any save.
    for (const value of [
      secrets.native,
      secrets.romanized,
      secrets.member,
      secrets.ticket,
      secrets.pnr,
      secrets.custom,
    ])
      expect(text).toContain(value);
    const { validateAndMigrateKeeprawFly: migrate } =
      await import("@keepraw-fly/validator");
    const migrated = migrate(source);
    expect(migrated.valid && JSON.parse(text)).toEqual(
      migrated.valid ? migrated.data : null,
    );
  });
});

describe("shareable export: field-level allowlist inside kept extensions", () => {
  // Valid under the schema (extension values are free-form JSON), so a legacy
  // or third-party writer could have produced exactly this.
  const hidden = {
    pnr: "HIDPNR42",
    ticket: "1609876543210",
    member: "FFP-HIDDEN-55667788",
    name: "Hidden Traveller Name",
    deep: "DEEP-NESTED-SECRET-0001",
    arrayed: "ARRAY-SECRET-0002",
    oddKey: "ODD-KEY-SECRET-0003",
  };

  function poisonedArchive(): KeeprawFlyDocument {
    const base = structuredClone(demo) as KeeprawFlyDocument;
    const [first, second, third] = base.flights;
    return {
      ...base,
      flights: [
        {
          ...first!,
          extensions: {
            "keepraw-fly.aircraft": {
              type: "A350-900",
              registration: "B-308M",
              bookingReference: hidden.pnr,
              owner: { passenger: { name: hidden.name } },
              notes: [hidden.arrayed],
            },
            "keepraw-fly.seat": {
              seat: "32A",
              cabin: "economy",
              bookingClass: "Y",
              ticketNumber: hidden.ticket,
              x: { y: { z: hidden.deep } },
              // A known field with the wrong shape is not kept either.
              cabinDetails: { holder: hidden.name },
            },
          },
        },
        {
          ...second!,
          extensions: {
            "keepraw-fly.seat": {
              seat: { value: "1A", memberNumber: hidden.member },
              cabin: "business",
            },
            "keepraw-fly.baggage": {
              carousel: "7",
              tag: hidden.oddKey,
              list: [{ pnr: hidden.pnr }],
            },
          },
        },
        {
          ...third!,
          extensions: {
            "keepraw-fly.aircraft": [hidden.arrayed],
            "keepraw-fly.baggage": "loose string " + hidden.oddKey,
          },
        },
        ...base.flights.slice(3),
      ],
    };
  }

  it("drops every unknown, nested and arrayed value in the three kept extensions", async () => {
    const text = await serializeKeeprawFly(poisonedArchive(), "shareable");
    for (const value of Object.values(hidden))
      expect(text).not.toContain(value);
  });

  it("keeps only the declared fields with valid values", async () => {
    const exported = JSON.parse(
      await serializeKeeprawFly(poisonedArchive(), "shareable"),
    ) as KeeprawFlyDocument;
    const [first, second, third] = exported.flights;
    expect(first!.extensions).toEqual({
      "keepraw-fly.aircraft": { type: "A350-900", registration: "B-308M" },
      "keepraw-fly.seat": { seat: "32A", cabin: "economy", bookingClass: "Y" },
    });
    // The validator folds the legacy baggage extension into baggageCarousel
    // on load; the redacted value is the only one that survives.
    const secondExtensions = second!.extensions ?? {};
    expect(secondExtensions["keepraw-fly.seat"]).toEqual({ cabin: "business" });
    expect(JSON.stringify(second)).not.toContain(hidden.oddKey);
    expect(third!.extensions?.["keepraw-fly.aircraft"]).toBeUndefined();
  });

  it("is default deny: every declared field list is exactly what the app reads", () => {
    for (const [extension, fields] of Object.entries(
      SHAREABLE_EXTENSION_FIELDS,
    ))
      expect(fields.length, extension).toBeGreaterThan(0);
    const { document, summary } = redactSensitiveData({
      ...(structuredClone(demo) as KeeprawFlyDocument),
      flights: [
        {
          ...(structuredClone(demo) as KeeprawFlyDocument).flights[0]!,
          extensions: {
            "keepraw-fly.seat": {
              seat: "12C",
              futureField: "anything",
              long: "x".repeat(10),
              cabin: "c".repeat(SHAREABLE_FIELD_MAX_LENGTH + 1),
              bookingClass: "Y\nPNR ABC123",
            },
          },
        },
      ],
    });
    expect(document.flights[0]!.extensions).toEqual({
      "keepraw-fly.seat": { seat: "12C" },
    });
    expect(summary.droppedExtensionFields).toBe(4);
  });

  it("validates, re-imports and leaves the source archive untouched", async () => {
    const source = poisonedArchive();
    const snapshot = structuredClone(source);
    const text = await serializeKeeprawFly(source, "shareable");
    expect(source).toEqual(snapshot);
    const validation = validateAndMigrateKeeprawFly(JSON.parse(text));
    expect(validation.valid).toBe(true);
    const preview = preflightJsonImport(text, validation, null);
    expect(preview.canImport).toBe(true);
    expect(preview.validRecords).toBe(preview.totalRecords);
  });

  it("full backups still keep the poisoned extensions byte for byte", async () => {
    const source = poisonedArchive();
    const text = await serializeKeeprawFly(source, "backup");
    const backup = JSON.parse(text) as KeeprawFlyDocument;
    expect(backup.flights[0]!.extensions).toEqual(
      source.flights[0]!.extensions,
    );
    expect(backup.flights[1]!.extensions?.["keepraw-fly.seat"]).toEqual(
      source.flights[1]!.extensions?.["keepraw-fly.seat"],
    );
    for (const value of [hidden.pnr, hidden.ticket, hidden.member, hidden.name])
      expect(text).toContain(value);
  });
});
