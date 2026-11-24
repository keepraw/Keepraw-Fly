import { disablePassportWebGL } from "./helpers/passport-svg";
test.beforeEach(async ({ page }) => disablePassportWebGL(page));

import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import type { KeeprawFlight } from "@keepraw-fly/schema";

test("keeps the same Stats regions on desktop and on mobile", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const archive = JSON.parse(
    await readFile(
      new URL("../examples/basic.keepraw-fly.json", import.meta.url),
      "utf8",
    ),
  );
  const route = (
    id: string,
    origin: string,
    destination: string,
    airline: string,
  ): KeeprawFlight => ({
    id,
    flightNumber: `${airline}${100 + Number(id)}`,
    serviceDate: "2026-09-22",
    airline: { iata: airline },
    origin: { iata: origin },
    destination: { iata: destination },
    scheduledDeparture: "2026-09-22T10:00:00+08:00",
    actualDeparture: "2026-09-22T10:00:00+08:00",
    scheduledArrival: "2026-09-22T12:00:00+08:00",
    actualArrival: "2026-09-22T12:10:00+08:00",
    extensions: { "keepraw-fly.aircraft": { type: "A320" } },
  });
  archive.flights = [
    route("1", "SZX", "TAO", "ZH"),
    ...["2", "3", "4"].map((id) => route(id, "SHA", "TAO", "CA")),
    route("5", "SHA", "TAO", "ZH"),
    ...["6", "7", "8"].map((id) => route(id, "TAO", "HKG", "CX")),
    {
      ...route("9", "HKG", "BOM", "CX"),
      scheduledArrival: "2026-09-22T12:00:00+05:30",
      actualArrival: "2026-09-22T12:10:00+05:30",
    },
  ];
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "legend.keepraw-fly.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(archive)),
  });
  await page.getByRole("button", { name: "Import this archive" }).click();
  const flightCount = page.locator(".passport-core-stat:nth-child(2)");
  // The regions live in Stats and the flights in Log; both share one selection.
  const show = (view: "log" | "stats") =>
    page.locator(`.site-navigation a[href="#/${view}"]`).click();
  await expect(flightCount).toContainText("9Flights");
  await show("stats");
  const totals = page.locator('.stats-panel[data-region="totals"]');
  await expect(totals.locator(".stats-figure")).toHaveText("1h 30m");
  await expect(totals).toContainText("Early arrivals do not offset delays");
  await expect(
    page.locator(".primary-stats, .passport-counts, .highlight-list"),
  ).toHaveCount(0);
  await expect(page.locator(".passport-core-stat")).toHaveCount(6);
  await expect(page.locator(".passport-core-stat").nth(3)).toHaveText(
    "5Airports",
  );
  await expect(page.locator(".passport-core-stat").nth(4)).toHaveText(
    "3Airlines",
  );
  await expect(page.locator(".passport-core-stat").nth(5)).toHaveText(
    "3Countries",
  );

  await expect(page.locator(".stats-insights")).toBeVisible();
  await expect(page.locator(".stats-panel")).toHaveCount(8);
  await show("log");
  await page.locator("#passport-flight-search").fill("TAO");
  await expect(page.locator(".flight-row")).toHaveCount(8);
  await expect(flightCount).toContainText("8Flights");
  await page.locator("#passport-flight-search").fill("");
  await expect(page.locator(".flight-row")).toHaveCount(9);
  await expect(page.locator(".passport-exploration")).toHaveCount(0);
  await show("stats");

  const airport = page.getByRole("button", {
    name: /Filter flights visiting .*TAO/,
  });
  await expect(airport).toContainText("8 visits");
  await airport.focus();
  await page.keyboard.press("Enter");
  await expect(flightCount).toContainText("8Flights");
  await expect(airport).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".passport-exploration")).toBeVisible();
  await show("log");
  await expect(page.locator(".flight-row")).toHaveCount(8);
  await show("stats");
  await airport.click();
  await expect(flightCount).toContainText("9Flights");
  const airline = page.getByRole("button", {
    name: /Filter flights flown with Cathay Pacific/,
  });
  await expect(airline).toContainText("4 flights");
  await airline.click();
  await expect(airline).toHaveAttribute("aria-pressed", "true");
  await expect(flightCount).toContainText("4Flights");
  // Every airline stays listed, so another one can be picked directly.
  await expect(
    page.locator('.stats-panel[data-region="airlines"] .stats-rank'),
  ).toHaveCount(3);
  await show("log");
  await expect(page.locator(".flight-row")).toHaveCount(4);
  await expect(page.locator('select[name="airline"]')).toHaveValue("CX");
  await page
    .getByRole("button", { name: "Remove filter: Cathay Pacific · CX" })
    .click();
  await expect(page.locator(".flight-row")).toHaveCount(9);
  await show("stats");
  await expect(airline).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("button", { name: /Shortest flight: filter/ }),
  ).toHaveCount(1);
  await page
    .getByRole("button", {
      name: /Longest flight: filter flights from HKG to BOM/,
    })
    .click();
  await show("log");
  await expect(page.locator(".flight-row")).toHaveCount(1);
  await page.locator(".passport-exploration-close").click();
  await page.locator("#passport-flight-search").fill("CX");
  await expect(page.locator(".flight-row")).toHaveCount(4);
  await page.locator("#passport-flight-search").fill("SHA");
  await expect(page.locator(".flight-row")).toHaveCount(4);
  await page.locator("#passport-flight-search").fill("");
  for (const locale of ["en-US", "zh-CN", "zh-TW"]) {
    for (const theme of ["light", "dark"]) {
      await page.goto("/#settings");
      const settings = page.locator(".settings-display-fields select");
      await settings.nth(0).selectOption(locale);
      await page.locator("#settings-appearance").selectOption(theme);
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/#/map");
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator(".passport-legend")).toBeVisible();
      await page.setViewportSize({ width: 390, height: 720 });
      await expect(page.locator(".passport-legend")).toBeHidden();
      await expect(page.locator(".passport-mobile-summary")).toBeVisible();
      await page.goto("/#/stats");
      for (const width of [1440, 1366, 1280, 1024, 761, 390]) {
        await page.setViewportSize({ width, height: 720 });
        expect(
          await page
            .locator("html")
            .evaluate((element) => element.scrollWidth <= element.clientWidth),
        ).toBe(true);
        await expect(page.locator(".stats-insights")).toBeVisible();
        await expect(page.locator(".stats-panel")).toHaveCount(8);
        if (width > 760) {
          expect(
            await page
              .locator(".passport-visual-sticky")
              .evaluate(
                (element) => element.scrollWidth <= element.clientWidth + 1,
              ),
          ).toBe(true);
          const sizes = await page
            .locator(".passport-core-stat")
            .first()
            .evaluate((element) =>
              ["strong", "span"].map((selector) =>
                parseFloat(
                  getComputedStyle(element.querySelector(selector)!).fontSize,
                ),
              ),
            );
          expect(sizes[0]).toBeGreaterThan(sizes[1]!);
          expect(
            await page
              .locator(".passport-visual-sticky")
              .evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
          ).toBe(true);
        } else {
          await expect(page.locator(".passport-mobile-summary")).toBeVisible();
        }
      }
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    }
  }

  for (const width of [760, 761, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    // Every entry stays reachable from the keyboard on every screen class.
    await expect(page.locator(".stats-insights")).toBeVisible();
    await expect(page.locator(".stats-panel")).toHaveCount(8);
    await expect(page.locator("button.stats-rank").first()).toBeVisible();
  }
});
