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

async function formalAirportId(name: string): Promise<string> {
  const formal = JSON.parse(
    await readFile(
      new URL(
        "../packages/core/data/airport-history/formal/airports.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as { airports: { airportId: string; name: { value: string } }[] };
  return formal.airports.find((airport) => airport.name.value === name)!
    .airportId;
}

test("Passport map selects Kai Tak and Chek Lap Kok as separate airports", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const kaiTak = `airport:${await formalAirportId("Hong Kong International Airport Kai Tak")}`;
  const chekLapKok = `airport:${await formalAirportId("Hong Kong International Airport")}`;
  await importFlights(page, [
    flight(
      "kai-tak-out",
      "HKG",
      "SFO",
      "1997-06-01",
      "1997-06-01T10:00:00+08:00",
      "1997-06-01T23:00:00+08:00",
    ),
    flight(
      "chek-lap-kok-out",
      "HKG",
      "SFO",
      "1999-06-01",
      "1999-06-01T10:00:00+08:00",
      "1999-06-01T23:00:00+08:00",
    ),
    // The shared code as a destination: another route context.
    flight(
      "kai-tak-in",
      "LAX",
      "HKG",
      "1997-07-01",
      "1997-07-01T09:00:00-07:00",
      "1997-07-02T16:00:00+08:00",
    ),
    flight(
      "chek-lap-kok-in",
      "LAX",
      "HKG",
      "1999-07-01",
      "1999-07-01T09:00:00-07:00",
      "1999-07-02T16:00:00+08:00",
    ),
  ]);
  const records = page.locator(".flight-record");
  const ids = async () =>
    (
      await records.evaluateAll((rows) =>
        rows.map((row) => (row as HTMLElement).dataset.flightId),
      )
    ).sort();
  // Four physical routes: same code pairs, different HKG sites.
  await expect(page.locator(".map-route-line")).toHaveCount(4);
  const kaiTakMarker = page.locator(`[data-airport-identity="${kaiTak}"]`);
  const chekLapKokMarker = page.locator(
    `[data-airport-identity="${chekLapKok}"]`,
  );
  await expect(kaiTakMarker).toHaveCount(1);
  await expect(chekLapKokMarker).toHaveCount(1);
  await expect(kaiTakMarker).toHaveAttribute(
    "data-airport-basis",
    "historical",
  );
  await expect(
    page.locator('[data-airport-identity="current:SFO"]'),
  ).toHaveAttribute("data-airport-basis", "current-directory");

  // Kai Tak marker: only the 1997 flights.
  await kaiTakMarker.focus();
  await page.keyboard.press("Enter");
  await expect(records).toHaveCount(2);
  expect(await ids()).toEqual(["kai-tak-in", "kai-tak-out"]);
  await expect(kaiTakMarker).toHaveAttribute("aria-pressed", "true");
  await expect(chekLapKokMarker).toHaveAttribute("aria-pressed", "false");

  // Chek Lap Kok marker: only the 1999 flights.
  await chekLapKokMarker.focus();
  await page.keyboard.press("Enter");
  await expect(records).toHaveCount(2);
  expect(await ids()).toEqual(["chek-lap-kok-in", "chek-lap-kok-out"]);
  await expect(kaiTakMarker).toHaveAttribute("aria-pressed", "false");

  // Route selection keeps the two HKG→SFO routes apart.
  const kaiTakRoute = page.locator(
    `.map-route[data-route-identity="${kaiTak}>current:SFO"]`,
  );
  const chekLapKokRoute = page.locator(
    `.map-route[data-route-identity="${chekLapKok}>current:SFO"]`,
  );
  await kaiTakRoute.focus();
  await page.keyboard.press("Enter");
  await expect(records).toHaveCount(1);
  expect(await ids()).toEqual(["kai-tak-out"]);
  await expect(kaiTakRoute).toHaveClass(/is-selected/);
  await expect(chekLapKokRoute).not.toHaveClass(/is-selected/);

  // Highlighting a flight lights its own physical route only.
  await page.locator(".passport-exploration-close").click();
  await expect(records).toHaveCount(4);
  await page
    .locator('.flight-record[data-flight-id="chek-lap-kok-out"] .flight-row')
    .hover();
  await expect(chekLapKokRoute).toHaveClass(/is-highlighted/);
  await expect(kaiTakRoute).not.toHaveClass(/is-highlighted/);

  // Passport shows verified history apart from current-directory airports.
  const evidence = page.locator(".passport-airport-evidence").first();
  await expect(evidence).toHaveAttribute("data-verified-airports", "2");
  await expect(evidence).toHaveAttribute(
    "data-current-directory-airports",
    "2",
  );
  await expect(evidence).toContainText("historically verified: 2");
  await expect(evidence).toContainText("current directory only");

  // Flight Detail states the basis of each code.
  await page
    .locator('.flight-record[data-flight-id="kai-tak-out"] .flight-row')
    .click();
  await expect(
    page.locator(".detail-stop--departure [data-assignment-evidence]"),
  ).toHaveAttribute("data-assignment-evidence", "historically_verified");
  await expect(
    page.locator(".detail-stop--arrival [data-assignment-evidence]"),
  ).toHaveAttribute("data-assignment-evidence", "current_directory");
  await expect(page.locator(".detail-stop--arrival")).toContainText(
    "validity on this date is not verified",
  );
});
