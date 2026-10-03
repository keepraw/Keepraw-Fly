import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";

const exampleArchive = fileURLToPath(new URL("../examples/basic.keepraw-fly.json", import.meta.url));
const unsavedMessage = "Changes are not saved on this device.";

interface ArchiveSnapshot {
  profile: { name?: { native?: string; romanized?: string; primary?: string } };
  flights: Array<{ id: string; flightNumber: string }>;
}

type SaveOutcome = "pass" | "fail" | "hold";

declare global {
  interface Window {
    documentPersistenceTest: {
      calls: Array<{ document: ArchiveSnapshot; kind: string }>;
      completed: number[];
      clearCalls: number;
      release: (index: number) => void;
    };
    settingsPersistenceTest: {
      calls: Array<{ appearance: string }>;
    };
  }
}

async function storedArchive(page: Page): Promise<ArchiveSnapshot | null> {
  return page.evaluate(async () => {
    // Resolve the same Vite module instance used by App, without a production test hook.
    const modulePath = "/src/storage/browser.ts";
    const { browserStorage } = await import(modulePath);
    return browserStorage.loadDocument();
  });
}

async function importArchive(page: Page) {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(exampleArchive);
  await page.getByRole("button", { name: "Import this archive", exact: true }).click();
  await expect(page.getByRole("button", { name: /Open UA123/ })).toBeVisible();
  await expect.poll(async () => (await storedArchive(page))?.flights[0]?.flightNumber).toBe("UA123");
  await expectSavingFinished(page);
}

async function mockDocumentSaves(page: Page, outcomes: SaveOutcome[], clearOutcomes: Array<"pass" | "fail"> = []) {
  await page.evaluate(async ({ plan, clearPlan }) => {
    const modulePath = "/src/storage/browser.ts";
    const { browserStorage } = await import(modulePath);
    const save = browserStorage.saveDocument.bind(browserStorage);
    const clear = browserStorage.clearDocument.bind(browserStorage);
    const releases = new Map<number, () => void>();
    const state: Window["documentPersistenceTest"] = window.documentPersistenceTest = {
      calls: [],
      completed: [],
      clearCalls: 0,
      release: (index) => {
        const release = releases.get(index);
        if (!release) throw new Error(`No pending document write ${index}`);
        releases.delete(index);
        release();
      },
    };
    browserStorage.saveDocument = async (document: ArchiveSnapshot, kind: string) => {
      const index = state.calls.length;
      state.calls.push({ document: structuredClone(document), kind });
      const outcome = plan[index] ?? "pass";
      if (outcome === "fail") throw new Error("Simulated IndexedDB write failure");
      if (outcome === "hold") {
        await new Promise<void>((resolve) => releases.set(index, resolve));
      }
      await save(document, kind);
      state.completed.push(index);
    };
    browserStorage.clearDocument = async () => {
      const index = state.clearCalls++;
      if (clearPlan[index] === "fail") throw new Error("Simulated IndexedDB deletion failure");
      await clear();
    };
  }, { plan: outcomes, clearPlan: clearOutcomes });
}

async function mockSettingsFailure(page: Page) {
  await page.evaluate(async () => {
    const modulePath = "/src/storage/browser.ts";
    const { browserStorage } = await import(modulePath);
    const save = browserStorage.saveSettings.bind(browserStorage);
    const state: Window["settingsPersistenceTest"] = window.settingsPersistenceTest = { calls: [] };
    browserStorage.saveSettings = async (settings: { appearance: string }) => {
      state.calls.push(structuredClone(settings));
      if (state.calls.length === 1) throw new Error("Simulated IndexedDB preferences failure");
      await save(settings);
    };
  });
}

function unsavedWarning(page: Page) {
  return page.locator(".storage-warning").filter({ hasText: unsavedMessage });
}

async function hasUnloadGuard(page: Page) {
  return page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
}

async function expectSavingFinished(page: Page) {
  await expect(page.locator(".persistence-status")).toHaveText("");
}

