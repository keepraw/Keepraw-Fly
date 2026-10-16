import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { openSettingsCategory } from "./helpers/settings";
import type {
  KeeprawFlyDocument,
  KeeprawFlight,
  FrequentFlyerMembership,
  ProfileName,
} from "@keepraw-fly/schema";

const archive = JSON.parse(
  await readFile(
    new URL("../examples/basic.keepraw-fly.json", import.meta.url),
    "utf8",
  ),
) as KeeprawFlyDocument;
const conflictText = "Another tab changed or cleared this archive.";

declare global {
  interface Window {
    archiveActions: {
      importArchive: (document: KeeprawFlyDocument) => Promise<void>;
      updateProfile: (name: ProfileName) => void;
      updateMemberships: (memberships: FrequentFlyerMembership[]) => void;
      saveFlight: (flight: KeeprawFlight) => Promise<void>;
      deleteEditedFlight: () => void;
      clearDocument: () => void;
    };
  }
}

async function exposeActions(page: Page) {
  await page.route("**/src/App.tsx*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    expect(source).toContain("if (!loaded) {");
    await route.fulfill({
      response,
      body: source.replace(
        "if (!loaded) {",
        `window.archiveActions = { importArchive, updateProfile, updateMemberships, saveFlight, deleteEditedFlight, clearDocument };\nif (!loaded) {`,
      ),
    });
  });
}

// Read native IndexedDB without rebasing the application's expected revision.
async function stored(page: Page): Promise<KeeprawFlyDocument | null> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("keepraw-fly");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction("documents", "readonly");
          const read = transaction.objectStore("documents").get("active");
          read.onsuccess = () => resolve(read.result?.document ?? null);
          read.onerror = () => reject(read.error);
          transaction.oncomplete = () => db.close();
        };
      }),
  );
}

async function twoTabs(page: Page, context: BrowserContext) {
  await exposeActions(page);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Create my archive", exact: true }),
  ).toBeVisible();
  await page.evaluate(
    (archive) => window.archiveActions.importArchive(archive),
    archive,
  );
  const stale = await context.newPage();
  await exposeActions(stale);
  await stale.goto("/");
  await expect(stale.getByRole("button", { name: /Open UA123/ })).toBeVisible();
  return stale;
}

async function commitWinner(page: Page) {
  await page.evaluate(() =>
    window.archiveActions.updateProfile({
      native: "Committed A",
      primary: "native",
    }),
  );
  await expect
    .poll(async () => (await stored(page))?.profile.name?.native)
    .toBe("Committed A");
  return (await stored(page))!;
}

function warning(page: Page) {
  return page.getByRole("alert").filter({ hasText: conflictText });
}

test("replaces a loaded large archive and edits, exports and reloads the current document", async ({
  page,
}) => {
  await exposeActions(page);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Create my archive", exact: true }),
  ).toBeVisible();
  const original = structuredClone(archive);
  original.extensions = { "test.original": { payload: "x".repeat(1_000_000) } };
  await page.evaluate(
    (document) => window.archiveActions.importArchive(document),
    original,
  );
  // Exercise a valid startup read, rather than only the initial empty state.
  await page.reload();
  await expect(page.getByRole("button", { name: /Open UA123/ })).toBeVisible();
  expect(await stored(page)).toEqual(original);

  const replacement = structuredClone(archive);
  replacement.flights[0]!.id = "replacement-flight";
  replacement.flights[0]!.flightNumber = "UA456";
  replacement.extensions = { "test.replacement": { preserved: [true, 42] } };
  await page.evaluate(
    (document) => window.archiveActions.importArchive(document),
    replacement,
  );
  await expect(page.getByRole("button", { name: /Open UA456/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Open UA123/ })).toHaveCount(0);
  expect(await stored(page)).toEqual(replacement);

  replacement.profile.name = { native: "Current Pilot", primary: "native" };
  await page.evaluate(
    (name) => window.archiveActions.updateProfile(name),
    replacement.profile.name,
  );
  await expect.poll(() => stored(page)).toEqual(replacement);
  await page.locator('.site-navigation a[href="#settings"]').click();
  await openSettingsCategory(page, "Data and backup");
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export Keepraw Fly JSON", exact: true })
    .click();
  const download = await downloading;
  expect(JSON.parse(await readFile((await download.path())!, "utf8"))).toEqual(
    replacement,
  );
  await page.reload();
  expect(await stored(page)).toEqual(replacement);
  await openSettingsCategory(page, "Profile");
  await expect(page.getByLabel("Native name", { exact: true })).toHaveValue(
    "Current Pilot",
  );
});

