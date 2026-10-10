import { disablePassportWebGL } from "./helpers/passport-svg";
test.beforeEach(async ({ page }) => disablePassportWebGL(page));

import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { KeeprawFlight, KeeprawFlyDocument } from "@keepraw-fly/schema";

test("statistics charts use recorded, filtered data and keep keyboard selections", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const archive: KeeprawFlyDocument = JSON.parse(
    await readFile(
      new URL("../examples/basic.keepraw-fly.json", import.meta.url),
      "utf8",
    ),
  );
  const flight = (
    year: number,
    origin: string,
    destination: string,
  ): KeeprawFlight => ({
    id: String(year),
    flightNumber: `CX${year}`,
    serviceDate: `${year}-01-01`,
    airline: { iata: "CX" },
    origin: { iata: origin },
    destination: { iata: destination },
    scheduledDeparture: `${year}-01-01T10:00:00Z`,
    scheduledArrival: `${year}-01-01T12:00:00Z`,
  });
  archive.flights = [
    { ...flight(2023, "HKG", "TAO"), actualArrival: "2023-01-01T12:40:00Z" },
    { ...flight(2024, "HKG", "TAO"), actualArrival: "2024-01-01T11:40:00Z" },
    flight(2025, "HKG", "SFO"),
    {
      ...flight(2026, "HKG", "PEK"),
      divertedTo: { iata: "TAO" },
      actualArrival: "2026-01-01T14:00:00Z",
    },
    {
      ...flight(2026, "LAX", "SYD"),
      id: "longest",
      flightNumber: "CX2027",
      scheduledArrival: "2026-01-02T00:00:00Z",
      actualDeparture: "2026-01-01T10:03:00Z",
      actualArrival: "2026-01-02T00:30:00Z",
    },
    {
      ...flight(2022, "PEK", "PVG"),
      cancelled: true,
      actualArrival: "2022-01-01T13:00:00Z",
    },
  ];
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "statistics.keepraw-fly.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(archive)),
  });
  await page.getByRole("button", { name: "Import this archive" }).click();
  await page.goto("/#settings");
  await page
    .getByRole("combobox", { name: "Distance", exact: true })
    .selectOption("kilometers");
  await page.goto("/#passport");
  const years = page.locator(".passport-delay-chart li");
  await expect(page.locator(".passport-delay-highlight > strong")).toHaveText(
    "1h 10m",
  );
  expect(
    await years.evaluateAll((items) =>
      items.map((item) => [
        item.getAttribute("data-year"),
        item.getAttribute("data-minutes"),
      ]),
    ),
  ).toEqual([
    ["2024", "0"],
    ["2025", "unknown"],
    ["2026", "30"],
  ]);
  await expect(page.locator(".passport-chart-scope")).toHaveText(
    "Latest 3 recorded years",
  );
  await expect(years.nth(0).locator(".passport-delay-bar")).toHaveAttribute(
    "style",
    "--delay-height: 0%;",
  );
  await expect(years.nth(1).locator(".passport-delay-bar")).toHaveCount(0);
  await expect(years.nth(2).locator(".passport-delay-bar")).toHaveAttribute(
    "style",
    "--delay-height: 100%;",
  );
  const ranks = page.locator(".passport-airport-rank");
  expect(
    await ranks.evaluateAll((items) =>
      items.map((item) => [
        item.getAttribute("data-airport"),
        item.getAttribute("data-visits"),
        item.querySelector<HTMLElement>(".passport-airport-track > span")!.style
          .width,
      ]),
    ),
  ).toEqual([
    ["HKG", "4", "100%"],
    ["TAO", "3", "75%"],
    ["LAX", "1", "25%"],
    ["SFO", "1", "25%"],
  ]);
  const longest = page.locator(".passport-longest-flight");
  await expect(
    longest.locator(".passport-longest-endpoint").first(),
  ).toHaveText("LAXLos Angeles");
  await expect(longest.locator(".passport-longest-endpoint").last()).toHaveText(
    "SYDSydney",
  );
  await expect(longest.locator(".passport-longest-facts")).toHaveText(
    "Flight duration14h 27mDistance12,061 km",
  );
  await expect(longest.locator("svg, canvas, img")).toHaveCount(0);

  const tao = page.locator('[data-airport="TAO"]');
  await tao.focus();
  await page.keyboard.press("Enter");
  await expect(tao).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".flight-row")).toHaveCount(3);
  await expect(page.locator(".map-airport.is-selected")).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect(page.locator(".flight-row")).toHaveCount(6);
  await longest.focus();
  await page.keyboard.press("Space");
  await expect(longest).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".flight-row")).toHaveCount(1);
  await page.keyboard.press("Space");
  await expect(page.locator(".flight-row")).toHaveCount(6);

  await page.getByRole("button", { name: "2024", exact: true }).click();
  await expect(years).toHaveCount(1);
  await expect(years).toHaveAttribute("data-minutes", "0");
  await expect(page.locator(".passport-delay-highlight > strong")).toHaveText(
    "0h 00m",
  );
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.locator("#passport-flight-search").fill("CX2023");
  await expect(years).toHaveCount(1);
  await expect(years).toHaveAttribute("data-year", "2023");
  await expect(years).toHaveAttribute("data-minutes", "40");
  await expect(ranks).toHaveCount(2);
  await expect(page.locator(".passport-delay-highlight > strong")).toHaveText(
    "0h 40m",
  );
  await page.locator("#passport-flight-search").fill("no matching flight");
  await expect(years).toHaveCount(0);
  await expect(ranks).toHaveCount(0);
  await expect(longest).not.toHaveAttribute("aria-pressed");
  await expect(
    longest.locator(".passport-longest-endpoint > strong"),
  ).toHaveText(["—", "—"]);
  await page.locator("#passport-flight-search").fill("");
  await page.goto("/#settings");
  await page
    .getByRole("combobox", { name: "Distance", exact: true })
    .selectOption("miles");
  await page.goto("/#passport");
  await expect(longest.locator(".passport-longest-facts")).toContainText(
    "7,494 mi",
  );
});
