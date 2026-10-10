import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";

const viewports = [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
  { width: 761, height: 900 },
  { width: 844, height: 390 },
];

for (const theme of ["light", "dark"]) {
  test(`desktop flight report, ledger and map remain usable in ${theme}`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize(viewports[0]!);
    await page.goto("/");
    await page.getByRole("button", { name: "Try demo" }).click();
    await page.goto("/#settings");
    await page
      .getByRole("combobox", { name: "Appearance", exact: true })
      .selectOption(theme);
    await page.goto("/#passport");
    await expect(page.locator(".route-map-canvas > svg")).toBeVisible();
    await expect(page.locator(".map-relief-texture:visible")).toHaveCount(1, {
      timeout: 20_000,
    });
    await mkdir("test-results/desktop-review", { recursive: true });
    const measurements: Record<string, number | boolean | string>[] = [];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.locator(".passport-archive").evaluate((el) => {
        el.scrollTop = 0;
      });
      await page.locator(".passport-visual-sticky").evaluate((el) => {
        el.scrollTop = 0;
      });
      await page.locator(".passport-archive-scroll").evaluate((el) => {
        el.scrollTop = 0;
      });
      await expect(
        page.locator(".flight-ledger-duration").first(),
      ).toBeVisible();
      const geometry = await page.evaluate(() => {
        const archive = document
          .querySelector(".passport-archive")!
          .getBoundingClientRect();
        const map = document
          .querySelector(".route-map")!
          .getBoundingClientRect();
        const report = document
          .querySelector(".passport-legend")!
          .getBoundingClientRect();
        return {
          widthFits: document.documentElement.scrollWidth <= innerWidth,
          heightFits: document.documentElement.scrollHeight <= innerHeight,
          archiveWidth: archive.width,
          mapWidth: map.width,
          mapHeight: map.height,
          reportHeight: report.height,
          rightClientHeight: document.querySelector(".passport-visual-sticky")!
            .clientHeight,
          rightScrollHeight: document.querySelector(".passport-visual-sticky")!
            .scrollHeight,
          mapAfterArchive: map.left > archive.right,
          reportBelowMap: report.top >= map.bottom - 1,
          rightFits: (() => {
            const right = document.querySelector(".passport-visual-sticky")!;
            return (
              right.scrollHeight <= right.clientHeight + 1 &&
              [...right.children]
                .filter((el) => getComputedStyle(el).display !== "none")
                .every(
                  (el) =>
                    el.getBoundingClientRect().bottom <=
                    right.getBoundingClientRect().bottom + 1,
                )
            );
          })(),
          statsCount: document.querySelectorAll(".passport-core-stat").length,
          scrollportsFit: [
            ".passport-archive-scroll",
            ".passport-visual-sticky",
          ].every((selector) => {
            const el = document.querySelector(selector)!;
            return el.scrollWidth <= el.clientWidth + 1;
          }),
        };
      });
      measurements.push({ theme, ...viewport, ...geometry });
      expect(geometry.widthFits).toBe(true);
      expect(geometry.heightFits).toBe(true);
      expect(geometry.archiveWidth).toBeGreaterThanOrEqual(290);
      expect(geometry.mapWidth).toBeGreaterThan(geometry.archiveWidth);
      expect(geometry.mapHeight).toBeGreaterThanOrEqual(
        viewport.height > 540 ? 260 : 135,
      );
      expect(geometry.rightFits).toBe(true);
      expect(geometry.statsCount).toBe(6);
      await expect(
        page.locator(
          ".flight-time-column, .flight-route-codes, .flight-status",
        ),
      ).toHaveCount(0);
      await expect(page.locator(".passport-highlights"))[
        viewport.height > 540 ? "toBeVisible" : "toBeHidden"
      ]();
      if (viewport.height > 540) {
        await expect(
          page.locator(".passport-spotlight-value").last(),
        ).toBeVisible();
        await expect(
          page.locator(".passport-spotlight-value").last(),
        ).toHaveText(/\S.+\s*→\s*\S.+/);
        await expect(
          page.locator(".passport-spotlight-item small").last(),
        ).toHaveText(/\d+h.*·.*\d/);
      }
      expect(geometry.mapAfterArchive).toBe(true);
      expect(geometry.reportBelowMap).toBe(true);
      expect(geometry.scrollportsFit).toBe(true);
      await page.screenshot({
        path: `test-results/desktop-review/${theme}-${viewport.width}x${viewport.height}.png`,
      });

      const zoomIn = page.getByRole("button", { name: "Zoom in", exact: true });
      await zoomIn.scrollIntoViewIfNeeded();
      const camera = page.locator(".route-map-canvas");
      const zoom = await camera.getAttribute("data-zoom");
      await zoomIn.click();
      await expect(camera).not.toHaveAttribute("data-zoom", zoom!);
      await page
        .getByRole("button", { name: "Fit recorded routes", exact: true })
        .click();
      await expect(camera).toHaveAttribute("data-zoom", zoom!);

      const route = page.locator(".map-route").first();
      await route.focus();
      await page.keyboard.press("Enter");
      const selected = page.locator(".flight-row.is-selected");
      await expect(selected).toBeFocused();
      await expect(page.locator(".map-route.is-highlighted")).toHaveCount(1);
      const selectedColor = await page
        .locator(".map-route.is-highlighted .map-route-line")
        .evaluate((el) => getComputedStyle(el).stroke);
      const ordinaryColor = await page
        .locator(".map-route:not(.is-highlighted) .map-route-line")
        .first()
        .evaluate((el) => getComputedStyle(el).stroke);
      expect(selectedColor).not.toBe(ordinaryColor);
      await expect(page.locator(".map-airport.is-selected")).toHaveCount(2);
      await expect(selected).toHaveCSS("outline-style", "solid");
    }
    await writeFile(
      `test-results/desktop-review/${theme}-dimensions.json`,
      JSON.stringify(measurements, null, 2),
    );

    await page.setViewportSize(viewports[0]!);
    await page.locator("#passport-flight-search").focus();
    expect(
      (
        await new AxeBuilder({ page })
          .include(".passport-archive-page")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    // The desktop-only duration and palette must disappear across the boundary.
    await page.setViewportSize({ width: 760, height: 900 });
    await expect(page.locator(".flight-ledger-duration")).toHaveCount(0);
    await expect(page.locator(".passport-mobile-summary")).toBeVisible();
    await expect(page.locator(".passport-map-title")).toHaveCount(0);
    await expect(page.locator(".map-world--aviation")).toHaveCount(0);
    await expect(page.locator(".map-relief-texture")).toHaveCount(0);
  });
}

