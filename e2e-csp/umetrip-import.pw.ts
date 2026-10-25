import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { openSettingsCategory } from "../e2e/helpers/settings";

test("the lazy XLS parser imports locally under the production CSP", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.assign(window, { umetripCspViolations: [] as string[] });
    document.addEventListener("securitypolicyviolation", (event) => {
      (
        window as unknown as { umetripCspViolations: string[] }
      ).umetripCspViolations.push(
        `${event.effectiveDirective}: ${event.blockedURI}`,
      );
    });
  });
  const requests: string[] = [];
  const uploads: string[] = [];
  page.on("request", (request) => {
    requests.push(request.url());
    if (["POST", "PUT", "PATCH"].includes(request.method()))
      uploads.push(request.url());
  });
  await page.goto("/#settings");
  await openSettingsCategory(page, "Data and backup");
  expect(requests.some((url) => /\/xlsx-[^/]+\.js/.test(url))).toBe(false);
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
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { umetripCspViolations: string[] })
          .umetripCspViolations,
    ),
  ).toEqual([]);
});
