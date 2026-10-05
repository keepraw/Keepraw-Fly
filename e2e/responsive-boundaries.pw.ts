import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { KeeprawFlight } from "@keepraw-fly/schema";

const viewports = [
  { width: 768, height: 1024 },
  { width: 844, height: 390 },
  { width: 760, height: 900 },
  { width: 761, height: 900 },
  { width: 1366, height: 768 },
];

function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error") errors.push(`console.error: ${message.text()}`);
  });
  return errors;
}

async function importArchive(page: Page) {
  // Use the same example and import/IndexedDB path as the existing E2E journeys.
  const archive = JSON.parse(await readFile(new URL("../examples/basic.keepraw-fly.json", import.meta.url), "utf8"));
  const flight: KeeprawFlight = archive.flights[0];
  // Enough rows to exercise internal archive scrolling even in tablet portrait.
  archive.flights = Array.from({ length: 12 }, (_, index) => ({
    ...flight, id: `${flight.id}-${index}`, flightNumber: `UA${123 + index}`,
  }));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Create my archive", exact: true })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "boundaries.keepraw-fly.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(archive)),
  });
  await page.getByRole("button", { name: "Import this archive", exact: true }).click();
  await expect(page.locator(".flight-row")).toHaveCount(12);
  await expect(page.locator(".persistence-status")).toHaveText("");
}

async function expectHealthyPage(page: Page, errors: string[]) {
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth),
  { message: "document must have no horizontal overflow (zero tolerance)" }).toBeLessThanOrEqual(0);
  expect(errors, "no uncaught page exception or console.error").toEqual([]);
}

async function expectReachable(control: Locator) {
  await control.scrollIntoViewIfNeeded();
  await expect(control, "control must be fully inside the viewport and its clipping ancestors").toBeInViewport({ ratio: 1 });
  await expect(control).toBeEnabled();
  // A rendered box alone does not prove another element is not covering it.
  await control.click({ trial: true });
}

async function expectColumns(grid: Locator, count: number) {
  await expect(grid).toHaveCSS("display", "grid");
  await expect.poll(() => grid.evaluate(element =>
    getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length),
  { message: `layout must resolve to ${count} grid columns` }).toBe(count);
}

async function expectShell(page: Page, mobile: boolean, current: "passport" | "settings") {
  await expect(page.locator(".site-header")).toHaveCSS("position", mobile ? "relative" : "sticky");
  await expect(page.locator(".site-navigation")).toHaveCSS("display", mobile ? "none" : "flex");
  await expect(page.locator(".mobile-page-heading")).toHaveCSS("display", mobile ? "flex" : "none");
  await expectReachable(mobile
    ? page.getByRole("button", { name: current === "passport" ? "Settings" : "Back to Flight Passport", exact: true })
    : page.locator(`.site-navigation a[href="#${current === "passport" ? "settings" : "passport"}"]`));
}

async function navigateTo(page: Page, destination: "passport" | "settings") {
  // Match the existing main E2E's navigation pattern; use the actual UI, not goto.
  if (await page.locator(".mobile-page-heading").isVisible()) {
    await page.locator(destination === "settings" ? ".mobile-settings-button" : ".mobile-page-back").click();
  } else {
    await page.locator(`.site-navigation a[href="#${destination}"]`).click();
  }
  await expect(page.locator(`.${destination}-page`)).toBeVisible();
}

async function expectPassportLayout(page: Page, mobile: boolean) {
  const layout = page.locator(".passport-layout");
  await expect(layout).toHaveCSS("display", mobile ? "flex" : "grid");
  await expect(page.locator(".passport-archive")).toHaveCSS("display", mobile ? "contents" : "flex");
  await expect(page.locator(".passport-archive-scroll")).toHaveCSS("overflow-y", mobile ? "visible" : "auto");
  if (mobile) {
    await expect(layout).toHaveCSS("flex-direction", "column");
    await expect(page.locator(".passport-mobile-summary")).toBeVisible();
    await expect(page.locator(".route-map, .route-map-loading, .passport-highlights")).toHaveCount(0);
  } else {
    await expectColumns(layout, 2);
    await expect(page.locator(".passport-mobile-summary")).toBeHidden();
    await expect(page.locator(".route-map-canvas")).toBeVisible();
    await expect(page.locator(".passport-highlights")).toHaveCount(1);
    await expect(page.locator(".passport-highlights")).toBeVisible();
  }
}

async function expectDetailLayout(page: Page, mobile: boolean) {
  await expectColumns(page.locator(".detail-operational-grid"), mobile ? 1 : 2);
  await expect(page.locator(".detail-adjacent-navigation")).toHaveCSS("display", mobile ? "none" : "flex");
  await expect(page.locator(".detail-header-more")).toHaveCSS("display", mobile ? "block" : "none");
  if (mobile) {
    await expect(page.locator(".detail-route-map, .detail-route-map-loading")).toHaveCount(0);
  } else {
    await expect(page.locator(".detail-route-map-canvas")).toBeVisible();
  }
  await expect(page.locator(".detail-stop--departure")).toContainText("SFO");
  await expect(page.locator(".detail-stop--arrival")).toContainText("LAX");
}

