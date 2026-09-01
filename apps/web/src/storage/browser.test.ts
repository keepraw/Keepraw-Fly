import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import { BrowserStorageAdapter } from "./browser";

const adapters: BrowserStorageAdapter[] = [];

afterEach(async () => {
  await Promise.all(adapters.splice(0).map((adapter) => adapter.deleteDatabaseForTests()));
});

describe("BrowserStorageAdapter", () => {
  it("round-trips a document including unknown extensions", async () => {
    const adapter = new BrowserStorageAdapter(`test-${crypto.randomUUID()}`);
    adapters.push(adapter);
    const document: KeeprawFlyDocument = {
      format: "keepraw-fly",
      formatVersion: "0.1.0",
      profile: {},
      flights: [],
      extensions: { "example.unknown": { preserved: true } },
    };

    await adapter.saveDocument(document, "demo");
    expect(await adapter.loadDocument()).toEqual(document);
    expect(await adapter.loadArchiveKind()).toBe("demo");
    await adapter.clearDocument();
    expect(await adapter.loadDocument()).toBeNull();
    expect(await adapter.loadArchiveKind()).toBeNull();
  });

  it("stores viewer preferences outside the portable document", async () => {
    const adapter = new BrowserStorageAdapter(`test-${crypto.randomUUID()}`);
    adapters.push(adapter);
    const settings = {
      language: "en" as const,
      appearance: "dark" as const,
      distanceUnit: "kilometers" as const,
      timeFormat: "12-hour" as const,
      powerUserMode: true,
    };

    await adapter.saveSettings(settings);
    expect(await adapter.loadSettings()).toEqual(settings);
    expect(await adapter.loadDocument()).toBeNull();
  });
});
