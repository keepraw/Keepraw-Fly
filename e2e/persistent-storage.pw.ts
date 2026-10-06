import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

type RequestOutcome = "granted" | "declined" | "failed";

declare global {
  interface Window {
    storageProtectionTest: {
      granted: boolean;
      persistCalls: number;
      persistedCalls: number;
      readFails: boolean;
      finish: (outcome: RequestOutcome) => void;
    };
  }
}

async function mockStorage(page: Page, options: { granted: boolean; supported: boolean; readFails?: boolean } = { granted: false, supported: true }) {
  await page.addInitScript(({ granted, supported, readFails }) => {
    const state: Window["storageProtectionTest"] = window.storageProtectionTest = {
      granted,
      persistCalls: 0,
      persistedCalls: 0,
      readFails: readFails ?? false,
      finish: (_outcome: RequestOutcome) => { throw new Error("No pending storage request"); },
    };
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: supported ? {
        persisted: async () => {
          state.persistedCalls++;
          if (state.readFails) throw new Error("Storage status unavailable");
          return state.granted;
        },
        persist: () => {
          state.persistCalls++;
          return new Promise<boolean>((resolve, reject) => {
            state.finish = (outcome) => {
              if (outcome === "failed") reject(new Error("Storage request failed"));
              else {
                state.granted = outcome === "granted";
                resolve(state.granted);
              }
            };
          });
        },
      } : undefined,
    });
  }, options);
  await page.goto("/#settings");
  await expect(page.locator(".settings-page")).toBeVisible();
}

for (const firstOutcome of ["declined", "failed"] as const) {
  test(`retries persistent storage after persist() ${firstOutcome} and disables only pending/granted requests`, async ({ page }) => {
    await mockStorage(page);
    const status = page.locator(".settings-storage-status");
    const request = page.getByRole("button", { name: "Request persistent storage", exact: true });
    await expect(status).toHaveText("Persistent storage can be requested");
    // Persistence requests work in a normal tab, without an installation event.
    expect(await page.evaluate(() => matchMedia("(display-mode: standalone)").matches)).toBe(false);
    expect(await page.evaluate(() => window.storageProtectionTest.persistCalls)).toBe(0);
    const storageRow = status.locator("..");
    await expect(storageRow).toContainText("cannot prevent manual clearing of site data or replace JSON backups");
    await expect(storageRow).toContainText("Installing Keepraw Fly as an app is not required");
    expect(await page.evaluate(() => ({
      secure: window.isSecureContext,
      persist: typeof navigator.storage.persist,
      persisted: window.storageProtectionTest.persistedCalls > 0,
    }))).toEqual({ secure: true, persist: "function", persisted: true });

    // A normal Playwright click checks hit testing, including overlays and pointer-events.
    await request.click();
    const pending = page.getByRole("button", { name: "Requesting persistent storage…", exact: true });
    await expect(pending).toBeDisabled();
    await pending.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
    expect(await page.evaluate(() => window.storageProtectionTest.persistCalls)).toBe(1);
    await page.evaluate((outcome) => window.storageProtectionTest.finish(outcome), firstOutcome);
    await expect(status).toHaveText(firstOutcome === "declined" ? "Persistent storage can be requested" : "Unable to read persistent storage status");
    if (firstOutcome === "failed") {
      await expect(page.getByText("The persistent storage request failed. Please try again; keep regular JSON backups.", { exact: true })).toBeVisible();
    } else {
      await expect(page.getByText("The browser has not granted persistent storage. Keepraw Fly still works normally; export JSON backups regularly.", { exact: true })).toBeVisible();
      await expect(page.getByRole("alert")).toHaveCount(0);
    }
    await expect(request).toBeEnabled();

    // No reload or remount: the second click must reach the actual StorageManager method.
    await request.click();
    await expect(pending).toBeDisabled();
    expect(await page.evaluate(() => window.storageProtectionTest.persistCalls)).toBe(2);
    await page.evaluate(() => window.storageProtectionTest.finish("granted"));
    await expect(status).toHaveText("Persistent storage enabled");
    await expect(page.locator(".settings-backup-status")).toHaveText("No backup yet");
    await expect(page.getByText("The browser has granted persistent storage. Continue exporting JSON backups regularly.", { exact: true })).toBeVisible();
    const grantedButton = page.getByRole("button", { name: "Persistent storage enabled", exact: true });
    await expect(grantedButton).toBeDisabled();
    await grantedButton.evaluate((button: HTMLButtonElement) => button.click());
    expect(await page.evaluate(() => window.storageProtectionTest.persistCalls)).toBe(2);
  });
}

