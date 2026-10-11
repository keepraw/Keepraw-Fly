import { expect, test, type Page } from "@playwright/test";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  importArchive,
  collectBrowserErrors,
  expectHealthyPage,
} from "./helpers/responsive";

test.describe.configure({ mode: "parallel" });

// Deterministic acceptance records: test data, never product placeholders.
const ca: KeeprawFlight = {
  id: "ca1831",
  flightNumber: "CA1831",
  serviceDate: "2026-09-21",
  airline: { iata: "CA" },
  origin: { iata: "PEK", terminal: "T3", gate: "C21" },
  destination: { iata: "PVG", terminal: "T2" },
  scheduledDeparture: "2026-09-21T10:00:00+08:00",
  scheduledArrival: "2026-09-21T12:15:00+08:00",
  actualDeparture: "2026-09-21T10:11:00+08:00",
  actualArrival: "2026-09-21T12:05:00+08:00",
  baggageCarousel: "8",
  ticketNumber: "9991234567890",
  bookingReference: "AB12CD",
  extensions: {
    "keepraw-fly.aircraft": { type: "Airbus A321", registration: "B-1234" },
    "keepraw-fly.seat": { seat: "12A", cabin: "economy", bookingClass: "Y" },
  },
};
const records: KeeprawFlight[] = [
  ca,
  {
    ...ca,
    id: "cz3964",
    flightNumber: "CZ3964",
    airline: { iata: "CZ" },
    origin: { iata: "TAO" },
    destination: { iata: "SZX" },
    actualDeparture: ca.scheduledDeparture,
    actualArrival: ca.scheduledArrival,
  },
  {
    ...ca,
    id: "international",
    flightNumber: "UA857",
    airline: { iata: "UA" },
    origin: { iata: "SFO" },
    destination: { iata: "PVG" },
    scheduledDeparture: "2026-09-21T11:00:00-07:00",
    actualDeparture: "2026-09-21T11:30:00-07:00",
    scheduledArrival: "2026-09-22T16:00:00+08:00",
    actualArrival: "2026-09-22T15:50:00+08:00",
  },
  {
    ...ca,
    id: "overnight",
    flightNumber: "ZH9911",
    origin: { iata: "SZX" },
    destination: { iata: "TAO" },
    scheduledDeparture: "2026-09-21T22:00:00+08:00",
    actualDeparture: "2026-09-21T22:10:00+08:00",
    scheduledArrival: "2026-09-22T01:00:00+08:00",
    actualArrival: "2026-09-22T01:20:00+08:00",
  },
  {
    ...ca,
    id: "diversion",
    flightNumber: "UA123",
    origin: { iata: "SFO" },
    destination: { iata: "LAX", terminal: "7", gate: "71" },
    divertedTo: { iata: "JFK", terminal: "4", gate: "B22" },
    scheduledDeparture: "2026-09-21T11:00:00-07:00",
    actualDeparture: "2026-09-21T11:00:00-07:00",
    scheduledArrival: "2026-09-21T13:00:00-07:00",
    actualArrival: "2026-09-21T20:00:00-04:00",
  },
  {
    ...ca,
    id: "cancelled",
    flightNumber: "CA1832",
    actualDeparture: undefined,
    actualArrival: undefined,
    cancelled: true,
  },
  {
    id: "sparse",
    flightNumber: "CA1833",
    serviceDate: ca.serviceDate,
    airline: ca.airline,
    origin: { iata: "PEK" },
    destination: { iata: "PVG" },
    scheduledDeparture: ca.scheduledDeparture,
    scheduledArrival: ca.scheduledArrival,
    actualDeparture: ca.actualDeparture,
  },
];

