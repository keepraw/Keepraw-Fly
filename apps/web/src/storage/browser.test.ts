import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import Dexie from "dexie";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import {
  BrowserStorageAdapter,
  persistentStorageState,
  requestPersistentStorage,
} from "./browser";

const adapters: BrowserStorageAdapter[] = [];
const databases: Dexie[] = [];

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  databases.splice(0).forEach((database) => database.close());
  await Promise.all(
    adapters.splice(0).map((adapter) => adapter.deleteDatabaseForTests()),
  );
});

describe("persistent storage", () => {
  it("reports existing protection without requesting it again", async () => {
    const persist = vi.fn().mockResolvedValue(false);
    vi.stubGlobal("navigator", {
      storage: { persisted: vi.fn().mockResolvedValue(true), persist },
    });

    await expect(persistentStorageState()).resolves.toBe("granted");
    await expect(requestPersistentStorage()).resolves.toBe("granted");
    expect(persist).not.toHaveBeenCalled();
  });

  it.each([
    [true, "granted"],
    [false, "available"],
  ] as const)("maps persist() === %s to %s", async (result, state) => {
    const persist = vi.fn().mockResolvedValue(result);
    vi.stubGlobal("navigator", {
      storage: { persisted: vi.fn().mockResolvedValue(false), persist },
    });

    await expect(persistentStorageState()).resolves.toBe("available");
    expect(persist).not.toHaveBeenCalled();
    await expect(requestPersistentStorage()).resolves.toBe(state);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("requests again after a false result and uses the next result", async () => {
    const persist = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    vi.stubGlobal("navigator", {
      storage: { persisted: vi.fn().mockResolvedValue(false), persist },
    });

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
  ])(
    "reports unsupported when the required APIs are missing: %j",
    async (navigatorValue) => {
      vi.stubGlobal("navigator", navigatorValue);
      await expect(persistentStorageState()).resolves.toBe("unsupported");
      await expect(requestPersistentStorage()).resolves.toBe("unsupported");
    },
  );

  it("can recognize existing protection when only persisted() is available", async () => {
    vi.stubGlobal("navigator", { storage: { persisted: async () => true } });
    await expect(persistentStorageState()).resolves.toBe("granted");
    await expect(requestPersistentStorage()).resolves.toBe("granted");
  });

  it("reports failed when reading protection throws", async () => {
    const persist = vi.fn();
    vi.stubGlobal("navigator", {
      storage: {
        persisted: vi.fn().mockRejectedValue(new Error("Storage unavailable")),
        persist,
      },
    });
    await expect(persistentStorageState()).resolves.toBe("failed");
    await expect(requestPersistentStorage()).resolves.toBe("failed");
    expect(persist).not.toHaveBeenCalled();
  });

  it("reports failed when requesting throws and permits a later retry", async () => {
    const persist = vi
      .fn()
      .mockRejectedValueOnce(new Error("Request failed"))
      .mockResolvedValueOnce(true);
    vi.stubGlobal("navigator", {
      storage: { persisted: async () => false, persist },
    });
    await expect(requestPersistentStorage()).resolves.toBe("failed");
    await expect(requestPersistentStorage()).resolves.toBe("granted");
    expect(persist).toHaveBeenCalledTimes(2);
  });

  it("reports failed if accessing the storage manager throws", async () => {
    vi.stubGlobal("navigator", {
      get storage() {
        throw new Error("Storage blocked");
      },
    });
    await expect(persistentStorageState()).resolves.toBe("failed");
    await expect(requestPersistentStorage()).resolves.toBe("failed");
  });
});

describe("BrowserStorageAdapter", () => {
  async function storedArchive(document: unknown, kind?: "personal" | "demo") {
    const name = `test-${crypto.randomUUID()}`;
    const adapter = new BrowserStorageAdapter(name);
    adapters.push(adapter);
    const database = new Dexie(name);
    database
      .version(1)
      .stores({ documents: "&key, updatedAt", preferences: "&key" });
    databases.push(database);
    const record = {
      key: "active",
      document,
      ...(kind ? { kind } : {}),
      updatedAt: "2026-10-01T12:00:00.000Z",
    };
    await database.table("documents").put(record);
    return {
      adapter,
      record,
      readRecord: () => database.table("documents").get("active"),
    };
  }

  it("distinguishes an empty database from an unreadable archive", async () => {
    const adapter = new BrowserStorageAdapter(`test-${crypto.randomUUID()}`);
    adapters.push(adapter);
    await expect(adapter.loadDocument()).resolves.toEqual({ status: "empty" });
  });

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
    expect(await adapter.loadDocument()).toEqual({
      status: "valid",
      document,
      kind: "demo",
      updatedAt: expect.any(String),
    });
    expect(await adapter.loadArchiveKind()).toBe("demo");
    await adapter.clearDocument();
    expect(await adapter.loadDocument()).toEqual({ status: "empty" });
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
    expect(await adapter.loadDocument()).toEqual({ status: "empty" });
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
      status: "valid",
      document: { format: "keepraw-fly", formatVersion: "0.1.0" },
    });
  });

  it("retains raw invalid data and metadata across repeated recovery reads", async () => {
    const raw = {
      format: "keepraw-fly",
      formatVersion: "0.1.0",
      profile: {},
      flights: [{ broken: true }],
      unknown: { preserved: true },
    };
    const { adapter, record, readRecord } = await storedArchive(raw, "demo");
    const save = vi.spyOn(adapter, "saveDocument");

    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await adapter.loadDocument();
      expect(result).toMatchObject({
        status: "invalid",
        rawDocument: raw,
        kind: "demo",
        updatedAt: record.updatedAt,
        issues: expect.any(Array),
      });
      if (result.status !== "invalid")
        throw new Error("Expected recovery data");
      expect(result.issues.length).toBeGreaterThan(0);
      expect(JSON.parse(JSON.stringify(result.rawDocument))).toEqual(raw);
    }
    expect(save).not.toHaveBeenCalled();
    expect(await readRecord()).toEqual(record);
  });

  it.each(["99.0.0", "experimental"])(
    "retains unsupported format version %s without migrating",
    async (formatVersion) => {
      const raw = {
        format: "keepraw-fly",
        formatVersion,
        profile: {},
        flights: [],
        extensions: { "example.future": { extra: true } },
      };
      const { adapter, record, readRecord } = await storedArchive(raw);
      const save = vi.spyOn(adapter, "saveDocument");

      await expect(adapter.loadDocument()).resolves.toEqual({
        status: "unsupported-version",
        rawDocument: raw,
        kind: "personal",
        updatedAt: record.updatedAt,
        formatVersion,
      });
      expect(save).not.toHaveBeenCalled();
      expect(await readRecord()).toEqual(record);
    },
  );

  it("only writes a migration after its output passes validation", async () => {
    const raw = {
      format: "rawfly",
      formatVersion: "0.1",
      profile: {},
      flights: [],
      extensions: { "example.unknown": { preserved: true } },
    };
    const { adapter, readRecord } = await storedArchive(raw, "demo");
    const save = vi.spyOn(adapter, "saveDocument");
    const canonical = { ...raw, format: "keepraw-fly", formatVersion: "0.1.0" };

    await expect(adapter.loadDocument()).resolves.toMatchObject({
      status: "valid",
      document: canonical,
      kind: "demo",
    });
    expect(save).toHaveBeenCalledExactlyOnceWith(canonical, "demo");
    expect((await readRecord()).document).toEqual(canonical);
    await expect(adapter.loadDocument()).resolves.toMatchObject({
      status: "valid",
      document: canonical,
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(raw.format).toBe("rawfly");
  });

  it("keeps the original archive when post-migration validation fails", async () => {
    const raw = {
      format: "rawfly",
      formatVersion: "0.1",
      profile: {},
      flights: [{ broken: true }],
    };
    const { adapter, record, readRecord } = await storedArchive(raw);
    const save = vi.spyOn(adapter, "saveDocument");

    await expect(adapter.loadDocument()).resolves.toMatchObject({
      status: "invalid",
      rawDocument: raw,
    });
    expect(save).not.toHaveBeenCalled();
    expect(await readRecord()).toEqual(record);
  });

  it("keeps a legacy archive in recovery when the validated migration cannot be saved", async () => {
    const raw = {
      format: "rawfly",
      formatVersion: "0.1",
      profile: {},
      flights: [],
    };
    const { adapter, record, readRecord } = await storedArchive(raw);
    const save = vi
      .spyOn(adapter, "saveDocument")
      .mockRejectedValueOnce(new Error("IndexedDB write unavailable"));

    await expect(adapter.loadDocument()).resolves.toMatchObject({
      status: "invalid",
      rawDocument: raw,
      issues: [{ keyword: "migration" }],
    });
    expect(save).toHaveBeenCalledOnce();
    expect(await readRecord()).toEqual(record);
    await expect(adapter.loadDocument()).resolves.toMatchObject({
      status: "valid",
      document: { format: "keepraw-fly", formatVersion: "0.1.0" },
    });
  });

  it("keeps the original archive when migration throws", async () => {
    const raw = {
      format: "rawfly",
      formatVersion: "0.1",
      profile: {},
      flights: [],
    };
    const { adapter, record, readRecord } = await storedArchive(raw);
    const clone = globalThis.structuredClone;
    const cloneFailure = vi
      .spyOn(globalThis, "structuredClone")
      .mockImplementation((value) => {
        if (
          value &&
          typeof value === "object" &&
          "format" in value &&
          value.format === "rawfly"
        )
          throw new Error("Migration unavailable");
        return clone(value);
      });
    const save = vi.spyOn(adapter, "saveDocument");

    await expect(adapter.loadDocument()).resolves.toMatchObject({
      status: "invalid",
      rawDocument: raw,
      issues: [{ keyword: "migration" }],
    });
    expect(save).not.toHaveBeenCalled();
    cloneFailure.mockRestore();
    expect(await readRecord()).toEqual(record);
  });

  it("lets actual IndexedDB read failures reach storage error handling", async () => {
    const { adapter } = await storedArchive({
      format: "keepraw-fly",
      formatVersion: "0.1.0",
      profile: {},
      flights: [],
    });
    vi.spyOn(IDBObjectStore.prototype, "get").mockImplementationOnce(() => {
      throw new DOMException("Storage unavailable", "UnknownError");
    });
    await expect(adapter.loadDocument()).rejects.toThrow("Storage unavailable");
  });
});
