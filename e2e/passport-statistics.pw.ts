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
  await page.goto("/#/stats");
  const region = (name: string) =>
    page.locator(`.stats-panel[data-region="${name}"]`);
  const total = region("totals").locator(".stats-figure");
  const years = page.locator(".stats-years tbody tr");
  const delays = years.locator("td:last-child");
  await expect(total).toHaveText("1h 10m");
  // Early arrivals do not offset delays, and the note says so in the open.
  await expect(region("totals")).toContainText(
    "Early arrivals do not offset delays",
  );
  expect(
    await years.evaluateAll((rows) =>
      rows.map((row) => [
        row.getAttribute("data-year"),
        row.querySelector("td")!.textContent,
        row.querySelector("td:last-child")!.getAttribute("data-minutes"),
      ]),
    ),
  ).toEqual([
    ["2026", "2", "30"],
    ["2025", "1", "unknown"],
    ["2024", "1", "0"],
    ["2023", "1", "40"],
  ]);
  expect(
    await page
      .locator(".stats-months li")
      .evaluateAll((items) =>
        items.map((item) => Number(item.getAttribute("data-count"))),
      ),
  ).toEqual([5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const ranks = region("airports").locator(".stats-rank");
  const ranking = (name: string) =>
    region(name)
      .locator(".stats-rank")
      .evaluateAll((items) =>
        items.map((item) => [
          item.getAttribute("data-key"),
          item.getAttribute("data-count"),
          item
            .querySelector<HTMLElement>(".stats-bar-fill")!
            .style.getPropertyValue("--stats-share"),
        ]),
      );
  expect(await ranking("airports")).toEqual([
    ["HKG", "4", "100%"],
    ["TAO", "3", "75%"],
    ["LAX", "1", "25%"],
    ["SFO", "1", "25%"],
    ["SYD", "1", "25%"],
  ]);
  // Cancelled flights count nowhere; nothing recorded is not a category.
  expect(await ranking("airlines")).toEqual([["CX", "5", "100%"]]);
  await expect(region("aircraft")).toContainText("Not enough data");
  expect(await ranking("cabins")).toEqual([["not-recorded", "5", "100%"]]);
  const record = (kind: string) =>
    page.locator(`.stats-record[data-record="${kind}"]`);
  const longest = record("longest");
  await expect(longest.locator(".stats-record-route")).toHaveText("LAX → SYD");
  await expect(longest.locator(".stats-record-places")).toHaveText(
    "Los Angeles → Sydney",
  );
  await expect(longest.locator(".stats-record-facts")).toHaveText(
    "14h 27m12,061 km",
  );
  await expect(longest.locator("svg, canvas, img")).toHaveCount(0);
  await expect(record("delay")).toContainText("HKG → TAO");
  await expect(record("delay").locator(".stats-record-facts")).toHaveText(
    "CX20230h 40m",
  );
  // The diverted flight counts on the route it actually flew.
  await expect(record("route")).toContainText("HKG → TAO");
  await expect(record("route")).toContainText("3 flights");

  const tao = page.locator('.stats-rank[data-key="TAO"]');
  await tao.focus();
  await page.keyboard.press("Enter");
  await expect(tao).toHaveAttribute("aria-pressed", "true");
  // The selection is shared: Map shows it on the chart and in its list.
  await page.goto("/#/map");
  await expect(page.locator(".flight-row")).toHaveCount(3);
  await expect(page.locator(".map-airport.is-selected")).toHaveCount(1);
  await page.goto("/#/stats");
  await tao.focus();
  await page.keyboard.press("Enter");
  await expect(tao).toHaveAttribute("aria-pressed", "false");
  await longest.focus();
  await page.keyboard.press("Space");
  await expect(longest).toHaveAttribute("aria-pressed", "true");
  await page.goto("/#/log");
  await expect(page.locator(".flight-row")).toHaveCount(1);
  await page.goto("/#/stats");
  await longest.focus();
  await page.keyboard.press("Space");
  await expect(longest).toHaveAttribute("aria-pressed", "false");
  await page.goto("/#/log");
  await expect(page.locator(".flight-row")).toHaveCount(6);
  await page.goto("/#/stats");
  // The longest delay is one flight, so its record opens that flight.
  await record("delay").click();
  await expect(page).toHaveURL(/#\/flight\/2023$/);
  await page.goBack();
  await expect(page.locator(".stats-insights")).toBeVisible();

  await page.getByRole("button", { name: "2024", exact: true }).click();
  await expect(years).toHaveCount(1);
  await expect(delays).toHaveAttribute("data-minutes", "0");
  await expect(total).toHaveText("0h 00m");
  await page.getByRole("button", { name: "All", exact: true }).click();
  // Stats has no search field; it names the search made in Log instead.
  await page.goto("/#/log");
  await page.locator("#passport-flight-search").fill("CX2023");
  await page.goto("/#/stats");
  await expect(page.locator(".passport-active-search")).toContainText("CX2023");
  await expect(years).toHaveCount(1);
  await expect(years).toHaveAttribute("data-year", "2023");
  await expect(delays).toHaveAttribute("data-minutes", "40");
  await expect(ranks).toHaveCount(2);
  await expect(total).toHaveText("0h 40m");
  await page.goto("/#/log");
  await page.locator("#passport-flight-search").fill("no matching flight");
  await page.goto("/#/stats");
  await expect(years).toHaveCount(0);
  await expect(ranks).toHaveCount(0);
  await expect(longest).not.toHaveAttribute("aria-pressed");
  await expect(page.locator(".stats-record-route")).toHaveText([
    "—",
    "—",
    "—",
    "—",
  ]);
  await page
    .locator(".passport-active-search")
    .getByRole("button", { name: /Clear search/ })
    .click();
  await expect(page.locator(".passport-active-search")).toHaveCount(0);
  await expect(years).toHaveCount(4);
  await page.goto("/#settings");
  await page
    .getByRole("combobox", { name: "Distance", exact: true })
    .selectOption("miles");
  await page.goto("/#/stats");
  await expect(longest.locator(".stats-record-facts")).toContainText(
    "7,494 mi",
  );
});