test("regional and Asia cameras retain accurate interactive relief and localized cities @cross-browser", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const demo: KeeprawFlyDocument = JSON.parse(
    await readFile(
      new URL("../packages/core/data/demo.keepraw-fly.json", import.meta.url),
      "utf8",
    ),
  );
  const airports: [string, string, string, string, number, number, string][] =
    JSON.parse(
      await readFile(
        new URL("../packages/core/data/airports.iata.json", import.meta.url),
        "utf8",
      ),
    );
  const airportByIata = new Map(
    airports.map((row) => [row[0], { latitude: row[4], longitude: row[5] }]),
  );
  const asiaFlights = demo.flights.filter((flight) =>
    [flight.origin.iata, flight.destination.iata].every((code) => {
      const airport = airportByIata.get(code);
      return (
        airport &&
        airport.longitude > 70 &&
        airport.longitude < 170 &&
        airport.latitude > -10
      );
    }),
  );
  for (const [distribution, flights] of [
    ["regional", asiaFlights.slice(0, 2)],
    ["asia", asiaFlights],
  ] as const) {
    await context.setOffline(false);
    await page.setViewportSize({ width: 1440, height: 900 });
    // The first distribution starts from the welcome page. The second adds
    // the remaining flights through Settings in the already-open archive.
    if (distribution === "asia") {
      await page.goto("/#settings");
      await page
        .locator(".settings-display-fields select")
        .nth(0)
        .selectOption("en");
    } else {
      await page.goto("/");
    }
    await page
      .locator('input[type="file"][accept=".json,application/json"]')
      .setInputFiles({
        name: `${distribution}.keepraw-fly.json`,
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify({ ...demo, flights })),
      });
    await page
      .getByRole("button", { name: /^Import (this archive|\d+ new flights?)$/ })
      .click();
    for (const theme of ["light", "dark"]) {
      await page.goto("/#settings");
      await page
        .locator(".settings-display-fields select")
        .nth(0)
        .selectOption("zh-CN");
      await page
        .locator(".settings-display-fields select")
        .nth(1)
        .selectOption(theme);
      await page.goto("/#passport");
      await expect(page.locator(".map-relief-texture:visible")).toHaveCount(1, {
        timeout: 20_000,
      });
      await context.setOffline(true);
      const first = flights[0]!;
      await expect(
        page.locator(
          `.flight-record[data-flight-id="${first.id}"] .flight-route-cities`,
        ),
      ).toContainText(/[\u3400-\u9fff]/);
      await expect(page.locator(".flight-route-codes")).toHaveCount(0);
      for (const viewport of [
        { width: 1440, height: 900 },
        { width: 844, height: 390 },
      ]) {
        await page.setViewportSize(viewport);
        await expect(page.locator(".map-airport-label")).not.toHaveCount(0);
        await page
          .getByRole("button", { name: "适配当前航线", exact: true })
          .click();
        const fit = await page.locator(".route-map").evaluate((el) => {
          const map = el.getBoundingClientRect();
          const controls = el
            .querySelector(".map-zoom-controls")!
            .getBoundingClientRect();
          const legend = el
            .querySelector(".passport-map-frequency-legend")!
            .getBoundingClientRect();
          const overlaps = (a: DOMRect, b: DOMRect) =>
            a.left < b.right &&
            a.right > b.left &&
            a.top < b.bottom &&
            a.bottom > b.top;
          return (
            [
              ...el.querySelectorAll(".map-airport-point, .map-route-line"),
            ].every((point) => {
              const rect = point.getBoundingClientRect();
              return (
                rect.left > map.left + 4 &&
                rect.right < map.right - 4 &&
                rect.top > map.top + 4 &&
                rect.bottom < map.bottom - 4
              );
            }) &&
            [...el.querySelectorAll(".map-airport-point")].every(
              (point) =>
                !overlaps(point.getBoundingClientRect(), controls) &&
                !overlaps(point.getBoundingClientRect(), legend),
            )
          );
        });
        expect(fit).toBe(true);
        const route = page.locator(".map-route").first();
        await route.focus();
        await page.keyboard.press("Enter");
        await expect(page.locator(".flight-row.is-selected")).toBeFocused();
        await mkdir("test-results/desktop-review", { recursive: true });
        await page.screenshot({
          path: `test-results/desktop-review/${distribution}-${theme}-${viewport.width}x${viewport.height}.png`,
        });
      }
      await context.setOffline(false);
    }
  }
});
