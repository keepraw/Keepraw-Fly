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
  spherePoint,
  visibleFrom,
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

// Real Three.js Passport globe at laptop, 1080p, 1440p and 4K CSS viewports:
// rendering, resize recomposition, labels, controls and interaction. The SVG-fallback layout contract lives in
// passport-desktop-design.pw.ts; this test never accepts the fallback.
const compositionViewports = [
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 3840, height: 2160 },
];

async function settleViewport(
  page: Page,
  viewport: { width: number; height: number },
) {
  await page.setViewportSize(viewport);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<string>((resolve) =>
            requestAnimationFrame(() =>
              requestAnimationFrame(() =>
                resolve(`${innerWidth}x${innerHeight}`),
              ),
            ),
          ),
      ),
    )
    .toBe(`${viewport.width}x${viewport.height}`);
}

async function globeComposition(page: Page) {
  // The renderer must re-measure its host after every container change;
  // a scene viewport that differs from the host is a stale composition.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const host = document.querySelector<HTMLElement>(".globe-host")!;
          const box = host.getBoundingClientRect();
          const view = JSON.parse(host.dataset.scene!).viewport;
          return (
            host.dataset.ready === "true" &&
            Math.abs(view.width - box.width) <= 1 &&
            Math.abs(view.height - box.height) <= 1
          );
        }),
      { timeout: 15_000 },
    )
    .toBe(true);
  return page.evaluate(() => {
    const host = document.querySelector<HTMLElement>(".globe-host")!;
    const canvas = document.querySelector<HTMLCanvasElement>(".globe-webgl")!;
    const frame = document
      .querySelector(".passport-globe-frame")!
      .getBoundingClientRect();
    const view = JSON.parse(host.dataset.scene!);
    // Apparent globe diameter from the live camera (unit-radius sphere).
    const distance = Math.hypot(...(view.camera as number[]));
    const diameter =
      (Math.tan(Math.asin(1 / distance)) /
        Math.tan((view.fov * Math.PI) / 360)) *
      view.viewport.height;
    // Disc centre after the camera's fractional view offset.
    const centerX = (0.5 - (view.viewOffset?.x ?? 0)) * view.viewport.width;
    const inFrame = (box: DOMRect) =>
      box.left >= frame.left - 1 &&
      box.right <= frame.right + 1 &&
      box.top >= frame.top - 1 &&
      box.bottom <= frame.bottom + 1;
    const labels = [
      ...document.querySelectorAll<HTMLElement>(".globe-airport-label"),
    ].filter((label) => {
      const style = getComputedStyle(label);
      return (
        label.getClientRects().length > 0 &&
        style.visibility !== "hidden" &&
        Number(style.opacity) > 0
      );
    });
    const bottom = (selector: string) =>
      document.querySelector(selector)!.getBoundingClientRect().bottom;
    return {
      frameWidth: frame.width,
      frameHeight: frame.height,
      diameter,
      discLeft: centerX - diameter / 2,
      discRight: centerX + diameter / 2,
      canvasWidth: view.viewport.width,
      canvasPixels: canvas.width * canvas.height,
      webglCanvases: document.querySelectorAll(".globe-webgl").length,
      labels: labels.length,
      labelsInFrame: labels.every((label) =>
        inFrame(label.getBoundingClientRect()),
      ),
      minLabelFont: Math.min(
        ...labels.map((label) => parseFloat(getComputedStyle(label).fontSize)),
      ),
      controls: [
        ...document.querySelectorAll(
          ".passport-globe-frame .globe-controls button",
        ),
      ].map((button) => inFrame(button.getBoundingClientRect())),
      statsBottom: bottom(".passport-core-stats"),
      highlightsBottom: bottom(".passport-highlights"),
      overflowX: document.documentElement.scrollWidth > innerWidth,
    };
  });
}

