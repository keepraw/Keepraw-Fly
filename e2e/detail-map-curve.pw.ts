import { expect, test } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { KeeprawFlight } from "@keepraw-fly/schema";

test("keeps a natural long-route arc and round offline detail-map endpoints", async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const archive = JSON.parse(await readFile(new URL("../examples/basic.keepraw-fly.json", import.meta.url), "utf8"));
  const flights: KeeprawFlight[] = [
    { id: "long", flightNumber: "CX695", serviceDate: "2026-09-22", airline: { iata: "CX" },
      origin: { iata: "HKG" }, destination: { iata: "BOM" },
      scheduledDeparture: "2026-09-22T18:00:00+08:00", scheduledArrival: "2026-09-22T22:30:00+05:30" },
    { id: "short", flightNumber: "ZH9911", serviceDate: "2026-09-22", airline: { iata: "ZH" },
      origin: { iata: "SZX" }, destination: { iata: "TAO" },
      scheduledDeparture: "2026-09-22T20:45:00+08:00", scheduledArrival: "2026-09-22T23:30:00+08:00" },
  ];
  archive.flights = flights;
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({ name: "detail-arcs.keepraw-fly.json",
    mimeType: "application/json", buffer: Buffer.from(JSON.stringify(archive)) });
  await page.getByRole("button", { name: "Import this archive" }).click();
  await mkdir("test-results/detail-map-curve", { recursive: true });
  const geometry: { theme: string; route: string; deviation: number; path: string | null }[] = [];

  for (const theme of ["light", "dark"]) {
    await context.setOffline(false);
    await page.goto("/#settings");
    await page.locator(".settings-display-fields select").nth(1).selectOption(theme);
    await page.goto("/#passport");
    for (const flight of flights) {
      await page.locator(`.flight-record[data-flight-id="${flight.id}"] .flight-row`).click();
      const line = page.locator(".detail-map-route");
      await expect(line).toBeVisible();
      await context.setOffline(true);
      const shape = await line.evaluate(element => {
        const path = element as SVGPathElement;
        const matrix = path.getScreenCTM()!;
        const length = path.getTotalLength();
        const at = (fraction: number) => path.getPointAtLength(length * fraction).matrixTransform(matrix);
        const start = at(0), end = at(1);
        const dx = end.x - start.x, dy = end.y - start.y;
        const deviation = Math.max(...Array.from({ length: 41 }, (_, index) => {
          const point = at(index / 40);
          return Math.abs(dx * (point.y - start.y) - dy * (point.x - start.x)) / Math.hypot(dx, dy);
        }));
        return { deviation, path: path.getAttribute("d"), linecap: getComputedStyle(path).strokeLinecap };
      });
      geometry.push({ theme, route: `${flight.origin.iata}-${flight.destination.iata}`, ...shape });
      if (flight.id === "long") expect(shape.deviation).toBeGreaterThan(8);
      else expect(shape.deviation).toBeGreaterThan(1);
      expect(shape.linecap).toBe("round");
      const strokeWidth = await line.evaluate(element => parseFloat(getComputedStyle(element).strokeWidth));
      expect(strokeWidth).toBeGreaterThanOrEqual(2);
      expect(strokeWidth).toBeLessThan(3);
      await expect(page.locator(".detail-map-airport-ring")).toHaveCount(0);
      await expect(page.locator(".detail-map-airport-point")).toHaveCount(2);
      for (const [index, dot] of (await page.locator(".detail-map-airport-point").all()).entries()) {
        expect(await dot.evaluate(element => getComputedStyle(element).fill)).not.toBe("none");
        const point = await dot.evaluate((element, index) => {
          const bounds = element.getBoundingClientRect();
          const path = document.querySelector<SVGPathElement>(".detail-map-route")!;
          const end = path.getPointAtLength(index === 0 ? 0 : path.getTotalLength()).matrixTransform(path.getScreenCTM()!);
          return { width: bounds.width, height: bounds.height,
            offset: Math.hypot(bounds.x + bounds.width / 2 - end.x, bounds.y + bounds.height / 2 - end.y) };
        }, index);
        expect(point.width).toBeGreaterThanOrEqual(6);
        // SVG bounds can round by a layout unit in different engines.
        expect(point.width).toBeLessThanOrEqual(8.05);
        expect(Math.abs(point.width - point.height)).toBeLessThan(0.05);
        expect(point.offset).toBeLessThan(1);
      }
      await expect(page.locator(".detail-map-airport text")).toHaveText([flight.origin.iata, flight.destination.iata]);
      await page.locator(".detail-route-map").screenshot({ path: `test-results/detail-map-curve/${theme}-${flight.origin.iata}-${flight.destination.iata}.png` });
      await page.locator(".detail-route-map .map-zoom-controls button").first().click();
      await page.locator(".detail-route-map .map-zoom-controls button").last().click();
      await expect(line).toBeVisible();
      await context.setOffline(false);
      await page.locator(".detail-header-back").click();
    }
  }
  await writeFile("test-results/detail-map-curve/geometry.json", JSON.stringify(geometry, null, 2));
});
