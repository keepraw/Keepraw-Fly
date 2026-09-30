import { expect, test } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import type { KeeprawFlight } from "@keepraw-fly/schema";

test("shares scope, highlight filtering, map selection and adjacent detail navigation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const archive = JSON.parse(await readFile(new URL("../examples/basic.keepraw-fly.json", import.meta.url), "utf8"));
  const zh: KeeprawFlight = {
    id: "zh9911", flightNumber: "ZH9911", serviceDate: "2026-09-22", airline: { iata: "ZH" },
    origin: { iata: "SZX", terminal: "T3", gate: "338" }, destination: { iata: "TAO" },
    scheduledDeparture: "2026-09-22T20:45:00+08:00", actualDeparture: "2026-09-22T20:56:00+08:00",
    scheduledArrival: "2026-09-23T00:05:00+08:00", actualArrival: "2026-09-22T23:30:00+08:00",
    extensions: { "keepraw-fly.aircraft": { type: "737-8 AL", registration: "B5379" } },
  };
  archive.flights = [zh,
    { ...zh, id: "cz3964", flightNumber: "CZ3964", airline: { iata: "CZ" }, serviceDate: "2026-09-21", origin: { iata: "PEK" },
      scheduledDeparture: "2026-09-21T23:28:00+08:00", actualDeparture: "2026-09-21T23:28:00+08:00",
      scheduledArrival: "2026-09-22T06:50:00+08:00", actualArrival: "2026-09-22T07:01:00+08:00" },
    { ...zh, id: "cx696", flightNumber: "CX696", airline: { iata: "CX" }, serviceDate: "2026-09-20", origin: { iata: "DEL" }, destination: { iata: "HKG" },
      scheduledDeparture: "2026-09-20T23:28:00+05:30", actualDeparture: "2026-09-20T23:28:00+05:30",
      scheduledArrival: "2026-09-21T06:50:00+08:00", actualArrival: "2026-09-21T06:50:00+08:00" },
    { ...zh, id: "older", flightNumber: "ZH9912", serviceDate: "2025-09-22", origin: { iata: "HKG" }, destination: { iata: "TAO" },
      scheduledDeparture: "2025-09-22T20:45:00+08:00", actualDeparture: "2025-09-22T20:45:00+08:00",
      scheduledArrival: "2025-09-22T23:30:00+08:00", actualArrival: "2025-09-22T23:30:00+08:00" },
  ];
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({ name: "desktop.keepraw-fly.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(archive)) });
  await page.getByRole("button", { name: "Import this archive" }).click();
  await expect(page.locator(".passport-scope")).toHaveText("All flights · 4 records");
  await expect(page.locator(".flight-row")).toHaveCount(4);
  await expect(page.locator(".passport-period")).toHaveCount(1);
  await page.locator(".passport-period").getByRole("button", { name: "2026" }).click();
  await expect(page.locator(".passport-scope")).toHaveText("2026 · 3 records");
  await expect(page.locator(".primary-stats > div").first()).toContainText("3");
  await expect(page.locator(".flight-row")).toHaveCount(3);
  await expect(page.locator('.flight-record[data-flight-id="zh9911"] .flight-times')).toHaveText("20:56—23:30");
  await expect(page.locator('.flight-record[data-flight-id="cz3964"] .flight-times')).toContainText("+1");
  await expect(page.locator('.flight-record[data-flight-id="cx696"] .flight-times')).toContainText("+1");
  await expect(page.locator(".primary-stats > div").last()).toContainText("0h 11m");

  await page.locator('.flight-record[data-flight-id="zh9911"] .flight-row').click();
  await expect(page.locator('.flight-record[data-flight-id="zh9911"] .flight-row')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".map-route.is-highlighted")).toHaveCount(1);
  await expect(page.locator(".map-airport.is-selected .map-airport-label")).toHaveText(["SZX", "TAO"]);
  await page.locator(".map-route").filter({ hasText: "SZX to TAO" }).click();
  await expect(page.locator('.flight-record[data-flight-id="zh9911"] .flight-row')).toBeFocused();
  await page.locator(".passport-highlight").nth(1).click();
  await expect(page.locator(".passport-exploration")).toContainText("TAO");
  await expect(page.locator(".flight-row")).toHaveCount(2);
  await page.getByRole("button", { name: /Open ZH9911/ }).click();
  await expect(page.getByRole("button", { name: "Previous", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".detail-heading-eyebrow")).toContainText("CZ3964");
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.locator(".detail-heading-summary")).toContainText("Departure delayed 11 min");
  await expect(page.locator(".detail-heading-summary")).toContainText("Arrived 35 min early");
  await expect(page.locator(".detail-stop--arrival .detail-scheduled-time")).toContainText("00:05 +1");
  await expect(page.locator(".detail-stop--departure .detail-stop-facts")).toContainText("Gate338");
  await expect(page.locator(".detail-map-airport text")).toHaveText(["SZX", "TAO"]);
  expect(Number(await page.locator(".detail-route-map-canvas").getAttribute("data-zoom"))).toBeGreaterThan(4);
  await mkdir("test-results/desktop-readability", { recursive: true });
  for (const width of [1440, 1280, 1024, 390]) {
    await page.setViewportSize({ width, height: 720 });
    expect(await page.locator("html").evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
    await expect(page.locator(".detail-route-map")).toHaveCount(width <= 760 ? 0 : 1);
    await page.screenshot({ path: `test-results/desktop-readability/detail-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.locator(".detail-header-back").click();
  await expect(page.locator(".passport-period button[aria-pressed=true]")).toHaveText("2026");
  await expect(page.locator(".passport-exploration")).toContainText("TAO");
  await page.locator(".passport-exploration-close").click();
  await page.locator("#passport-flight-search").fill("ZH9911");
  await expect(page.locator(".flight-row")).toHaveCount(1);
  expect(Number(await page.locator(".route-map-canvas").getAttribute("data-zoom"))).toBeGreaterThan(2.5);
  await page.locator("#passport-flight-search").fill("");
  for (const width of [1440, 1280, 1024, 390]) {
    await page.setViewportSize({ width, height: 720 });
    expect(await page.locator("html").evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
    await page.locator(".flight-row").last().scrollIntoViewIfNeeded();
    const bounds = await page.locator(".flight-row").last().boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(720);
    await page.screenshot({ path: `test-results/desktop-readability/passport-${width}.png`, fullPage: true });
  }
  for (const [locale, appearance] of [["zh-CN", "light"], ["zh-TW", "dark"], ["en", "dark"]]) {
    await page.goto("/#settings");
    const settings = page.locator(".settings-display-fields select");
    await settings.nth(0).selectOption(locale);
    await settings.nth(1).selectOption(appearance);
    await page.goto("/#passport");
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.locator('.flight-record[data-flight-id="zh9911"] .flight-row-open').click();
    await expect(page.locator(".detail-heading-summary")).toContainText(locale === "en" ? "Departure delayed 11 min" : locale === "zh-CN" ? "出发晚点 11 分" : "出發延誤 11 分");
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 720 });
      expect(await page.locator("html").evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
      await page.screenshot({ path: `test-results/desktop-readability/detail-${locale}-${appearance}-${width}.png`, fullPage: true });
    }
  }
});
