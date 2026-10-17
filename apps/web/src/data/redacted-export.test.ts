import { describe, expect, it } from "vitest";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import { validateAndMigrateKeeprawFly } from "@keepraw-fly/validator";
import demo from "@keepraw-fly/core/demo";
import { redactSensitiveData } from "./redacted-export";
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