test("formal Passport globe keeps a real, usable composition from laptop to 4K", async ({
  page,
  browserName,
}) => {
  // Software WebGL at 4K is only practical on the Chromium project.
  test.skip(
    browserName !== "chromium",
    "Real-WebGL 4K matrix runs on Chromium",
  );
  test.setTimeout(150_000);
  await importFlights(page);
  const mode = await globeMode(page);
  test.skip(
    mode !== "webgl",
    "WebGL2 is unavailable here; the SVG fallback is not evidence of real-globe composition",
  );

  for (const viewport of compositionViewports) {
    await test.step(`${viewport.width}x${viewport.height}`, async () => {
      await settleViewport(page, viewport);
      const view = await globeComposition(page);
      expect(view.webglCanvases).toBe(1);
      expect(view.canvasPixels).toBeGreaterThan(0);
      expect(view.overflowX).toBe(false);
      // Passport home framing keeps the whole globe disc inside the map
      // width (no left/right crop) at every desktop size.
      expect(view.discLeft).toBeGreaterThanOrEqual(-1);
      expect(view.discRight).toBeLessThanOrEqual(view.canvasWidth + 1);
      expect(view.labels).toBeGreaterThanOrEqual(3);
      expect(view.labelsInFrame).toBe(true);
      expect(view.minLabelFont).toBeGreaterThanOrEqual(11);
      expect(view.controls).toEqual([true, true, true]);
      expect(view.statsBottom).toBeLessThanOrEqual(viewport.height);
      expect(view.highlightsBottom).toBeLessThanOrEqual(viewport.height);
    });
  }

  await test.step("4K zoom, keyboard, Home and route selection", async () => {
    await settleViewport(page, { width: 3840, height: 2160 });
    await globeComposition(page);
    const host = page.locator(".globe-host");
    const before = await host.getAttribute("data-camera");
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await expect(host).not.toHaveAttribute("data-camera", before!);
    await page.locator(".globe-webgl").focus();
    const zoomed = await host.getAttribute("data-camera");
    await page.keyboard.press("ArrowRight");
    await expect(host).not.toHaveAttribute("data-camera", zoomed!);
    await page.keyboard.press("Home");
    await expect.poll(async () => (await scene(page)).atHome).toBe(true);
    await page.getByRole("button", { name: "Zoom out", exact: true }).click();
    await page
      .getByRole("button", { name: "Fit recorded routes", exact: true })
      .click();
    await expect.poll(async () => (await scene(page)).atHome).toBe(true);
    const route = await picker(page);
    await route.selectOption("SZX-TAO");
    await expect(page.locator(".flight-row")).toHaveCount(3);
    await expect(
      page.locator('.flight-record[data-flight-id="typography-1"] .flight-row'),
    ).toHaveAttribute("aria-current", "true");
    await route.selectOption("");
    await page.locator(".passport-globe-navigation summary").click();
  });

  await test.step("shrinking back to a laptop recomposes the same globe", async () => {
    const canvas = await page.locator(".globe-webgl").elementHandle();
    await settleViewport(page, { width: 1440, height: 900 });
    const view = await globeComposition(page);
    expect(await canvas!.evaluate((el) => el.isConnected)).toBe(true);
    expect(view.webglCanvases).toBe(1);
    expect(view.labelsInFrame).toBe(true);
    expect(view.controls).toEqual([true, true, true]);
  });
});

// Passport labels and markers grow with the layout scale (1x at 1920x1080,
// about 1.33x at 2560x1440, 2x at 3840x2160). Label avoidance, label offsets
// and pointer hit radii must follow, measured here from rendered DOM label
// boxes and real pointer events on the WebGL canvas (CSS pixels).
type SceneRoute = {
  key: string;
  origin: { iata: string; latitude: number; longitude: number };
  destination: { iata: string; latitude: number; longitude: number };
};

async function screenGeometry(page: Page) {
  const view = await scene(page);
  const box = (await page.locator(".globe-webgl").boundingBox())!;
  const cam = view.camera as Vec3;
  const forward = scale(normalize(cam), -1),
    right = normalize(cross(forward, [0, 1, 0])),
    up = cross(right, forward);
  const tangent = Math.tan(((view.fov as number) * Math.PI) / 360);
  const offset = view.viewOffset ?? { x: 0, y: 0 };
  // Same projection as the renderer, including the Passport view offset.
  const toScreen = (point: Vec3) => {
    const delta = add(point, scale(cam, -1)),
      depth = dot(delta, forward);
    return {
      x:
        box.x +
        box.width / 2 +
        ((dot(delta, right) / depth / tangent) * box.height) / 2 -
        offset.x * box.width,
      y:
        box.y +
        box.height / 2 -
        ((dot(delta, up) / depth / tangent) * box.height) / 2 -
        offset.y * box.height,
      visible: visibleFrom(point, cam),
    };
  };
  const inside = (p: { x: number; y: number }, margin: number) =>
    p.x > box.x + margin &&
    p.x < box.x + box.width - margin &&
    p.y > box.y + margin &&
    p.y < box.y + box.height - margin;
  const routes = (view.routes as SceneRoute[]).map((route) => ({
    route,
    samples: routeArc(route as never).map(toScreen),
  }));
  const airports = new Map<string, ReturnType<typeof toScreen>>();
  for (const { route } of routes)
    for (const point of [route.origin, route.destination])
      airports.set(point.iata, toScreen(spherePoint(point)));
  return {
    unit: view.layoutUnit as number,
    routes,
    airports,
    inside,
  };
}

