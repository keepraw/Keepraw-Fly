import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const exampleArchive = fileURLToPath(
  new URL("../examples/basic.keepraw-fly.json", import.meta.url),
);
const recoveryTitle = "We couldn't open your local archive";
const preservationMessage =
  "Keepraw Fly found existing data on this device, but it could not be opened with this version. Your stored data has not been deleted or modified.";
const storedAt = "2026-08-19T12:00:00.000Z";

interface LocalRecord {
  key: "active";
  document: unknown;
  kind: "personal" | "demo";
  updatedAt: string;
}

const invalidArchive = {
  format: "keepraw-fly",
  formatVersion: "0.1.0",
  profile: {},
  flights: [{ broken: true }],
};

async function writeRecord(
  page: Page,
  document: unknown,
  kind: LocalRecord["kind"] = "personal",
) {
  const record: LocalRecord = {
    key: "active",
    document,
    kind,
    updatedAt: storedAt,
  };
  await page.evaluate(async (value) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepraw-fly");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction("documents", "readwrite");
        transaction.objectStore("documents").put(value);
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error);
        transaction.onerror = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  }, record);
  return record;
}

async function readRecord(page: Page): Promise<LocalRecord | null> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepraw-fly");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<LocalRecord | null>((resolve, reject) => {
        const request = database
          .transaction("documents", "readonly")
          .objectStore("documents")
          .get("active");
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
      });
    } finally {
      database.close();
    }
  });
}

async function seedArchive(
  page: Page,
  document: unknown,
  kind: LocalRecord["kind"] = "personal",
) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Create my archive", exact: true }),
  ).toBeVisible();
  const record = await writeRecord(page, document, kind);
  await page.reload();
  return record;
}

async function expectRecovery(page: Page) {
  await expect(
    page.getByRole("heading", { name: recoveryTitle, level: 1, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(preservationMessage, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create my archive", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Try demo", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".welcome")).toHaveCount(0);
}

async function failNextStorageOperation(
  page: Page,
  method: "loadDocument" | "saveDocument" | "clearDocument",
) {
  await page.evaluate(async (methodName) => {
    const modulePath = "/src/storage/browser.ts";
    const { browserStorage } = await import(modulePath);
    const original = browserStorage[methodName].bind(browserStorage);
    browserStorage[methodName] = async () => {
      browserStorage[methodName] = original;
      throw new Error("Simulated IndexedDB recovery operation failure");
    };
  }, method);
}

test("keeps empty storage on the welcome page and opens a valid local archive normally", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Create my archive", exact: true }),
  ).toBeVisible();
  expect(await readRecord(page)).toBeNull();
  const archive = JSON.parse(await readFile(exampleArchive, "utf8"));
  const record = await writeRecord(page, archive);
  await page.reload();
  await expect(page.getByRole("button", { name: /Open UA123/ })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: recoveryTitle, exact: true }),
  ).toHaveCount(0);
  expect(await readRecord(page)).toEqual(record);
});

test("shows recovery for an invalid local archive and retry leaves its raw record intact", async ({
  page,
}) => {
  const record = await seedArchive(page, invalidArchive, "demo");
  await expectRecovery(page);
  expect(await readRecord(page)).toEqual(record);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expectRecovery(page);
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeEnabled();
  expect(await readRecord(page)).toEqual(record);
  await page.goto("/#settings");
  await expectRecovery(page);
  await expect(
    page.getByRole("combobox", { name: "Appearance", exact: true }),
  ).toHaveCount(0);
  expect(await readRecord(page)).toEqual(record);
});

test("downloads an invalid legacy archive without canonicalizing it or dropping unknown fields", async ({
  page,
}) => {
  const raw = {
    ...invalidArchive,
    format: "rawfly",
    formatVersion: "0.1",
    unknownRecoveryField: { nested: ["preserve", 42] },
    extensions: { "example.recovery": { label: "原始档案", enabled: true } },
    flights: [
      {
        broken: true,
        extensions: {
          "keepraw-fly.ticket": { number: "keep-this-legacy-field" },
        },
      },
    ],
  };
  const record = await seedArchive(page, raw);
  await expectRecovery(page);
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download recovery copy", exact: true })
    .click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(
    /^keepraw-fly-recovery-\d{4}-\d{2}-\d{2}\.json$/,
  );
  const downloadedPath = await download.path();
  expect(downloadedPath).not.toBeNull();
  expect(JSON.parse(await readFile(downloadedPath!, "utf8"))).toEqual(raw);
  expect(await readRecord(page)).toEqual(record);
});

