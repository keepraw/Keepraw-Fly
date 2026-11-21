import { expect, test, type Page } from "@playwright/test";
import type { KeeprawFlight, KeeprawFlyDocument } from "@keepraw-fly/schema";
import type { ViewerSettings } from "../apps/web/src/storage/types";
import { disablePassportWebGL } from "./helpers/passport-svg";
import { openSettingsCategory } from "./helpers/settings";

async function savedSettings(page: Page): Promise<ViewerSettings | null> {
  return page.evaluate(async () => {
    const path = "/src/storage/browser.ts";
    const { browserStorage } = await import(path);
    return browserStorage.loadSettings();
  });
}

test("KF-13: list and adjacent navigation share stable UTC ordering within a service date", async ({
  page,
}) => {
  await disablePassportWebGL(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  const facts = [
    ["A", "NH101", "HND", "2026-09-01T10:00:00+09:00"],
    ["B", "BA102", "LHR", "2026-09-01T09:00:00Z"],
    ["equal", "NH103", "HND", "2026-09-01T18:00:00+09:00"],
    ["west", "UA104", "SFO", "2026-09-01T04:00:00-07:00"],
  ];
  const flights: KeeprawFlight[] = facts.map(
    ([id, flightNumber, origin, departure]) => ({
      id: id!,
      flightNumber: flightNumber!,
      serviceDate: "2026-09-01",
      airline: { iata: flightNumber!.slice(0, 2) },
      origin: { iata: origin! },
      destination: { iata: "LAX" },
      scheduledDeparture: departure!,
      scheduledArrival: new Date(
        Date.parse(departure!) + 12 * 3_600_000,
      ).toISOString(),
    }),
  );
  const archive: KeeprawFlyDocument = {
    format: "keepraw-fly",
    formatVersion: "0.1.0",
    profile: {},
    flights,
  };
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "timezones.keepraw-fly.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(archive)),
  });
  await page
    .getByRole("button", { name: "Import this archive", exact: true })
    .click();
  const numbers = ["UA104", "BA102", "NH103", "NH101"];
  await expect(page.locator(".flight-number")).toHaveText(numbers);
  await page.locator(".flight-row").first().click();
  const previous = page.getByRole("button", { name: "Previous", exact: true });
  const next = page.getByRole("button", { name: "Next", exact: true });
  await expect(previous).toBeDisabled();
  for (const number of numbers) {
    if (number !== numbers[0]) await next.click();
    await expect(page.locator(".detail-heading-eyebrow")).toContainText(number);
  }
  await expect(next).toBeDisabled();
  for (const number of numbers.slice(0, -1).reverse()) {
    await previous.click();
    await expect(page.locator(".detail-heading-eyebrow")).toContainText(number);
  }
  await expect(previous).toBeDisabled();
  await page.locator(".detail-header-back").click();
  await expect(page.locator(".flight-number")).toHaveText(numbers);
});

test("KF-15: Flighty preflight counts one bad row and retains both missing-field errors", async ({
  page,
}) => {
  await page.goto("/#settings");
  await openSettingsCategory(page, "Data and backup");
  const input = page.getByLabel("Open Flighty CSV", { exact: true });
  await input.setInputFiles({
    name: "two-errors-one-row.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Date,Airline,Flight,From,To,Gate Departure (Scheduled),Gate Arrival (Scheduled)\n2026-09-01,,,SFO,LAX,2026-09-01T10:00,2026-09-01T12:00",
    ),
  });
  const preview = page
    .locator(".csv-import-control")
    .filter({ has: input })
    .locator(".csv-preview");
  await expect(preview.getByLabel("Import preflight summary")).toContainText(
    "Recognized1Valid0With issues1",
  );
  await expect(
    preview.getByRole("button", {
      name: "Resolve issues to import",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(preview).toContainText("Airline");
  await expect(preview).toContainText("Flight");
});

test("KF-27: stale tabs merge preference fields and backup metadata across reloads @cross-browser", async ({
  page,
  context,
}) => {
  await disablePassportWebGL(page);
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .setInputFiles("examples/basic.keepraw-fly.json");
  await page
    .getByRole("button", { name: "Import this archive", exact: true })
    .click();
  await expect(page.locator(".flight-row")).toHaveCount(1);
  await expect(page.locator(".persistence-status")).toHaveText("");
  await page.goto("/#settings");
  const stale = await context.newPage();
  await stale.goto("/#settings");
  await expect(stale.locator("#settings-language")).toHaveValue("en-US");
  await expect(stale.locator("#settings-time-format")).toHaveValue("24-hour");
  await page.locator("#settings-language").selectOption("en-GB");
  await expect
    .poll(async () => (await savedSettings(page))?.language)
    .toBe("en-GB");
  await openSettingsCategory(page, "Data and backup");
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export Keepraw Fly JSON", exact: true })
    .click();
  await downloading;
  await expect
    .poll(async () => (await savedSettings(page))?.lastBackupAt)
    .toBeTruthy();
  const lastBackupAt = (await savedSettings(page))!.lastBackupAt;
  // This page still holds the snapshot from before both writes in the first tab.
  await expect(stale.locator("#settings-language")).toHaveValue("en-US");
  await stale.locator("#settings-time-format").selectOption("12-hour");
  await stale.locator("#settings-distance").selectOption("kilometers");
  await expect
    .poll(() => savedSettings(stale))
    .toMatchObject({
      language: "en-GB",
      timeFormat: "12-hour",
      distanceUnit: "kilometers",
      lastBackupAt,
    });
  for (const tab of [page, stale]) {
    await tab.reload();
    await expect(tab.locator("#settings-language")).toHaveValue("en-GB");
    await expect(tab.locator("#settings-time-format")).toHaveValue("12-hour");
    await expect(tab.locator("#settings-distance")).toHaveValue("kilometers");
    expect((await savedSettings(tab))?.lastBackupAt).toBe(lastBackupAt);
  }
  // Same-field conflicts have a documented, deterministic last-commit winner.
  await page.locator("#settings-appearance").selectOption("light");
  await expect
    .poll(async () => (await savedSettings(page))?.appearance)
    .toBe("light");
  await stale.locator("#settings-appearance").selectOption("dark");
  await expect
    .poll(async () => (await savedSettings(stale))?.appearance)
    .toBe("dark");
  await page.reload();
  await expect(page.locator("#settings-appearance")).toHaveValue("dark");
  expect((await savedSettings(page))?.lastBackupAt).toBe(lastBackupAt);
  await stale.close();
});
