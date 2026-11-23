import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { KeeprawFlight, KeeprawFlyDocument } from "@keepraw-fly/schema";
import { disablePassportWebGL } from "./helpers/passport-svg";
import { openSettingsCategory } from "./helpers/settings";

const flight: KeeprawFlight = {
  id: "p1-fixture",
  flightNumber: "UA7911",
  airline: { iata: "UA" },
  serviceDate: "2025-01-01",
  origin: { iata: "SFO" },
  destination: { iata: "LAX" },
  scheduledDeparture: "2025-01-01T11:00:00-08:00",
  scheduledArrival: "2025-01-01T12:30:00-08:00",
};
function archive(...flights: KeeprawFlight[]): KeeprawFlyDocument {
  return {
    format: "keepraw-fly",
    formatVersion: "0.1.0",
    profile: { name: { romanized: "Fictional test owner" } },
    flights,
  };
}

async function stored(page: Page) {
  return page.evaluate(
    () =>
      new Promise<
        | {
            document: KeeprawFlyDocument;
            kind: "demo" | "personal";
            updatedAt: string;
          }
        | undefined
      >((resolve, reject) => {
        const open = indexedDB.open("keepraw-fly");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("documents", "readonly");
          const request = tx.objectStore("documents").get("active");
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
          tx.oncomplete = () => db.close();
        };
      }),
  );
}

async function selectJson(page: Page, document: KeeprawFlyDocument) {
  await page.locator('input[type="file"][accept*=".json"]').setInputFiles({
    name: "p1-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(document)),
  });
}

async function importArchive(page: Page, document: KeeprawFlyDocument) {
  await page.goto("/");
  await selectJson(page, document);
  await page
    .getByRole("button", { name: "Import this archive", exact: true })
    .click();
  await expect
    .poll(async () => (await stored(page))?.document)
    .toEqual(document);
}

async function openBackupSettings(page: Page) {
  await page.goto("/#settings");
  await openSettingsCategory(page, "Data and backup");
}

async function openFlight(page: Page, number = flight.flightNumber) {
  await page
    .getByRole("button", { name: new RegExp(`Open ${number}\\b`) })
    .click();
}

/** An open flight is addressable, so a reload returns to its Detail. */
async function reloadDetail(page: Page) {
  await page.reload();
  await expect(page.locator(".detail-flight-card")).toBeVisible();
}

async function openEditor(page: Page) {
  await page.getByRole("button", { name: "Edit flight", exact: true }).click();
  return page.getByRole("dialog", { name: "Edit flight", exact: true });
}

function csvFile(headers: string, ...rows: string[]) {
  return {
    name: "p1-fixture.csv",
    mimeType: "text/csv",
    buffer: Buffer.from([headers, ...rows].join("\n")),
  };
}
const csvHeaders =
  "flightNumber,serviceDate,originIata,destinationIata,scheduledDeparture,scheduledArrival";
const csvRow = `${flight.flightNumber},2025-01-01,SFO,LAX,2025-01-01T11:00,2025-01-01T12:30`;

