import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import { globeMode } from "./helpers/globe-capability";
import { disablePassportWebGL } from "./helpers/passport-svg";
import AxeBuilder from "@axe-core/playwright";
import {
  add,
  cross,
  dot,
  normalize,
  routeArc,
  scale,
  type Vec3,
} from "../apps/web/src/globe/globe-math";

async function importFlights(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const archive: KeeprawFlyDocument = JSON.parse(
    await readFile("e2e/fixtures/chinese-passport.keepraw-fly.json", "utf8"),
  );
  const first = archive.flights[0]!;
  archive.flights.push(
    {
      ...first,
      id: "repeat",
      flightNumber: "ZH999",
      serviceDate: "2024-01-01",
    },
    {
      ...first,
      id: "diverted",
      flightNumber: "ZH998",
      serviceDate: "2025-01-01",
      destination: { iata: "PEK" },
      divertedTo: { iata: "TAO" },
    },
  );
  for (const flight of archive.flights.slice(-2)) {
    for (const field of [
      "scheduledDeparture",
      "scheduledArrival",
      "actualDeparture",
      "actualArrival",
    ] as const) {
      if (flight[field])
        flight[field] = flight.serviceDate + flight[field]!.slice(10);
    }
  }
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "task-3.keepraw-fly.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(archive)),
  });
  await page
    .getByRole("button", { name: "Import this archive", exact: true })
    .click();
  await expect(page.locator(".passport-globe-frame")).toBeVisible();
  return archive;
}

async function scene(page: Page) {
  return JSON.parse(
    (await page.locator(".globe-host").getAttribute("data-scene"))!,
  );
}

async function picker(page: Page) {
  await page.locator(".passport-globe-navigation summary").click();
  return page.getByRole("combobox", { name: "Select a route", exact: true });
}

test("formal Passport uses real scoped routes and stable selection, Archive focus and keyboard @cross-browser", async ({
  page,
}) => {
  const archive = await importFlights(page);
  const mode = await globeMode(page);
  const route = await picker(page);
  await expect(route.locator('option[value="SZX-TAO"]')).toHaveText(
    "SZX → TAO · 3",
  );
  await expect(route.locator('option[value="TAO-SZX"]')).toHaveCount(1);
  await expect(route.locator('option[value="SZX-PEK"]')).toHaveCount(0);
  await expect(page.locator(".flight-row")).toHaveCount(archive.flights.length);
  const canvas =
    mode === "webgl"
      ? await page.locator(".globe-webgl").elementHandle()
      : null;
  if (mode === "webgl") {
    const initial = await scene(page);
    expect(
      initial.routes.find((r: { key: string }) => r.key === "SZX-TAO").count,
    ).toBe(3);
    expect(initial.physicalRoutes).toBeLessThan(initial.routes.length);
  }
  await route.selectOption("SZX-TAO");
  await expect(page.locator(".flight-row")).toHaveCount(3);
  const selected = page.locator(
    '.flight-record[data-flight-id="typography-1"] .flight-row',
  );
  await expect(selected).toBeFocused();
  await expect(selected).toHaveAttribute("aria-current", "true");
  await expect(selected).toBeInViewport({ ratio: 0.99 });
  // The full period/search network remains available after selecting a subset.
  await route.selectOption("TAO-SZX");
  await expect(page.locator(".flight-row")).toHaveCount(1);
  if (canvas)
    expect(
      await canvas.evaluate(
        (el) => el === document.querySelector(".globe-webgl"),
      ),
    ).toBe(true);
  await page
    .getByRole("combobox", { name: "Select an airport", exact: true })
    .selectOption("SZX");
  if (mode === "webgl") {
    const label = page
      .locator(".globe-airport-label")
      .filter({ hasText: /^SZX$/ });
    // Labels are DOM buttons, using the renderer's actual projected geometry.
    await expect(label).toBeVisible();
    await label.click();
    await expect(page.locator(".flight-row.is-selected")).toBeFocused();
    await page.locator(".globe-webgl").focus();
    const before = await page
      .locator(".globe-host")
      .getAttribute("data-camera");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".globe-host")).not.toHaveAttribute(
      "data-camera",
      before!,
    );
    await page.keyboard.press("Home");
    await expect.poll(async () => (await scene(page)).atHome).toBe(true);
  }
  await route.selectOption("");
  await page.getByRole("button", { name: "2024", exact: true }).click();
  await expect(page.locator(".flight-row")).toHaveCount(1);
  await expect(route.locator('option[value="SZX-TAO"]')).toHaveText(
    "SZX → TAO · 1",
  );
  if (mode === "webgl") {
    await expect(page.locator(".globe-host")).toHaveAttribute(
      "data-ready",
      "true",
    );
    expect(
      (await scene(page)).routes.map((r: { key: string }) => r.key),
    ).toEqual(["SZX-TAO"]);
    expect(await canvas!.evaluate((el) => el.isConnected)).toBe(false);
  }
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.locator("#passport-flight-search").fill("ZH998");
  await expect(page.locator(".flight-row")).toHaveCount(1);
  await expect(route.locator('option[value="SZX-TAO"]')).toHaveText(
    "SZX → TAO · 1",
  );
  await page.locator("#passport-flight-search").fill("no matching flight");
  await expect(page.locator(".flight-row")).toHaveCount(0);
  await expect(route.locator("option")).toHaveCount(1);
  await expect(page.locator(".passport-core-stat")).toHaveCount(6);
  await expect(page.locator(".passport-highlights")).toBeVisible();
});

