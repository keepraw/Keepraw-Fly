import { expect, test, type Page } from "@playwright/test";

type RequestOutcome = "granted" | "declined" | "failed";

declare global {
  interface Window {
    storageProtectionTest: {
      granted: boolean;
      persistCalls: number;
      persistedCalls: number;
      finish: (outcome: RequestOutcome) => void;
    };
  }
}

async function mockStorage(page: Page, options = { granted: false, supported: true }) {
  await page.addInitScript(({ granted, supported }) => {
    const state: Window["storageProtectionTest"] = window.storageProtectionTest = {
      granted,
      persistCalls: 0,
      persistedCalls: 0,
      finish: (_outcome: RequestOutcome) => { throw new Error("No pending storage request"); },
    };
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: supported ? {
        persisted: async () => { state.persistedCalls++; return state.granted; },
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
  test(`retries protection after persist() ${firstOutcome} and disables only pending/granted requests`, async ({ page }) => {
    await mockStorage(page);
    const status = page.locator(".settings-storage-status");
    const request = page.getByRole("button", { name: "Request protection", exact: true });
    await expect(status).toHaveText("Not protected");
    expect(await page.evaluate(() => ({
      secure: window.isSecureContext,
      persist: typeof navigator.storage.persist,
      persisted: window.storageProtectionTest.persistedCalls > 0,
    }))).toEqual({ secure: true, persist: "function", persisted: true });

    // A normal Playwright click checks hit testing, including overlays and pointer-events.
    await request.click();
    const pending = page.getByRole("button", { name: "Requesting protection…", exact: true });
    await expect(pending).toBeDisabled();
    await pending.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
    expect(await page.evaluate(() => window.storageProtectionTest.persistCalls)).toBe(1);
    await page.evaluate((outcome) => window.storageProtectionTest.finish(outcome), firstOutcome);
    await expect(status).toHaveText(firstOutcome === "declined" ? "Not protected" : "Unable to read protection status");
    if (firstOutcome === "failed") {
      await expect(page.getByText("The protection request failed. Please try again.", { exact: true })).toBeVisible();
    }
    await expect(request).toBeEnabled();

    // No reload or remount: the second click must reach the actual StorageManager method.
    await request.click();
    await expect(pending).toBeDisabled();
    expect(await page.evaluate(() => window.storageProtectionTest.persistCalls)).toBe(2);
    await page.evaluate(() => window.storageProtectionTest.finish("granted"));
    await expect(status).toHaveText("Protected");
    const protectedButton = page.getByRole("button", { name: "Protected", exact: true });
    await expect(protectedButton).toBeDisabled();
    await protectedButton.evaluate((button: HTMLButtonElement) => button.click());
    expect(await page.evaluate(() => window.storageProtectionTest.persistCalls)).toBe(2);
  });
}

test("shows existing protection without requesting again", async ({ page }) => {
  await mockStorage(page, { granted: true, supported: true });
  await expect(page.locator(".settings-storage-status")).toHaveText("Protected");
  await expect(page.getByRole("button", { name: "Protected", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => window.storageProtectionTest.persistCalls)).toBe(0);
});

test("does not offer an enabled request when storage APIs are unsupported", async ({ page }) => {
  await mockStorage(page, { granted: false, supported: false });
  await expect(page.locator(".settings-storage-status")).toHaveText("Not protected — unsupported by this browser");
  await expect(page.getByRole("button", { name: "Request protection", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => window.storageProtectionTest.persistCalls)).toBe(0);
});

test("rechecks protection granted elsewhere before requesting", async ({ page }) => {
  await mockStorage(page);
  await expect(page.locator(".settings-storage-status")).toHaveText("Not protected");
  await page.evaluate(() => { window.storageProtectionTest.granted = true; });
  await page.getByRole("button", { name: "Request protection", exact: true }).click();
  await expect(page.locator(".settings-storage-status")).toHaveText("Protected");
  expect(await page.evaluate(() => window.storageProtectionTest.persistCalls)).toBe(0);
});
