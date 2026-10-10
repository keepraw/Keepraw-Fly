import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { globeMode, exerciseSvgFallback } from "./helpers/globe-capability";
import type { GlobeMetrics } from "../apps/web/src/globe/globe-renderer";
import {
  add,
  cross,
  dot,
  normalize,
  selectedRouteView,
  routeArc,
  scale,
  type Vec3,
} from "../apps/web/src/globe/globe-math";

const destination = "artifacts/globe-lab";
async function ready(page: Page) {
  await expect(page.locator(".globe-host")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 25000 },
  );
}
async function metrics(page: Page) {
  return page
    .locator(".globe-host")
    .evaluate(
      (el) => (el as HTMLElement & { globeMetrics: unknown }).globeMetrics,
    );
}
async function camera(page: Page) {
  return page.locator(".globe-host").getAttribute("data-camera");
}
async function settledCamera(page: Page) {
  await expect
    .poll(async () => {
      const motion = ((await metrics(page)) as GlobeMetrics).motion;
      const position = JSON.parse((await camera(page)) || "null") as
        number[] | null;
      return Boolean(
        motion &&
        position &&
        motion.state !== "running" &&
        motion.target.every((n, i) => Math.abs(n - position[i]!) < 1e-8),
      );
    })
    .toBe(true);
}

test("globe actual browser screenshots, viewports, selection and resource measurements @cross-browser", async ({
  page,
  browserName,
}) => {
  test.setTimeout(120000);
  await mkdir(destination, { recursive: true });
  const external: string[] = [],
    errors: string[] = [];
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1:5173") &&
      !r.url().startsWith("data:")
    )
      external.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/globe-lab");
  if ((await globeMode(page)) === "svg") {
    for (const theme of ["Light", "Dark"]) {
      await page.getByRole("button", { name: theme, exact: true }).click();
      for (const viewport of [
        { width: 1440, height: 900 },
        { width: 844, height: 390 },
      ]) {
        await page.setViewportSize(viewport);
        await expect(
          page.locator(".globe-fallback svg[role=group]"),
        ).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await exerciseSvgFallback(page);
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
    return;
  }
  const readings: unknown[] = [];
  for (const theme of ["dark", "light"]) {
    await page
      .getByRole("button", {
        name: theme === "dark" ? "Dark" : "Light",
        exact: true,
      })
      .click();
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1280, height: 720 },
      { width: 1024, height: 768 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(160);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `${destination}/${browserName}-${theme}-${viewport.width}x${viewport.height}.png`,
      });
      if (viewport.width === 1440)
        await page.locator(".globe-stage").screenshot({
          path: `${destination}/${browserName}-${theme}-map.png`,
        });
      readings.push({
        theme,
        viewport,
        metrics: await metrics(page),
        camera: await camera(page),
      });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  const before = await camera(page);
  // The demo's European route is on the far side of its Pacific-facing overview.
  const values = await page
    .getByRole("combobox", { name: "Route", exact: true })
    .locator("option")
    .evaluateAll((options) =>
      options.map((o) => (o as HTMLOptionElement).value),
    );
  const backside =
    values.find((v) => v === "LHR-FRA") ??
    values.find((v) => v.includes("LHR") || v.includes("CDG"))!;
  expect(backside).toBeTruthy();
  await page
    .getByRole("combobox", { name: "Route", exact: true })
    .selectOption(backside);
  await expect.poll(() => camera(page)).not.toBe(before);
  await page.waitForTimeout(150);
  await page.screenshot({
    path: `${destination}/${browserName}-dark-selected-backside.png`,
  });
  await page.locator(".globe-stage").screenshot({
    path: `${destination}/${browserName}-dark-selected-backside-map.png`,
  });
  await page
    .getByRole("combobox", { name: "Airport", exact: true })
    .selectOption("SFO");
  await expect(
    page.locator(".globe-airport-label.is-selected:visible"),
  ).toHaveText("SFO");
  await page.locator(".globe-webgl").focus();
  const prior = await camera(page);
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => camera(page)).not.toBe(prior);
  const manual = await camera(page);
  await page.locator(".flight-row").first().hover();
  await page.waitForTimeout(180);
  expect(await camera(page)).toBe(manual);
  // Demand rendering should stop completely once interactions end.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(100);
  const idleA = (await metrics(page)) as { frames: number };
  await page.waitForTimeout(300);
  const idleB = (await metrics(page)) as { frames: number };
  expect(idleB.frames).toBe(idleA.frames);
  await page.getByRole("button", { name: "Fit recorded routes" }).click();
  await page
    .getByRole("combobox", { name: "Texture", exact: true })
    .selectOption("2048");
  await ready(page);
  readings.push({ quality: "2048", metrics: await metrics(page) });
  await page
    .getByRole("combobox", { name: "Texture", exact: true })
    .selectOption("4096");
  await ready(page);
  const canvas = page.locator(".globe-webgl"),
    box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.55);
  await page.mouse.down();
  const interactionStart = Date.now();
  const interactionFrameStart = ((await metrics(page)) as { frames: number })
    .frames;
  for (let i = 1; i <= 40; i++)
    await page.mouse.move(
      box.x + box.width * 0.6 - i * 8,
      box.y + box.height * 0.55 + Math.sin(i / 8) * 45,
    );
  await page.mouse.up();
  await page.waitForTimeout(150);
  readings.push({
    interactionWallMs: Date.now() - interactionStart,
    interactionFrames:
      ((await metrics(page)) as { frames: number }).frames -
      interactionFrameStart,
    metrics: await metrics(page),
  });
  await page.screenshot({
    path: `${destination}/${browserName}-dark-manual-rotation.png`,
  });
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
  await writeFile(
    `${destination}/${browserName}-measurements.json`,
    JSON.stringify({ readings, external, errors, backside }, null, 2),
  );
});