test.beforeEach(async ({ page }) => {
  await disablePassportWebGL(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
});

for (const [source, number] of [
  ["JSON", flight.flightNumber],
  ["CSV", flight.flightNumber],
  ["Flighty", flight.flightNumber],
  ["Umetrip", "CA1031"],
] as const) {
  test(
    `${source} import replaces Demo without carrying over flights or owner (KF-05)`,
    { tag: source === "JSON" ? "@cross-browser" : [] },
    async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: "Try demo", exact: true }).click();
      await expect(page.locator(".demo-banner")).toBeVisible();
      await expect
        .poll(async () => (await stored(page))?.document.flights.length)
        .toBe(24);
      const demo = await stored(page);
      expect(demo).toMatchObject({
        kind: "demo",
        document: { profile: { name: { romanized: "Yuan Lin" } } },
      });
      await openBackupSettings(page);
      const select = async () => {
        if (source === "JSON") await selectJson(page, archive(flight));
        else if (source === "CSV")
          await page
            .getByLabel("Open CSV file", { exact: true })
            .setInputFiles(csvFile(csvHeaders, csvRow));
        else if (source === "Flighty")
          await page
            .getByLabel("Open Flighty CSV", { exact: true })
            .setInputFiles(
              csvFile(
                "Date,Airline,Flight,From,To,Gate Departure (Scheduled),Gate Arrival (Scheduled)",
                "2025-01-01,UA,7911,SFO,LAX,2025-01-01T11:00,2025-01-01T12:30",
              ),
            );
        else
          await page
            .getByLabel("Open Umetrip XLS", { exact: true })
            .setInputFiles(
              fileURLToPath(
                new URL(
                  "../tests/fixtures/umetrip/standard.xls",
                  import.meta.url,
                ),
              ),
            );
      };
      await select();
      const preview = page.locator(
        source === "JSON" ? ".import-preview" : ".csv-preview",
      );
      await expect(
        page.locator(".settings-import-row").filter({ has: preview }),
      ).toContainText("Demo data will not be kept.");
      await expect(
        preview.getByLabel("Import preflight summary"),
      ).toContainText("New1");
      expect(await stored(page)).toEqual(demo);
      if (source === "JSON") {
        await preview
          .getByRole("button", { name: "Cancel", exact: true })
          .click();
        await expect(preview).toHaveCount(0);
        expect(await stored(page)).toEqual(demo);
        await select();
      }
      await preview
        .getByRole("button", {
          name: /^(Import this archive|Add (?:1 new|1) flights?)$/,
        })
        .click();
      await expect
        .poll(async () => (await stored(page))?.kind)
        .toBe("personal");
      const personal = await stored(page);
      expect(personal?.document.profile).toEqual(
        source === "JSON" ? archive().profile : {},
      );
      expect(
        personal?.document.flights.map((entry) => entry.flightNumber),
      ).toEqual([number]);
      expect(personal?.document.frequentFlyerMemberships).toBeUndefined();

      await page.reload();
      await expect(page.locator(".flight-row")).toHaveCount(1);
      await expect(
        page.getByRole("button", { name: new RegExp(`Open ${number}\\b`) }),
      ).toBeVisible();
      await expect(page.locator(".demo-banner")).toHaveCount(0);
      expect(await stored(page)).toEqual(personal);
      if (source === "JSON") {
        await openBackupSettings(page);
        const download = page.waitForEvent("download");
        await page
          .getByRole("button", { name: "Export Keepraw Fly JSON", exact: true })
          .click();
        expect(
          JSON.parse(await readFile((await (await download).path())!, "utf8")),
        ).toEqual(archive(flight));
      }
    },
  );
}

test("correcting a physical SFO identity updates the mounted Detail map (KF-06)", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await importArchive(page, {
    ...archive({
      ...flight,
      origin: { iata: "SFO", airportId: "apt_unavailable" },
    }),
    formatVersion: "0.2.0",
  });
  await openFlight(page);
  const frame = page.locator(".detail-flight-map");
  const unavailable = frame.getByRole("status");
  await expect(unavailable).toContainText("The flight route is unavailable");
  const editor = await openEditor(page);
  await editor
    .getByRole("combobox", { name: "Origin", exact: true })
    .fill("San Francisco International Airport");
  await editor
    .getByRole("option", { name: /^SFO San Francisco International Airport/ })
    .click();
  await editor
    .getByRole("button", { name: "Save flight", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /San Francisco to Los Angeles/ }),
  ).toBeVisible();
  await expect(frame).toHaveAttribute("data-route-status", "flown");
  await expect(frame.locator(".map-airport-label")).toHaveText(["SFO", "LAX"]);
  await expect
    .poll(async () => (await stored(page))?.document.flights[0]?.origin)
    .toEqual({
      iata: "SFO",
      airportId: expect.stringMatching(/^apt_(?!unavailable)/),
    });
  await reloadDetail(page);
  await expect(frame).toHaveAttribute("data-route-status", "flown");
  await expect(frame.locator(".map-airport-label")).toHaveText(["SFO", "LAX"]);
});

test("selects EDC and IHA by name and reloads both directory identities (KF-07)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 680, height: 900 });
  await importArchive(page, archive(flight));
  await openFlight(page);
  const editor = await openEditor(page);
  for (const [field, code, name] of [
    ["Origin", "EDC", "Austin Executive Airport"],
    ["Destination", "IHA", "Niijima Airport"],
  ]) {
    await editor
      .getByRole("combobox", { name: field, exact: true })
      .fill(name!);
    await editor
      .getByRole("option", { name: new RegExp(`^${code} ${name}`) })
      .click();
    await expect(
      editor.getByRole("combobox", { name: field, exact: true }),
    ).toHaveValue(code!);
  }
  await editor.getByLabel("Arrival date", { exact: true }).fill("2025-01-02");
  await editor
    .getByRole("button", { name: "Save flight", exact: true })
    .click();
  await expect
    .poll(async () => (await stored(page))?.document.flights[0])
    .toMatchObject({
      origin: {
        iata: "EDC",
        airportId: "apt_eb562540-071e-4433-8d9b-26fe7170894c",
      },
      destination: {
        iata: "IHA",
        airportId: "apt_89b4e952-f536-4b6f-85c3-eba5cb0dd279",
      },
    });
  await reloadDetail(page);
  await expect(page.locator(".route-origin-airport")).toHaveText(
    "Austin Executive Airport",
  );
  await expect(page.locator(".route-arrival-airport")).toHaveText(
    "Niijima Airport",
  );
});