for (const operation of [
  "flight-add",
  "flight-edit",
  "flight-delete",
  "profile",
  "memberships",
  "import",
  "clear",
] as const) {
  test(`rejects a stale ${operation} and preserves the other tab's full archive`, async ({
    page,
    context,
  }) => {
    const stale = await twoTabs(page, context);
    if (operation === "flight-delete") {
      await stale.getByRole("button", { name: /Open UA123/ }).click();
      await stale
        .getByRole("button", { name: "Edit flight", exact: true })
        .click();
    }
    const committed = await commitWinner(page);
    await stale.evaluate(
      async ({ operation, archive }) => {
        const actions = window.archiveActions;
        switch (operation) {
          case "flight-add":
            await actions.saveFlight({
              ...archive.flights[0]!,
              id: "new-flight",
              flightNumber: "UA126",
            });
            break;
          case "flight-edit":
            await actions.saveFlight({
              ...archive.flights[0]!,
              flightNumber: "UA126",
            });
            break;
          case "flight-delete":
            actions.deleteEditedFlight();
            break;
          case "profile":
            actions.updateProfile({ native: "Unsaved B", primary: "native" });
            break;
          case "memberships":
            actions.updateMemberships([
              {
                id: "member-b",
                programId: "ua-mileageplus",
                memberNumber: "123",
                associatedAirlines: ["UA"],
                tier: "Gold",
              },
            ]);
            break;
          case "import":
            await actions
              .importArchive({ ...archive, flights: [] })
              .catch(() => {});
            break;
          case "clear":
            actions.clearDocument();
            break;
        }
      },
      { operation, archive },
    );
    await expect(warning(stale)).toBeVisible();
    await expect(
      warning(stale).getByRole("button", { name: "Try again", exact: true }),
    ).toHaveCount(0);
    expect(await stored(page)).toEqual(committed);
    // Further edits cannot enqueue an overwrite after the first conflict.
    await stale.evaluate(() =>
      window.archiveActions.updateProfile({
        native: "Later B",
        primary: "native",
      }),
    );
    expect(await stored(page)).toEqual(committed);
    const downloadPromise = stale.waitForEvent("download");
    await warning(stale)
      .getByRole("button", { name: "Export unsaved archive", exact: true })
      .click();
    const download = await downloadPromise;
    const exported = JSON.parse(
      await readFile((await download.path())!, "utf8"),
    );
    if (operation === "profile")
      expect(exported.profile.name.native).toBe("Unsaved B");
    if (operation === "clear") expect(exported).toEqual(archive);
    if (operation === "flight-edit")
      expect(exported.flights[0].flightNumber).toBe("UA126");
    if (operation === "import") expect(exported.flights).toEqual([]);
    expect(await stored(page)).toEqual(committed);
  });
}

test(
  "keeps a conflict draft, confirms reload, and then permits saving from the new revision",
  { tag: "@cross-browser" },
  async ({ page, context }) => {
    const stale = await twoTabs(page, context);
    const committed = await commitWinner(page);
    await stale.getByRole("button", { name: /Open UA123/ }).click();
    await stale
      .getByRole("button", { name: "Edit flight", exact: true })
      .click();
    const editor = stale.getByRole("dialog", {
      name: "Edit flight",
      exact: true,
    });
    await editor.getByLabel("Flight number").fill("UA126");
    await editor
      .getByRole("button", { name: "Save flight", exact: true })
      .click();
    await expect(warning(stale)).toBeVisible();
    await expect(stale.locator(".detail-heading-eyebrow")).toContainText(
      "UA126",
    );
    await warning(stale)
      .getByRole("button", { name: "Load saved archive", exact: true })
      .click();
    const confirmation = stale.getByRole("dialog", {
      name: "Load saved archive",
      exact: true,
    });
    await confirmation
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect(warning(stale)).toBeVisible();
    expect(await stored(stale)).toEqual(committed);
    await warning(stale)
      .getByRole("button", { name: "Load saved archive", exact: true })
      .click();
    await confirmation
      .getByRole("button", { name: "Load saved archive", exact: true })
      .click();
    await expect(warning(stale)).toHaveCount(0);
    await stale.evaluate(() =>
      window.archiveActions.updateProfile({
        native: "Saved after reload",
        primary: "native",
      }),
    );
    await expect
      .poll(async () => (await stored(page))?.profile.name?.native)
      .toBe("Saved after reload");
    expect((await stored(page))?.flights).toEqual(committed.flights);
  },
);