for (const failure of ["webgl", "texture", "context"] as const) {
  test(`formal Passport ${failure} failure has interactive SVG and retry @cross-browser`, async ({
    page,
  }) => {
    if (failure === "webgl") await disablePassportWebGL(page);
    if (failure === "texture")
      await page.route("**/earth-4096*.webp", (route) => route.abort());
    await importFlights(page);
    if (failure === "context") {
      if ((await globeMode(page)) === "svg") return;
      await page.locator(".globe-webgl").evaluate((canvas) => {
        (canvas as HTMLCanvasElement)
          .getContext("webgl2")!
          .getExtension("WEBGL_lose_context")!
          .loseContext();
      });
    }
    await expect(page.locator(".globe-fallback svg[role=group]")).toBeVisible();
    await expect(page.locator(".globe-webgl")).toHaveCount(0);
    const target = page
      .locator(".map-route")
      .filter({ hasText: "SZX to TAO" })
      .first();
    await target.focus();
    await page.keyboard.press("Enter");
    await expect(target).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".flight-row.is-selected")).toBeFocused();
    await expect(page.locator(".flight-row")).toHaveCount(3);
    await expect(page.locator(".map-route.is-highlighted")).toHaveCount(1);
    if (failure !== "webgl") {
      await page.unroute("**/earth-4096*.webp");
      await page
        .getByRole("button", { name: "Try again", exact: true })
        .click();
      await globeMode(page);
    } else {
      await page
        .getByRole("button", { name: "Try again", exact: true })
        .click();
      await expect(page.locator(".globe-stage")).toHaveAttribute(
        "data-attempt",
        "1",
      );
      await expect(target).toHaveAttribute("aria-pressed", "true");
    }
  });
}

