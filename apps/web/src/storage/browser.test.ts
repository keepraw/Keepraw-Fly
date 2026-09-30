import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import { BrowserStorageAdapter, persistentStorageState, requestPersistentStorage } from "./browser";

const adapters: BrowserStorageAdapter[] = [];

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(adapters.splice(0).map((adapter) => adapter.deleteDatabaseForTests()));
});

describe("persistent storage", () => {
  it("reports existing protection without requesting it again", async () => {
    const persist = vi.fn().mockResolvedValue(false);
    vi.stubGlobal("navigator", { storage: { persisted: vi.fn().mockResolvedValue(true), persist } });

    await expect(persistentStorageState()).resolves.toBe("granted");
    await expect(requestPersistentStorage()).resolves.toBe("granted");
    expect(persist).not.toHaveBeenCalled();
  });

  it.each([
    [true, "granted"],
    [false, "available"],
  ] as const)("maps persist() === %s to %s", async (result, state) => {
    const persist = vi.fn().mockResolvedValue(result);
    vi.stubGlobal("navigator", { storage: { persisted: vi.fn().mockResolvedValue(false), persist } });

    await expect(persistentStorageState()).resolves.toBe("available");
    expect(persist).not.toHaveBeenCalled();
    await expect(requestPersistentStorage()).resolves.toBe(state);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("requests again after a false result and uses the next result", async () => {
    const persist = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.stubGlobal("navigator", { storage: { persisted: vi.fn().mockResolvedValue(false), persist } });

    await expect(requestPersistentStorage()).resolves.toBe("available");
    await expect(requestPersistentStorage()).resolves.toBe("granted");
    expect(persist).toHaveBeenCalledTimes(2);
  });

  it.each([
    undefined,
    {},
    { storage: {} },
    { storage: { persisted: false } },
    { storage: { persisted: async () => false } },
    { storage: { persist: async () => true } },
  ])("reports unsupported when the required APIs are missing: %j", async (navigatorValue) => {
    vi.stubGlobal("navigator", navigatorValue);
    await expect(persistentStorageState()).resolves.toBe("unsupported");
    await expect(requestPersistentStorage()).resolves.toBe("unsupported");
  });

  it("can recognize existing protection when only persisted() is available", async () => {
    vi.stubGlobal("navigator", { storage: { persisted: async () => true } });
    await expect(persistentStorageState()).resolves.toBe("granted");
    await expect(requestPersistentStorage()).resolves.toBe("granted");
  });

  it("reports failed when reading protection throws", async () => {
    const persist = vi.fn();
    vi.stubGlobal("navigator", { storage: {
      persisted: vi.fn().mockRejectedValue(new Error("Storage unavailable")), persist,
    } });
    await expect(persistentStorageState()).resolves.toBe("failed");
    await expect(requestPersistentStorage()).resolves.toBe("failed");
    expect(persist).not.toHaveBeenCalled();
  });

  it("reports failed when requesting throws and permits a later retry", async () => {
    const persist = vi.fn().mockRejectedValueOnce(new Error("Request failed")).mockResolvedValueOnce(true);
    vi.stubGlobal("navigator", { storage: { persisted: async () => false, persist } });
    await expect(requestPersistentStorage()).resolves.toBe("failed");
    await expect(requestPersistentStorage()).resolves.toBe("granted");
    expect(persist).toHaveBeenCalledTimes(2);
  });

  it("reports failed if accessing the storage manager throws", async () => {
    vi.stubGlobal("navigator", { get storage() { throw new Error("Storage blocked"); } });
    await expect(persistentStorageState()).resolves.toBe("failed");
    await expect(requestPersistentStorage()).resolves.toBe("failed");
  });
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

  it("upgrades a legacy RawFly archive when it is loaded", async () => {
    const adapter = new BrowserStorageAdapter(`test-${crypto.randomUUID()}`);
    adapters.push(adapter);
    await adapter.saveDocument({
      format: "rawfly",
      formatVersion: "0.1",
      profile: {},
      flights: [],
    } as unknown as KeeprawFlyDocument);

    await expect(adapter.loadDocument()).resolves.toMatchObject({
      format: "keepraw-fly",
      formatVersion: "0.1.0",
    });
  });
});