test("globe local SVG fallback on texture failure and context loss @cross-browser", async ({
  page,
}) => {
  await page.goto("/globe-lab");
  if ((await globeMode(page)) === "svg") {
    await exerciseSvgFallback(page);
    return;
  }
  await page.route("**/earth-4096.webp", (route) => route.abort());
  await page.reload();
  await expect(page.locator(".globe-fallback")).toBeVisible();
  await expect
    .poll(
      async () =>
        JSON.parse(
          (await page.locator(".globe-stage").getAttribute("data-error")) ||
            "null",
        )?.kind,
    )
    .toBe("texture");
  await expect(page.locator(".route-map-canvas > svg")).toBeVisible();
  await page.unroute("**/earth-4096.webp");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await ready(page);
  await page
    .locator(".globe-webgl")
    .evaluate((canvas) =>
      canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true })),
    );
  await expect(page.locator(".globe-fallback")).toBeVisible();
  await expect
    .poll(
      async () =>
        JSON.parse(
          (await page.locator(".globe-stage").getAttribute("data-error")) ||
            "null",
        )?.kind,
    )
    .toBe("context");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await ready(page);
});

test("globe filtering, real archive loading and formal Passport isolation @cross-browser", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await expect(page.locator(".route-map-canvas > svg")).toBeVisible();
  await page.goto("/globe-lab");
  const mode = await globeMode(page);
  const expectMap = async () => {
    if (mode === "webgl") await ready(page);
    else
      await expect(
        page.locator(".globe-fallback svg[role=group]"),
      ).toBeVisible();
  };
  await expect(page.locator(".flight-row")).toHaveCount(24);
  await page.getByRole("button", { name: "2026", exact: true }).click();
  await expectMap();
  await expect(page.locator(".flight-row")).toHaveCount(10);
  await page
    .getByRole("textbox", { name: "Search flights, airports, airlines…" })
    .fill("UA123");
  await expectMap();
  await expect(page.locator(".flight-row")).toHaveCount(1);
  await page.locator(".flight-row").click();
  await expect(
    page.getByRole("combobox", { name: "Route", exact: true }),
  ).toHaveValue("SFO-LAX");
  await page.goto("/#passport");
  await expect(page.locator(".route-map-canvas > svg")).toBeVisible();
  await expect(page.locator(".globe-webgl")).toHaveCount(0);
});

test("globe gracefully handles disabled WebGL @cross-browser", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const reviewWindow = window as unknown as { allowGlobeWebGL: boolean };
    reviewWindow.allowGlobeWebGL = false;
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      ...args: Parameters<typeof original>
    ) {
      if (!reviewWindow.allowGlobeWebGL && String(args[0]).startsWith("webgl"))
        return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto("/globe-lab");
  await expect(page.locator(".globe-fallback")).toBeVisible();
  await expect(page.locator(".route-map-canvas > svg")).toBeVisible();
  expect(await globeMode(page)).toBe("svg");
  await exerciseSvgFallback(page);
  await page.evaluate(() => {
    (window as unknown as { allowGlobeWebGL: boolean }).allowGlobeWebGL = true;
  });
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  if ((await globeMode(page)) === "webgl") {
    await expect(
      page.locator(".globe-airport-label.is-selected:visible"),
    ).toHaveText("LAX");
  }
  await expect(
    page.getByRole("combobox", { name: "Airport", exact: true }),
  ).toHaveValue("LAX");
});

