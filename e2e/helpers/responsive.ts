import { expect, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { KeeprawFlight } from "@keepraw-fly/schema";

export function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error") errors.push(`console.error: ${message.text()}`);
  });
  return errors;
}

export async function importArchive(page: Page, flights?: KeeprawFlight[]) {
  // Use the same example and import/IndexedDB path as the existing E2E journeys.
  const archive = JSON.parse(await readFile(new URL("../../examples/basic.keepraw-fly.json", import.meta.url), "utf8"));
  const flight: KeeprawFlight = archive.flights[0];
  // Enough rows to exercise internal archive scrolling even in tablet portrait.
  archive.flights = flights ?? Array.from({ length: 12 }, (_, index) => ({
    ...flight, id: `${flight.id}-${index}`, flightNumber: `UA${123 + index}`,
  }));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Create my archive", exact: true })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "boundaries.keepraw-fly.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(archive)),
  });
  await page.getByRole("button", { name: "Import this archive", exact: true }).click();
  await expect(page.locator(".flight-row")).toHaveCount(archive.flights.length);
  await expect(page.locator(".persistence-status")).toHaveText("");
}

export async function expectHealthyPage(page: Page, errors: string[]) {
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth),
  { message: "document must have no horizontal overflow (zero tolerance)" }).toBeLessThanOrEqual(0);
  expect(errors, "no uncaught page exception or console.error").toEqual([]);
}

export async function expectReachable(control: Locator) {
  await control.scrollIntoViewIfNeeded();
  // Native scrolling honors scroll-padding, whose optimal region can be smaller
  // than a flight row at short heights. Center in the actual scrollport instead;
  // a control that cannot fit still fails the full-intersection assertion below.
  await control.evaluate(element => {
    for (let container = element.parentElement; container; container = container.parentElement) {
      if (!/^(auto|scroll)$/.test(getComputedStyle(container).overflowY)
        || container.scrollHeight <= container.clientHeight) continue;
      const target = element.getBoundingClientRect();
      if (target.height > container.clientHeight) continue;
      const top = container.getBoundingClientRect().top + container.clientTop;
      container.scrollTop += target.top - top - (container.clientHeight - target.height) / 2;
    }
  });
  await expectUnclipped(control);
  await expect(control).toBeEnabled();
  // A rendered box alone does not prove another element is not covering it.
  await control.click({ trial: true });
}

export async function expectColumns(grid: Locator, count: number) {
  await expect(grid).toHaveCSS("display", "grid");
  await expect.poll(() => grid.evaluate(element =>
    getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length),
  { message: `layout must resolve to ${count} grid columns` }).toBe(count);
}

export async function expectUnclipped(element: Locator) {
  await expect(element).toBeVisible();
  // WebKit's IntersectionObserver can snap fractional edges inward (<1px).
  // Keep a near-full intersection AND check every clipping edge in CSS pixels.
  await expect(element).toBeInViewport({ ratio: 0.99 });
  await expect.poll(() => element.evaluate(target => {
    const rect = target.getBoundingClientRect();
    const failures: string[] = [];
    if (rect.left < -1 || rect.right > innerWidth + 1
      || rect.top < -1 || rect.bottom > innerHeight + 1) failures.push("viewport");
    for (let ancestor = target.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      const bounds = ancestor.getBoundingClientRect();
      const left = bounds.left + ancestor.clientLeft;
      const top = bounds.top + ancestor.clientTop;
      // One CSS pixel allows fractional layout rounding, not missing text.
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX)
        && (rect.left < left - 1 || rect.right > left + ancestor.clientWidth + 1)) failures.push(`${ancestor.className}: x`);
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY)
        && (rect.top < top - 1 || rect.bottom > top + ancestor.clientHeight + 1)) failures.push(`${ancestor.className}: y`);
    }
    return failures;
  }), { message: "element must fit the viewport and every clipping ancestor's actual scrollport" }).toEqual([]);
}

export async function expectSeparateBoxes(first: Locator, second: Locator) {
  const a = await first.boundingBox();
  const b = await second.boundingBox();
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  expect(a!.x + a!.width <= b!.x || b!.x + b!.width <= a!.x
    || a!.y + a!.height <= b!.y || b!.y + b!.height <= a!.y,
  "rendered rectangles must not overlap").toBe(true);
}

export async function expectShell(page: Page, mobile: boolean, current: "passport" | "settings") {
  await expect(page.locator(".site-header")).toHaveCSS("position", mobile ? "relative" : "sticky");
  await expect(page.locator(".site-navigation")).toHaveCSS("display", mobile ? "none" : "flex");
  await expect(page.locator(".mobile-page-heading")).toHaveCSS("display", mobile ? "flex" : "none");
  await expectReachable(mobile
    ? page.getByRole("button", { name: current === "passport" ? "Settings" : "Back to Flight Passport", exact: true })
    : page.locator(`.site-navigation a[href="#${current === "passport" ? "settings" : "passport"}"]`));
}

export async function navigateTo(page: Page, destination: "passport" | "settings") {
  // Match the existing main E2E's navigation pattern; use the actual UI, not goto.
  if (await page.locator(".mobile-page-heading").isVisible()) {
    await page.locator(destination === "settings" ? ".mobile-settings-button" : ".mobile-page-back").click();
  } else {
    await page.locator(`.site-navigation a[href="#${destination}"]`).click();
  }
  await expect(page.locator(`.${destination}-page`)).toBeVisible();
}

export async function expectPassportLayout(page: Page, mobile: boolean) {
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

export async function expectDetailLayout(page: Page, mobile: boolean) {
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

export async function expectSettingsLayout(page: Page, mobile: boolean) {
  // Toggle rows intentionally retain two columns on mobile; use an ordinary row.
  await expectColumns(page.getByRole("combobox", { name: "Appearance", exact: true }).locator(".."), mobile ? 1 : 2);
}
