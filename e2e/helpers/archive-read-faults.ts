import { expect, type Page } from "@playwright/test";
import type { BrowserStorageAdapter } from "../../apps/web/src/storage/browser";

interface ReadFaults {
  fail?: boolean;
  hold?: boolean;
  settingsFail?: boolean;
}

declare global {
  interface Window {
    archiveReadTest: {
      fail: boolean;
      hold: boolean;
      calls: number;
      completed: number;
      failed: number;
      settingsFailures: number;
      writes: number;
      clears: number;
      pending: number[];
      release: (index?: number) => void;
    };
  }
}

// Serialized into the browser entry below. Keep this function self-contained.
function installReadFaults(
  storage: BrowserStorageAdapter,
  { fail = true, hold = false, settingsFail = false }: ReadFaults,
) {
  const read = storage.loadDocument.bind(storage);
  const save = storage.saveDocument.bind(storage);
  const clear = storage.clearDocument.bind(storage);
  const releases = new Map<number, () => void>();
  const state: Window["archiveReadTest"] = (window.archiveReadTest = {
    fail,
    hold,
    calls: 0,
    completed: 0,
    failed: 0,
    settingsFailures: 0,
    writes: 0,
    clears: 0,
    pending: [],
    release: (index) => {
      if (index !== undefined && !releases.has(index))
        throw new Error(`No pending archive read ${index}`);
      if (releases.size === 0) throw new Error("No pending archive reads");
      for (const [key, resolve] of releases) {
        if (index === undefined || key === index) {
          releases.delete(key);
          state.pending = [...releases.keys()];
          resolve();
        }
      }
    },
  });
  storage.loadDocument = async () => {
    const index = state.calls++;
    try {
      if (state.hold)
        await new Promise<void>((resolve) => {
          releases.set(index, resolve);
          state.pending = [...releases.keys()];
        });
      if (state.fail) {
        state.failed++;
        throw new Error("Simulated initial archive read failure");
      }
      return await read();
    } finally {
      state.completed++;
    }
  };
  storage.saveDocument = async (...args) => {
    state.writes++;
    return save(...args);
  };
  storage.clearDocument = async () => {
    state.clears++;
    return clear();
  };
  if (settingsFail)
    storage.loadSettings = async () => {
      state.settingsFailures++;
      throw new Error("Simulated preferences read failure");
    };
}

/** Control the existing adapter, retaining its native IndexedDB implementation. */
export async function controlArchiveReads(page: Page, faults: ReadFaults = {}) {
  await page.route("**/src/main.tsx", async (route) => {
    // A static import of main would evaluate its dependencies before this body.
    // Dynamic import guarantees that the adapter is patched before even loading
    // App/Bootstrap. The query bypasses this exact route, not Vite's transforms.
    // addInitScript alone cannot await an ESM import before the app starts.
    await route.fulfill({
      contentType: "text/javascript",
      body: `
        import { browserStorage } from "/src/storage/browser.ts";
        (${installReadFaults.toString()})(browserStorage, ${JSON.stringify(faults)});
        await import("/src/main.tsx?archive-read-faults");
      `,
    });
  });
}

/** The remaining scope injection must fail clearly if its single anchor moves. */
export function injectLoadingCallbacks(source: string, callbacks: string) {
  const anchor = "if (!loaded) {";
  expect(
    source.split(anchor).length - 1,
    "Archive recovery callback injection requires exactly one App loading branch",
  ).toBe(1);
  return source.replace(anchor, `${callbacks}\n${anchor}`);
}