async function visibleLabels(page: Page) {
  return page.evaluate(() => {
    const frame = document
      .querySelector(".passport-globe-frame")!
      .getBoundingClientRect();
    const labels = [
      ...document.querySelectorAll<HTMLElement>(".globe-airport-label"),
    ]
      .filter((label) => !label.hidden && label.getClientRects().length)
      .map((label) => ({
        code: label.textContent!.trim(),
        selected: label.classList.contains("is-selected"),
        box: label.getBoundingClientRect().toJSON() as DOMRect,
      }));
    const overlaps: string[] = [];
    for (let i = 0; i < labels.length; i++)
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i]!,
          b = labels[j]!;
        // A selected airport label is always shown; it may sit beside others.
        if (a.selected || b.selected) continue;
        const x =
            Math.min(a.box.right, b.box.right) -
            Math.max(a.box.left, b.box.left),
          y =
            Math.min(a.box.bottom, b.box.bottom) -
            Math.max(a.box.top, b.box.top);
        if (x > 0.5 && y > 0.5) overlaps.push(`${a.code}/${b.code}`);
      }
    return {
      codes: labels.map((label) => label.code).sort(),
      overlaps,
      outside: labels
        .filter(
          ({ box }) =>
            box.left < frame.left ||
            box.right > frame.right ||
            box.top < frame.top ||
            box.bottom > frame.bottom,
        )
        .map((label) => label.code),
    };
  });
}

function distanceToSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

/** A visible route point far from other routes and airports, with its
 * screen normal, so near/far pointer probes are unambiguous. */
function isolatedRoutePoint(
  geometry: Awaited<ReturnType<typeof screenGeometry>>,
) {
  // Wider than the 20-unit empty probe plus the 8-unit route hit band.
  const clearance = 30 * geometry.unit;
  for (const { route, samples } of geometry.routes)
    for (let i = 20; i < samples.length - 20; i += 4) {
      const p = samples[i]!,
        q = samples[i + 1]!;
      if (!p.visible || !q.visible || !geometry.inside(p, clearance)) continue;
      const length = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      const normal = { x: -(q.y - p.y) / length, y: (q.x - p.x) / length };
      // Both directions of a pair share one physical arc.
      const pair = (r: SceneRoute) =>
        [r.origin.iata, r.destination.iata].sort().join("-");
      const others = geometry.routes.filter(
        (other) => pair(other.route) !== pair(route),
      );
      const clear =
        others.every(({ samples: other }) =>
          other.every(
            (a, j) =>
              j === 0 ||
              !a.visible ||
              !other[j - 1]!.visible ||
              distanceToSegment(p, other[j - 1]!, a) > clearance,
          ),
        ) &&
        [...geometry.airports.values()].every(
          (a) => !a.visible || Math.hypot(a.x - p.x, a.y - p.y) > clearance,
        );
      if (clear) return { key: route.key, point: p, normal };
    }
  return null;
}

async function cameraSettled(page: Page) {
  const host = page.locator(".globe-host");
  let last = "";
  await expect
    .poll(
      async () => {
        const now = (await host.getAttribute("data-camera"))!;
        const still = now === last;
        last = now;
        return still;
      },
      { intervals: [250] },
    )
    .toBe(true);
}

