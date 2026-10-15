import { openSettingsCategory } from "./helpers/settings";
import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import type { KeeprawFlight, KeeprawFlyDocument } from "@keepraw-fly/schema";

const exampleArchive = fileURLToPath(
  new URL("../examples/basic.keepraw-fly.json", import.meta.url),
);
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
    const result = await browserStorage.loadDocument();
    return result.status === "valid" ? result.document : null;
  });
}

async function importArchive(page: Page) {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(exampleArchive);
  await page
    .getByRole("button", { name: "Import this archive", exact: true })
    .click();
  await expect(page.getByRole("button", { name: /Open UA123/ })).toBeVisible();
  await expect
    .poll(async () => (await storedArchive(page))?.flights[0]?.flightNumber)
    .toBe("UA123");
  await expectSavingFinished(page);
}

async function mockDocumentSaves(
  page: Page,
  outcomes: SaveOutcome[],
  clearOutcomes: Array<"pass" | "fail"> = [],
) {
  await page.evaluate(
    async ({ plan, clearPlan }) => {
      const modulePath = "/src/storage/browser.ts";
      const { browserStorage } = await import(modulePath);
      const save = browserStorage.saveDocument.bind(browserStorage);
      const clear = browserStorage.clearDocument.bind(browserStorage);
      const releases = new Map<number, () => void>();
      const state: Window["documentPersistenceTest"] =
        (window.documentPersistenceTest = {
          calls: [],
          completed: [],
          clearCalls: 0,
          release: (index) => {
            const release = releases.get(index);
            if (!release) throw new Error(`No pending document write ${index}`);
            releases.delete(index);
            release();
          },
        });
      browserStorage.saveDocument = async (
        document: ArchiveSnapshot,
        kind: string,
      ) => {
        const index = state.calls.length;
        state.calls.push({ document: structuredClone(document), kind });
        const outcome = plan[index] ?? "pass";
        if (outcome === "fail")
          throw new Error("Simulated IndexedDB write failure");
        if (outcome === "hold") {
          await new Promise<void>((resolve) => releases.set(index, resolve));
        }
        await save(document, kind);
        state.completed.push(index);
      };
      browserStorage.clearDocument = async () => {
        const index = state.clearCalls++;
        if (clearPlan[index] === "fail")
          throw new Error("Simulated IndexedDB deletion failure");
        await clear();
      };
    },
    { plan: outcomes, clearPlan: clearOutcomes },
  );
}

