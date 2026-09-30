import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile } from "node:fs/promises";
import type { KeeprawFlight } from "@keepraw-fly/schema";

test("reads Passport statistics as a map caption without a flight-highlights section", async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const archive = JSON.parse(await readFile(new URL("../examples/basic.keepraw-fly.json", import.meta.url), "utf8"));
  const route = (id: string, origin: string, destination: string, airline: string): KeeprawFlight => ({
    id, flightNumber: `${airline}${100 + Number(id)}`, serviceDate: "2026-09-22", airline: { iata: airline },
    origin: { iata: origin }, destination: { iata: destination },
    scheduledDeparture: "2026-09-22T10:00:00+08:00", actualDeparture: "2026-09-22T10:00:00+08:00",
    scheduledArrival: "2026-09-22T12:00:00+08:00", actualArrival: "2026-09-22T12:10:00+08:00",
    extensions: { "keepraw-fly.aircraft": { type: "A320" } },
  });
  archive.flights = [route("1", "SZX", "TAO", "ZH"),
    ...["2", "3", "4"].map(id => route(id, "SHA", "TAO", "CA")), route("5", "SHA", "TAO", "ZH"),
    ...["6", "7", "8"].map(id => route(id, "TAO", "HKG", "CX")),
    { ...route("9", "HKG", "BOM", "CX"), scheduledArrival: "2026-09-22T12:00:00+05:30", actualArrival: "2026-09-22T12:10:00+05:30" },
  ];
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({ name: "legend.keepraw-fly.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(archive)) });
  await page.getByRole("button", { name: "Import this archive" }).click();
  await expect(page.locator(".passport-legend-support")).toContainText("9 flights");
  await expect(page.locator(".passport-legend-delay")).toHaveText("1h 30m total arrival delay");
  await expect(page.locator(".passport-visual")).not.toContainText("Early arrivals do not offset delays");
  await expect(page.locator(".passport-legend-delay")).toHaveAttribute("title", "Early arrivals do not offset delays");
  await expect(page.locator(".primary-stats, .passport-counts, .highlight-list")).toHaveCount(0);
  await expect(page.locator(".passport-network-line")).toContainText("3 countries · 5 airports · 3 airlines · 1 aircraft type");

  await expect(page.locator(".passport-highlights, .passport-highlight, .passport-spotlight")).toHaveCount(0);
  await page.locator("#passport-flight-search").fill("TAO");
  await expect(page.locator(".flight-row")).toHaveCount(8);
  await expect(page.locator(".passport-legend-support")).toContainText("8 flights");
  await page.locator("#passport-flight-search").fill("");
  await expect(page.locator(".flight-row")).toHaveCount(9);
  await expect(page.locator(".passport-exploration")).toHaveCount(0);

  await mkdir("test-results/passport-legend", { recursive: true });
  for (const locale of ["en", "zh-CN", "zh-TW"]) {
    for (const theme of ["light", "dark"]) {
      await page.goto("/#settings");
      const settings = page.locator(".settings-display-fields select");
      await settings.nth(0).selectOption(locale);
      await settings.nth(1).selectOption(theme);
      await page.goto("/#passport");
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      for (const width of [1440, 1280, 390]) {
        await page.setViewportSize({ width, height: 720 });
        expect(await page.locator("html").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
        await expect(page.locator(".passport-highlights, .passport-highlight, .passport-spotlight")).toHaveCount(0);
        if (width > 760) {
          await expect(page.locator(".passport-legend")).toBeVisible();
          expect(await page.locator(".passport-visual-sticky").evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
          const sizes = await page.locator(".passport-legend").evaluate(element => [".passport-legend-hero strong", ".passport-legend-support", ".passport-legend-delay"].map(selector => parseFloat(getComputedStyle(element.querySelector(selector)!).fontSize)));
          expect(sizes[0]).toBeGreaterThan(sizes[1]!);
          expect(sizes[1]).toBeGreaterThan(sizes[2]!);
        } else {
          await expect(page.locator(".passport-legend")).toBeHidden();
          await expect(page.locator(".passport-mobile-summary")).toBeVisible();
          await expect(page.locator(".passport-delay-panel")).toBeVisible();
          await expect(page.locator(".passport-network-panel")).toBeVisible();
        }
        await page.screenshot({ path: `test-results/passport-legend/${locale}-${theme}-${width}.png`, fullPage: true });
      }
      expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    }
  }
});
