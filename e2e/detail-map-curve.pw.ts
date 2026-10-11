import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import { importArchive } from "./helpers/responsive";
import {
  normalize,
  projectGlobePoint,
  routeArc,
  type GlobeView,
} from "../apps/web/src/globe/globe-math";
import {
  FIXED_SUN_DIRECTION,
  solarDirectionFromUtc,
} from "../apps/web/src/globe/globe-solar";

const flight: KeeprawFlight = {
  id: "detail",
  flightNumber: "UA123",
  serviceDate: "2026-09-22",
  airline: { iata: "UA" },
  origin: { iata: "SFO" },
  destination: { iata: "LAX" },
  scheduledDeparture: "2026-09-22T18:00:00-07:00",
  scheduledArrival: "2026-09-22T20:00:00-07:00",
};
const host = (page: Page) => page.locator(".detail-globe-frame .globe-host");
async function ready(page: Page) {
  // Genuine WebGL is required: unavailable hardware is a failure, never a
  // fallback pass or an environment-based skip, including on ARM.
  await expect(host(page)).toHaveAttribute("data-ready", "true", {
    timeout: 25000,
  });
  await expect(page.locator(".detail-globe-frame canvas")).toBeVisible();
  await expect(
    page.locator(
      ".detail-globe-frame svg, .detail-globe-frame .globe-fallback",
    ),
  ).toHaveCount(0);
}
async function open(page: Page, flights = [flight], desktop = true) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 760, height: 900 });
  await importArchive(page, flights);
  await page
    .locator(`.flight-record[data-flight-id="${flights[0]!.id}"] .flight-row`)
    .click();
  if (desktop) await page.setViewportSize({ width: 1440, height: 900 });
}
async function scene(page: Page) {
  return JSON.parse((await host(page).getAttribute("data-scene"))!);
}
async function expectFramed(page: Page, key: string) {
  const view = await scene(page);
  expect(view.physicalRoutes).toBe(1);
  expect(view.routes.map((r: { key: string }) => r.key)).toEqual([key]);
  const camera: GlobeView = {
    direction: normalize(view.camera),
    distance: Math.hypot(...view.camera),
    offset: view.viewOffset,
    fov: view.fov,
  };
  for (const p of routeArc(view.routes[0])) {
    const projection = projectGlobePoint(p, camera, view.viewport);
    expect(projection.visible).toBe(true);
    expect(projection.x).toBeGreaterThan(0.15);
    expect(projection.x).toBeLessThan(0.85);
    expect(projection.y).toBeGreaterThan(0.15);
    expect(projection.y).toBeLessThan(0.85);
  }
  expect(
    await page.locator("html").evaluate((e) => e.scrollWidth <= e.clientWidth),
  ).toBe(true);
}