async function mockSettingsFailure(page: Page) {
  await page.evaluate(async () => {
    const modulePath = "/src/storage/browser.ts";
    const { browserStorage } = await import(modulePath);
    const save = browserStorage.saveSettings.bind(browserStorage);
    const state: Window["settingsPersistenceTest"] =
      (window.settingsPersistenceTest = { calls: [] });
    browserStorage.saveSettings = async (settings: { appearance: string }) => {
      state.calls.push(structuredClone(settings));
      if (state.calls.length === 1)
        throw new Error("Simulated IndexedDB preferences failure");
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
  await editor
    .getByRole("button", { name: "Save flight", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await expect(page.locator(".detail-heading-eyebrow")).toContainText(
    flightNumber,
  );
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

// Real IndexedDB round-trip; mocked failures/queue ordering stay in Chromium.
test(
  "persists an edited flight and keeps it after reload without an unsaved warning",
  { tag: "@cross-browser" },
  async ({ page }) => {
    await importArchive(page);
    await openImportedFlight(page);
    await editFlightNumber(page, "UA124");
    await expect
      .poll(async () => (await storedArchive(page))?.flights[0]?.flightNumber)
      .toBe("UA124");
    await expectSavingFinished(page);
    await expect(page.locator(".storage-warning")).toHaveCount(0);

    await page.reload();
    await expect(
      page.getByRole("button", { name: /Open UA124/ }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Open UA123/ })).toHaveCount(
      0,
    );
    await expect(page.locator(".storage-warning")).toHaveCount(0);
  },
);

test("keeps failed flight edits visible and does not let a successful settings write hide them", async ({
  page,
}) => {
  await importArchive(page);
  await openImportedFlight(page);
  await mockDocumentSaves(page, ["fail"]);
  await editFlightNumber(page, "UA124");
  await expect(unsavedWarning(page)).toBeVisible();
  await expect(
    unsavedWarning(page).getByRole("button", {
      name: "Try again",
      exact: true,
    }),
  ).toBeEnabled();
  expect((await storedArchive(page))?.flights[0]?.flightNumber).toBe("UA123");

  await openSettings(page);
  await page
    .getByRole("combobox", { name: "Appearance", exact: true })
    .selectOption("dark");
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const modulePath = "/src/storage/browser.ts";
        const { browserStorage } = await import(modulePath);
        return (await browserStorage.loadSettings())?.appearance;
      }),
    )
    .toBe("dark");
  await expect(unsavedWarning(page)).toBeVisible();
  expect(
    await page.evaluate(() => window.documentPersistenceTest.calls.length),
  ).toBe(1);
});

test("retries the edited document snapshot and persists it without re-editing", async ({
  page,
}) => {
  await importArchive(page);
  await openImportedFlight(page);
  await mockDocumentSaves(page, ["fail", "pass"]);
  await expect.poll(() => hasUnloadGuard(page)).toBe(false);
  await editFlightNumber(page, "UA124");
  await expect(unsavedWarning(page)).toBeVisible();
  await expect.poll(() => hasUnloadGuard(page)).toBe(true);
  await unsavedWarning(page)
    .getByRole("button", { name: "Try again", exact: true })
    .click();
  await expectSavingFinished(page);
  await expect(unsavedWarning(page)).toHaveCount(0);
  await expect.poll(() => hasUnloadGuard(page)).toBe(false);
  await expect(page.locator(".detail-heading-eyebrow")).toContainText("UA124");
  expect(
    (await storedArchive(page))?.flights.map((flight) => flight.flightNumber),
  ).toEqual(["UA124"]);
  expect(
    await page.evaluate(() =>
      window.documentPersistenceTest.calls.map(
        (call) => call.document.flights[0]?.flightNumber,
      ),
    ),
  ).toEqual(["UA124", "UA124"]);

  await page.reload();
  await expect(page.getByRole("button", { name: /Open UA124/ })).toBeVisible();
  await expect(page.locator(".storage-warning")).toHaveCount(0);
});

test("retrying a failed new flight write does not add the flight twice", async ({
  page,
}) => {
  await importArchive(page);
  await openImportedFlight(page);
  await mockDocumentSaves(page, ["fail", "pass"]);
  await page
    .getByRole("button", { name: "Duplicate as new", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Duplicate flight",
    exact: true,
  });
  await editor.getByLabel("Flight number").fill("UA124");
  await editor
    .getByRole("button", { name: "Save flight", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await expect(page.locator(".detail-heading-eyebrow")).toContainText("UA124");
  await expect(unsavedWarning(page)).toBeVisible();
  await unsavedWarning(page)
    .getByRole("button", { name: "Try again", exact: true })
    .click();
  await expectSavingFinished(page);
  await expect(unsavedWarning(page)).toHaveCount(0);
  const saved = await storedArchive(page);
  expect(saved?.flights.map((flight) => flight.flightNumber)).toEqual([
    "UA123",
    "UA124",
  ]);
  expect(new Set(saved?.flights.map((flight) => flight.id)).size).toBe(2);
  expect(
    await page.evaluate(() =>
      window.documentPersistenceTest.calls.map((call) =>
        call.document.flights.map((flight) => flight.id),
      ),
    ),
  ).toEqual([
    saved?.flights.map((flight) => flight.id),
    saved?.flights.map((flight) => flight.id),
  ]);

  await page.reload();
  await expect(page.getByRole("button", { name: /Open UA123/ })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Open UA124/ })).toHaveCount(1);
});

test("retrying a failed deletion saves the remaining document without deleting again", async ({
  page,
}) => {
  await importArchive(page);
  await openImportedFlight(page);
  await mockDocumentSaves(page, ["fail", "pass"]);
  await page.getByRole("button", { name: "Edit flight", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Edit flight", exact: true })
    .getByRole("button", { name: "Delete flight", exact: true })
    .click();
  await page
    .getByRole("alertdialog", { name: "Delete flight", exact: true })
    .getByRole("button", { name: "Delete flight", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Edit flight", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Open UA123/ })).toHaveCount(0);
  await expect(unsavedWarning(page)).toBeVisible();
  expect((await storedArchive(page))?.flights).toHaveLength(1);

  await unsavedWarning(page)
    .getByRole("button", { name: "Try again", exact: true })
    .click();
  await expectSavingFinished(page);
  await expect(unsavedWarning(page)).toHaveCount(0);
  expect((await storedArchive(page))?.flights).toEqual([]);
  expect(
    await page.evaluate(() =>
      window.documentPersistenceTest.calls.map(
        (call) => call.document.flights.length,
      ),
    ),
  ).toEqual([0, 0]);
  await page.reload();
  await expect(page.getByRole("button", { name: /Open UA123/ })).toHaveCount(0);
  await expect(page.locator(".storage-warning")).toHaveCount(0);
});

test("serializes two rapid flight edits and leaves both the UI and IndexedDB at the latest version", async ({
  page,
}) => {
  await importArchive(page);
  await openImportedFlight(page);
  await mockDocumentSaves(page, ["hold", "pass"]);
  await editFlightNumber(page, "UA124");
  await expect
    .poll(() =>
      page.evaluate(() => window.documentPersistenceTest.calls.length),
    )
    .toBe(1);
  await editFlightNumber(page, "UA125");
  expect(
    await page.evaluate(() => window.documentPersistenceTest.calls.length),
  ).toBe(1);
  expect((await storedArchive(page))?.flights[0]?.flightNumber).toBe("UA123");
  await expect(page.locator(".persistence-status")).toHaveText("Saving…");
  await expect.poll(() => hasUnloadGuard(page)).toBe(true);

  await page.evaluate(() => window.documentPersistenceTest.release(0));
  await expect
    .poll(() => page.evaluate(() => window.documentPersistenceTest.completed))
    .toEqual([0, 1]);
  await expectSavingFinished(page);
  expect(
    await page.evaluate(() =>
      window.documentPersistenceTest.calls.map(
        (call) => call.document.flights[0]?.flightNumber,
      ),
    ),
  ).toEqual(["UA124", "UA125"]);
  expect((await storedArchive(page))?.flights[0]?.flightNumber).toBe("UA125");
  await expect(page.locator(".detail-heading-eyebrow")).toContainText("UA125");
  await expect(page.locator(".storage-warning")).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("button", { name: /Open UA125/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Open UA124/ })).toHaveCount(0);
  await expect(page.locator(".storage-warning")).toHaveCount(0);
});

test("an earlier asynchronous flight save does not close the next open editor", async ({
  page,
}) => {
  await importArchive(page);
  await openImportedFlight(page);
  await mockDocumentSaves(page, ["hold", "pass"]);
  await editFlightNumber(page, "UA124");
  await expect
    .poll(() =>
      page.evaluate(() => window.documentPersistenceTest.calls.length),
    )
    .toBe(1);
  await page.getByRole("button", { name: "Edit flight", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit flight", exact: true });
  await editor.getByLabel("Flight number").fill("UA125");

  await page.evaluate(() => window.documentPersistenceTest.release(0));
  await expect
    .poll(() => page.evaluate(() => window.documentPersistenceTest.completed))
    .toEqual([0]);
  await expect(editor).toBeVisible();
  await expect(editor.getByLabel("Flight number")).toHaveValue("UA125");
  await editor
    .getByRole("button", { name: "Save flight", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await expect
    .poll(async () => (await storedArchive(page))?.flights[0]?.flightNumber)
    .toBe("UA125");
  await expectSavingFinished(page);
  await expect(page.locator(".storage-warning")).toHaveCount(0);
});

test("failed settings remain visible and Retry persists the current settings snapshot", async ({
  page,
}) => {
  await importArchive(page);
  await openSettings(page);
  await mockSettingsFailure(page);
  const appearance = page.getByRole("combobox", {
    name: "Appearance",
    exact: true,
  });
  await appearance.selectOption("dark");
  await expect(appearance).toHaveValue("dark");
  const warning = page
    .locator(".storage-warning")
    .filter({ hasText: "Settings are not saved on this device." });
  await expect(warning).toBeVisible();
  await warning.getByRole("button", { name: "Try again", exact: true }).click();
  await expectSavingFinished(page);
  await expect(warning).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      window.settingsPersistenceTest.calls.map(
        (settings) => settings.appearance,
      ),
    ),
  ).toEqual(["dark", "dark"]);

  await page.reload();
  await expect(appearance).toHaveValue("dark");
  await expect(page.locator(".storage-warning")).toHaveCount(0);
});

test("an older successful profile write cannot hide a newer failure and Retry saves the latest profile", async ({
  page,
}) => {
  await importArchive(page);
  await openSettings(page);
  await mockDocumentSaves(page, ["hold", "fail", "pass"]);
  await openSettingsCategory(page, "Profile");
  const nativeName = page.getByLabel("Native name", { exact: true });
  await nativeName.fill("Profile A");
  await expect
    .poll(() =>
      page.evaluate(() => window.documentPersistenceTest.calls.length),
    )
    .toBe(1);
  await nativeName.fill("Profile B");
  await expect(nativeName).toHaveValue("Profile B");
  expect(
    await page.evaluate(() => window.documentPersistenceTest.calls.length),
  ).toBe(1);

  await page.evaluate(() => window.documentPersistenceTest.release(0));
  await expect(unsavedWarning(page)).toBeVisible();
  expect((await storedArchive(page))?.profile.name?.native).toBe("Profile A");
  expect(
    await page.evaluate(() =>
      window.documentPersistenceTest.calls.map(
        (call) => call.document.profile.name?.native,
      ),
    ),
  ).toEqual(["Profile A", "Profile B"]);
  await expect(nativeName).toHaveValue("Profile B");

  await unsavedWarning(page)
    .getByRole("button", { name: "Try again", exact: true })
    .click();
  await expectSavingFinished(page);
  await expect(unsavedWarning(page)).toHaveCount(0);
  expect((await storedArchive(page))?.profile.name?.native).toBe("Profile B");
  expect(
    await page.evaluate(() =>
      window.documentPersistenceTest.calls.map(
        (call) => call.document.profile.name?.native,
      ),
    ),
  ).toEqual(["Profile A", "Profile B", "Profile B"]);
  await page.reload();
  await openSettingsCategory(page, "Profile");
  await expect(nativeName).toHaveValue("Profile B");
  await expect(page.locator(".storage-warning")).toHaveCount(0);
});

test("clearing an archive is ordered after a pending save and cannot revive its data", async ({
  page,
}) => {
  await importArchive(page);
  await openSettings(page);
  await mockDocumentSaves(page, ["hold"]);
  await openSettingsCategory(page, "Profile");
  await page.getByLabel("Native name", { exact: true }).fill("Pending profile");
  await expect
    .poll(() =>
      page.evaluate(() => window.documentPersistenceTest.calls.length),
    )
    .toBe(1);
  await openSettingsCategory(page, "Danger zone");
  await page
    .locator(".settings-danger-zone")
    .getByRole("button", { name: "Clear local data", exact: true })
    .click();
  await page
    .getByRole("alertdialog", { name: "Clear local data", exact: true })
    .getByRole("button", { name: "Clear local data", exact: true })
    .click();
  expect(
    await page.evaluate(() => window.documentPersistenceTest.clearCalls),
  ).toBe(0);

  await page.evaluate(() => window.documentPersistenceTest.release(0));
  await expect(
    page.getByRole("button", { name: "Create my archive", exact: true }),
  ).toBeVisible();
  await expect.poll(() => storedArchive(page)).toBeNull();
  await expectSavingFinished(page);
  expect(
    await page.evaluate(() => window.documentPersistenceTest.clearCalls),
  ).toBe(1);
  await expect(page.locator(".storage-warning")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Create my archive", exact: true }),
  ).toBeVisible();
  expect(await storedArchive(page)).toBeNull();
});

test("retries a failed archive clear as a deletion and releases the unsaved exit guard", async ({
  page,
}) => {
  await importArchive(page);
  await openSettings(page);
  await mockDocumentSaves(page, [], ["fail", "pass"]);
  await openSettingsCategory(page, "Danger zone");
  await page
    .locator(".settings-danger-zone")
    .getByRole("button", { name: "Clear local data", exact: true })
    .click();
  await page
    .getByRole("alertdialog", { name: "Clear local data", exact: true })
    .getByRole("button", { name: "Clear local data", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Create my archive", exact: true }),
  ).toBeVisible();
  await expect(unsavedWarning(page)).toBeVisible();
  await expect.poll(() => hasUnloadGuard(page)).toBe(true);
  expect((await storedArchive(page))?.flights[0]?.flightNumber).toBe("UA123");

  await unsavedWarning(page)
    .getByRole("button", { name: "Try again", exact: true })
    .click();
  await expectSavingFinished(page);
  await expect(unsavedWarning(page)).toHaveCount(0);
  await expect.poll(() => hasUnloadGuard(page)).toBe(false);
  expect(await storedArchive(page)).toBeNull();
  expect(
    await page.evaluate(() => ({
      saves: window.documentPersistenceTest.calls.length,
      clears: window.documentPersistenceTest.clearCalls,
    })),
  ).toEqual({ saves: 0, clears: 2 });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Create my archive", exact: true }),
  ).toBeVisible();
  expect(await storedArchive(page)).toBeNull();
});

// Synthetic facts only: exercise JSON import, the real editor and native IndexedDB.
function generatedEditorArchive(): KeeprawFlyDocument {
  return {
    format: "keepraw-fly",
    formatVersion: "0.1.0",
    profile: {
      name: {
        native: "Synthetic Pilot",
        romanized: "Test Pilot",
        primary: "native",
      },
    },
    frequentFlyerMemberships: [
      {
        id: "test-ua",
        programId: "test-program",
        memberNumber: "TEST-123",
        tier: "Gold",
        associatedAirlines: ["UA"],
        defaultAirline: "UA",
      },
      {
        id: "test-other",
        programId: "test-other",
        memberNumber: "TEST-456",
        tier: "Silver",
        associatedAirlines: ["MU"],
      },
    ],
    extensions: { "test.archive": { generated: true } },
    flights: [1, 2, 3].map((number) => ({
      id: `synthetic-${number}`,
      flightNumber: `UA70${number}`,
      serviceDate: `2026-08-2${number}`,
      airline: { iata: "UA", icao: "UAL" },
      origin: { iata: "SFO", terminal: "3", gate: `F${number}` },
      destination: { iata: "LAX", terminal: "7", gate: "70" },
      scheduledDeparture: `2026-08-2${number}T08:00:00-07:00`,
      scheduledArrival: `2026-08-2${number}T10:00:00-07:00`,
      actualDeparture: `2026-08-2${number}T08:12:00-07:00`,
      actualArrival: `2026-08-2${number}T10:15:00-07:00`,
      ticketNumber: `016123456789${number}`,
      bookingReference: `TEST${number}`,
      baggageCarousel: `D0${number}`,
      frequentFlyer: { membershipId: "test-ua", tierAtFlight: null },
      extensions: {
        "test.flight": { marker: number, facts: [true, null, "generated"] },
        "keepraw-fly.aircraft": {
          type: "B738",
          registration: `N123${number}`,
          source: "synthetic",
        },
        "keepraw-fly.seat": {
          seat: "12A",
          cabin: "economy",
          bookingClass: "Y",
          source: "synthetic",
        },
      },
    })),
  };
}

async function readEditorRecord(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ document: KeeprawFlyDocument; updatedAt: string }>(
        (resolve, reject) => {
          const request = indexedDB.open("keepraw-fly");
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const database = request.result;
            const transaction = database.transaction("documents", "readonly");
            const read = transaction.objectStore("documents").get("active");
            read.onsuccess = () => resolve(read.result);
            read.onerror = () => reject(read.error);
            transaction.oncomplete = () => database.close();
          };
        },
      ),
  );
}

async function importEditorArchive(page: Page, archive: unknown) {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "synthetic.keepraw-fly.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(archive)),
  });
  await page
    .getByRole("button", { name: "Import this archive", exact: true })
    .click();
  await expect(page.getByRole("button", { name: /Open UA701/ })).toBeVisible();
  await expectSavingFinished(page);
  await page.getByRole("button", { name: /Open UA701/ }).click();
}

async function openEditor(page: Page) {
  await page.getByRole("button", { name: "Edit flight", exact: true }).click();
  return page.getByRole("dialog", { name: "Edit flight", exact: true });
}

async function saveEditor(page: Page) {
  const editor = page.getByRole("dialog");
  await editor
    .getByRole("button", { name: "Save flight", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await expectSavingFinished(page);
}

async function expectValidEditorReload(
  page: Page,
  expected: KeeprawFlyDocument,
) {
  expect(await storedArchive(page)).toEqual(expected);
  expect((await readEditorRecord(page)).document).toEqual(expected);
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Open UA/ }).first(),
  ).toBeVisible();
  await expect(page.locator(".recovery-page")).toHaveCount(0);
  expect((await readEditorRecord(page)).document).toEqual(expected);
}

test(
  "saves cancelled to diverted, reloads valid IndexedDB and exports valid JSON",
  { tag: "@cross-browser" },
  async ({ page }) => {
    const archive = generatedEditorArchive();
    const flight = archive.flights[0]!;
    flight.cancelled = true;
    delete flight.actualDeparture;
    delete flight.actualArrival;
    await importEditorArchive(page, archive);
    const editor = await openEditor(page);
    await editor.getByLabel("Canceled", { exact: true }).uncheck();
    await editor
      .getByRole("combobox", { name: "Diverted", exact: true })
      .fill("JFK");
    await saveEditor(page);
    delete flight.cancelled;
    flight.divertedTo = { iata: "JFK" };
    await expectValidEditorReload(page, archive);
    await openSettings(page);
    await openSettingsCategory(page, "Data and backup");
    const downloading = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export Keepraw Fly JSON", exact: true })
      .click();
    const downloaded = JSON.parse(
      await readFile((await (await downloading).path())!, "utf8"),
    );
    expect(downloaded).toEqual(archive);
    expect(await storedArchive(page)).toEqual(downloaded);
  },
);

for (const field of ["flightNumber", "bookingReference"] as const) {
  test(`preserves imported historical facts when only ${field} changes`, async ({
    page,
  }) => {
    const archive = generatedEditorArchive();
    const flight = archive.flights[0]!;
    flight.divertedTo = { iata: "JFK", terminal: "4", gate: "B12" };
    flight.actualArrival = "2026-08-21T13:15:00-04:00";
    await importEditorArchive(page, archive);
    const editor = await openEditor(page);
    await expect(
      editor.getByLabel("Frequent Flyer Tier", { exact: true }),
    ).toHaveValue("");
    const value = field === "flightNumber" ? "UA799" : "CHANGED";
    await editor
      .getByLabel(
        field === "flightNumber" ? "Flight number" : "Booking Reference / PNR",
      )
      .fill(value);
    await saveEditor(page);
    flight[field] = value;
    await expectValidEditorReload(page, archive);
  });
}

test("changes and clears diversion without transferring old airport facts", async ({
  page,
}) => {
  const archive = generatedEditorArchive();
  const flight = archive.flights[0]!;
  flight.divertedTo = { iata: "JFK", terminal: "4", gate: "B12" };
  delete flight.actualArrival;
  await importEditorArchive(page, archive);
  let editor = await openEditor(page);
  await editor
    .getByRole("combobox", { name: "Diverted", exact: true })
    .fill("BOS");
  await saveEditor(page);
  flight.divertedTo = { iata: "BOS" };
  expect((await readEditorRecord(page)).document).toEqual(archive);
  editor = await openEditor(page);
  await editor
    .getByRole("combobox", { name: "Diverted", exact: true })
    .fill("");
  await saveEditor(page);
  delete flight.divertedTo;
  await expectValidEditorReload(page, archive);
});

test("preserves an unassociated historical membership until explicitly reselected or edited", async ({
  page,
}) => {
  const archive = generatedEditorArchive();
  const flight = archive.flights[0]!;
  flight.frequentFlyer = { membershipId: "test-other", tierAtFlight: null };
  await importEditorArchive(page, archive);
  await editFlightNumber(page, "UA799");
  flight.flightNumber = "UA799";
  expect((await readEditorRecord(page)).document).toEqual(archive);
  let editor = await openEditor(page);
  await editor
    .getByLabel("Frequent Flyer Tier", { exact: true })
    .fill("Platinum");
  await saveEditor(page);
  flight.frequentFlyer.tierAtFlight = "Platinum";
  expect((await readEditorRecord(page)).document).toEqual(archive);
  editor = await openEditor(page);
  await editor.getByLabel("Frequent flyer membership").selectOption("test-ua");
  await expect(
    editor.getByLabel("Frequent Flyer Tier", { exact: true }),
  ).toHaveValue("Gold");
  await saveEditor(page);
  flight.frequentFlyer = { membershipId: "test-ua", tierAtFlight: "Gold" };
  await expectValidEditorReload(page, archive);
});

test("does not auto-fill a membership on an existing unlinked flight", async ({
  page,
}) => {
  const archive = generatedEditorArchive();
  delete archive.flights[0]!.frequentFlyer;
  await importEditorArchive(page, archive);
  await editFlightNumber(page, "UA799");
  archive.flights[0]!.flightNumber = "UA799";
  await expectValidEditorReload(page, archive);
});

test("keeps new and duplicate flight membership matching while leaving old flights unknown", async ({
  page,
}) => {
  const archive = generatedEditorArchive();
  await importEditorArchive(page, archive);
  await page
    .getByRole("button", { name: "Duplicate as new", exact: true })
    .click();
  let editor = page.getByRole("dialog");
  await expect(
    editor.getByLabel("Frequent Flyer Tier", { exact: true }),
  ).toHaveValue("Gold");
  await editor.getByLabel("Flight number").fill("MU799");
  await expect(editor.getByLabel("Frequent flyer membership")).toHaveValue(
    "test-other",
  );
  await expect(
    editor.getByLabel("Frequent Flyer Tier", { exact: true }),
  ).toHaveValue("Silver");
  await saveEditor(page);
  let stored = (await readEditorRecord(page)).document;
  expect(stored.flights.slice(0, 3)).toEqual(archive.flights);
  expect(stored.flights[3]?.frequentFlyer).toEqual({
    membershipId: "test-other",
    tierAtFlight: "Silver",
  });
  await page.locator(".detail-header-back").click();
  await page.getByRole("button", { name: "Add flight", exact: true }).click();
  editor = page.getByRole("dialog");
  await editor.getByLabel("Flight number").fill("UA799");
  await expect(editor.getByLabel("Frequent flyer membership")).toHaveValue(
    "test-ua",
  );
  await expect(
    editor.getByLabel("Frequent Flyer Tier", { exact: true }),
  ).toHaveValue("Gold");
  await editor
    .getByRole("combobox", { name: "Origin", exact: true })
    .fill("SFO");
  await editor
    .getByRole("combobox", { name: "Destination", exact: true })
    .fill("LAX");
  await saveEditor(page);
  stored = (await readEditorRecord(page)).document;
  expect(stored.flights.slice(0, 3)).toEqual(archive.flights);
  expect(stored.flights[4]?.frequentFlyer).toEqual({
    membershipId: "test-ua",
    tierAtFlight: "Gold",
  });
  await expectValidEditorReload(page, stored);
});

test("ordinary editing of a migrated legacy JSON flight keeps its unknown historical tier", async ({
  page,
}) => {
  const archive = generatedEditorArchive();
  const legacy = {
    ...structuredClone(archive),
    format: "rawfly",
    formatVersion: "0.1",
  };
  const flight = legacy.flights[0]!;
  delete flight.frequentFlyer;
  flight.extensions!["keepraw-fly.frequent-flyer"] = {
    membershipId: "test-ua",
    tier: null,
  };
  await importEditorArchive(page, legacy);
  expect((await readEditorRecord(page)).document).toEqual(archive);
  await editFlightNumber(page, "UA799");
  archive.flights[0]!.flightNumber = "UA799";
  await expectValidEditorReload(page, archive);
});

for (const fault of ["conflict", "membership", "schema"] as const) {
  test(`rejects ${fault} at the save boundary without writing or losing the draft`, async ({
    page,
  }) => {
    // Inject a malformed converter result, without adding a production test hook.
    await page.route("**/src/components/FlightEditor.tsx", async (route) => {
      const response = await route.fetch();
      const source = await response.text();
      expect(source).toContain("await onSave(nextFlight);");
      await route.fulfill({
        response,
        body: source.replace(
          "await onSave(nextFlight);",
          "await onSave(window.corruptFlightEdit ? window.corruptFlightEdit(nextFlight) : nextFlight);",
        ),
      });
    });
    const archive = generatedEditorArchive();
    await importEditorArchive(page, archive);
    const before = await readEditorRecord(page);
    await mockDocumentSaves(page, []);
    await page.evaluate((fault) => {
      window.corruptFlightEdit = (flight) => ({
        ...flight,
        ...(fault === "conflict"
          ? { cancelled: true, divertedTo: { iata: "JFK" } }
          : fault === "membership"
            ? { frequentFlyer: { membershipId: "missing" } }
            : { origin: { iata: "INVALID" } }),
      });
    }, fault);
    const editor = await openEditor(page);
    await editor.getByLabel("Flight number").fill("UA799");
    await editor
      .getByRole("button", { name: "Save flight", exact: true })
      .click();
    await expect(editor.getByRole("alert")).toHaveText(
      "Please check the flight details and try again.",
    );
    await expect(editor.getByLabel("Flight number")).toHaveValue("UA799");
    await expect(
      editor.getByRole("button", { name: "Save flight", exact: true }),
    ).toBeEnabled();
    expect(await readEditorRecord(page)).toEqual(before);
    expect(
      await page.evaluate(() => window.documentPersistenceTest.calls),
    ).toEqual([]);
    // A corrected retry uses the retained draft, and a reload before retry keeps the original archive.
    if (fault === "conflict") {
      await page.evaluate(() => {
        delete window.corruptFlightEdit;
      });
      await saveEditor(page);
      archive.flights[0]!.flightNumber = "UA799";
    }
    await expectValidEditorReload(page, archive);
  });
}

declare global {
  interface Window {
    corruptFlightEdit?: (flight: KeeprawFlight) => KeeprawFlight;
  }
}

async function delayFirstFlightValidation(page: Page) {
  await page.route("**/src/App.tsx", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const validation = "const { validateKeeprawFly } = await import(";
    expect(source).toContain(validation);
    expect(source).toContain("if (!loaded) {");
    await route.fulfill({
      response,
      // Exercise the real callbacks; keep the test controls out of production.
      // Pause at the import boundary, after the candidate snapshot was built.
      body: source
        .replace(
          validation,
          `await window.flightValidationDelay.wait();\n${validation}`,
        )
        .replace(
          "if (!loaded) {",
          `window.flightValidationActions = { clearDocument, importArchive, updateProfile, saveFlight };
        if (!loaded) {`,
        ),
    });
  });
}

