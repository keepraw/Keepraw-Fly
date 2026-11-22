import { expect, test, type Page } from "@playwright/test";
import { collectBrowserErrors, expectHealthyPage } from "./helpers/responsive";

async function openDemo(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await expect(page.locator(".route-map-canvas > svg")).toBeVisible();
}

function camera(page: Page) {
  return page
    .locator(".route-map-canvas .map-viewport-content")
    .getAttribute("transform");
}

function zoom(page: Page) {
  return page
    .locator(".route-map-canvas.map-viewport, .route-map-canvas .map-viewport")
    .first()
    .getAttribute("data-zoom")
    .then(Number);
}

for (const [width, height] of [
  [1440, 900],
  [390, 844],
] as const) {
  test(`Passport mounts the themed 2D map without WebGL at ${width}px @cross-browser`, async ({
    page,
  }) => {
    const errors = collectBrowserErrors(page);
    const globeRequests: string[] = [];
    page.on("request", (request) => {
      if (
        /PassportGlobe|GlobeMap|globe-renderer|three(?:[./-])|earth-\d|night-\d/.test(
          request.url(),
        )
      )
        globeRequests.push(request.url());
    });
    await page.setViewportSize({ width, height });
    await openDemo(page);
    const map = page.locator(".route-map");
    await expect(map).toHaveAttribute("data-map-theme", "neon-aviation");
    await expect(page.locator("canvas, .passport-globe-frame")).toHaveCount(0);
    await expect(map.locator(".map-land-hatch")).toHaveCount(1);
    await expect(map.locator(".map-route")).not.toHaveCount(0);
    await expect(map.locator(".map-route.is-frequent")).not.toHaveCount(0);
    await expect(map.locator(".map-airport.is-hub")).not.toHaveCount(0);
    // Glow is layered strokes; no per-route SVG filter is ever applied.
    expect(
      await map
        .locator(".map-route-line, .map-route-glow, .map-airport-point")
        .evaluateAll(
          (elements) =>
            elements.filter(
              (element) => getComputedStyle(element).filter !== "none",
            ).length,
        ),
    ).toBe(0);
    const bounds = (await map.locator(".route-map-canvas").boundingBox())!;
    expect(bounds.width).toBeGreaterThan(width * 0.5);
    expect(bounds.height).toBeGreaterThanOrEqual(240);
    expect(globeRequests).toEqual([]);
    await expectHealthyPage(page, errors);
  });
}

test("routes and airports select by pointer, keyboard and picker", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDemo(page);
  const map = page.locator(".route-map");
  const routePicker = map.getByRole("combobox", {
    name: "Select a route",
    exact: true,
  });
  const airportPicker = map.getByRole("combobox", {
    name: "Select an airport",
    exact: true,
  });
  await map.locator(".passport-map-navigation summary").click();
  await expect(routePicker).toHaveValue("");

  // Keyboard: every route is a focusable button activated by Enter.
  const route = map.locator('.map-route[aria-label^="SFO to LAX"]');
  await expect(route).toHaveAttribute("role", "button");
  await route.focus();
  await page.keyboard.press("Enter");
  await expect(route).toHaveClass(/is-selected/);
  await expect(map.locator(".map-route.is-selected")).toHaveCount(1);
  await expect(routePicker).toHaveValue("SFO-LAX");
  await expect(page.locator(".flight-row:focus")).toHaveCount(1);
  await expect(page.locator(".flight-row:focus")).toContainText("SFO");

  // Picker: choosing an airport replaces the route selection.
  await airportPicker.selectOption("SYD");
  await expect(map.locator(".map-route.is-selected")).toHaveCount(0);
  const sydney = map.locator('.map-airport[aria-label*="SYD"]');
  await expect(sydney).toHaveClass(/is-selected/);
  await expect(routePicker).toHaveValue("");

  // Pointer: clicking an airport marker selects it; Space works as well.
  const heathrow = map.locator('.map-airport[aria-label*="LHR"]');
  await heathrow.dispatchEvent("click");
  await expect(heathrow).toHaveClass(/is-selected/);
  await expect(airportPicker).toHaveValue("LHR");
  await sydney.focus();
  await page.keyboard.press("Space");
  await expect(sydney).toHaveClass(/is-selected/);
  await expect(airportPicker).toHaveValue("SYD");

  // Clearing through the picker restores the resting network.
  await airportPicker.selectOption("");
  await expect(map.locator(".map-route.is-selected")).toHaveCount(0);
  await expect(airportPicker).toHaveValue("");
});

test("zoom, pan, keyboard and reset keep working on the themed map", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDemo(page);
  const map = page.locator(".route-map");
  const controls = map.locator(".map-zoom-controls");
  const home = await camera(page);

  await controls.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect.poll(() => camera(page)).not.toBe(home);
  const zoomed = await camera(page);
  const zoomedLevel = await zoom(page);
  expect(zoomedLevel).toBeGreaterThan(1);

  const box = (await map.locator(".route-map-canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 120, box.y + box.height / 2, {
    steps: 6,
  });
  await page.mouse.up();
  await expect.poll(() => camera(page)).not.toBe(zoomed);
  const panned = await camera(page);
  expect(await zoom(page)).toBe(zoomedLevel);

  await page.mouse.wheel(0, -400);
  await expect.poll(() => camera(page)).not.toBe(panned);

  await controls
    .getByRole("button", { name: "Fit recorded routes", exact: true })
    .click();
  await expect.poll(() => camera(page)).toBe(home);
  // Route strokes stay crisp at any zoom and device pixel ratio.
  await expect(map.locator(".map-route-line").first()).toHaveCSS(
    "vector-effect",
    "non-scaling-stroke",
  );
});

test("a flight returning to its origin keeps its airport in the picker", async ({
  page,
}) => {
  const date = "2026-05-01";
  const archive = {
    format: "keepraw-fly",
    formatVersion: "0.1.0",
    profile: { name: { romanized: "Test Traveller", primary: "romanized" } },
    flights: [
      {
        id: "scenic",
        flightNumber: "KF1",
        serviceDate: date,
        airline: { iata: "FI" },
        origin: { iata: "KEF" },
        destination: { iata: "KEF" },
        scheduledDeparture: `${date}T10:00:00Z`,
        scheduledArrival: `${date}T12:00:00Z`,
      },
    ],
  };
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "scenic.keepraw-fly.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(archive)),
  });
  await page
    .getByRole("button", { name: "Import this archive", exact: true })
    .click();
  const map = page.locator(".route-map[data-map-theme]");
  await expect(map.locator(".map-airport")).toHaveCount(1);
  await map.locator(".passport-map-navigation summary").click();
  const picker = map.getByLabel("Select an airport", { exact: true });
  await expect(picker.locator("option")).toHaveCount(2);
  await map.locator(".map-airport").focus();
  await page.keyboard.press("Enter");
  await expect(picker).toHaveValue("KEF");
});

test("drawn route lines drop the draw-in dash pattern", async ({ page }) => {
  // With non-scaling strokes Chromium spaces a retained pathLength dash in
  // screen pixels, which leaves gaps in (or hides) lines on a zoomed-in map.
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  const lines = page.locator(".route-map-canvas .map-route-line");
  await expect(lines.first()).toBeVisible();
  await expect
    .poll(() =>
      lines.evaluateAll((elements) =>
        elements.every(
          (element) => getComputedStyle(element).strokeDasharray === "none",
        ),
      ),
    )
    .toBe(true);
});