test("shows existing persistent storage without requesting again", async ({ page }) => {
  await mockStorage(page, { granted: true, supported: true });
  await expect(page.locator(".settings-storage-status")).toHaveText("Persistent storage enabled");
  await expect(page.locator(".settings-backup-status")).toHaveText("No backup yet");
  await expect(page.getByRole("button", { name: "Persistent storage enabled", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => window.storageProtectionTest.persistCalls)).toBe(0);
});

test("does not offer an enabled request when storage APIs are unsupported", async ({ page }) => {
  await mockStorage(page, { granted: false, supported: false });
  await expect(page.locator(".settings-storage-status")).toHaveText("This browser does not support persistent storage requests");
  await expect(page.getByRole("button", { name: "Request persistent storage", exact: true })).toBeDisabled();
  await expect(page.locator(".settings-storage-status").locator("..")).toContainText("JSON backups");
  expect(await page.evaluate(() => window.storageProtectionTest.persistCalls)).toBe(0);
});

test("reports an unreadable persistent storage status and permits an explicit retry", async ({ page }) => {
  await mockStorage(page, { granted: false, supported: true, readFails: true });
  await expect(page.locator(".settings-storage-status")).toHaveText("Unable to read persistent storage status");
  const request = page.getByRole("button", { name: "Request persistent storage", exact: true });
  await expect(request).toBeEnabled();
  expect(await page.evaluate(() => window.storageProtectionTest.persistCalls)).toBe(0);
  await page.evaluate(() => { window.storageProtectionTest.readFails = false; });
  await request.click();
  await expect(page.getByRole("button", { name: "Requesting persistent storage…", exact: true })).toBeDisabled();
  await page.evaluate(() => window.storageProtectionTest.finish("granted"));
  await expect(page.locator(".settings-storage-status")).toHaveText("Persistent storage enabled");
});

for (const event of ["focus", "visibilitychange"] as const) {
  test(`refreshes persistent storage after ${event} without requesting it`, async ({ page }) => {
    await mockStorage(page);
    await expect(page.locator(".settings-storage-status")).toHaveText("Persistent storage can be requested");
    for (const granted of [true, false]) {
      await page.evaluate(({ granted, event }) => {
        window.storageProtectionTest.granted = granted;
        if (event === "focus") window.dispatchEvent(new Event(event));
        else {
          Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
          document.dispatchEvent(new Event(event));
        }
      }, { granted, event });
      await expect(page.locator(".settings-storage-status")).toHaveText(granted
        ? "Persistent storage enabled" : "Persistent storage can be requested");
      await expect(page.getByRole("button", { name: granted ? "Persistent storage enabled" : "Request persistent storage", exact: true }))
        .toBeEnabled({ enabled: !granted });
    }
    expect(await page.evaluate(() => window.storageProtectionTest.persistCalls)).toBe(0);
  });
}

for (const locale of [
  { language: "en", title: "Persistent storage", available: "Persistent storage can be requested", granted: "Persistent storage enabled", request: "Request persistent storage" },
  { language: "zh-CN", title: "浏览器持久存储", available: "可申请持久存储", granted: "已启用持久存储", request: "申请持久存储" },
  { language: "zh-TW", title: "瀏覽器持久儲存", available: "可申請持久儲存", granted: "已啟用持久儲存", request: "申請持久儲存" },
]) {
  test(`explains persistent storage and JSON backups in ${locale.language} at mobile width`, async ({ page }) => {
    await mockStorage(page);
    await page.getByRole("combobox", { name: "Language", exact: true }).selectOption(locale.language);
    await page.setViewportSize({ width: 390, height: 844 });
    const status = page.locator(".settings-storage-status");
    await expect(status).toHaveText(locale.available);
    const row = status.locator("..");
    await expect(row).toContainText(locale.title);
    await expect(row).toContainText("JSON");
    const request = page.getByRole("button", { name: locale.request, exact: true });
    await request.scrollIntoViewIfNeeded();
    await request.click();
    await expect.poll(() => page.evaluate(() => window.storageProtectionTest.persistCalls)).toBe(1);
    await page.evaluate(() => window.storageProtectionTest.finish("granted"));
    await expect(status).toHaveText(locale.granted);
    await expect(row.locator('small[role="status"]')).toContainText("JSON");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    expect(await page.getByRole("button", { name: locale.granted, exact: true }).evaluate(element =>
      element.scrollWidth <= element.clientWidth)).toBe(true);
  });
}

test("rechecks persistent storage granted elsewhere before requesting", async ({ page }) => {
  await mockStorage(page);
  await expect(page.locator(".settings-storage-status")).toHaveText("Persistent storage can be requested");
  await page.evaluate(() => { window.storageProtectionTest.granted = true; });
  await page.getByRole("button", { name: "Request persistent storage", exact: true }).click();
  await expect(page.locator(".settings-storage-status")).toHaveText("Persistent storage enabled");
  expect(await page.evaluate(() => window.storageProtectionTest.persistCalls)).toBe(0);
});

test("reads native persistent storage without assuming the browser grants it", { tag: "@cross-browser" }, async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/#settings");
  const status = page.locator(".settings-storage-status");
  const settled = /^(Persistent storage enabled|Persistent storage can be requested|This browser does not support persistent storage requests|Unable to read persistent storage status)$/;
  await expect(status).toHaveText(settled);
  const capabilities = await page.evaluate(() => ({
    persist: typeof navigator.storage?.persist === "function",
    persisted: typeof navigator.storage?.persisted === "function",
  }));
  testInfo.annotations.push({ type: "native-storage", description: JSON.stringify(capabilities) });
  const request = page.getByRole("button", { name: "Request persistent storage", exact: true });
  if (await status.textContent() === "Persistent storage enabled") {
    await expect(page.getByRole("button", { name: "Persistent storage enabled", exact: true })).toBeDisabled();
  } else if (!capabilities.persist || !capabilities.persisted) {
    await expect(status).toHaveText("This browser does not support persistent storage requests");
    await expect(request).toBeDisabled();
  } else {
    await expect(request).toBeEnabled();
  }
  // Native permission prompts are browser UI and can remain pending in headless
  // Firefox. The shared tests above cover granted/declined/error request outcomes;
  // this test independently checks the real API and the initial status.
  const granted = await page.evaluate(async () => {
    try { return await navigator.storage?.persisted?.() ?? false; }
    catch { return null; }
  });
  if (granted === true) {
    await expect(status).toHaveText("Persistent storage enabled");
  } else {
    await expect(status).not.toHaveText("Persistent storage enabled");
    await expect(page.getByText("The browser has granted persistent storage. Continue exporting JSON backups regularly.", { exact: true })).toHaveCount(0);
  }
  testInfo.annotations.push({ type: "native-storage-result", description: await status.innerText() });
  expect(errors).toEqual([]);
});