// Geometry supports (and never replaces) the attached real-browser screenshots.
async function expectTimeGrid(page: Page, width: number) {
  const rows = await page
    .locator(".detail-airport-time, .detail-scheduled-time")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const bounds = element.getBoundingClientRect();
        const children = [".time-source", "time", ".time-zone"].map(
          (selector) => {
            const child = element.querySelector(selector)!;
            const rect = child.getBoundingClientRect();
            return {
              x: rect.x,
              y: rect.y,
              right: rect.right,
              bottom: rect.bottom,
            };
          },
        );
        return {
          display: getComputedStyle(element).display,
          left: bounds.left,
          right: bounds.right,
          children,
        };
      }),
    );
  for (const row of rows) {
    expect(row.display).toBe("grid");
    for (const child of row.children) {
      expect(child.x).toBeGreaterThanOrEqual(row.left - 1);
      expect(child.right).toBeLessThanOrEqual(row.right + 1);
    }
    if (width <= 480) {
      expect(row.children[1].y).toBeGreaterThanOrEqual(
        row.children[0].bottom - 1,
      );
      expect(row.children[2].y).toBeCloseTo(row.children[0].y, 0);
    } else {
      expect(row.children[0].right).toBeLessThanOrEqual(row.children[1].x);
      expect(row.children[1].right).toBeLessThanOrEqual(row.children[2].x);
    }
  }
  for (let column = 0; column < 3; column++) {
    for (const row of rows.slice(1))
      expect(row.children[column].x).toBeCloseTo(rows[0].children[column].x, 0);
  }
}

