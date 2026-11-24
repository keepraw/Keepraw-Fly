import { expect, test } from "@playwright/test";
import { openImport } from "../e2e/helpers/settings";
import {
  regionalAirportCodes,
  scaleArchive,
} from "../tests/fixtures/scale-archives";

test("fits all 3,080 regional routes in the production Passport 2D map", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const archive = scaleArchive(1);
  const sample = archive.flights[0]!;
  archive.flights = regionalAirportCodes.flatMap((origin) =>
    regionalAirportCodes
      .filter((destination) => origin !== destination)
      .map((destination) => ({
        ...sample,
        id: `${origin}-${destination}`,
        origin: { iata: origin },
        destination: { iata: destination },
        scheduledDeparture: "2025-03-01T10:00:00Z",
        scheduledArrival: "2025-03-01T16:00:00Z",
      })),
  );
  expect(archive.flights).toHaveLength(3_080);

  const fallback = page.locator(".route-map[data-map-theme] .map-viewport");
  // Finish normal lazy loading before expanding the archive under test.
  await page.goto("/");
  await page.locator('input[type="file"][accept*=".json"]').setInputFiles({
    name: "regional-seed.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ ...archive, flights: [archive.flights[0]] }),
    ),
  });
  await page
    .getByRole("button", { name: "Import this archive", exact: true })
    .click();
  await expect(fallback).toBeVisible({ timeout: 30_000 });

  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await openImport(page);
  await page.locator('#settings-import input[type="file"]').setInputFiles({
    name: "regional-3080.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(archive)),
  });
  await page
    .getByRole("button", { name: "Import 3,079 new flights", exact: true })
    .click();
  await expect(fallback).toBeVisible({ timeout: 60_000 });
  await expect(fallback.locator(".map-airports .map-airport")).toHaveCount(56);
  await expect(fallback.locator(".map-routes .map-route")).toHaveCount(3_080);
  const camera = await fallback
    .locator(":scope > svg")
    .evaluate((svg: SVGSVGElement) => {
      const viewport = svg.viewBox.baseVal;
      const content = svg.querySelector<SVGGElement>(".map-viewport-content")!;
      const routes = svg.querySelector<SVGGElement>(".map-routes")!.getBBox();
      const transform = content.transform.baseVal.consolidate()!.matrix;
      return {
        zoom: transform.a,
        centerX: (viewport.width / 2 - transform.e) / transform.a,
        centerY: (viewport.height / 2 - transform.f) / transform.d,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        left: routes.x * transform.a + transform.e,
        right: (routes.x + routes.width) * transform.a + transform.e,
        top: routes.y * transform.d + transform.f,
        bottom: (routes.y + routes.height) * transform.d + transform.f,
      };
    });
  expect(camera.zoom).toBeGreaterThan(1);
  expect(camera.zoom).toBeLessThanOrEqual(6);
  expect(camera.left).toBeGreaterThanOrEqual(-1);
  expect(camera.right).toBeLessThanOrEqual(camera.viewportWidth + 1);
  expect(camera.top).toBeGreaterThanOrEqual(-1);
  expect(camera.bottom).toBeLessThanOrEqual(camera.viewportHeight + 1);
  expect(errors).toEqual([]);
  await testInfo.attach("regional-camera", {
    body: JSON.stringify(camera),
    contentType: "application/json",
  });
});