async function expectSettingsLayout(page: Page, mobile: boolean) {
  // Toggle rows intentionally retain two columns on mobile; use an ordinary row.
  await expectColumns(page.getByRole("combobox", { name: "Appearance", exact: true }).locator(".."), mobile ? 1 : 2);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

for (const viewport of viewports) {
  test(`Passport, Flight Detail and Settings remain reachable without document overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const errors = collectBrowserErrors(page);
    const mobile = viewport.width <= 760;
    await page.setViewportSize(viewport);
    await importArchive(page);

    await test.step("Passport: correct layout mode, navigation, scrollable flight rows and add-flight entry", async () => {
      await expectShell(page, mobile, "passport");
      await expectPassportLayout(page, mobile);
      await expectHealthyPage(page, errors);
      await expectReachable(page.locator(".flight-row").last());
      await expectReachable(page.getByRole("button", { name: "Add flight", exact: true }));
      await page.getByRole("button", { name: "Add flight", exact: true }).click();
      const editor = page.getByRole("dialog", { name: "Add a flight", exact: true });
      await expect(editor).toBeVisible();
      await expectReachable(editor.getByRole("button", { name: "Cancel", exact: true }).last());
      await expectHealthyPage(page, errors);
      await editor.getByRole("button", { name: "Cancel", exact: true }).last().click();
      await expect(editor).toHaveCount(0);
      if (!mobile) {
        // The short-height desktop layout has a separately scrolling right column.
        await expectReachable(page.locator("button.passport-spotlight-item").first());
      }
      await expectHealthyPage(page, errors);
    });

    await test.step("Flight Detail: correct column/map mode, flight content and edit/back actions", async () => {
      await page.getByRole("button", { name: "Open UA123, SFO to LAX", exact: true }).click();
      await expect(page.locator(".detail-heading-eyebrow")).toContainText("UA123");
      await expectDetailLayout(page, mobile);
      await expectReachable(page.locator(".detail-stop--arrival .detail-airport-time"));
      const edit = page.getByRole("button", { name: "Edit flight", exact: true });
      await expectReachable(edit);
      await edit.click();
      const editor = page.getByRole("dialog", { name: "Edit flight", exact: true });
      await expect(editor.getByLabel("Flight number")).toHaveValue("UA123");
      await expectReachable(editor.getByRole("button", { name: "Cancel", exact: true }).last());
      await expectHealthyPage(page, errors);
      await editor.getByRole("button", { name: "Cancel", exact: true }).last().click();
      await expect(editor).toHaveCount(0);
      await expectHealthyPage(page, errors);
      await expectReachable(page.locator(".detail-header-back"));
      await page.locator(".detail-header-back").click();
    });

    await test.step("Settings: accessible navigation, responsive rows and operable preferences", async () => {
      await navigateTo(page, "settings");
      await expectShell(page, mobile, "settings");
      await expectSettingsLayout(page, mobile);
      const appearance = page.getByRole("combobox", { name: "Appearance", exact: true });
      await expectReachable(appearance);
      await appearance.selectOption("dark");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await expectReachable(page.locator(".import-control-settings > .settings-action"));
      await expectHealthyPage(page, errors);
      await navigateTo(page, "passport");
      await expectPassportLayout(page, mobile);
      await expectHealthyPage(page, errors);
    });

    await test.step("Resize: switching to the opposite mode and back leaves no stale layout or page errors", async () => {
      await page.setViewportSize(mobile ? { width: 761, height: 900 } : { width: 760, height: 900 });
      await expectPassportLayout(page, !mobile);
      await expectHealthyPage(page, errors);
      await page.setViewportSize(viewport);
      await expectShell(page, mobile, "passport");
      await expectPassportLayout(page, mobile);
      await expect(page.locator(".flight-row")).toHaveCount(12);
      await expectHealthyPage(page, errors);
    });
  });
}

test("Passport, Flight Detail and Settings switch actual layout and retain state across 760/761 breakpoint resizes", async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.setViewportSize({ width: 760, height: 900 });
  await importArchive(page);
  await page.getByRole("searchbox").fill("UA123");
  await expect(page.locator(".flight-row")).toHaveCount(1);

  await test.step("Passport: 760→761→760→761 updates CSS and map/highlights DOM without losing search", async () => {
    for (const width of [760, 761, 760, 761]) {
      await page.setViewportSize({ width, height: 900 });
      await expectShell(page, width === 760, "passport");
      await expectPassportLayout(page, width === 760);
      await expect(page.getByRole("searchbox")).toHaveValue("UA123");
      await expect(page.locator(".flight-row")).toHaveCount(1);
      await expectHealthyPage(page, errors);
    }
  });

  await page.getByRole("button", { name: "Open UA123, SFO to LAX", exact: true }).click();
  await test.step("Flight Detail: 761→760→761→760 updates columns and map DOM on the same flight", async () => {
    for (const width of [761, 760, 761, 760]) {
      await page.setViewportSize({ width, height: 900 });
      await expectDetailLayout(page, width === 760);
      await expect(page.locator(".detail-heading-eyebrow")).toContainText("UA123");
      await expectReachable(page.locator(".detail-header-back"));
      await expectHealthyPage(page, errors);
    }
  });
  await page.locator(".detail-header-back").click();
  await navigateTo(page, "settings");
  await test.step("Settings: 760→761→760→761 updates navigation and row columns without remounting", async () => {
    for (const width of [760, 761, 760, 761]) {
      await page.setViewportSize({ width, height: 900 });
      await expectShell(page, width === 760, "settings");
      await expectSettingsLayout(page, width === 760);
      await expectHealthyPage(page, errors);
    }
  });
});
