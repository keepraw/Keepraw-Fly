import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fileURLToPath } from "node:url";
import type { KeeprawFlyDocument } from "../packages/schema/src/index";
import { openSettingsCategory } from "./helpers/settings";

const fixture = (name: string) =>
  fileURLToPath(
    new URL(`../tests/fixtures/umetrip/${name}.xls`, import.meta.url),
  );
const baseline: KeeprawFlyDocument = {
  format: "keepraw-fly",
  formatVersion: "0.1.0",
  profile: { name: { romanized: "Fictional XLS reviewer" } },
  frequentFlyerMemberships: [
    {
      id: "synthetic-member",
      programId: "mileageplus",
      memberNumber: "SYNTHETIC",
      associatedAirlines: ["UA"],
    },
  ],
  extensions: { "test.archive": { preserved: true } },
  flights: [
    {
      id: "baseline-flight",
      flightNumber: "UA1341",
      serviceDate: "2023-06-08",
      airline: { iata: "UA" },
      origin: { iata: "SFO" },
      destination: { iata: "LAX" },
      scheduledDeparture: "2023-06-08T10:00:00-07:00",
      scheduledArrival: "2023-06-08T11:30:00-07:00",
      frequentFlyer: {
        membershipId: "synthetic-member",
        tierAtFlight: "Test tier",
      },
    },
  ],
};

async function stored(page: Page): Promise<KeeprawFlyDocument | null> {
  return page.evaluate(async () => {
    const modulePath = "/src/storage/browser.ts";
    const { browserStorage } = await import(modulePath);
    const result = await browserStorage.loadDocument();
    return result.status === "valid" ? result.document : null;
  });
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#settings");
  await openSettingsCategory(page, "Data and backup");
  await page.locator('input[type="file"][accept*=".json"]').setInputFiles({
    name: "synthetic-baseline.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(baseline)),
  });
  await page
    .getByRole("button", { name: "Import this archive", exact: true })
    .click();
  await expect.poll(() => stored(page)).toEqual(baseline);
  await page.goto("/#settings");
  await openSettingsCategory(page, "Data and backup");
});

test("previews XLS status exclusions and duplicates, then appends without replacing the archive", async ({
  page,
}) => {
  const uploads: string[] = [];
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH"].includes(request.method()))
      uploads.push(request.url());
  });
  const input = page.locator('input[type="file"][accept*=".xls"]');
  await input.setInputFiles(fixture("review"));
  const preview = page.getByRole("region", { name: "Review Umetrip import" });
  await expect(preview.getByLabel("Import preflight summary")).toContainText(
    "Recognized6Valid4With issues0New2Possible duplicate1Existing / duplicate1",
  );
  await expect(preview).toContainText("Excluded records: 2");
  await expect(preview).toContainText("OPEN ticket: 1");
  await expect(preview).toContainText("Refunded: 1");
  await preview.getByText("View excluded rows", { exact: true }).click();
  await expect(preview).toContainText("OPEN票 99, row 2:");
  await expect(preview).toContainText("History test, row 8:");
  await expect(
    preview.getByRole("button", { name: "Add 2 flights", exact: true }),
  ).toBeEnabled();
  expect(await stored(page)).toEqual(baseline);
  await preview.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(preview).toHaveCount(0);
  expect(await stored(page)).toEqual(baseline);

  await input.setInputFiles(fixture("review"));
  await preview
    .getByRole("checkbox", { name: /Also import 1 possible duplicate/ })
    .check();
  await preview
    .getByRole("button", { name: "Add 3 flights", exact: true })
    .click();
  await expect(preview).toHaveCount(0);
  const after = await stored(page);
  expect(after?.flights).toHaveLength(4);
  expect(after?.flights[0]).toEqual(baseline.flights[0]);
  expect(after?.profile).toEqual(baseline.profile);
  expect(after?.frequentFlyerMemberships).toEqual(
    baseline.frequentFlyerMemberships,
  );
  expect(after?.extensions).toEqual(baseline.extensions);
  expect(
    after?.flights
      .slice(1)
      .every((flight) => !flight.actualDeparture && !flight.actualArrival),
  ).toBe(true);
  expect(JSON.stringify(after)).not.toContain("Synthetic passenger");
  expect(uploads).toEqual([]);
  await page.reload();
  await page.goto("/#settings");
  await openSettingsCategory(page, "Data and backup");
  expect(await stored(page)).toEqual(after);
  await input.setInputFiles(fixture("review"));
  await expect(preview.getByLabel("Import preflight summary")).toContainText(
    "New0Possible duplicate0Existing / duplicate4",
  );
  await expect(
    preview.getByRole("button", { name: "No new flights to import" }),
  ).toBeDisabled();
});

test("a located row error blocks all writes and file replacement clears stale errors", async ({
  page,
}) => {
  const input = page.locator('input[type="file"][accept*=".xls"]');
  await input.setInputFiles(fixture("invalid"));
  const preview = page.getByRole("region", { name: "Review Umetrip import" });
  await expect(preview.getByRole("alert")).toContainText(
    "Flight history, row 2:",
  );
  await expect(preview.getByRole("alert")).toContainText(
    "airport name or IATA code cannot be resolved",
  );
  await expect(
    preview.getByRole("button", { name: "Resolve issues to import" }),
  ).toBeDisabled();
  expect(await stored(page)).toEqual(baseline);
  await input.setInputFiles(fixture("many-issues"));
  await expect(preview.getByRole("alert").getByRole("listitem")).toHaveCount(
    20,
  );
  await preview
    .getByRole("button", { name: "Show more rows", exact: true })
    .click();
  await expect(preview.getByRole("alert").getByRole("listitem")).toHaveCount(
    25,
  );
  await expect(preview.getByRole("alert")).toContainText(
    "Flight history, row 26:",
  );
  await input.setInputFiles(fixture("standard"));
  await expect(
    preview.getByRole("button", { name: "Add 1 flight", exact: true }),
  ).toBeEnabled();
  await expect(preview.getByRole("alert")).toHaveCount(0);
  await input.setInputFiles({
    name: "forged.xls",
    mimeType: "application/vnd.ms-excel",
    buffer: Buffer.from("a,b\n1,2"),
  });
  await expect(preview).toHaveCount(0);
  await expect(page.locator(".csv-import-error")).toContainText(
    "genuine binary Excel",
  );
  expect(await stored(page)).toEqual(baseline);
});

test("the Chinese XLS preview remains usable on a narrow screen and in dark mode", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Language").selectOption("zh-CN");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await page.locator("#settings-appearance").selectOption("dark");
  await openSettingsCategory(page, "Data and backup");
  const section = page.locator(
    'section[aria-labelledby="settings-umetrip-title"]',
  );
  await section
    .locator('input[type="file"]')
    .setInputFiles(fixture("standard"));
  await expect(
    section.getByRole("button", { name: "添加 1 个航班", exact: true }),
  ).toBeEnabled();
  await section.scrollIntoViewIfNeeded();
  expect(
    await page
      .locator("html")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  const audit = await new AxeBuilder({ page })
    .include('section[aria-labelledby="settings-umetrip-title"]')
    .analyze();
  expect(audit.violations).toEqual([]);
  await section.screenshot({ path: "artifacts/umetrip-mobile-dark.png" });
  await section.getByRole("button", { name: "取消", exact: true }).click();
  expect(await stored(page)).toEqual(baseline);
});