async function editFlightNumber(page: Page, flightNumber: string) {
  await page.getByRole("button", { name: "Edit flight", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit flight", exact: true });
  await editor.getByLabel("Flight number").fill(flightNumber);
  await editor.getByRole("button", { name: "Save flight", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.locator(".detail-heading-eyebrow")).toContainText(flightNumber);
}

async function openImportedFlight(page: Page) {
  await page.getByRole("button", { name: /Open UA123/ }).click();
  await expect(page.locator(".detail-heading-eyebrow")).toContainText("UA123");
}

async function openSettings(page: Page) {
  if (await page.locator(".detail-header-back").isVisible()) {
    await page.locator(".detail-header-back").click();
  }
  await page.locator('.site-navigation a[href="#settings"]').click();
  await expect(page.locator(".settings-page")).toBeVisible();
}

test("persists an edited flight and keeps it after reload without an unsaved warning", async ({ page }) => {
  await importArchive(page);
  await openImportedFlight(page);
  await editFlightNumber(page, "UA124");
  await expect.poll(async () => (await storedArchive(page))?.flights[0]?.flightNumber).toBe("UA124");
  await expectSavingFinished(page);
  await expect(page.locator(".storage-warning")).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("button", { name: /Open UA124/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Open UA123/ })).toHaveCount(0);
  await expect(page.locator(".storage-warning")).toHaveCount(0);
});

test("keeps failed flight edits visible and does not let a successful settings write hide them", async ({ page }) => {
  await importArchive(page);
  await openImportedFlight(page);
  await mockDocumentSaves(page, ["fail"]);
  await editFlightNumber(page, "UA124");
  await expect(unsavedWarning(page)).toBeVisible();
  await expect(unsavedWarning(page).getByRole("button", { name: "Try again", exact: true })).toBeEnabled();
  expect((await storedArchive(page))?.flights[0]?.flightNumber).toBe("UA123");

  await openSettings(page);
  await page.getByRole("combobox", { name: "Appearance", exact: true }).selectOption("dark");
  await expect.poll(() => page.evaluate(async () => {
    const modulePath = "/src/storage/browser.ts";
    const { browserStorage } = await import(modulePath);
    return (await browserStorage.loadSettings())?.appearance;
  })).toBe("dark");
  await expect(unsavedWarning(page)).toBeVisible();
  expect(await page.evaluate(() => window.documentPersistenceTest.calls.length)).toBe(1);
});

test("retries the edited document snapshot and persists it without re-editing", async ({ page }) => {
  await importArchive(page);
  await openImportedFlight(page);
  await mockDocumentSaves(page, ["fail", "pass"]);
  await expect.poll(() => hasUnloadGuard(page)).toBe(false);
  await editFlightNumber(page, "UA124");
  await expect(unsavedWarning(page)).toBeVisible();
  await expect.poll(() => hasUnloadGuard(page)).toBe(true);
  await unsavedWarning(page).getByRole("button", { name: "Try again", exact: true }).click();
  await expectSavingFinished(page);
  await expect(unsavedWarning(page)).toHaveCount(0);
  await expect.poll(() => hasUnloadGuard(page)).toBe(false);
  await expect(page.locator(".detail-heading-eyebrow")).toContainText("UA124");
  expect((await storedArchive(page))?.flights.map((flight) => flight.flightNumber)).toEqual(["UA124"]);
  expect(await page.evaluate(() => window.documentPersistenceTest.calls.map((call) => call.document.flights[0]?.flightNumber))).toEqual(["UA124", "UA124"]);

  await page.reload();
  await expect(page.getByRole("button", { name: /Open UA124/ })).toBeVisible();
  await expect(page.locator(".storage-warning")).toHaveCount(0);
});

test("retrying a failed new flight write does not add the flight twice", async ({ page }) => {
  await importArchive(page);
  await openImportedFlight(page);
  await mockDocumentSaves(page, ["fail", "pass"]);
  await page.getByRole("button", { name: "Duplicate as new", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Duplicate flight", exact: true });
  await editor.getByLabel("Flight number").fill("UA124");
  await editor.getByRole("button", { name: "Save flight", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.locator(".detail-heading-eyebrow")).toContainText("UA124");
  await expect(unsavedWarning(page)).toBeVisible();
  await unsavedWarning(page).getByRole("button", { name: "Try again", exact: true }).click();
  await expectSavingFinished(page);
  await expect(unsavedWarning(page)).toHaveCount(0);
  const saved = await storedArchive(page);
  expect(saved?.flights.map((flight) => flight.flightNumber)).toEqual(["UA123", "UA124"]);
  expect(new Set(saved?.flights.map((flight) => flight.id)).size).toBe(2);
  expect(await page.evaluate(() => window.documentPersistenceTest.calls.map((call) => call.document.flights.map((flight) => flight.id)))).toEqual([saved?.flights.map((flight) => flight.id), saved?.flights.map((flight) => flight.id)]);

  await page.reload();
  await expect(page.getByRole("button", { name: /Open UA123/ })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Open UA124/ })).toHaveCount(1);
});

test("retrying a failed deletion saves the remaining document without deleting again", async ({ page }) => {
  await importArchive(page);
  await openImportedFlight(page);
  await mockDocumentSaves(page, ["fail", "pass"]);
  await page.getByRole("button", { name: "Edit flight", exact: true }).click();
  await page.getByRole("dialog", { name: "Edit flight", exact: true }).getByRole("button", { name: "Delete flight", exact: true }).click();
  await page.getByRole("alertdialog", { name: "Delete flight", exact: true }).getByRole("button", { name: "Delete flight", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Edit flight", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Open UA123/ })).toHaveCount(0);
  await expect(unsavedWarning(page)).toBeVisible();
  expect((await storedArchive(page))?.flights).toHaveLength(1);

  await unsavedWarning(page).getByRole("button", { name: "Try again", exact: true }).click();
  await expectSavingFinished(page);
  await expect(unsavedWarning(page)).toHaveCount(0);
  expect((await storedArchive(page))?.flights).toEqual([]);
  expect(await page.evaluate(() => window.documentPersistenceTest.calls.map((call) => call.document.flights.length))).toEqual([0, 0]);
  await page.reload();
  await expect(page.getByRole("button", { name: /Open UA123/ })).toHaveCount(0);
  await expect(page.locator(".storage-warning")).toHaveCount(0);
});

test("serializes two rapid flight edits and leaves both the UI and IndexedDB at the latest version", async ({ page }) => {
  await importArchive(page);
  await openImportedFlight(page);
  await mockDocumentSaves(page, ["hold", "pass"]);
  await editFlightNumber(page, "UA124");
  await expect.poll(() => page.evaluate(() => window.documentPersistenceTest.calls.length)).toBe(1);
  await editFlightNumber(page, "UA125");
  expect(await page.evaluate(() => window.documentPersistenceTest.calls.length)).toBe(1);
  expect((await storedArchive(page))?.flights[0]?.flightNumber).toBe("UA123");
  await expect(page.locator(".persistence-status")).toHaveText("Saving…");
  await expect.poll(() => hasUnloadGuard(page)).toBe(true);

  await page.evaluate(() => window.documentPersistenceTest.release(0));
  await expect.poll(() => page.evaluate(() => window.documentPersistenceTest.completed)).toEqual([0, 1]);
  await expectSavingFinished(page);
  expect(await page.evaluate(() => window.documentPersistenceTest.calls.map((call) => call.document.flights[0]?.flightNumber))).toEqual(["UA124", "UA125"]);
  expect((await storedArchive(page))?.flights[0]?.flightNumber).toBe("UA125");
  await expect(page.locator(".detail-heading-eyebrow")).toContainText("UA125");
  await expect(page.locator(".storage-warning")).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("button", { name: /Open UA125/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Open UA124/ })).toHaveCount(0);
  await expect(page.locator(".storage-warning")).toHaveCount(0);
});

test("an earlier asynchronous flight save does not close the next open editor", async ({ page }) => {
  await importArchive(page);
  await openImportedFlight(page);
  await mockDocumentSaves(page, ["hold", "pass"]);
  await editFlightNumber(page, "UA124");
  await expect.poll(() => page.evaluate(() => window.documentPersistenceTest.calls.length)).toBe(1);
  await page.getByRole("button", { name: "Edit flight", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit flight", exact: true });
  await editor.getByLabel("Flight number").fill("UA125");

  await page.evaluate(() => window.documentPersistenceTest.release(0));
  await expect.poll(() => page.evaluate(() => window.documentPersistenceTest.completed)).toEqual([0]);
  await expect(editor).toBeVisible();
  await expect(editor.getByLabel("Flight number")).toHaveValue("UA125");
  await editor.getByRole("button", { name: "Save flight", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect.poll(async () => (await storedArchive(page))?.flights[0]?.flightNumber).toBe("UA125");
  await expectSavingFinished(page);
  await expect(page.locator(".storage-warning")).toHaveCount(0);
});

test("failed settings remain visible and Retry persists the current settings snapshot", async ({ page }) => {
  await importArchive(page);
  await openSettings(page);
  await mockSettingsFailure(page);
  const appearance = page.getByRole("combobox", { name: "Appearance", exact: true });
  await appearance.selectOption("dark");
  await expect(appearance).toHaveValue("dark");
  const warning = page.locator(".storage-warning").filter({ hasText: "Settings are not saved on this device." });
  await expect(warning).toBeVisible();
  await warning.getByRole("button", { name: "Try again", exact: true }).click();
  await expectSavingFinished(page);
  await expect(warning).toHaveCount(0);
  expect(await page.evaluate(() => window.settingsPersistenceTest.calls.map((settings) => settings.appearance))).toEqual(["dark", "dark"]);

  await page.reload();
  await expect(appearance).toHaveValue("dark");
  await expect(page.locator(".storage-warning")).toHaveCount(0);
});

test("an older successful profile write cannot hide a newer failure and Retry saves the latest profile", async ({ page }) => {
  await importArchive(page);
  await openSettings(page);
  await mockDocumentSaves(page, ["hold", "fail", "pass"]);
  const nativeName = page.getByLabel("Native name", { exact: true });
  await nativeName.fill("Profile A");
  await expect.poll(() => page.evaluate(() => window.documentPersistenceTest.calls.length)).toBe(1);
  await nativeName.fill("Profile B");
  await expect(nativeName).toHaveValue("Profile B");
  expect(await page.evaluate(() => window.documentPersistenceTest.calls.length)).toBe(1);

  await page.evaluate(() => window.documentPersistenceTest.release(0));
  await expect(unsavedWarning(page)).toBeVisible();
  expect((await storedArchive(page))?.profile.name?.native).toBe("Profile A");
  expect(await page.evaluate(() => window.documentPersistenceTest.calls.map((call) => call.document.profile.name?.native))).toEqual(["Profile A", "Profile B"]);
  await expect(nativeName).toHaveValue("Profile B");

  await unsavedWarning(page).getByRole("button", { name: "Try again", exact: true }).click();
  await expectSavingFinished(page);
  await expect(unsavedWarning(page)).toHaveCount(0);
  expect((await storedArchive(page))?.profile.name?.native).toBe("Profile B");
  expect(await page.evaluate(() => window.documentPersistenceTest.calls.map((call) => call.document.profile.name?.native))).toEqual(["Profile A", "Profile B", "Profile B"]);
  await page.reload();
  await expect(nativeName).toHaveValue("Profile B");
  await expect(page.locator(".storage-warning")).toHaveCount(0);
});

test("clearing an archive is ordered after a pending save and cannot revive its data", async ({ page }) => {
  await importArchive(page);
  await openSettings(page);
  await mockDocumentSaves(page, ["hold"]);
  await page.getByLabel("Native name", { exact: true }).fill("Pending profile");
  await expect.poll(() => page.evaluate(() => window.documentPersistenceTest.calls.length)).toBe(1);
  await page.locator(".settings-danger-zone").getByRole("button", { name: "Clear local data", exact: true }).click();
  await page.getByRole("alertdialog", { name: "Clear local data", exact: true }).getByRole("button", { name: "Clear local data", exact: true }).click();
  expect(await page.evaluate(() => window.documentPersistenceTest.clearCalls)).toBe(0);

  await page.evaluate(() => window.documentPersistenceTest.release(0));
  await expect(page.getByRole("button", { name: "Create my archive", exact: true })).toBeVisible();
  await expect.poll(() => storedArchive(page)).toBeNull();
  await expectSavingFinished(page);
  expect(await page.evaluate(() => window.documentPersistenceTest.clearCalls)).toBe(1);
  await expect(page.locator(".storage-warning")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Create my archive", exact: true })).toBeVisible();
  expect(await storedArchive(page)).toBeNull();
});

test("retries a failed archive clear as a deletion and releases the unsaved exit guard", async ({ page }) => {
  await importArchive(page);
  await openSettings(page);
  await mockDocumentSaves(page, [], ["fail", "pass"]);
  await page.locator(".settings-danger-zone").getByRole("button", { name: "Clear local data", exact: true }).click();
  await page.getByRole("alertdialog", { name: "Clear local data", exact: true }).getByRole("button", { name: "Clear local data", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create my archive", exact: true })).toBeVisible();
  await expect(unsavedWarning(page)).toBeVisible();
  await expect.poll(() => hasUnloadGuard(page)).toBe(true);
  expect((await storedArchive(page))?.flights[0]?.flightNumber).toBe("UA123");

  await unsavedWarning(page).getByRole("button", { name: "Try again", exact: true }).click();
  await expectSavingFinished(page);
  await expect(unsavedWarning(page)).toHaveCount(0);
  await expect.poll(() => hasUnloadGuard(page)).toBe(false);
  expect(await storedArchive(page)).toBeNull();
  expect(await page.evaluate(() => ({ saves: window.documentPersistenceTest.calls.length, clears: window.documentPersistenceTest.clearCalls }))).toEqual({ saves: 0, clears: 2 });
  await page.reload();
  await expect(page.getByRole("button", { name: "Create my archive", exact: true })).toBeVisible();
  expect(await storedArchive(page)).toBeNull();
});