test("single actual route, Home, resize, pointer, wheel and keyboard controls", async ({
  page,
}) => {
  await open(page);
  await ready(page);
  for (const width of [761, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(
        async () =>
          (await scene(page)).viewport.width -
          (await host(page).evaluate((e) => e.clientWidth)),
      )
      .toBe(0);
    await expectFramed(page, "SFO-LAX");
    await page.screenshot({
      path: `test-results/detail-globe-${width}.png`,
      fullPage: true,
    });
    await expect(page.locator(".globe-airport-label")).toHaveText([
      "LAX",
      "SFO",
    ]);
    const stage = (await host(page).boundingBox())!;
    for (const label of await page.locator(".globe-airport-label").all()) {
      await expect(label).toBeVisible();
      const bounds = (await label.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(stage.x);
      expect(bounds.y).toBeGreaterThanOrEqual(stage.y);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(
        stage.x + stage.width,
      );
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(
        stage.y + stage.height,
      );
    }
    const controls = page.locator(".globe-controls"),
      initial = (await scene(page)).camera;
    await controls
      .getByRole("button", { name: "Zoom in", exact: true })
      .click();
    await expect
      .poll(async () => JSON.stringify((await scene(page)).camera))
      .not.toBe(JSON.stringify(initial));
    await controls
      .getByRole("button", { name: "Zoom out", exact: true })
      .click();
    await expect
      .poll(async () => Math.hypot(...(await scene(page)).camera))
      .toBeCloseTo(Math.hypot(...initial), 6);
    await page.locator(".globe-webgl").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("+");
    await expect
      .poll(async () => Math.hypot(...(await scene(page)).camera))
      .toBeCloseTo(Math.hypot(...initial) / 1.15, 6);
    const operated = (await scene(page)).camera;
    await page.setViewportSize({ width: width + 12, height: 880 });
    await expect
      .poll(
        async () =>
          (await scene(page)).viewport.width -
          (await host(page).evaluate((e) => e.clientWidth)),
      )
      .toBe(0);
    expect((await scene(page)).camera).toEqual(operated);
    await page.keyboard.press("Home");
    await expect.poll(async () => (await scene(page)).atHome).toBe(true);
  }
  const box = (await page.locator(".globe-webgl").boundingBox())!,
    before = (await scene(page)).camera;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 55,
    box.y + box.height / 2 + 20,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect
    .poll(async () => JSON.stringify((await scene(page)).camera))
    .not.toBe(JSON.stringify(before));
  await page.mouse.wheel(0, 100);
  await page.locator(".globe-controls button").last().click();
  await expect.poll(async () => (await scene(page)).atHome).toBe(true);
  const homeView = await scene(page);
  homeView.camera.forEach((n: number, i: number) =>
    expect(n).toBeCloseTo(
      homeView.home.direction[i] * homeView.home.distance,
      6,
    ),
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("flight switching reframes long, diverted and coincident routes; cancelled and unknown routes have no canvas", async ({
  page,
}) => {
  const flights = [
    flight,
    {
      ...flight,
      id: "long",
      origin: { iata: "HKG" },
      destination: { iata: "BOM" },
    },
    { ...flight, id: "diverted", divertedTo: { iata: "JFK" } },
    { ...flight, id: "same", destination: { iata: "SFO" } },
    { ...flight, id: "cancelled", cancelled: true },
    { ...flight, id: "unknown", origin: { iata: "ZZZ" } },
  ];
  flights.forEach((record, i) => {
    record.flightNumber = `UA${123 + i}`;
  });
  await open(page, flights);
  for (const record of flights) {
    if (record.id !== "detail") {
      await page.setViewportSize({ width: 760, height: 900 });
      await page.locator(".detail-header-back").click();
      await page
        .locator(`.flight-record[data-flight-id="${record.id}"] .flight-row`)
        .click();
      await page.setViewportSize({ width: 1440, height: 900 });
    }
    if (record.cancelled || record.origin.iata === "ZZZ") {
      await expect(page.locator(".detail-globe-message")).toContainText(
        record.cancelled ? "cancelled" : "unknown",
      );
      await expect(
        page.locator(".detail-globe-frame canvas, .detail-globe-frame svg"),
      ).toHaveCount(0);
    } else {
      await ready(page);
      await expectFramed(
        page,
        `${record.origin.iata}-${record.divertedTo?.iata ?? record.destination.iata}`,
      );
      if (record.divertedTo) {
        await expect(page.locator(".detail-heading h1")).toContainText(
          "Los Angeles",
        );
        await expect(page.locator(".detail-diversion-note")).toContainText(
          "JFK",
        );
      }
    }
  }
});

test("760px loads no Globe code, textures, canvas or WebGL; 761px mounts and releases on breakpoint changes", async ({
  page,
}) => {
  const resources: string[] = [];
  page.on("request", (r) => {
    if (
      /DetailGlobe|GlobeMap|globe-renderer|three(?:[./-])|earth-\d|night-\d/.test(
        r.url(),
      )
    )
      resources.push(r.url());
  });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    (window as any).detailContexts = 0;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type.startsWith("webgl")) (window as any).detailContexts++;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await open(page, [flight], false);
  await expect(page.locator("canvas, .detail-route-map")).toHaveCount(0);
  expect(resources).toEqual([]);
  expect(await page.evaluate(() => (window as any).detailContexts)).toBe(0);
  await page.setViewportSize({ width: 761, height: 900 });
  await ready(page);
  expect(resources.length).toBeGreaterThan(0);
  await page.evaluate(() => {
    (window as any).oldHost = document.querySelector(".globe-host");
  });
  await page.setViewportSize({ width: 760, height: 900 });
  await expect(page.locator("canvas, .detail-route-map")).toHaveCount(0);
  expect(
    await page.evaluate(() => (window as any).oldHost.dataset.ready),
  ).toBeUndefined();
  await page.setViewportSize({ width: 761, height: 900 });
  await ready(page);
  await expectFramed(page, "SFO-LAX");
});

for (const language of ["en", "zh-CN", "zh-TW"]) {
  test(`uses ${language}, Light/Dark/System and Fixed/Realtime preferences`, async ({
    page,
  }) => {
    await open(page, [flight], false);
    await page.goto("/#settings");
    for (const appearance of ["light", "dark", "system"])
      for (const solarMode of ["fixed", "realtime"]) {
        await page.emulateMedia({ colorScheme: "dark" });
        await page
          .locator(".settings-display-fields select")
          .nth(0)
          .selectOption(language);
        await page
          .locator(".settings-display-fields select")
          .nth(1)
          .selectOption(appearance);
        await page
          .locator(".settings-display-fields select")
          .nth(4)
          .selectOption(solarMode);
        await page.setViewportSize({ width: 760, height: 900 });
        await page.goto("/#passport");
        await page.locator(".flight-row").click();
        await page.setViewportSize({ width: 1024, height: 900 });
        await ready(page);
        await expect(page.locator(".globe-stage")).toHaveAttribute(
          "data-theme",
          appearance === "light" ? "light" : "dark",
        );
        await expect(page.locator(".globe-stage")).toHaveAttribute(
          "data-solar-mode",
          solarMode,
        );
        await expect(page.locator("canvas")).toHaveAttribute(
          "aria-label",
          language === "en"
            ? /Drag to rotate/
            : language === "zh-CN"
              ? /拖动旋转/
              : /拖曳旋轉/,
        );
        const lighting = JSON.parse(
          (await host(page).getAttribute("data-lighting"))!,
        );
        const expected =
          solarMode === "fixed"
            ? FIXED_SUN_DIRECTION
            : solarDirectionFromUtc(new Date());
        lighting.sunDirection.forEach((n: number, i: number) =>
          expect(n).toBeCloseTo(expected[i]!, 2),
        );
        if (appearance === "system") {
          const position = (await scene(page)).camera;
          await page.evaluate(() => {
            (window as any).savedCanvas = document.querySelector("canvas");
          });
          await page.emulateMedia({ colorScheme: "light" });
          await expect(page.locator(".globe-stage")).toHaveAttribute(
            "data-theme",
            "light",
          );
          expect((await scene(page)).camera).toEqual(position);
          expect(
            await page.evaluate(
              () =>
                (window as any).savedCanvas ===
                document.querySelector("canvas"),
            ),
          ).toBe(true);
        }
        await page.goto("/#settings");
      }
  });
}

for (const failure of [
  "unavailable",
  "initialization",
  "texture",
  "context",
] as const) {
  test(`${failure} failure has localized retry and recovers without SVG`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ failure }) => {
        (window as any).blockDetail = failure === "unavailable";
        (window as any).failObserver = failure === "initialization";
        const Observer = ResizeObserver;
        window.ResizeObserver = class extends Observer {
          observe(target: Element, options?: ResizeObserverOptions) {
            if (
              target.classList.contains("globe-host") &&
              (window as any).failObserver
            )
              throw new Error("Injected scene initialization failure");
            super.observe(target, options);
          }
        };
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...args) {
          if (
            type === "webgl2" &&
            this.dataset.globeView === "detail" &&
            (window as any).blockDetail
          )
            return null;
          return Reflect.apply(original, this, [type, ...args]);
        } as typeof original;
      },
      { failure },
    );
    if (failure === "texture")
      await page.route(/earth-4096.*webp/, (r) =>
        r.request().resourceType() === "image" ? r.abort() : r.continue(),
      );
    await open(page);
    if (failure === "context") {
      await ready(page);
      await page
        .locator("canvas")
        .evaluate((canvas: HTMLCanvasElement) =>
          canvas
            .getContext("webgl2")!
            .getExtension("WEBGL_lose_context")!
            .loseContext(),
        );
    }
    await expect(page.locator(".globe-stage")).toHaveAttribute(
      "data-error",
      new RegExp(failure === "unavailable" ? "webgl2-unavailable" : failure),
    );
    await expect(page.locator(".globe-fallback")).toContainText(
      failure === "texture"
        ? "imagery"
        : failure === "context"
          ? "lost"
          : failure === "initialization"
            ? "could not start"
            : "WebGL",
    );
    await expect(
      page.locator(".detail-globe-frame svg, .detail-globe-frame canvas"),
    ).toHaveCount(0);
    await page.evaluate(() => {
      (window as any).blockDetail = false;
      (window as any).failObserver = false;
    });
    await page.unrouteAll({ behavior: "wait" });
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await ready(page);
    await expect(page.locator(".globe-stage")).toHaveAttribute(
      "data-attempt",
      "1",
    );
    await expectFramed(page, "SFO-LAX");
  });
}