test("Detail shows both signs of local arrival day offsets (KF-08)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 680, height: 900 });
  await importArchive(
    page,
    archive(
      {
        ...flight,
        origin: { iata: "LHR" },
        destination: { iata: "HND" },
        scheduledDeparture: "2025-01-01T11:00:00Z",
        scheduledArrival: "2025-01-01T23:30:00Z",
      },
      {
        ...flight,
        id: "date-line",
        flightNumber: "UA7912",
        origin: { iata: "HND" },
        destination: { iata: "HNL" },
        scheduledDeparture: "2025-01-01T15:30:00Z",
        scheduledArrival: "2025-01-01T22:30:00Z",
      },
    ),
  );
  await openFlight(page);
  const arrival = page.locator(".detail-stop--arrival time");
  await expect(arrival).toHaveText("08:30 +1");
  await expect(arrival.locator(".time-day-offset")).toHaveAttribute(
    "aria-label",
    "1 day later",
  );
  await page.locator(".detail-header-back").click();
  await openFlight(page, "UA7912");
  await expect(arrival).toHaveText("12:30 -1");
  await expect(arrival.locator(".time-day-offset")).toHaveAttribute(
    "aria-label",
    "1 day earlier",
  );
});

test("blocks invalid CSV status rows before commit and persists Y as cancelled (KF-10)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await importArchive(page, archive({ ...flight, flightNumber: "UA7912" }));
  const before = await stored(page);
  await openBackupSettings(page);
  const input = page.getByLabel("Open CSV file", { exact: true });
  const preview = page.locator(".csv-preview");
  await input.setInputFiles(
    csvFile(
      `${csvHeaders},cancelled,divertedToIata`,
      `${csvRow},maybe,`,
      `${csvRow},true,ORD`,
    ),
  );
  await expect(
    preview.getByRole("button", {
      name: "Resolve issues to import",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(preview.getByRole("alert").getByRole("listitem")).toHaveText([
    /CSV line 2.*Use true, 1, yes or y/i,
    /CSV line 3.*canceled flight cannot also have a diversion airport/i,
  ]);
  expect(await stored(page)).toEqual(before);
  await input.setInputFiles(csvFile(`${csvHeaders},cancelled`, `${csvRow},Y`));
  await preview
    .getByRole("button", { name: "Add 1 flight", exact: true })
    .click();
  await expect
    .poll(async () => (await stored(page))?.document.flights)
    .toEqual([
      before!.document.flights[0],
      expect.objectContaining({
        flightNumber: flight.flightNumber,
        cancelled: true,
      }),
    ]);
  await page.reload();
  await expect(page.locator(".flight-row")).toHaveCount(2);
  await expect(
    page.locator(".passport-core-stat").filter({ hasText: /^1Flights$/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Open UA7911/ })).toContainText(
    "Canceled",
  );
});

test(
  'edits and deletes a persisted flight with ID "new" (KF-12)',
  { tag: "@cross-browser" },
  async ({ page }) => {
    await page.setViewportSize({ width: 680, height: 900 });
    await importArchive(
      page,
      archive(
        { ...flight, id: "new" },
        { ...flight, id: "neighbor", flightNumber: "UA7913" },
      ),
    );
    await openFlight(page);
    let editor = await openEditor(page);
    await expect(
      editor.getByRole("textbox", { name: /^Flight number/ }),
    ).toHaveValue("UA7911");
    await editor
      .getByRole("textbox", { name: /^Flight number/ })
      .fill("UA7912");
    await editor
      .getByRole("button", { name: "Save flight", exact: true })
      .click();
    await expect
      .poll(async () =>
        (await stored(page))?.document.flights.map(({ id, flightNumber }) => [
          id,
          flightNumber,
        ]),
      )
      .toEqual([
        ["new", "UA7912"],
        ["neighbor", "UA7913"],
      ]);
    await reloadDetail(page);
    editor = await openEditor(page);
    await editor
      .getByRole("button", { name: "Delete flight", exact: true })
      .click();
    await page
      .getByRole("alertdialog", { name: "Delete flight", exact: true })
      .getByRole("button", { name: "Delete flight", exact: true })
      .click();
    await expect
      .poll(async () => (await stored(page))?.document.flights)
      .toEqual([{ ...flight, id: "neighbor", flightNumber: "UA7913" }]);
    await page.reload();
    await expect(page.locator(".flight-row")).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: /Open UA7913/ }),
    ).toBeVisible();
  },
);

