import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import { collectBrowserErrors, expectHealthyPage } from "./helpers/responsive";

const fixture = new URL(
  "./fixtures/detail-content-hero.keepraw-fly.json",
  import.meta.url,
);

function leg(
  id: string,
  origin: string,
  destination: string,
  day: number,
): KeeprawFlight {
  const date = `2026-05-${String(day).padStart(2, "0")}`;
  return {
    id,
    flightNumber: `KF${day}`,
    serviceDate: date,
    airline: { iata: "CA" },
    origin: { iata: origin },
    destination: { iata: destination },
    scheduledDeparture: `${date}T02:00:00Z`,
    scheduledArrival: `${date}T14:00:00Z`,
  } as KeeprawFlight;
}

// Short hop, trans-Pacific date-line crossing, polar and a southern long haul.
const geometryCases = [
  { id: "short", origin: "SFO", destination: "LAX" },
  { id: "dateline", origin: "TPE", destination: "LAX" },
  { id: "polar", origin: "JFK", destination: "HKG" },
  { id: "south", origin: "SYD", destination: "SCL" },
  { id: "atlantic", origin: "LHR", destination: "JFK" },
] as const;

async function importFlights(page: Page) {
  const archive = JSON.parse(await readFile(fixture, "utf8"));
  archive.flights = [
    ...archive.flights,
    ...geometryCases.map((item, index) =>
      leg(item.id, item.origin, item.destination, index + 1),
    ),
  ];
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Create my archive", exact: true }),
  ).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "flight-route-map.keepraw-fly.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(archive)),
  });
  await page
    .getByRole("button", { name: "Import this archive", exact: true })
    .click();
  await expect(page.locator(".flight-row")).toHaveCount(archive.flights.length);
}

async function openFlight(page: Page, id: string) {
  await page.setViewportSize({ width: 390, height: 900 });
  if (await page.locator(".detail-header-back").count())
    await page.locator(".detail-header-back").click();
  await page
    .locator(`.flight-record[data-flight-id="${id}"] .flight-row`)
    .click();
  await expect(page.locator(".detail-heading")).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(".detail-flight-map")).toBeVisible();
}

/** Screen-space geometry of the mounted single-route map. */
async function routeGeometry(page: Page) {
  return page.locator(".detail-flight-map").evaluate((map) => {
    const frame = map.querySelector(".map-viewport")!.getBoundingClientRect();
    const center = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    };
    const line = map.querySelector<SVGPathElement>(
      ".map-route.is-selected .map-route-line",
    )!;
    const matrix = line.getScreenCTM()!;
    const total = line.getTotalLength();
    const samples = Array.from({ length: 65 }, (_, index) => {
      const point = line.getPointAtLength((total * index) / 64);
      return new DOMPoint(point.x, point.y).matrixTransform(matrix);
    });
    let longestJump = 0;
    for (let index = 1; index < samples.length; index += 1)
      longestJump = Math.max(
        longestJump,
        Math.hypot(
          samples[index]!.x - samples[index - 1]!.x,
          samples[index]!.y - samples[index - 1]!.y,
        ),
      );
    const route = line.getBoundingClientRect();
    return {
      frame: {
        x: frame.x,
        y: frame.y,
        right: frame.right,
        bottom: frame.bottom,
        width: frame.width,
        height: frame.height,
      },
      route: {
        x: route.x,
        y: route.y,
        right: route.right,
        bottom: route.bottom,
        width: route.width,
        height: route.height,
      },
      subpaths: (line.getAttribute("d")!.match(/M/g) ?? []).length,
      longestJump,
      markers: [...map.querySelectorAll(".map-airport")].map((marker) => ({
        role: marker.getAttribute("data-airport-role"),
        label: marker.querySelector(".map-airport-label")?.textContent ?? null,
        ...center(marker.querySelector(".map-airport-point")!),
      })),
    };
  });
}