async function expectScaledInteraction(page: Page, label: string) {
  await test.step(label, async () => {
    await cameraSettled(page);
    const geometry = await screenGeometry(page);
    const labels = await visibleLabels(page);
    expect(labels.overlaps).toEqual([]);
    expect(labels.outside).toEqual([]);

    // The route picker <details> may still be open from an earlier probe.
    const navigation = page.locator(".passport-globe-navigation");
    if (!(await navigation.evaluate((el) => (el as HTMLDetailsElement).open)))
      await navigation.locator("summary").click();
    const route = page.getByRole("combobox", {
      name: "Select a route",
      exact: true,
    });
    await route.selectOption("");
    const target = isolatedRoutePoint(geometry);
    expect(target, "an isolated visible route segment").not.toBeNull();
    const { point, normal, key } = target!;
    // Empty map near a route (well outside its scaled hit band) selects nothing.
    await page.mouse.click(
      point.x + normal.x * 20 * geometry.unit,
      point.y + normal.y * 20 * geometry.unit,
    );
    await expect(route).toHaveValue("");
    // Just beside the visible line, in layout units, selects that route.
    await page.mouse.click(
      point.x + normal.x * 5 * geometry.unit,
      point.y + normal.y * 5 * geometry.unit,
    );
    await expect(route).toHaveValue(key);
    await route.selectOption("");

    // Selecting a route flies the camera; re-measure once it settles.
    await cameraSettled(page);
    const current = await screenGeometry(page);
    const { codes } = await visibleLabels(page);
    // A visible airport marker, probed beside its centre in layout units.
    const code = codes.find((code) => {
      const p = current.airports.get(code);
      return p?.visible && current.inside(p, 30 * current.unit);
    })!;
    const marker = current.airports.get(code)!;
    await page.mouse.click(marker.x, marker.y + 8 * geometry.unit);
    await expect(page.locator(".globe-airport-label.is-selected")).toHaveText([
      code,
    ]);
    await route.selectOption("");
    await expect(page.locator(".globe-airport-label.is-selected")).toHaveCount(
      0,
    );
  });
}

test("formal Passport labels and pointer hits follow the layout scale", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Real-WebGL 4K matrix runs on Chromium",
  );
  test.setTimeout(180_000);
  await importFlights(page);
  test.skip(
    (await globeMode(page)) !== "webgl",
    "WebGL2 is unavailable here; the SVG fallback is not evidence of real-globe interaction",
  );
  let referenceLabels: string[] = [];
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
    { width: 3840, height: 2160 },
  ]) {
    await settleViewport(page, viewport);
    await globeComposition(page);
    // Earlier probes selected routes and moved the camera; return Home.
    await page.locator(".globe-webgl").focus();
    await page.keyboard.press("Home");
    await expect.poll(async () => (await scene(page)).atHome).toBe(true);
    await cameraSettled(page);
    const view = await scene(page);
    // The renderer reads the same layout unit the Passport CSS uses.
    const unit = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.width = "calc(1000 * var(--passport-px, 1px))";
      document.querySelector(".globe-host")!.append(probe);
      const width = probe.offsetWidth / 1000;
      probe.remove();
      return width;
    });
    expect(view.layoutUnit).toBe(unit);
    // The scaled composition shows the same avoided label set as 1080p.
    const { codes } = await visibleLabels(page);
    if (viewport.width === 1920) referenceLabels = codes;
    else expect(codes).toEqual(referenceLabels);
    await expectScaledInteraction(page, `${viewport.width}x${viewport.height}`);
  }

  // 4K after zoom out, rotation, Home and Fit.
  const host = page.locator(".globe-host");
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await expect.poll(async () => (await scene(page)).atHome).toBe(false);
  await expectScaledInteraction(page, "4K zoomed out");
  await page.locator(".globe-webgl").focus();
  const before = await host.getAttribute("data-camera");
  await page.keyboard.press("ArrowLeft");
  await expect(host).not.toHaveAttribute("data-camera", before!);
  await expectScaledInteraction(page, "4K rotated");
  await page.locator(".globe-webgl").focus();
  await page.keyboard.press("Home");
  await expect.poll(async () => (await scene(page)).atHome).toBe(true);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page
    .getByRole("button", { name: "Fit recorded routes", exact: true })
    .click();
  await expect.poll(async () => (await scene(page)).atHome).toBe(true);
  await expectScaledInteraction(page, "4K after Home and Fit");

  // Shrinking back restores the reference unit and the same behaviour.
  await settleViewport(page, { width: 1920, height: 1080 });
  await globeComposition(page);
  await page.locator(".globe-webgl").focus();
  await page.keyboard.press("Home");
  await expect.poll(async () => (await scene(page)).atHome).toBe(true);
  await cameraSettled(page);
  expect((await scene(page)).layoutUnit).toBe(1);
  expect((await visibleLabels(page)).codes).toEqual(referenceLabels);
  await expectScaledInteraction(page, "back to 1920x1080");
});