async function startDelayedFlightSave(page: Page, flight: KeeprawFlight) {
  await page.evaluate((flight) => {
    let release: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const state: Window["flightValidationDelay"] =
      (window.flightValidationDelay = {
        calls: 0,
        outcome: "pending" as "pending" | "saved" | "rejected",
        release: () => release(),
        wait: () => (++state.calls === 1 ? held : Promise.resolve()),
      });
    void window.flightValidationActions.saveFlight(flight).then(
      () => {
        state.outcome = "saved";
      },
      () => {
        state.outcome = "rejected";
      },
    );
  }, flight);
  await expect
    .poll(() => page.evaluate(() => window.flightValidationDelay.calls))
    .toBe(1);
}

for (const change of [
  "clear",
  "replace",
  "profile",
  "same-turn-profile",
  "other-flight",
  "failed-profile",
] as const) {
  test(`rejects delayed flight validation after ${change} without changing IndexedDB or retry intent`, async ({
    page,
  }) => {
    await delayFirstFlightValidation(page);
    const archive = generatedEditorArchive();
    await importEditorArchive(page, archive);
    const original = await readEditorRecord(page);
    await mockDocumentSaves(
      page,
      change === "failed-profile" ? ["fail", "pass"] : [],
    );
    await startDelayedFlightSave(page, {
      ...archive.flights[0]!,
      flightNumber: "UA799",
    });
    expect(
      await page.evaluate(() => window.documentPersistenceTest.calls),
    ).toEqual([]);

    const expected = structuredClone(archive);
    if (change === "clear") {
      await page.evaluate(() => window.flightValidationActions.clearDocument());
      await expect.poll(() => readEditorRecord(page)).toBeUndefined();
    } else if (change === "replace") {
      expected.profile = {
        name: { native: "Replacement Pilot", primary: "native" },
      };
      expected.flights = expected.flights.map((flight, index) => ({
        ...flight,
        id: `replacement-${index}`,
        flightNumber: `UA80${index + 1}`,
      }));
      expected.extensions = { "test.replacement": { preserved: true } };
      await page.evaluate(
        (document) => window.flightValidationActions.importArchive(document),
        expected,
      );
      await expectSavingFinished(page);
    } else if (change === "other-flight") {
      expected.flights[1]!.flightNumber = "UA798";
      await page.evaluate(
        (flight) => window.flightValidationActions.saveFlight(flight),
        expected.flights[1]!,
      );
      await expectSavingFinished(page);
    } else {
      expected.profile = {
        name: { native: "Updated Pilot", primary: "native" },
      };
      await page.evaluate(
        ({ name, releaseImmediately }) => {
          window.flightValidationActions.updateProfile(name);
          if (releaseImmediately) window.flightValidationDelay.release();
        },
        {
          name: expected.profile.name!,
          releaseImmediately: change === "same-turn-profile",
        },
      );
      if (change === "failed-profile")
        await expect(unsavedWarning(page)).toBeVisible();
      else await expectSavingFinished(page);
    }
    const current = await readEditorRecord(page);
    if (change === "failed-profile") expect(current).toEqual(original);
    else if (change !== "clear") expect(current.document).toEqual(expected);
    const writesBeforeRelease = await page.evaluate(() => ({
      saves: window.documentPersistenceTest.calls.length,
      clears: window.documentPersistenceTest.clearCalls,
    }));

    // A stale completion must not close a newer editor or discard its draft.
    if (change !== "clear") {
      if (change === "replace")
        await page.getByRole("button", { name: /Open UA801/ }).click();
      const editor = await openEditor(page);
      await editor.getByLabel("Flight number").fill("UA797");
    }
    await page.evaluate(() => window.flightValidationDelay.release());
    await expect
      .poll(() => page.evaluate(() => window.flightValidationDelay.outcome))
      .not.toBe("pending");
    expect(await readEditorRecord(page)).toEqual(current);
    expect(
      await page.evaluate(() => window.flightValidationDelay.outcome),
    ).toBe("rejected");
    expect(
      await page.evaluate(() => ({
        saves: window.documentPersistenceTest.calls.length,
        clears: window.documentPersistenceTest.clearCalls,
      })),
    ).toEqual(writesBeforeRelease);
    if (change !== "clear") {
      await expect(
        page.getByRole("dialog").getByLabel("Flight number"),
      ).toHaveValue("UA797");
      await page.keyboard.press("Escape");
    }
    if (change === "failed-profile") {
      await unsavedWarning(page)
        .getByRole("button", { name: "Try again", exact: true })
        .click();
      await expectSavingFinished(page);
      expect((await readEditorRecord(page)).document).toEqual(expected);
      expect(
        await page.evaluate(() =>
          window.documentPersistenceTest.calls.map((call) => call.document),
        ),
      ).toEqual([expected, expected]);
    }
    await page.reload();
    if (change === "clear") {
      await expect(
        page.getByRole("button", { name: "Create my archive", exact: true }),
      ).toBeVisible();
      expect(await readEditorRecord(page)).toBeUndefined();
    } else {
      await expect(
        page.getByRole("button", { name: /Open UA/ }).first(),
      ).toBeVisible();
      expect(await storedArchive(page)).toEqual(expected);
      expect((await readEditorRecord(page)).document).toEqual(expected);
    }
  });
}