test("globe direct route and airport picking, motion and accessibility @cross-browser", async ({
  page,
  browserName,
}) => {
  test.setTimeout(45000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/globe-lab");
  if ((await globeMode(page)) === "svg") {
    await exerciseSvgFallback(page);
    for (const theme of ["Light", "Dark"]) {
      await page.getByRole("button", { name: theme, exact: true }).click();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
    return;
  }
  await page
    .getByRole("combobox", { name: "Airport", exact: true })
    .selectOption("SFO");
  const scene = JSON.parse(
    (await page.locator(".globe-host").getAttribute("data-scene"))!,
  ) as {
    routes: {
      origin: { iata: string; latitude: number; longitude: number };
      destination: { iata: string; latitude: number; longitude: number };
    }[];
  };
  const point = (code: string) => {
    return scene.routes
      .flatMap((route) => [route.origin, route.destination])
      .find((point) => point.iata === code)!;
  };
  const midpoint = routeArc({
    origin: point("SFO"),
    destination: point("LAX"),
    flightCount: 1,
  })[48]!;
  await settledCamera(page);
  const cam = JSON.parse((await camera(page))!) as Vec3;
  const forward = scale(normalize(cam), -1),
    right = normalize(cross(forward, [0, 1, 0])),
    up = cross(right, forward);
  const delta = add(midpoint, scale(cam, -1));
  const box = (await page.locator(".globe-webgl").boundingBox())!;
  const tangent = Math.tan((17 * Math.PI) / 180),
    depth = dot(delta, forward);
  const x =
    box.x +
    box.width / 2 +
    ((dot(delta, right) / depth / tangent) * box.height) / 2;
  const y =
    box.y +
    box.height / 2 -
    ((dot(delta, up) / depth / tangent) * box.height) / 2;
  // Click the real projected arc, not an implementation-only hit target.
  await page.mouse.click(x, y);
  await expect(
    page.getByRole("combobox", { name: "Route", exact: true }),
  ).toHaveValue("SFO-LAX");
  await page.getByRole("button", { name: /^LAX ·/ }).click();
  await expect(
    page.getByRole("combobox", { name: "Airport", exact: true }),
  ).toHaveValue("LAX");
  const before = await camera(page);
  await page.locator(".globe-webgl").focus();
  await page.keyboard.press("+");
  await expect.poll(() => camera(page)).not.toBe(before);
  await page.keyboard.press("Home");
  await expect
    .poll(async () => ((await metrics(page)) as GlobeMetrics).motion?.state)
    .toBe("instant");
  await settledCamera(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const motionStart = await camera(page);
  await page
    .getByRole("combobox", { name: "Route", exact: true })
    .selectOption("LHR-FRA");
  await expect
    .poll(async () => ((await metrics(page)) as GlobeMetrics).motion?.state)
    .toBe("completed");
  const end = await camera(page);
  const motion = ((await metrics(page)) as GlobeMetrics).motion!;
  await test.info().attach("Completed camera motion", {
    body: JSON.stringify(motion, null, 2),
    contentType: "application/json",
  });
  const targetView = selectedRouteView(
    { origin: point("LHR"), destination: point("FRA"), flightCount: 1 },
    box,
  );
  expect(motion.from).toEqual(JSON.parse(motionStart!));
  expect(motion.duration).toBe(650);
  expect(motion.elapsed).toBeGreaterThanOrEqual(motion.duration);
  expect(motion.progress.length).toBeGreaterThan(0);
  expect(motion.progress.at(-1)).toBe(1);
  expect(
    motion.progress.every(
      (p, i) => p >= 0 && p <= 1 && (i === 0 || p >= motion.progress[i - 1]!),
    ),
  ).toBe(true);
  expect(end).not.toBe(motionStart);
  const finalCamera = JSON.parse(end!) as number[];
  finalCamera.forEach((n, i) =>
    expect(n).toBeCloseTo(targetView.direction[i]! * targetView.distance, 8),
  );
  const axeResults = [];
  for (const theme of ["Light", "Dark"]) {
    await page.getByRole("button", { name: theme, exact: true }).click();
    const results = await new AxeBuilder({ page }).analyze();
    axeResults.push({ theme, violations: results.violations });
    expect(results.violations).toEqual([]);
  }
  await writeFile(
    `${destination}/${browserName}-accessibility.json`,
    JSON.stringify(axeResults, null, 2),
  );
  const cadence = await page
    .locator(".globe-webgl")
    .evaluate(async (canvas) => {
      const timestamps: number[] = [];
      let raf = 0;
      const startedAt = performance.now();
      await new Promise<void>((resolve) => {
        // Cadence is diagnostic, not a hardware speed requirement. Stop by wall
        // time even if RAF is throttled; never wait for 121 expensive GPU frames.
        const finish = () => {
          cancelAnimationFrame(raf);
          clearTimeout(deadline);
          resolve();
        };
        const deadline = setTimeout(finish, 2000);
        const step = (now: number) => {
          timestamps.push(now);
          canvas.dispatchEvent(
            new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
          );
          if (timestamps.length < 121 && performance.now() - startedAt < 2000)
            raf = requestAnimationFrame(step);
          else finish();
        };
        raf = requestAnimationFrame(step);
      });
      const intervals = timestamps
        .slice(1)
        .map((n, i) => n - timestamps[i]!)
        .sort((a, b) => a - b);
      return {
        wallMs: performance.now() - startedAt,
        durationMs:
          timestamps.length > 1 ? timestamps.at(-1)! - timestamps[0]! : 0,
        frames: Math.max(0, timestamps.length - 1),
        medianIntervalMs: intervals[Math.floor(intervals.length * 0.5)],
        p95IntervalMs: intervals[Math.floor(intervals.length * 0.95)],
      };
    });
  await writeFile(
    `${destination}/${browserName}-rotation-cadence.json`,
    JSON.stringify(cadence, null, 2),
  );
  expect(cadence.frames).toBeGreaterThan(0);
  await expect.poll(() => camera(page)).not.toBe(end);
});