test("reports a recovery serialization failure without changing the stored source", async ({
  page,
}) => {
  const raw = { ...invalidArchive, unknownRecoveryValue: BigInt(42) };
  const record = await seedArchive(page, raw);
  await expectRecovery(page);
  let downloads = 0;
  page.on("download", () => {
    downloads++;
  });
  await page
    .getByRole("button", { name: "Download recovery copy", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "The recovery copy could not be downloaded. Your stored data has not been changed.",
  );
  expect(downloads).toBe(0);
  expect(await readRecord(page)).toEqual(record);
});

test("describes an unsupported future version accurately and never migrates its legacy fields", async ({
  page,
}) => {
  const raw = {
    format: "rawfly",
    formatVersion: "99.0.0",
    profile: {},
    flights: [
      { extensions: { "keepraw-fly.ticket": { number: "future-ticket" } } },
    ],
    futureFact: { value: "must survive" },
  };
  const record = await seedArchive(page, raw);
  await expectRecovery(page);
  await expect(
    page.getByText(
      "This archive was created by a newer or unsupported format version.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText(/corrupt/i)).toHaveCount(0);
  expect(await readRecord(page)).toEqual(record);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expectRecovery(page);
  expect(await readRecord(page)).toEqual(record);
});

test("persists a supported migration only after validation and reloads the canonical archive", async ({
  page,
}) => {
  const legacy = JSON.parse(await readFile(exampleArchive, "utf8"));
  legacy.format = "rawfly";
  legacy.formatVersion = "0.1";
  legacy.extensions = { "example.recovery": { preserved: true } };
  legacy.flights[0].extensions["keepraw-fly.ticket"] = {
    number: "legacy-ticket-number",
  };
  const record = await seedArchive(page, legacy, "demo");
  await expect(page.getByRole("button", { name: /Open UA123/ })).toBeVisible();
  const canonical = {
    ...legacy,
    format: "keepraw-fly",
    formatVersion: "0.1.0",
    flights: [
      {
        ...legacy.flights[0],
        ticketNumber: "legacy-ticket-number",
        extensions: {
          "keepraw-fly.aircraft":
            legacy.flights[0].extensions["keepraw-fly.aircraft"],
        },
      },
    ],
  };
  const migrated = await readRecord(page);
  expect(migrated?.document).toEqual(canonical);
  expect(migrated?.kind).toBe("demo");
  expect(migrated?.updatedAt).not.toBe(record.updatedAt);
  await page.reload();
  await expect(page.getByRole("button", { name: /Open UA123/ })).toBeVisible();
  expect(await readRecord(page)).toEqual(migrated);
});

test("retains the original archive when a known migration fails post-migration validation", async ({
  page,
}) => {
  const legacy = JSON.parse(await readFile(exampleArchive, "utf8"));
  legacy.format = "rawfly";
  legacy.formatVersion = "0.1";
  legacy.flights[0].scheduledArrival = legacy.flights[0].scheduledDeparture;
  legacy.flights[0].extensions["keepraw-fly.ticket"] = {
    number: "legacy-ticket-number",
  };
  const record = await seedArchive(page, legacy);
  await expectRecovery(page);
  expect(await readRecord(page)).toEqual(record);
  await page.reload();
  await expectRecovery(page);
  expect(await readRecord(page)).toEqual(record);
});

test("requires confirmation to clear recovery data and cancellation preserves the archive", async ({
  page,
}) => {
  const record = await seedArchive(page, invalidArchive);
  await expectRecovery(page);
  const clearButton = page.getByRole("button", {
    name: "Clear local data",
    exact: true,
  });
  // Focus restoration is a keyboard contract; WebKit mouse clicks do not focus buttons.
  await clearButton.focus();
  await clearButton.press("Enter");
  const confirmation = page.getByRole("alertdialog", {
    name: "Clear local data",
    exact: true,
  });
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText(/cannot be undone/i);
  await expect(
    confirmation.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  expect(await readRecord(page)).toEqual(record);
  await confirmation
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(confirmation).toHaveCount(0);
  await expect(clearButton).toBeFocused();
  expect(await readRecord(page)).toEqual(record);
  await clearButton.click();
  await confirmation
    .getByRole("button", { name: "Clear local data", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Create my archive", exact: true }),
  ).toBeVisible();
  expect(await readRecord(page)).toBeNull();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Create my archive", exact: true }),
  ).toBeVisible();
  expect(await readRecord(page)).toBeNull();
});

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 761, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`validates an imported backup and only replaces recovery data after explicit confirmation at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const record = await seedArchive(page, invalidArchive);
    await expectRecovery(page);
    const input = page.locator('input[type="file"][accept*=".json"]');
    await input.setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(invalidArchive)),
    });
    const preview = page.getByRole("region", {
      name: "Review before importing",
      exact: true,
    });
    await expect(
      preview.getByRole("button", {
        name: "Resolve issues to import",
        exact: true,
      }),
    ).toBeDisabled();
    const issues = preview.getByRole("alert");
    await issues.scrollIntoViewIfNeeded();
    await expect(issues).toBeVisible();
    expect(await readRecord(page)).toEqual(record);
    await preview.getByRole("button", { name: "Cancel", exact: true }).click();

    await input.setInputFiles(exampleArchive);
    await expect(preview).toBeVisible();
    await preview.locator(".import-preview-heading").scrollIntoViewIfNeeded();
    await expect(preview.locator(".import-preview-heading")).toBeInViewport({
      ratio: 0.99,
    });
    expect(await readRecord(page)).toEqual(record);
    await preview
      .getByRole("button", { name: "Import this archive", exact: true })
      .click();
    const confirmation = page.getByRole("dialog", {
      name: "Replace local archive?",
      exact: true,
    });
    await expect(confirmation).toBeVisible();
    await expect(confirmation).toBeInViewport({ ratio: 0.99 });
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBe(0);
    await expect(
      confirmation.getByRole("button", { name: "Cancel", exact: true }),
    ).toBeFocused();
    expect(await readRecord(page)).toEqual(record);
    await confirmation
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect(confirmation).toHaveCount(0);
    await expectRecovery(page);
    expect(await readRecord(page)).toEqual(record);

    await input.setInputFiles(exampleArchive);
    await preview
      .getByRole("button", { name: "Import this archive", exact: true })
      .click();
    await confirmation
      .getByRole("button", { name: "Replace local archive", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: /Open UA123/ }),
    ).toBeVisible();
    const archive = JSON.parse(await readFile(exampleArchive, "utf8"));
    expect((await readRecord(page))?.document).toEqual(archive);
    expect((await readRecord(page))?.kind).toBe("personal");
    await page.reload();
    await expect(
      page.getByRole("button", { name: /Open UA123/ }),
    ).toBeVisible();
    expect((await readRecord(page))?.document).toEqual(archive);
  });
}

test("keeps recovery data after a backup write failure and allows another confirmed import", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const record = await seedArchive(page, invalidArchive);
  await expectRecovery(page);
  await failNextStorageOperation(page, "saveDocument");
  const input = page.locator('input[type="file"][accept*=".json"]');
  await input.setInputFiles(exampleArchive);
  await page
    .getByRole("button", { name: "Import this archive", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Replace local archive?", exact: true })
    .getByRole("button", { name: "Replace local archive", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({
      hasText:
        "The backup could not be saved. Your stored data has not been changed.",
    }),
  ).toBeVisible();
  await expectRecovery(page);
  expect(await readRecord(page)).toEqual(record);

  await input.setInputFiles(exampleArchive);
  await page
    .getByRole("button", { name: "Import this archive", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Replace local archive?", exact: true })
    .getByRole("button", { name: "Replace local archive", exact: true })
    .click();
  await expect(page.getByRole("button", { name: /Open UA123/ })).toBeVisible();
  expect((await readRecord(page))?.document).toEqual(
    JSON.parse(await readFile(exampleArchive, "utf8")),
  );
});

test("keeps recovery data after a deletion failure and allows another confirmed clear", async ({
  page,
}) => {
  const record = await seedArchive(page, invalidArchive);
  await expectRecovery(page);
  await failNextStorageOperation(page, "clearDocument");
  await page
    .getByRole("button", { name: "Clear local data", exact: true })
    .click();
  await page
    .getByRole("alertdialog", { name: "Clear local data", exact: true })
    .getByRole("button", { name: "Clear local data", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({
      hasText:
        "The local archive could not be cleared. Your stored data has not been changed.",
    }),
  ).toBeVisible();
  await expectRecovery(page);
  expect(await readRecord(page)).toEqual(record);
  await page
    .getByRole("button", { name: "Clear local data", exact: true })
    .click();
  await page
    .getByRole("alertdialog", { name: "Clear local data", exact: true })
    .getByRole("button", { name: "Clear local data", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Create my archive", exact: true }),
  ).toBeVisible();
  expect(await readRecord(page)).toBeNull();
});

test("keeps the previous recovery source after a retry read failure and can retry again", async ({
  page,
}) => {
  const record = await seedArchive(page, invalidArchive);
  await expectRecovery(page);
  await failNextStorageOperation(page, "loadDocument");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({
      hasText:
        "The local archive could not be read. Your stored data has not been changed.",
    }),
  ).toBeVisible();
  await expectRecovery(page);
  expect(await readRecord(page)).toEqual(record);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expectRecovery(page);
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeEnabled();
  expect(await readRecord(page)).toEqual(record);
});

test("retry opens an archive made readable elsewhere without overwriting its record", async ({
  page,
}) => {
  await seedArchive(page, invalidArchive);
  await expectRecovery(page);
  const archive = JSON.parse(await readFile(exampleArchive, "utf8"));
  const record = await writeRecord(page, archive);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("button", { name: /Open UA123/ })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: recoveryTitle, exact: true }),
  ).toHaveCount(0);
  expect(await readRecord(page)).toEqual(record);
});

test("keeps recovery visible when viewer preferences cannot be read at startup", async ({
  page,
}) => {
  const record = await seedArchive(page, invalidArchive);
  await expectRecovery(page);
  await page.route("**/src/storage/browser.ts", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    expect(source).toContain("async loadSettings() {");
    await route.fulfill({
      response,
      body: source.replace(
        "async loadSettings() {",
        'async loadSettings() { throw new Error("Preferences unavailable");',
      ),
    });
  });
  await page.reload();
  await expectRecovery(page);
  await expect(page.getByRole("alert")).toContainText(
    "Local storage is unavailable.",
  );
  expect(await readRecord(page)).toEqual(record);
});

test("reports backup file read failures and permits another import without modifying recovery data", async ({
  page,
}) => {
  const record = await seedArchive(page, invalidArchive);
  await expectRecovery(page);
  await page.evaluate(() => {
    const read = File.prototype.text;
    File.prototype.text = async function () {
      File.prototype.text = read;
      throw new Error("Backup file unavailable");
    };
  });
  const input = page.locator('input[type="file"][accept*=".json"]');
  await input.setInputFiles(exampleArchive);
  await expect(page.getByRole("alert")).toContainText(
    "The backup could not be opened. Your stored data has not been changed.",
  );
  await expect(input).toBeEnabled();
  expect(await readRecord(page)).toEqual(record);
  await input.setInputFiles(exampleArchive);
  await expect(
    page.getByRole("button", { name: "Import this archive", exact: true }),
  ).toBeEnabled();
  expect(await readRecord(page)).toEqual(record);
});

test("recovery and its confirmation dialog have no accessibility violations", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedArchive(page, invalidArchive);
  await expectRecovery(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.evaluate(async () => {
    const modulePath = "/src/storage/browser.ts";
    const { browserStorage } = await import(modulePath);
    await browserStorage.saveSettings({
      language: "en",
      appearance: "dark",
      distanceUnit: "miles",
      timeFormat: "24-hour",
      powerUserMode: false,
    });
  });
  await page.reload();
  await expectRecovery(page);
  await expect(page.locator(".recovery-heading h1")).toHaveCSS(
    "color",
    "rgb(244, 246, 248)",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page
      .locator("html")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Clear local data", exact: true })
    .click();
  await expect(
    page.getByRole("alertdialog", { name: "Clear local data", exact: true }),
  ).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include(".confirmation-dialog").analyze())
      .violations,
  ).toEqual([]);
});

for (const locale of [
  {
    language: "zh-CN",
    title: "无法打开本地飞行档案",
    preservation:
      "Keepraw Fly 在此设备上检测到了现有数据，但当前版本无法正常读取。原始数据尚未被修改或删除。",
  },
  {
    language: "zh-TW",
    title: "無法開啟本機飛行檔案",
    preservation:
      "Keepraw Fly 在此裝置上偵測到現有資料，但目前版本無法正常讀取。原始資料尚未被修改或刪除。",
  },
]) {
  test(`shows recovery in ${locale.language}`, async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Create my archive", exact: true }),
    ).toBeVisible();
    const record = await writeRecord(page, invalidArchive);
    await page.evaluate(async (language) => {
      const modulePath = "/src/storage/browser.ts";
      const { browserStorage } = await import(modulePath);
      await browserStorage.saveSettings({
        language,
        appearance: "system",
        distanceUnit: "kilometers",
        timeFormat: "24-hour",
        powerUserMode: false,
      });
    }, locale.language);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: locale.title, exact: true, level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByText(locale.preservation, { exact: true }),
    ).toBeVisible();
    expect(await readRecord(page)).toEqual(record);
  });
}