test("StrictMode, visibility and page navigation release contexts and observers and stop old RAFs", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const audit = ((window as any).globeAudit = {
      active: 0,
      created: 0,
      released: 0,
      observers: 0,
      deletedBuffers: 0,
      deletedTextures: 0,
      deletedPrograms: 0,
    });
    const original = HTMLCanvasElement.prototype.getContext,
      seen = new WeakSet();
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      const gl = Reflect.apply(original, this, [type, ...args]);
      if (
        type === "webgl2" &&
        gl &&
        this.dataset.globeView === "detail" &&
        !seen.has(gl)
      ) {
        seen.add(gl);
        audit.active++;
        audit.created++;
        for (const [method, counter] of [
          ["deleteBuffer", "deletedBuffers"],
          ["deleteTexture", "deletedTextures"],
          ["deleteProgram", "deletedPrograms"],
        ]) {
          const originalDelete = gl[method!].bind(gl);
          gl[method!] = (resource: unknown) => {
            if (resource) (audit as any)[counter!]++;
            originalDelete(resource);
          };
        }
        const get = gl.getExtension.bind(gl);
        let released = false;
        gl.getExtension = (name: string) => {
          const extension = get(name);
          if (name === "WEBGL_lose_context" && extension) {
            const lose = extension.loseContext.bind(extension);
            extension.loseContext = () => {
              if (!released) {
                audit.active--;
                audit.released++;
                released = true;
              }
              lose();
            };
          }
          return extension;
        };
      }
      return gl;
    } as typeof original;
    const Observer = ResizeObserver;
    window.ResizeObserver = class extends Observer {
      tracked = false;
      observe(target: Element, options?: ResizeObserverOptions) {
        if (target.classList.contains("globe-host") && !this.tracked) {
          audit.observers++;
          this.tracked = true;
        }
        super.observe(target, options);
      }
      disconnect() {
        if (this.tracked) {
          audit.observers--;
          this.tracked = false;
        }
        super.disconnect();
      }
    };
  });
  await open(page);
  await ready(page);
  expect(
    await page.evaluate(() => (window as any).globeAudit.created),
  ).toBeGreaterThanOrEqual(2);
  await page.evaluate(() => {
    (window as any).oldHost = document.querySelector(".globe-host");
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const frames = await host(page).evaluate((e: any) => e.globeMetrics.frames);
  await page.locator(".globe-controls button").first().click();
  await page.waitForTimeout(100);
  expect(await host(page).evaluate((e: any) => e.globeMetrics.frames)).toBe(
    frames,
  );
  await page.evaluate(() => {
    delete (document as any).hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(() => host(page).evaluate((e: any) => e.globeMetrics.frames))
    .toBeGreaterThan(frames);
  await page.goto("/#settings");
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => (window as any).globeAudit.active))
    .toBe(0);
  expect(await page.evaluate(() => (window as any).globeAudit.observers)).toBe(
    0,
  );
  const stopped = await page.evaluate(
    () => (window as any).oldHost.globeMetrics.frames,
  );
  await page.waitForTimeout(100);
  expect(
    await page.evaluate(() => (window as any).oldHost.globeMetrics.frames),
  ).toBe(stopped);
  const audit = await page.evaluate(() => (window as any).globeAudit);
  expect(audit.released).toBe(audit.created);
  expect(audit.deletedBuffers).toBeGreaterThan(0);
  expect(audit.deletedTextures).toBeGreaterThan(0);
  expect(audit.deletedPrograms).toBeGreaterThan(0);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/(?:earth|night)-4096.*webp/, async (r) => {
    if (r.request().resourceType() === "image") await pending;
    await r.continue();
  });
  await page.setViewportSize({ width: 760, height: 900 });
  await page.goto("/#passport");
  await page.locator(".flight-row").click();
  await page.setViewportSize({ width: 761, height: 900 });
  await expect(page.locator(".globe-webgl")).toBeVisible();
  await page.evaluate(() => {
    (window as any).pendingHost = document.querySelector(".globe-host");
  });
  await page.goto("/#settings");
  await expect(page.locator("canvas")).toHaveCount(0);
  release();
  await page.unrouteAll({ behavior: "wait" });
  await expect
    .poll(() => page.evaluate(() => (window as any).globeAudit.active))
    .toBe(0);
  expect(
    await page.evaluate(() => (window as any).pendingHost.dataset.ready),
  ).toBeUndefined();
  expect(await page.evaluate(() => (window as any).globeAudit.observers)).toBe(
    0,
  );
  expect(errors).toEqual([]);
});