test("short, date-line, polar and long-haul routes are framed automatically @cross-browser", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = collectBrowserErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 900 });
  await importFlights(page);
  for (const item of geometryCases) {
    await openFlight(page, item.id);
    const map = page.locator(".detail-flight-map");
    await expect(map).toHaveAttribute("data-route-status", "flown");
    await expect(map.locator(".map-airport-label")).toHaveText([
      item.origin,
      item.destination,
    ]);
    const geometry = await routeGeometry(page);
    // The whole route and both endpoints sit inside the frame with padding.
    expect(geometry.route.x).toBeGreaterThan(geometry.frame.x);
    expect(geometry.route.right).toBeLessThan(geometry.frame.right);
    expect(geometry.route.y).toBeGreaterThan(geometry.frame.y);
    expect(geometry.route.bottom).toBeLessThan(geometry.frame.bottom);
    for (const marker of geometry.markers) {
      expect(marker.x).toBeGreaterThan(geometry.frame.x + 8);
      expect(marker.x).toBeLessThan(geometry.frame.right - 8);
      expect(marker.y).toBeGreaterThan(geometry.frame.y + 8);
      expect(marker.y).toBeLessThan(geometry.frame.bottom - 8);
    }
    // The route is one continuous stroke: the map is recentred on the route,
    // so even a date-line crossing never jumps across the world.
    expect(geometry.subpaths, item.id).toBe(1);
    expect(geometry.longestJump, item.id).toBeLessThan(
      geometry.frame.width / 4,
    );
    // The route fills a useful share of the frame instead of a world view.
    expect(
      Math.max(
        geometry.route.width / geometry.frame.width,
        geometry.route.height / geometry.frame.height,
      ),
      item.id,
    ).toBeGreaterThan(0.2);
    // The stroke ends on the two airport markers.
    const [origin, arrival] = geometry.markers;
    expect(
      Math.hypot(origin!.x - arrival!.x, origin!.y - arrival!.y),
    ).toBeGreaterThan(40);
    await expect(page.locator("canvas")).toHaveCount(0);
  }
  await expectHealthyPage(page, errors);
});

test("diverted flights draw the flown route and keep the planned destination", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 900 });
  await importFlights(page);
  await openFlight(page, "diversion");
  const map = page.locator(".detail-flight-map");
  await expect(map).toHaveAttribute("data-route-status", "diverted");
  await expect(map.locator(".map-route.is-selected")).toHaveCount(1);
  await expect(map.locator(".map-route-planned")).toHaveCount(1);
  const geometry = await routeGeometry(page);
  expect(geometry.markers.map((marker) => [marker.role, marker.label])).toEqual(
    [
      ["origin", "SFO"],
      ["arrival", "JFK"],
      ["planned", "LAX"],
    ],
  );
  for (const marker of geometry.markers) {
    expect(marker.x).toBeGreaterThan(geometry.frame.x);
    expect(marker.x).toBeLessThan(geometry.frame.right);
    expect(marker.y).toBeGreaterThan(geometry.frame.y);
    expect(marker.y).toBeLessThan(geometry.frame.bottom);
  }
  await expect(map.locator(".map-route-planned")).not.toHaveCSS(
    "stroke-dasharray",
    "none",
  );
});

test("cancelled flights show a status instead of a route", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 900 });
  await importFlights(page);
  await openFlight(page, "cancelled");
  const map = page.locator(".detail-flight-map");
  await expect(map).toHaveAttribute("data-route-status", "cancelled");
  await expect(map.getByRole("status")).toContainText(
    "This flight was canceled",
  );
  await expect(map.locator(".map-viewport, .map-route")).toHaveCount(0);
});

test("zoom, drag, keyboard and reset work, and the camera resets per flight", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 900 });
  await importFlights(page);
  await openFlight(page, "dateline");
  const map = page.locator(".detail-flight-map");
  const view = () =>
    map.locator(".map-viewport-content").getAttribute("transform");
  const zoom = () =>
    map.locator(".map-viewport").getAttribute("data-zoom").then(Number);
  const home = await view();
  const homeZoom = await zoom();
  const controls = map.locator(".map-zoom-controls");
  await controls.getByRole("button", { name: "Zoom out", exact: true }).click();
  await expect.poll(view).not.toBe(home);
  const out = await view();
  expect(await zoom()).toBeLessThan(homeZoom);
  const box = (await map.locator(".map-viewport").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2, {
    steps: 6,
  });
  await page.mouse.up();
  await expect.poll(view).not.toBe(out);
  // Keyboard users reach the same controls.
  const zoomIn = controls.getByRole("button", { name: "Zoom in", exact: true });
  await zoomIn.focus();
  const beforeKey = await view();
  await page.keyboard.press("Enter");
  await expect.poll(view).not.toBe(beforeKey);
  await controls
    .getByRole("button", { name: "Fit recorded routes", exact: true })
    .click();
  // The fit is recomputed, so it may differ from the first one by a rounding
  // residue (a translate of -0.003 instead of 0); it is the same view.
  const numbers = (transform: string | null) =>
    (transform?.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g) ?? []).map(Number);
  const homeNumbers = numbers(home);
  expect(homeNumbers).toHaveLength(3);
  await expect
    .poll(async () => {
      const current = numbers(await view());
      return (
        current.length === homeNumbers.length &&
        current.every(
          (value, index) => Math.abs(value - homeNumbers[index]!) < 0.01,
        )
      );
    })
    .toBe(true);

  // Resizing the window re-frames, and another flight starts from its own fit.
  await page.setViewportSize({ width: 1920, height: 1080 });
  const wide = await routeGeometry(page);
  expect(wide.route.x).toBeGreaterThan(wide.frame.x);
  expect(wide.route.right).toBeLessThan(wide.frame.right);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(map.locator(".map-route.is-selected")).toHaveCount(1);
  await expect.poll(view).not.toBe(home);
});
