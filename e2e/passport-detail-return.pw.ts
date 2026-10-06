import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";

// Both scrollports and SVG-to-row keyboard focus have engine-specific behavior.

async function importLongArchive(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const archive: KeeprawFlyDocument = JSON.parse(await readFile(new URL("../examples/basic.keepraw-fly.json", import.meta.url), "utf8"));
  archive.flights = Array.from({ length: 30 }, (_, index) => {
    const serviceDate = `2026-09-${String(30 - index).padStart(2, "0")}`;
    return {
      id: `flight-${index}`, flightNumber: `CX${100 + index}`, serviceDate, airline: { iata: "CX" },
      origin: { iata: index === 24 ? "SZX" : "HKG" }, destination: { iata: index === 24 ? "PEK" : "TAO" },
      scheduledDeparture: `${serviceDate}T10:00:00+08:00`, scheduledArrival: `${serviceDate}T12:00:00+08:00`,
    };
  });
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "return-position.keepraw-fly.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(archive)),
  });
  await page.getByRole("button", { name: "Import this archive" }).click();
  await expect(page.locator(".flight-row")).toHaveCount(30);
}

function flightRow(page: Page, index: number) {
  return page.locator(`[data-flight-id="flight-${index}"] .flight-row`);
}

async function expectRestoredWithoutSelection(page: Page, row: Locator) {
  await page.locator(".detail-header-back").click();
  await page.mouse.move(0, 0);
  // Intersection with the viewport also accounts for the desktop list scrollport.
  // Allow subpixel rounding at the viewport edge (notably in mobile Firefox).
  await expect(row).toBeInViewport({ ratio: 0.99 });
  await expect(page.locator(".flight-record.is-selected, .flight-row.is-selected, .flight-row[aria-current]")).toHaveCount(0);
  await expect(row).toHaveCSS("box-shadow", "none");
  await expect(row).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
}

for (const width of [1280, 390]) {
  test(`restores the opened flight without selection at ${width}px`, { tag: "@cross-browser" }, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 });
    await importLongArchive(page);
    // Keep a year and search active to verify navigation preserves the list scope.
    await page.getByRole("button", { name: "2026", exact: true }).click();
    await page.locator("#passport-flight-search").fill("CX");
    const row = flightRow(page, 24);
    await expect(row).not.toBeInViewport();
    await row.click();
    await expect(page.locator(".detail-flight-card")).toBeVisible();
    await expectRestoredWithoutSelection(page, row);
    await expect(page.locator("#passport-flight-search")).toHaveValue("CX");
    await expect(page.getByRole("button", { name: "2026", exact: true })).toHaveAttribute("aria-pressed", "true");
    if (width > 760) {
      expect(await page.locator(".passport-archive-scroll").evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    } else {
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    }
  });
}

test("restores the adjacent detail flight without selecting it", { tag: "@cross-browser" }, async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await importLongArchive(page);
  await flightRow(page, 24).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".detail-flight-card")).toContainText("CX125");
  await expectRestoredWithoutSelection(page, flightRow(page, 25));
});

for (const source of ["airport", "route"] as const) {
  test(`map ${source} selection still scrolls, focuses and highlights the flight`, { tag: "@cross-browser" }, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await importLongArchive(page);
    const row = flightRow(page, 24);
    await expect(row).not.toBeInViewport();
    const mapItem = page.locator(`.map-${source}`).filter({ hasText: source === "airport" ? "SZX" : "SZX to PEK" });
    await mapItem.focus();
    await page.keyboard.press("Enter");
    await expect(row).toBeInViewport({ ratio: 0.99 });
    await expect(row).toBeFocused();
    await expect(row).toHaveClass(/is-selected/);
    await expect(row).toHaveAttribute("aria-current", "true");
    await expect(page.locator(".flight-row.is-selected")).toHaveCount(1);
    expect(await row.evaluate(element => getComputedStyle(element).boxShadow)).toContain("inset");
    // Opening an explicitly selected record must also end its list selection.
    await row.click();
    await expect(page.locator(".detail-flight-card")).toBeVisible();
    await expectRestoredWithoutSelection(page, row);
  });
}