test("mounted prop and language updates preserve camera and canvas; a new flight reframes", async ({
  page,
}) => {
  await open(page, [flight], false);
  await page.goto("/#settings");
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.evaluate(async (record) => {
    const dependency = (name: string) =>
      performance
        .getEntriesByType("resource")
        .map((r) => r.name)
        .find((url) => url.includes(`/.vite/deps/${name}.js?`))!;
    const { default: React } = await import(dependency("react"));
    const {
      default: { createRoot },
    } = await import(dependency("react-dom_client"));
    const { DetailGlobe } = await import("/src/globe/DetailGlobe.tsx");
    const { i18n } = await import("/src/i18n.ts");
    const { I18nextProvider } = await import(dependency("react-i18next"));
    const detailI18n = i18n.cloneInstance();
    const mount = document.createElement("div");
    mount.style.width = "600px";
    document.body.append(mount);
    const root = createRoot(mount);
    (window as any).renderDetail = (props: object) =>
      root.render(
        React.createElement(
          I18nextProvider,
          { i18n: detailI18n },
          React.createElement(DetailGlobe, props),
        ),
      );
    (window as any).detailI18n = detailI18n;
    (window as any).detailRoot = root;
    (window as any).renderDetail({
      flight: record,
      appearance: "light",
      solarMode: "fixed",
    });
  }, flight);
  await ready(page);
  await page.locator(".globe-webgl").focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await scene(page)).atHome).toBe(false);
  const camera = (await scene(page)).camera;
  await page.evaluate(() => {
    (window as any).savedCanvas = document.querySelector("canvas");
  });
  for (const language of ["zh-CN", "zh-TW", "en"]) {
    await page.evaluate(
      async ({ record, language }) => {
        (window as any).renderDetail({
          flight: { ...record, notes: "unrelated edit" },
          appearance: "dark",
          solarMode: "realtime",
        });
        await (window as any).detailI18n.changeLanguage(language);
      },
      { record: flight, language },
    );
    await expect(page.locator(".globe-stage")).toHaveAttribute(
      "data-theme",
      "dark",
    );
    await expect(page.locator(".globe-stage")).toHaveAttribute(
      "data-solar-mode",
      "realtime",
    );
    expect((await scene(page)).camera).toEqual(camera);
    expect(
      await page.evaluate(
        () => (window as any).savedCanvas === document.querySelector("canvas"),
      ),
    ).toBe(true);
    await expect(page.locator("canvas")).toHaveAttribute(
      "aria-label",
      language === "en"
        ? /Drag to rotate/
        : language === "zh-CN"
          ? /拖动旋转/
          : /拖曳旋轉/,
    );
  }
  await page.evaluate(
    (record) =>
      (window as any).renderDetail({
        flight: {
          ...record,
          id: "next",
          origin: { iata: "HKG" },
          destination: { iata: "BOM" },
        },
        appearance: "light",
        solarMode: "fixed",
      }),
    flight,
  );
  await ready(page);
  await expectFramed(page, "HKG-BOM");
  expect((await scene(page)).camera).not.toEqual(camera);
  await page.evaluate(() => (window as any).detailRoot.unmount());
  await expect(page.locator("canvas")).toHaveCount(0);
});
