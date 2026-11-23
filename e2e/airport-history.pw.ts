import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import { disablePassportWebGL } from "./helpers/passport-svg";

const kaiTak = "apt_86460159-a072-4a18-afcc-ab376cda7047";
const chekLapKok = "apt_8d89722f-007c-4eb4-aaa0-ec1c61007a09";
function flight(id: string, year: string): KeeprawFlight {
  return {
    id,
    flightNumber: "CX100",
    airline: { iata: "CX" },
    serviceDate: `${year}-06-01`,
    origin: { iata: "HKG" },
    destination: { iata: "SFO" },
    scheduledDeparture: `${year}-06-01T10:00:00+08:00`,
    scheduledArrival: `${year}-06-01T08:00:00-07:00`,
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
    name: "airports.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(archive)),
  });
  await page.getByRole("button", { name: "Import this archive" }).click();
  await expect(page.locator(".flight-row")).toHaveCount(flights.length);
}
test.beforeEach(async ({ page }) => {
  await disablePassportWebGL(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
});
test("old backups resolve formal history without candidate requests", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("raw.githubusercontent.com"))
      requests.push(request.url());
  });
  await importFlights(page, [flight("old", "1997"), flight("new", "2005")]);
  await expect(page.locator(".map-route-line")).toHaveCount(2);
  const oldMarker = page.locator(`[data-airport-identity="airport:${kaiTak}"]`);
  await expect(oldMarker).toHaveCount(1);
  await expect(
    page.locator(`[data-airport-identity="airport:${chekLapKok}"]`),
  ).toHaveCount(1);
  await oldMarker.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".flight-record")).toHaveCount(1);
  await expect(page.locator(".flight-record")).toHaveAttribute(
    "data-flight-id",
    "old",
  );
  expect(requests).toEqual([]);
});
test("manual selection survives save, reload and a date edit", async ({
  page,
}) => {
  await importFlights(page, [flight("manual", "2005")]);
  await page.locator(".flight-row").click();
  await page.getByRole("button", { name: "Edit flight", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit flight", exact: true });
  await editor.getByRole("combobox").first().fill("Kai Tak");
  await editor
    .locator('[data-history-kind="formal"]')
    .filter({ hasText: "Kai Tak" })
    .click();
  await editor
    .getByRole("button", { name: "Save flight", exact: true })
    .click();
  await expect(page.locator(".route-origin-airport")).toHaveText(
    "Hong Kong International Airport Kai Tak",
  );
  // The open flight keeps its address across the reload.
  await page.reload();
  await expect(page.locator(".route-origin-airport")).toHaveText(
    "Hong Kong International Airport Kai Tak",
  );
  await page.getByRole("button", { name: "Edit flight", exact: true }).click();
  const dates = page.getByRole("dialog").locator('input[type="date"]');
  await dates.nth(0).fill("2006-06-01");
  await dates.nth(1).fill("2006-06-01");
  await page.getByRole("button", { name: "Save flight", exact: true }).click();
  await expect(page.locator(".route-origin-airport")).toHaveText(
    "Hong Kong International Airport Kai Tak",
  );
  await expect(page.locator(".detail-stop--departure")).toContainText("HKG");
  await expect(page.locator(".detail-airport-evidence")).toHaveCount(0);
});

test("replacing SFO with historical Kai Tak persists the HKG code and site after reload", async ({
  page,
}) => {
  const original = flight("replace", "2005");
  original.origin = { iata: "SFO" };
  original.destination = { iata: "LAX" };
  original.scheduledDeparture = "2005-06-01T08:00:00-07:00";
  original.scheduledArrival = "2005-06-02T12:00:00-07:00";
  await importFlights(page, [original]);
  await page.locator(".flight-row").click();
  await page.getByRole("button", { name: "Edit flight", exact: true }).click();
  const editor = page.getByRole("dialog");
  await editor.getByRole("combobox").first().fill("Kai Tak");
  await editor
    .locator('[data-history-kind="formal"]')
    .filter({ hasText: "Kai Tak" })
    .click();
  await expect(editor.getByRole("combobox").first()).toHaveValue("HKG");
  await editor.getByRole("button", { name: "Save flight" }).click();
  await expect(page.locator(".route-origin-airport")).toContainText("Kai Tak");
  await page.reload();
  await expect(
    page.locator(`[data-airport-identity="airport:${kaiTak}"]`),
  ).toHaveCount(1);
  await expect(page.locator(".detail-stop--departure")).toContainText("HKG");
  await expect(page.locator(".route-origin-airport")).toContainText("Kai Tak");
});

for (const [priorSite, expected] of [
  ["apt_d8f290d3-11cc-4441-af6d-f4dd52d3b8dc", "IST"], // confirm Atatürk's recorded alias
  ["apt_92a92544-1808-487a-85e0-0fa995e1de82", "ISL"], // replace the other site
] as const) {
  test(`selecting Atatürk from a saved IST site commits ${expected}`, async ({
    page,
  }) => {
    const original = flight("confirm-site", "2024");
    original.origin = { iata: "IST", airportId: priorSite };
    original.scheduledDeparture = "2024-06-01T10:00:00+03:00";
    original.scheduledArrival = "2024-06-01T13:00:00-07:00";
    await importFlights(page, [original]);
    await page.locator(".flight-row").click();
    await page
      .getByRole("button", { name: "Edit flight", exact: true })
      .click();
    const editor = page.getByRole("dialog");
    await editor.getByRole("combobox").first().fill("Atatürk");
    await editor
      .getByRole("option", { name: /ISL Ataturk International Airport/ })
      .click();
    await expect(editor.getByRole("combobox").first()).toHaveValue(expected);
    await editor.getByRole("button", { name: "Save flight" }).click();
    await expect(page.locator(".route-origin-airport")).toContainText(
      "Ataturk International Airport",
    );
    // The open flight keeps its address across the reload.
    await page.reload();
    await expect(page.locator(".detail-stop--departure")).toContainText(
      expected,
    );
    await expect(page.locator(".route-origin-airport")).toContainText(
      "Ataturk International Airport",
    );
  });
}

test("TAO keeps the flight-date site when changing airport-name languages", async ({
  page,
}) => {
  const old = flight("liuting", "2020");
  const recent = flight("jiaodong", "2024");
  old.origin.iata = "TAO";
  recent.origin.iata = "TAO";
  await importFlights(page, [old, recent]);
  for (const [language, oldLabel, recentLabel] of [
    ["ja-JP", "青島流亭国際空港", "青島膠東国際空港"],
    ["ko-KR", "칭다오 류팅 국제공항", "칭다오 자오둥 국제공항"],
  ]) {
    await page.goto("/#settings");
    await page.locator("#settings-language").selectOption(language);
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    await page.goto("/");
    await expect(
      page.locator(`[data-flight-id="liuting"] [title="${oldLabel}"]`),
    ).toHaveCount(1);
    await expect(
      page.locator(`[data-flight-id="jiaodong"] [title="${recentLabel}"]`),
    ).toHaveCount(1);
    await expect(
      page.locator(
        '[data-airport-identity="airport:apt_f470ecb5-c6dc-4516-a233-37302da2115b"]',
      ),
    ).toHaveCount(1);
    await expect(
      page.locator(
        '[data-airport-identity="airport:apt_6729d2b2-4b79-48c8-9c42-0d4eeba121b8"]',
      ),
    ).toHaveCount(1);
  }
});