for (const language of ["en", "zh-CN", "zh-TW"] as const) {
  for (const appearance of ["light", "dark", "system"] as const) {
    test(`detail hierarchy visual review: ${language} / ${appearance}`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(180_000);
      const errors = collectBrowserErrors(page);
      await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
      await page.setViewportSize({ width: 390, height: 900 });
      const globeRequests: string[] = [];
      page.on("request", (r) => {
        if (
          /DetailGlobe|GlobeMap|globe-renderer|three(?:[./-])|earth-\d|night-\d/.test(
            r.url(),
          )
        )
          globeRequests.push(r.url());
      });
      await importArchive(page, records);
      await page.goto("/#settings");
      const selects = page.locator(".settings-display-fields select");
      await selects.nth(0).selectOption(language);
      await selects.nth(1).selectOption(appearance);
      await selects.nth(2).selectOption("kilometers");
      await selects
        .nth(3)
        .selectOption(appearance === "system" ? "12-hour" : "24-hour");
      await page.goto("/#passport");
      await page
        .locator('.flight-record[data-flight-id="ca1831"] .flight-row')
        .click();
      // Visit mobile before any desktop mount to prove code is not requested.
      for (const width of [360, 390, 430, 761, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(
          page.locator(".detail-heading-summary .flight-deviation"),
        ).toHaveCount(0);
        await expect(
          page.locator(".detail-stop--departure .flight-deviation"),
        ).toContainText("11");
        await expect(
          page.locator(".detail-stop--arrival .flight-deviation"),
        ).toContainText("10");
        await expect(page.locator(".detail-segment-meta")).toHaveCount(1);
        await expect(page.locator(".detail-scheduled-time")).toHaveCount(2);
        await expect(
          page.locator(".detail-airport-time .time-zone"),
        ).toHaveText(["UTC+8", "UTC+8"]);
        await expect(page.locator(".detail-metadata-shelf")).toContainText(
          "12A",
        );
        if (width <= 760) {
          await expect(page.locator(".detail-route-map, canvas")).toHaveCount(
            0,
          );
          expect(globeRequests).toEqual([]);
        } else {
          await expect(
            page.locator(".detail-globe-frame .globe-host"),
          ).toHaveAttribute("data-ready", "true", { timeout: 25000 });
          await expect(page.locator(".globe-airport-label")).toHaveText([
            "PEK",
            "PVG",
          ]);
          for (const label of await page.locator(".globe-airport-label").all())
            await expect(label).toBeVisible();
        }
        await expectTimeGrid(page, width);
        if (width > 760) {
          const stops = (await page.locator(".detail-stops").boundingBox())!;
          const map = (await page.locator(".detail-route-map").boundingBox())!;
          if (width < 1200)
            expect(map.y).toBeGreaterThanOrEqual(stops.y + stops.height);
          else expect(map.x).toBeGreaterThan(stops.x + stops.width);
          await expect(
            page.locator(".detail-globe-frame .globe-stage"),
          ).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
        }
        await expectHealthyPage(page, errors);
        const path = testInfo.outputPath(`ca1831-${width}.png`);
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path, fullPage: true });
        await testInfo.attach(`CA1831 ${width}`, {
          path,
          contentType: "image/png",
        });
        if (width === 1440 && language === "en" && appearance !== "system") {
          // Review-only candidate B; restore A before continuing the matrix.
          const frame = page.locator(".detail-globe-frame");
          await frame.evaluate((element) =>
            (element as HTMLElement).style.setProperty(
              "--detail-galaxy-opacity",
              "0.9",
            ),
          );
          try {
            const candidate = testInfo.outputPath("ca1831-1440-galaxy-B.png");
            await page.screenshot({ path: candidate, fullPage: true });
            await testInfo.attach("CA1831 galaxy B", {
              path: candidate,
              contentType: "image/png",
            });
          } finally {
            await frame.evaluate((element) =>
              (element as HTMLElement).style.removeProperty(
                "--detail-galaxy-opacity",
              ),
            );
          }
        }
      }
      if (appearance === "system") {
        await page.emulateMedia({ colorScheme: "light" });
        await expect(page.locator(".detail-globe-frame")).toHaveAttribute(
          "data-theme",
          "light",
        );
        await page.screenshot({
          path: testInfo.outputPath("system-light-1440.png"),
          fullPage: true,
        });
        await page.emulateMedia({ colorScheme: "dark" });
        await expect(page.locator(".detail-globe-frame")).toHaveAttribute(
          "data-theme",
          "dark",
        );
      }
      for (const record of records.slice(1)) {
        await page.setViewportSize({ width: 390, height: 900 });
        await page.locator(".detail-header-back").click();
        await page
          .locator(`.flight-record[data-flight-id="${record.id}"] .flight-row`)
          .click();
        for (const width of [360, 390, 430, 761, 1024, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          if (width > 760 && !record.cancelled)
            await expect(
              page.locator(".detail-globe-frame .globe-host"),
            ).toHaveAttribute("data-ready", "true", { timeout: 25000 });
          if (record.id === "overnight" || record.id === "international")
            await expect(
              page.locator(".detail-stop--arrival .detail-airport-time"),
            ).toContainText("+1");
          if (record.id === "diversion") {
            await expect(
              page.locator(".detail-stop--arrival .detail-stop-place strong"),
            ).toHaveText("JFK");
            await expect(page.locator(".detail-heading h1")).toContainText(
              { en: "Los Angeles", "zh-CN": "洛杉矶", "zh-TW": "洛杉磯" }[
                language
              ],
            );
            await expect(page.locator(".detail-planned-airport")).toContainText(
              "LAX",
            );
            await expect(
              page.locator(
                ".detail-stop--arrival .detail-airport-time .time-zone",
              ),
            ).toHaveText("UTC-4");
            await expect(
              page.locator(
                ".detail-stop--arrival .detail-scheduled-time .time-zone",
              ),
            ).toHaveText("UTC-7");
            await expect(page.locator(".detail-planned-facts")).toContainText(
              "71",
            );
            await expect(
              page.locator(
                ".detail-stop--arrival .detail-stop-heading > .detail-stop-facts",
              ),
            ).toContainText("B22");
          }
          if (record.cancelled) {
            await expect(page.locator(".detail-flight-phase")).toHaveClass(
              /is-cancelled/,
            );
            await expect(page.locator(".flight-deviation")).toHaveCount(0);
          }
          if (record.id === "sparse") {
            await expect(
              page.locator(".detail-metadata-shelf, .detail-stop-facts"),
            ).toHaveCount(0);
            await expect(
              page.locator(".detail-stop--arrival .time-source"),
            ).toContainText(
              { en: "Scheduled", "zh-CN": "计划", "zh-TW": "計劃" }[language],
            );
          }
          if (record.id === "cz3964")
            await expect(
              page.locator(".detail-stop-meta, .flight-deviation"),
            ).toHaveCount(0);
          await expectHealthyPage(page, errors);
          const path = testInfo.outputPath(`${record.id}-${width}.png`);
          await page.evaluate(() => document.fonts.ready);
          await page.screenshot({ path, fullPage: true });
          await testInfo.attach(`${record.flightNumber} ${width}`, {
            path,
            contentType: "image/png",
          });
        }
      }
    });
  }
}