declare global {
  interface Window {
    flightValidationDelay: {
      calls: number;
      outcome: "pending" | "saved" | "rejected";
      wait: () => Promise<void>;
      release: () => void;
    };
    flightValidationActions: {
      clearDocument: () => void;
      importArchive: (document: KeeprawFlyDocument) => void;
      updateProfile: (
        name: NonNullable<KeeprawFlyDocument["profile"]["name"]>,
      ) => void;
      saveFlight: (flight: KeeprawFlight) => Promise<void>;
    };
  }
}

test("accepts delayed flight validation when only viewer preferences changed", async ({
  page,
}) => {
  await delayFirstFlightValidation(page);
  const archive = generatedEditorArchive();
  await importEditorArchive(page, archive);
  await mockDocumentSaves(page, []);
  archive.flights[0]!.flightNumber = "UA799";
  await startDelayedFlightSave(page, archive.flights[0]!);
  await openSettings(page);
  await page.locator("#settings-appearance").selectOption("dark");
  await expectSavingFinished(page);
  expect(
    await page.evaluate(() => window.documentPersistenceTest.calls),
  ).toEqual([]);
  await page.evaluate(() => window.flightValidationDelay.release());
  await expect
    .poll(() => page.evaluate(() => window.flightValidationDelay.outcome))
    .toBe("saved");
  await expectSavingFinished(page);
  expect(
    await page.evaluate(() =>
      window.documentPersistenceTest.calls.map((call) => call.document),
    ),
  ).toEqual([archive]);
  await expectValidEditorReload(page, archive);
});