test("formal Globe releases GPU resources and RAF on data replacement, page leave and Mobile transition", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = { textures: 0, buffers: 0, programs: 0 };
    (window as unknown as { gpuDeletes: typeof state }).gpuDeletes = state;
    for (const [method, counter] of [
      ["deleteTexture", "textures"],
      ["deleteBuffer", "buffers"],
      ["deleteProgram", "programs"],
    ] as const) {
      const original = WebGL2RenderingContext.prototype[method];
      WebGL2RenderingContext.prototype[method] = function (resource: never) {
        if (resource) state[counter]++;
        return original.call(this, resource);
      };
    }
  });
  await importFlights(page);
  if ((await globeMode(page)) === "svg") return;
  const host = await page.locator(".globe-host").elementHandle();
  await host!.evaluate((el) => {
    (window as unknown as { retiredMetrics: unknown }).retiredMetrics = (
      el as HTMLElement & { globeMetrics: unknown }
    ).globeMetrics;
  });
  await page.getByRole("button", { name: "2025", exact: true }).click();
  await expect(page.locator(".globe-host")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const deleted = await page.evaluate(
    () =>
      (
        window as unknown as {
          gpuDeletes: { textures: number; buffers: number; programs: number };
        }
      ).gpuDeletes,
  );
  expect(deleted.textures).toBeGreaterThanOrEqual(2);
  expect(deleted.buffers).toBeGreaterThan(0);
  expect(deleted.programs).toBeGreaterThan(0);
  const frames = await page.evaluate(
    () =>
      (window as unknown as { retiredMetrics: { frames: number } })
        .retiredMetrics.frames,
  );
  await page.waitForTimeout(150);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { retiredMetrics: { frames: number } })
          .retiredMetrics.frames,
    ),
  ).toBe(frames);
  const canvas = await page.locator(".globe-webgl").elementHandle();
  await page.locator('.site-navigation a[href="#settings"]').click();
  await expect(page.locator(".globe-webgl")).toHaveCount(0);
  expect(await canvas!.evaluate((el) => el.isConnected)).toBe(false);
  await page
    .getByRole("combobox", { name: "Solar illumination", exact: true })
    .selectOption("realtime");
  await page.locator('.site-navigation a[href="#passport"]').click();
  await expect(page.locator(".globe-stage")).toHaveAttribute(
    "data-solar-mode",
    "realtime",
  );
  await page.reload();
  await expect(page.locator(".globe-stage")).toHaveAttribute(
    "data-solar-mode",
    "realtime",
  );
  await page.setViewportSize({ width: 760, height: 900 });
  await expect(page.locator(".passport-globe-frame")).toHaveCount(0);
  await expect(page.locator(".passport-mobile-summary")).toBeVisible();
  await expect(page.locator(".passport-highlights")).toHaveCount(0);
});

test("formal Globe pointer route picking and both themes remain accessible @cross-browser", async ({
  page,
}) => {
  await importFlights(page);
  if ((await globeMode(page)) === "svg") return;
  await picker(page);
  await page
    .getByRole("combobox", { name: "Select an airport", exact: true })
    .selectOption("BOM");
  await expect(
    page
      .locator(".globe-airport-label.is-selected")
      .filter({ hasText: /^BOM$/ }),
  ).toBeVisible();
  const view = await scene(page);
  const target = view.routes.find((r: { key: string }) => r.key === "BOM-HKG");
  const midpoint = routeArc(target)[48]!;
  const cam = view.camera as Vec3;
  const forward = scale(normalize(cam), -1),
    right = normalize(cross(forward, [0, 1, 0])),
    up = cross(right, forward);
  const delta = add(midpoint, scale(cam, -1));
  const box = (await page.locator(".globe-webgl").boundingBox())!;
  const tangent = Math.tan((17 * Math.PI) / 180),
    depth = dot(delta, forward);
  await page.mouse.click(
    box.x +
      box.width / 2 +
      ((dot(delta, right) / depth / tangent) * box.height) / 2,
    box.y +
      box.height / 2 -
      ((dot(delta, up) / depth / tangent) * box.height) / 2,
  );
  await expect(
    page.getByRole("combobox", { name: "Select a route", exact: true }),
  ).toHaveValue("BOM-HKG");
  await expect(page.locator(".flight-row")).toHaveCount(1);
  await expect(page.locator(".flight-row.is-selected")).toBeFocused();
  await page.locator(".passport-globe-navigation summary").click();
  for (const theme of ["dark", "light"]) {
    await page.locator('.site-navigation a[href="#settings"]').click();
    await page
      .getByRole("combobox", { name: "Appearance", exact: true })
      .selectOption(theme);
    await page.locator('.site-navigation a[href="#passport"]').click();
    await expect(page.locator(".globe-host")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await expect(page.locator(".globe-stage")).toHaveAttribute(
      "data-theme",
      theme,
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});