test("blocks a native leap-second import without changing the saved archive (KF-25)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 680, height: 900 });
  await importArchive(page, archive(flight));
  const before = await stored(page);
  await openBackupSettings(page);
  await selectJson(
    page,
    archive({
      ...flight,
      id: "leap-second",
      scheduledArrival: "2016-12-31T23:59:60Z",
    }),
  );
  const preview = page.locator(".import-preview");
  await expect(preview.getByRole("alert")).toContainText(
    "/flights/0/scheduledArrival",
  );
  await expect(preview.getByRole("alert")).toContainText(
    "Leap seconds are not supported",
  );
  await expect(
    preview.getByRole("button", {
      name: "Resolve issues to import",
      exact: true,
    }),
  ).toBeDisabled();
  expect(await stored(page)).toEqual(before);
  await page.goto("/#/map");
  await page.reload();
  await openFlight(page);
  await expect(page.locator(".detail-stop--arrival time")).toHaveText("12:30");
  expect(await stored(page)).toEqual(before);
});

for (const conflict of [false, true]) {
  test(
    `mixed membership migration ${conflict ? "keeps the conflicting original recoverable" : "preserves referenced legacy accounts after reload"} (KF-19)`,
    { tag: "@cross-browser" },
    async ({ page }) => {
      await page.setViewportSize({ width: 680, height: 900 });
      await page.goto("/");
      await expect(
        page.getByRole("button", { name: "Create my archive", exact: true }),
      ).toBeVisible();
      const account = {
        id: "legacy",
        programId: "custom",
        memberNumber: "TEST-001",
        associatedAirlines: ["UA"],
      };
      const raw = {
        ...archive({ ...flight, frequentFlyer: { membershipId: account.id } }),
        frequentFlyerMemberships: conflict
          ? [{ ...account, memberNumber: "DIFFERENT" }]
          : [],
        extensions: {
          "keepraw-fly.frequent-flyer": { memberships: [account] },
        },
      };
      await page.evaluate(
        (document) =>
          new Promise<void>((resolve, reject) => {
            const request = indexedDB.open("keepraw-fly");
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const db = request.result;
              const tx = db.transaction("documents", "readwrite");
              tx.objectStore("documents").put({
                key: "active",
                document,
                kind: "personal",
                updatedAt: "2025-01-01T00:00:00Z",
              });
              tx.oncomplete = () => {
                db.close();
                resolve();
              };
              tx.onabort = () => {
                db.close();
                reject(tx.error);
              };
            };
          }),
        raw,
      );
      const original = await stored(page);
      await page.reload();
      if (conflict) {
        await expect(page.locator(".recovery-page")).toBeVisible();
        expect(await stored(page)).toEqual(original);
        const download = page.waitForEvent("download");
        await page
          .getByRole("button", { name: "Download recovery copy", exact: true })
          .click();
        expect(
          JSON.parse(await readFile((await (await download).path())!, "utf8")),
        ).toEqual(raw);
      } else {
        await expect(
          page.getByRole("button", { name: /Open UA7911/ }),
        ).toBeVisible();
        const migrated = {
          ...archive({
            ...flight,
            frequentFlyer: { membershipId: account.id },
          }),
          frequentFlyerMemberships: [account],
        };
        expect((await stored(page))?.document).toEqual(migrated);
        await openFlight(page);
        await expect(page.locator(".detail-flight-card")).toContainText(
          "TEST-001",
        );
      }
      const after = await stored(page);
      await page.reload();
      await expect(
        page.locator(conflict ? ".recovery-page" : ".detail-flight-card"),
      ).toBeVisible();
      expect(await stored(page)).toEqual(after);
    },
  );
}