test(
  "a failed save retry cannot resurrect an archive cleared by another tab",
  { tag: "@cross-browser" },
  async ({ page, context }) => {
    const stale = await twoTabs(page, context);
    await stale.evaluate(async () => {
      const path = "/src/storage/browser.ts";
      const { browserStorage } = await import(path);
      const save = browserStorage.saveDocument.bind(browserStorage);
      let fail = true;
      browserStorage.saveDocument = async (...args: unknown[]) => {
        if (fail) {
          fail = false;
          throw new Error("Temporary storage failure");
        }
        return save(...args);
      };
      window.archiveActions.updateProfile({
        native: "Retry B",
        primary: "native",
      });
    });
    await expect(
      stale.getByText("Changes are not saved on this device.", { exact: true }),
    ).toBeVisible();
    await page.evaluate(() => window.archiveActions.clearDocument());
    await expect.poll(() => stored(page)).toBeNull();
    await stale.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(warning(stale)).toBeVisible();
    expect(await stored(page)).toBeNull();
    await warning(stale)
      .getByRole("button", { name: "Load saved archive", exact: true })
      .click();
    await stale
      .getByRole("dialog", { name: "Load saved archive", exact: true })
      .getByRole("button", { name: "Load saved archive", exact: true })
      .click();
    await expect(
      stale.getByRole("button", { name: "Create my archive", exact: true }),
    ).toBeVisible();
    expect(await stored(page)).toBeNull();
  },
);

test(
  "atomically arbitrates simultaneous writes from two real IndexedDB connections",
  { tag: "@cross-browser" },
  async ({ page, context }) => {
    const stale = await twoTabs(page, context);
    const outcomes = await Promise.all(
      [page, stale].map((tab, index) =>
        tab.evaluate(async (index) => {
          const path = "/src/storage/browser.ts";
          const { BrowserStorageAdapter } = await import(path);
          const adapter = new BrowserStorageAdapter();
          const { document } = await adapter.loadDocument();
          // Both pages rendezvous after reading the same revision.
          (window as any).raceAdapter = adapter;
          (window as any).raceDocument = {
            ...document,
            profile: { name: { native: String(index), primary: "native" } },
          };
        }, index),
      ),
    );
    expect(outcomes).toHaveLength(2);
    const writes = await Promise.all(
      [page, stale].map((tab) =>
        tab.evaluate(async () => {
          try {
            await (window as any).raceAdapter.saveDocument(
              (window as any).raceDocument,
            );
            return "saved";
          } catch (error) {
            return (error as Error).message;
          }
        }),
      ),
    );
    expect(writes.sort()).toEqual(["archive-conflict", "saved"]);
    expect(["0", "1"]).toContain((await stored(page))?.profile.name?.native);
  },
);

test("an initially empty stale tab cannot recreate an archive after another tab created and cleared it", async ({
  page,
  context,
}) => {
  await exposeActions(page);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Create my archive", exact: true }),
  ).toBeVisible();
  const stale = await context.newPage();
  await exposeActions(stale);
  await stale.goto("/");
  await expect(
    stale.getByRole("button", { name: "Create my archive", exact: true }),
  ).toBeVisible();
  await page.evaluate(
    (archive) => window.archiveActions.importArchive(archive),
    archive,
  );
  await page.evaluate(() => window.archiveActions.clearDocument());
  await expect.poll(() => stored(page)).toBeNull();
  await stale.evaluate(
    (archive) => window.archiveActions.importArchive(archive).catch(() => {}),
    archive,
  );
  await expect(warning(stale)).toBeVisible();
  expect(await stored(page)).toBeNull();
});

