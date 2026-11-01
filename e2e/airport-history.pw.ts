import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import { disablePassportWebGL } from "./helpers/passport-svg";

test.beforeEach(async ({ page }) => disablePassportWebGL(page));

// Real committed airport-history data: HKG was Kai Tak in 1997 and Chek Lap
// Kok in 2005; AUS has two unconfirmed historical sites; QQQ is unknown.
// KMG: the bundled directory still places it at the closed Wujiaba airport
// while the worldwide reference layer places it at Changshui (23 km away), so
// it is a historical candidate and never a confirmed route endpoint.
function flight(
  id: string,
  origin: string,
  destination: string,
  serviceDate: string,
  scheduledDeparture: string,
  scheduledArrival: string,
): KeeprawFlight {
  return {
    id,
    flightNumber: `CX${id.length + 100}`,
    serviceDate,
    airline: { iata: "CX" },
    origin: { iata: origin },
    destination: { iata: destination },
    scheduledDeparture,
    scheduledArrival,
  };
}

async function importFlights(page: Page, flights: KeeprawFlight[]) {
  const archive = JSON.parse(
    await readFile(
      new URL("../examples/basic.keepraw-fly.json", import.meta.url),
      "utf8",
    ),
  );
  archive.flights = flights;
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "airport-history.keepraw-fly.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(archive)),
  });
  await page.getByRole("button", { name: "Import this archive" }).click();
  await expect(page.locator(".flight-row")).toHaveCount(flights.length);
}

test("resolves airports by flight date and keeps unresolved flights", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await importFlights(page, [
    flight(
      "kai-tak",
      "HKG",
      "SFO",
      "1997-06-01",
      "1997-06-01T10:00:00+08:00",
      "1997-06-01T08:00:00-07:00",
    ),
    flight(
      "chek-lap-kok",
      "HKG",
      "SFO",
      "2005-06-01",
      "2005-06-01T10:00:00+08:00",
      "2005-06-01T08:00:00-07:00",
    ),
    flight(
      "austin",
      "AUS",
      "LAX",
      "1995-06-01",
      "1995-06-01T10:00:00-05:00",
      "1995-06-01T11:30:00-07:00",
    ),
    flight(
      "kunming",
      "CTU",
      "KMG",
      "2026-09-22",
      "2026-09-22T10:00:00+08:00",
      "2026-09-22T11:30:00+08:00",
    ),
    flight(
      "unknown",
      "QQQ",
      "SFO",
      "2010-06-01",
      "2010-06-01T08:00:00+05:45",
      "2010-06-01T18:00:00-07:00",
    ),
  ]);

  // Kai Tak and Chek Lap Kok are separate physical airports and routes.
  await expect(page.locator(".map-route-line")).toHaveCount(2);
  await expect(
    page.locator('[data-airport-identity^="airport:apt_"]'),
  ).toHaveCount(2);
  // AUS and KMG candidates are drawn only as possible locations, never as routes.
  await expect(
    page.locator('[data-possible-airport="AUS"]').first(),
  ).toBeAttached();
  await expect(
    page.locator('[data-possible-airport="KMG"]').first(),
  ).toBeAttached();
  await expect(
    page.locator('.flight-record[data-unresolved-airports~="KMG"]'),
  ).toHaveCount(1);
  // Desktop: the Airports figure counts confirmed sites only and carries the
  // unconfirmed codes (AUS, KMG, QQQ) beside it.
  const coverage = page.locator(".passport-history-coverage").first();
  await expect(coverage).toHaveAttribute("data-unresolved-airports", "3");
  await expect(coverage).toHaveAttribute(
    "title",
    "Airports not confirmed at their flight dates: 3 (not counted above)",
  );
  // The unknown code is kept as recorded.
  await expect(
    page.locator('.flight-record[data-unresolved-airports~="QQQ"]'),
  ).toHaveCount(1);

  await page
    .locator('.flight-record[data-flight-id="kai-tak"] .flight-row')
    .click();
  await expect(page.locator(".route-origin-airport")).toHaveText(
    "Hong Kong International Airport Kai Tak",
  );
  await expect(
    page.locator('[data-airport-history="historical"]'),
  ).toContainText("22.3203°N, 114.1981°E");
});
