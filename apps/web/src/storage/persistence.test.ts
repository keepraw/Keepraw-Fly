import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import { BrowserStorageAdapter } from "./browser";
import { createPersistenceQueue, type PersistenceState } from "./persistence";

const adapters: BrowserStorageAdapter[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(adapters.splice(0).map((adapter) => adapter.deleteDatabaseForTests()));
});

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function observeStates() {
  return vi.fn<(state: PersistenceState) => void>();
}

function documentWithFlight(flightNumber: string): KeeprawFlyDocument {
  return {
    format: "keepraw-fly",
    formatVersion: "0.1.0",
    profile: {},
    flights: [{
      id: "edited-flight",
      flightNumber,
      serviceDate: "2026-08-21",
      airline: { iata: "MU" },
      origin: { iata: "PVG" },
      destination: { iata: "SFO" },
      scheduledDeparture: "2026-08-21T13:00:00+08:00",
      scheduledArrival: "2026-08-21T09:00:00-07:00",
    }],
  };
}

describe("document persistence queue", () => {
  it("starts idle and ignores retry when there is no failed snapshot", async () => {
    const write = vi.fn<(snapshot: string) => Promise<void>>();
    const onStateChange = observeStates();
    const queue = createPersistenceQueue(write, onStateChange);

    expect(onStateChange).not.toHaveBeenCalled();
    await expect(queue.retry()).resolves.toBe(false);
    expect(write).not.toHaveBeenCalled();
    expect(onStateChange).not.toHaveBeenCalled();
  });

  it("enters saving immediately and reports saved only after the write succeeds", async () => {
    const completion = deferred();
    const started = deferred();
    const onStateChange = observeStates();
    const write = vi.fn(async (snapshot: string) => {
      expect(snapshot).toBe("A");
      started.resolve();
      await completion.promise;
    });
    const queue = createPersistenceQueue(write, onStateChange);

    const saved = queue.save("A");
    expect(onStateChange.mock.calls).toEqual([[{ status: "saving" }]]);
    await started.promise;
    expect(onStateChange).toHaveBeenCalledTimes(1);
    completion.resolve();

    await expect(saved).resolves.toBe(true);
    const state = onStateChange.mock.lastCall?.[0];
    expect(state).toMatchObject({ status: "saved", savedAt: expect.any(String) });
    if (state?.status !== "saved") throw new Error("Expected the successful write to be saved");
    expect(new Date(state.savedAt).toISOString()).toBe(state.savedAt);
    await expect(queue.retry()).resolves.toBe(false);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it.each(["rejection", "synchronous throw"])("reports an unsaved error after a write %s", async (failure) => {
    const write = vi.fn((_: string): Promise<void> => {
      if (failure === "synchronous throw") throw new Error("Storage unavailable");
      return Promise.reject(new Error("Storage unavailable"));
    });
    const onStateChange = observeStates();
    const queue = createPersistenceQueue(write, onStateChange);

    await expect(queue.save("edited snapshot")).resolves.toBe(false);
    expect(onStateChange.mock.calls).toEqual([
      [{ status: "saving" }],
      [{ status: "error", error: "storage" }],
    ]);
  });

  it("serializes A and B and keeps B saving when A completes", async () => {
    const first = deferred();
    const second = deferred();
    const firstStarted = deferred();
    const secondStarted = deferred();
    let persisted: string | null = null;
    const write = vi.fn(async (snapshot: string) => {
      if (snapshot === "A") {
        firstStarted.resolve();
        await first.promise;
      } else {
        secondStarted.resolve();
        await second.promise;
      }
      persisted = snapshot;
    });
    const onStateChange = observeStates();
    const queue = createPersistenceQueue(write, onStateChange);

    const savedA = queue.save("A");
    await firstStarted.promise;
    const savedB = queue.save("B");
    expect(write).toHaveBeenCalledTimes(1);
    expect(onStateChange.mock.lastCall?.[0]).toEqual({ status: "saving" });
    first.resolve();
    await expect(savedA).resolves.toBe(true);
    await secondStarted.promise;
    expect(persisted).toBe("A");
    expect(onStateChange.mock.calls).toEqual([[{ status: "saving" }], [{ status: "saving" }]]);

    second.resolve();
    await expect(savedB).resolves.toBe(true);
    expect(persisted).toBe("B");
    expect(write.mock.calls.map(([snapshot]) => snapshot)).toEqual(["A", "B"]);
    expect(onStateChange.mock.lastCall?.[0].status).toBe("saved");
  });

  it("does not report A saved when the latest B subsequently fails, and retries B", async () => {
    const first = deferred();
    const second = deferred();
    const secondStarted = deferred();
    const onStateChange = observeStates();
    const write = vi.fn<(snapshot: string) => Promise<void>>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => {
        secondStarted.resolve();
        return second.promise;
      })
      .mockResolvedValueOnce(undefined);
    const queue = createPersistenceQueue(write, onStateChange);

    const savedA = queue.save("A");
    const savedB = queue.save("B");
    first.resolve();
    await expect(savedA).resolves.toBe(true);
    await secondStarted.promise;
    second.reject(new Error("B could not be saved"));
    await expect(savedB).resolves.toBe(false);

    expect(onStateChange.mock.calls).toEqual([
      [{ status: "saving" }],
      [{ status: "saving" }],
      [{ status: "error", error: "storage" }],
    ]);
    await expect(queue.retry()).resolves.toBe(true);
    expect(write.mock.calls.map(([snapshot]) => snapshot)).toEqual(["A", "B", "B"]);
    expect(onStateChange.mock.lastCall?.[0].status).toBe("saved");
  });

  it("continues after A fails and does not replace B saving with A's error", async () => {
    const first = deferred();
    const second = deferred();
    const secondStarted = deferred();
    const write = vi.fn<(snapshot: string) => Promise<void>>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => {
        secondStarted.resolve();
        return second.promise;
      });
    const onStateChange = observeStates();
    const queue = createPersistenceQueue(write, onStateChange);

    const savedA = queue.save("A");
    const savedB = queue.save("B");
    first.reject(new Error("A failed"));
    await expect(savedA).resolves.toBe(false);
    await secondStarted.promise;
    expect(onStateChange.mock.calls).toEqual([[{ status: "saving" }], [{ status: "saving" }]]);
    second.resolve();

    await expect(savedB).resolves.toBe(true);
    expect(onStateChange.mock.lastCall?.[0].status).toBe("saved");
    expect(write.mock.calls.map(([snapshot]) => snapshot)).toEqual(["A", "B"]);
  });

  it("accepts only one retry while its write is pending", async () => {
    const completion = deferred();
    const started = deferred();
    const write = vi.fn<(snapshot: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error("Initial failure"))
      .mockImplementationOnce(() => {
        started.resolve();
        return completion.promise;
      });
    const onStateChange = observeStates();
    const queue = createPersistenceQueue(write, onStateChange);

    await expect(queue.save("latest snapshot")).resolves.toBe(false);
    const retry = queue.retry();
    expect(onStateChange.mock.lastCall?.[0]).toEqual({ status: "saving" });
    await expect(queue.retry()).resolves.toBe(false);
    await started.promise;
    expect(write).toHaveBeenCalledTimes(2);
    completion.resolve();
    await expect(retry).resolves.toBe(true);
    expect(write.mock.calls).toEqual([["latest snapshot"], ["latest snapshot"]]);
  });

  it("ignores retry during an ordinary save", async () => {
    const completion = deferred();
    const write = vi.fn((_: string) => completion.promise);
    const queue = createPersistenceQueue(write, observeStates());

    const saved = queue.save("A");
    await expect(queue.retry()).resolves.toBe(false);
    completion.resolve();
    await expect(saved).resolves.toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("can retry again after a retry fails", async () => {
    const write = vi.fn<(snapshot: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error("First failure"))
      .mockRejectedValueOnce(new Error("Retry failure"))
      .mockResolvedValueOnce(undefined);
    const onStateChange = observeStates();
    const queue = createPersistenceQueue(write, onStateChange);

    await expect(queue.save("B")).resolves.toBe(false);
    await expect(queue.retry()).resolves.toBe(false);
    expect(onStateChange.mock.lastCall?.[0]).toEqual({ status: "error", error: "storage" });
    await expect(queue.retry()).resolves.toBe(true);
    expect(write.mock.calls).toEqual([["B"], ["B"], ["B"]]);
    expect(onStateChange.mock.lastCall?.[0].status).toBe("saved");
  });

  it("keeps a newer edit authoritative when it is queued during retry", async () => {
    const retryCompletion = deferred();
    const retryStarted = deferred();
    const newestCompletion = deferred();
    const newestStarted = deferred();
    const write = vi.fn<(snapshot: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error("A failed"))
      .mockImplementationOnce(() => {
        retryStarted.resolve();
        return retryCompletion.promise;
      })
      .mockImplementationOnce(() => {
        newestStarted.resolve();
        return newestCompletion.promise;
      })
      .mockResolvedValueOnce(undefined);
    const onStateChange = observeStates();
    const queue = createPersistenceQueue(write, onStateChange);

    await queue.save("A");
    const retriedA = queue.retry();
    await retryStarted.promise;
    const savedB = queue.save("B");
    retryCompletion.resolve();
    await expect(retriedA).resolves.toBe(true);
    await newestStarted.promise;
    expect(onStateChange.mock.lastCall?.[0]).toEqual({ status: "saving" });
    expect(onStateChange.mock.calls.some(([state]) => state.status === "saved")).toBe(false);
    newestCompletion.reject(new Error("B failed"));
    await expect(savedB).resolves.toBe(false);
    await expect(queue.retry()).resolves.toBe(true);
    expect(write.mock.calls).toEqual([["A"], ["A"], ["B"], ["B"]]);
  });

  it("does not let successful settings persistence clear a document error", async () => {
    const documentStates = observeStates();
    const settingsStates = observeStates();
    const documents = createPersistenceQueue(
      vi.fn<(snapshot: string) => Promise<void>>().mockRejectedValue(new Error("Document failure")),
      documentStates,
    );
    const settings = createPersistenceQueue(
      vi.fn<(snapshot: string) => Promise<void>>().mockResolvedValue(undefined),
      settingsStates,
    );

    await documents.save("unsaved document");
    await settings.save("new preferences");
    expect(documentStates.mock.lastCall?.[0]).toEqual({ status: "error", error: "storage" });
    expect(documentStates).toHaveBeenCalledTimes(2);
    expect(settingsStates.mock.lastCall?.[0].status).toBe("saved");
  });
});

describe("persistence queue with IndexedDB", () => {
  it("keeps failed changes available for retry while IndexedDB retains the previous document", async () => {
    const adapter = new BrowserStorageAdapter(`persistence-${crypto.randomUUID()}`);
    adapters.push(adapter);
    const original = documentWithFlight("MU589");
    const edited = documentWithFlight("MU590");
    const onStateChange = observeStates();
    const write = vi.fn((snapshot: KeeprawFlyDocument) => adapter.saveDocument(snapshot, "personal"));
    const queue = createPersistenceQueue(write, onStateChange);

    await expect(queue.save(original)).resolves.toBe(true);
    const failedPut = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementationOnce(() => {
      throw new DOMException("The device is out of storage", "QuotaExceededError");
    });
    await expect(queue.save(edited)).resolves.toBe(false);
    expect(onStateChange.mock.lastCall?.[0]).toEqual({ status: "error", error: "storage" });
    expect(await adapter.loadDocument()).toMatchObject({ status: "valid", document: original });
    expect(edited.flights).toHaveLength(1);
    expect(edited.flights[0]?.flightNumber).toBe("MU590");
    failedPut.mockRestore();

    await expect(queue.retry()).resolves.toBe(true);
    expect(await adapter.loadDocument()).toMatchObject({ status: "valid", document: edited });
    expect(await adapter.loadArchiveKind()).toBe("personal");
    expect(write.mock.calls).toEqual([[original], [edited], [edited]]);
    const loaded = await adapter.loadDocument();
    if (loaded.status !== "valid") throw new Error("Expected the saved archive to be valid");
    expect(loaded.document.flights).toHaveLength(1);
    expect(onStateChange.mock.lastCall?.[0].status).toBe("saved");
  });

  it("serializes a clear after an older save so that the older document cannot reappear", async () => {
    const adapter = new BrowserStorageAdapter(`persistence-${crypto.randomUUID()}`);
    adapters.push(adapter);
    const completion = deferred();
    const started = deferred();
    const snapshot = documentWithFlight("MU589");
    const onStateChange = observeStates();
    const write = vi.fn(async (document: KeeprawFlyDocument | null) => {
      if (document) {
        started.resolve();
        await completion.promise;
        await adapter.saveDocument(document, "demo");
      } else {
        await adapter.clearDocument();
      }
    });
    const queue = createPersistenceQueue(write, onStateChange);

    const saved = queue.save(snapshot);
    await started.promise;
    const cleared = queue.save(null);
    expect(write).toHaveBeenCalledTimes(1);
    completion.resolve();
    await expect(saved).resolves.toBe(true);
    await expect(cleared).resolves.toBe(true);

    expect(write.mock.calls).toEqual([[snapshot], [null]]);
    expect(await adapter.loadDocument()).toEqual({ status: "empty" });
    expect(await adapter.loadArchiveKind()).toBeNull();
    expect(onStateChange.mock.calls.map(([state]) => state.status)).toEqual(["saving", "saving", "saved"]);
  });

  it("can retry a failed clear without restoring a previous snapshot", async () => {
    const adapter = new BrowserStorageAdapter(`persistence-${crypto.randomUUID()}`);
    adapters.push(adapter);
    const original = documentWithFlight("MU589");
    await adapter.saveDocument(original, "demo");
    const onStateChange = observeStates();
    const write = vi.fn<(snapshot: KeeprawFlyDocument | null) => Promise<void>>()
      .mockRejectedValueOnce(new Error("Clear failed"))
      .mockImplementation((snapshot) => snapshot ? adapter.saveDocument(snapshot) : adapter.clearDocument());
    const queue = createPersistenceQueue(write, onStateChange);

    await expect(queue.save(null)).resolves.toBe(false);
    expect(await adapter.loadDocument()).toMatchObject({ status: "valid", document: original });
    await expect(queue.retry()).resolves.toBe(true);
    expect(write.mock.calls).toEqual([[null], [null]]);
    expect(await adapter.loadDocument()).toEqual({ status: "empty" });
    expect(await adapter.loadArchiveKind()).toBeNull();
    expect(onStateChange.mock.lastCall?.[0].status).toBe("saved");
  });
});
