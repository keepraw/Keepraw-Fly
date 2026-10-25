import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { openSettingsCategory } from "../e2e/helpers/settings";
import { watchViolations } from "./helpers/csp-observer";

test("the lazy XLS parser imports locally under the production CSP", async ({
  page,
  browserName,
  baseURL,
}, testInfo) => {
  const watch = await watchViolations(page, browserName);
  const observerReportUrl = new URL("/__csp-observer-report", baseURL).href;
  const requests: string[] = [];
  const uploads: string[] = [];
  page.on("request", (request) => {
    requests.push(request.url());
    // The observer's report-only POST is fulfilled locally by its test route.
    // Every other write request remains an import privacy failure.
    if (
      ["POST", "PUT", "PATCH"].includes(request.method()) &&
      request.url() !== observerReportUrl
    )
      uploads.push(request.url());
  });
  await page.goto("/#settings");
  await openSettingsCategory(page, "Data and backup");
  expect(requests.some((url) => /\/xlsx-[^/]+\.js/.test(url))).toBe(false);
  const beforeXls = await watch.readAll();
  await page
    .locator('input[type="file"][accept*=".xls"]')
    .setInputFiles(
      fileURLToPath(
        new URL("../tests/fixtures/umetrip/standard.xls", import.meta.url),
      ),
    );
  const preview = page.getByRole("region", { name: "Review Umetrip import" });
  await expect(preview.getByLabel("Import preflight summary")).toContainText(
    "Recognized1Valid1With issues0New1",
  );
  expect(requests.some((url) => /\/xlsx-[^/]+\.js/.test(url))).toBe(true);
  await preview
    .getByRole("button", { name: "Add 1 flight", exact: true })
    .click();
  await expect(preview).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<string[]>((resolve, reject) => {
            const request = indexedDB.open("keepraw-fly");
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const db = request.result;
              const transaction = db.transaction("documents", "readonly");
              const record = transaction.objectStore("documents").get("active");
              record.onsuccess = () =>
                resolve(
                  record.result?.document.flights.map(
                    (flight: { flightNumber: string }) => flight.flightNumber,
                  ) ?? [],
                );
              record.onerror = () => reject(record.error);
              transaction.oncomplete = () => db.close();
            };
          }),
      ),
    )
    .toEqual(["CA1031"]);
  expect(uploads).toEqual([]);
  await testInfo.attach("csp-observations", {
    body: JSON.stringify(
      { beforeXls, afterImport: await watch.readAll() },
      null,
      2,
    ),
    contentType: "application/json",
  });
  expect(await watch.violations()).toEqual([]);
  expect(await watch.cspConsoleErrors()).toEqual([]);
});