test("a failed clear retry cannot remove another tab's subsequent save", async ({
  page,
  context,
}) => {
  const stale = await twoTabs(page, context);
  await stale.evaluate(async () => {
    const path = "/src/storage/browser.ts";
    const { browserStorage } = await import(path);
    const clear = browserStorage.clearDocument.bind(browserStorage);
    let fail = true;
    browserStorage.clearDocument = async () => {
      if (fail) {
        fail = false;
        throw new Error("Temporary deletion failure");
      }
      return clear();
    };
    window.archiveActions.clearDocument();
  });
  await expect(
    stale.getByText("Changes are not saved on this device.", { exact: true }),
  ).toBeVisible();
  const committed = await commitWinner(page);
  await stale.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(warning(stale)).toBeVisible();
  expect(await stored(page)).toEqual(committed);
});

test("a failed conflict reload preserves the draft and unload guard until a successful retry", async ({
  page,
  context,
}) => {
  const stale = await twoTabs(page, context);
  const committed = await commitWinner(page);
  await stale.evaluate(() =>
    window.archiveActions.updateProfile({
      native: "Keep this draft",
      primary: "native",
    }),
  );
  await expect(warning(stale)).toBeVisible();
  await stale.evaluate(async () => {
    const path = "/src/storage/browser.ts";
    const { browserStorage } = await import(path);
    const load = browserStorage.loadDocument.bind(browserStorage);
    let fail = true;
    browserStorage.loadDocument = async () => {
      if (fail) {
        fail = false;
        throw new Error("Temporary read failure");
      }
      return load();
    };
  });
  await warning(stale)
    .getByRole("button", { name: "Load saved archive", exact: true })
    .click();
  await stale
    .getByRole("dialog", { name: "Load saved archive", exact: true })
    .getByRole("button", { name: "Load saved archive", exact: true })
    .click();
  await expect(
    stale.getByRole("dialog", { name: "Load saved archive", exact: true }),
  ).toHaveCount(0);
  await expect(warning(stale)).toBeVisible();
  expect(
    await stale.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  ).toBe(true);
  const downloadPromise = stale.waitForEvent("download");
  await warning(stale)
    .getByRole("button", { name: "Export unsaved archive", exact: true })
    .click();
  const download = await downloadPromise;
  expect(
    JSON.parse(await readFile((await download.path())!, "utf8")).profile.name
      .native,
  ).toBe("Keep this draft");
  expect(await stored(page)).toEqual(committed);
  await warning(stale)
    .getByRole("button", { name: "Load saved archive", exact: true })
    .click();
  await stale
    .getByRole("dialog", { name: "Load saved archive", exact: true })
    .getByRole("button", { name: "Load saved archive", exact: true })
    .click();
  await expect(warning(stale)).toHaveCount(0);
  expect(await stored(page)).toEqual(committed);
});

test("a late conflict remains visible inside a subsequently opened editor without losing its draft", async ({
  page,
  context,
}) => {
  const stale = await twoTabs(page, context);
  await stale.evaluate(async () => {
    const path = "/src/storage/browser.ts";
    const { browserStorage } = await import(path);
    const save = browserStorage.saveDocument.bind(browserStorage);
    let release: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    (window as any).releaseConflictWrite = () => release();
    browserStorage.saveDocument = async (...args: unknown[]) => {
      await pending;
      return save(...args);
    };
  });
  await stale.getByRole("button", { name: /Open UA123/ }).click();
  await stale.getByRole("button", { name: "Edit flight", exact: true }).click();
  const editor = stale.getByRole("dialog", {
    name: "Edit flight",
    exact: true,
  });
  await editor.getByLabel("Flight number").fill("UA124");
  await editor
    .getByRole("button", { name: "Save flight", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await stale.getByRole("button", { name: "Edit flight", exact: true }).click();
  await editor.getByLabel("Flight number").fill("UA125");
  const committed = await commitWinner(page);
  await stale.evaluate(() => (window as any).releaseConflictWrite());
  await expect(editor.getByRole("alert")).toContainText(conflictText);
  await expect(editor.getByLabel("Flight number")).toHaveValue("UA125");
  await editor
    .getByRole("button", { name: "Save flight", exact: true })
    .click();
  await expect(editor).toBeVisible();
  await expect(editor.getByRole("alert")).toContainText(conflictText);
  await expect(editor.getByLabel("Flight number")).toHaveValue("UA125");
  expect(await stored(page)).toEqual(committed);
});
