import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import { expectDetailHero } from "./helpers/detail-hero";
import { supportedLanguages } from "../apps/web/src/locales/registry";
import { collectBrowserErrors, expectHealthyPage } from "./helpers/responsive";

test.describe.configure({ mode: "parallel" });

// Deterministic acceptance records (test data only), shared with the review
// screenshot script: a standard flight, ZH9911 SZX → TAO overnight, a sparse
// record without a Metadata Shelf, a rich record with a frequent-flyer
// snapshot, cancelled, and a diverted cross-date flight.
const fixture = new URL(
  "./fixtures/detail-content-hero.keepraw-fly.json",
  import.meta.url,
);

async function importRecords(page: Page) {
  const archive = JSON.parse(await readFile(fixture, "utf8"));
  const records: KeeprawFlight[] = archive.flights;
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Create my archive", exact: true }),
  ).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "detail-content-hero.keepraw-fly.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(archive)),
  });
  await page
    .getByRole("button", { name: "Import this archive", exact: true })
    .click();
  await expect(page.locator(".flight-row")).toHaveCount(records.length);
}

async function openFlight(page: Page, id: string) {
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: 390, height: 900 });
  await page
    .locator(`.flight-record[data-flight-id="${id}"] .flight-row`)
    .click();
  await expect(page.locator(".detail-heading")).toBeVisible();
  await page.setViewportSize(viewport);
}

async function settle(page: Page, width: number) {
  if (width >= 1200) {
    // The Detail Globe is lazy; wait for the real frame, then for a genuine
    // WebGL scene unless the explicit error UI replaced it.
    await expect(page.locator(".detail-globe-frame")).toHaveCount(1, {
      timeout: 25000,
    });
    if (await page.locator(".detail-globe-frame").count()) {
      await expect(page.locator(".detail-hero-space")).toHaveCount(1);
      await expect(
        page.locator(
          '.detail-globe-frame .globe-host[data-ready="true"], .detail-globe-frame .globe-fallback, .detail-globe-message',
        ),
      ).not.toHaveCount(0, { timeout: 25000 });
    }
  }
  return expectDetailHero(page, width);
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const rect = (selector: string) =>
      document.querySelector(selector)?.getBoundingClientRect() ?? null;
    const host = document.querySelector<HTMLElement>(
      ".detail-globe-frame .globe-host",
    );
    const scene = host?.dataset.scene ? JSON.parse(host.dataset.scene) : null;
    return {
      titleTop: Math.round(rect(".detail-heading h1")!.top),
      heroHeight: Math.round(rect(".detail-hero-grid")!.height),
      globe: scene ? `${scene.viewport.width}x${scene.viewport.height}` : null,
      shelfTop: rect(".detail-metadata-shelf")
        ? Math.round(rect(".detail-metadata-shelf")!.top)
        : null,
      verticalScroll:
        document.documentElement.scrollHeight > window.innerHeight,
      horizontalOverflow:
        document.documentElement.scrollWidth - window.innerWidth,
    };
  });
}

test("Hero height follows content, not viewport height, across the viewport matrix", async ({
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  const errors = collectBrowserErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await page.setViewportSize({ width: 390, height: 900 });
  await importRecords(page);
  await openFlight(page, "ca1831");
  const results: Record<string, Awaited<ReturnType<typeof measure>>> = {};
  for (const [width, height] of [
    [1440, 900],
    [1440, 720],
    [1440, 1440],
    [1920, 1080],
    [1920, 1440],
    [2560, 1440],
    [3840, 2160],
    [1366, 768],
    [1280, 720],
    [1200, 900],
    [1200, 390],
    [1199, 900],
    [390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await settle(page, width);
    await page.evaluate(() => window.scrollTo(0, 0));
    const result = await measure(page);
    results[`${width}x${height}`] = result;
    expect(result.horizontalOverflow).toBeLessThanOrEqual(0);
    if (width >= 1200) {
      // No viewport-filling Hero: a 4K screen must not be taken over again.
      expect(result.heroHeight).toBeLessThan(Math.max(height * 0.75, 600));
      // Short desktops scroll; every control stays reachable.
      const controls = page.locator(".detail-globe-frame .globe-controls");
      await controls.scrollIntoViewIfNeeded();
      const box = (await controls.boundingBox())!;
      // Hover the frame right beside the controls so they reveal in place.
      await page.mouse.move(box.x - 4, box.y + box.height / 2);
      await expect(controls.getByRole("button").first()).toBeInViewport();
      await page.evaluate(() => window.scrollTo(0, 0));
    } else {
      await expect(page.locator(".detail-globe-frame")).toHaveCount(0);
    }
  }
  // Same width, different heights: identical title position and Hero height.
  for (const [base, others] of [
    ["1440x900", ["1440x720", "1440x1440"]],
    ["1920x1080", ["1920x1440"]],
    ["1200x900", ["1200x390"]],
  ] as const) {
    for (const other of others) {
      expect(results[other]!.titleTop).toBe(results[base]!.titleTop);
      expect(results[other]!.heroHeight).toBe(results[base]!.heroHeight);
      expect(results[other]!.globe).toBe(results[base]!.globe);
    }
  }
  // Title top is decided by the header and normal flow at every desktop size.
  const desktopTops = new Set(
    Object.entries(results)
      .filter(([key]) => Number(key.split("x")[0]) >= 1200)
      .map(([, value]) => value.titleTop),
  );
  expect(desktopTops.size).toBe(1);
  testInfo.annotations.push({
    type: "detail-hero-geometry",
    description: JSON.stringify(results),
  });
  await expectHealthyPage(page, errors);
});

for (const id of [
  "ca1831",
  "overnight",
  "sparse",
  "rich",
  "cancelled",
  "diversion",
] as const) {
  test(`content-led Hero holds for the ${id} record`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors = collectBrowserErrors(page);
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
    await page.setViewportSize({ width: 390, height: 900 });
    await importRecords(page);
    await openFlight(page, id);
    for (const [width, height] of [
      [1440, 900],
      [1920, 1080],
    ] as const) {
      await page.setViewportSize({ width, height });
      const geometry = await settle(page, width);
      if (id === "cancelled") {
        await expect(page.locator(".detail-globe-message")).toBeVisible();
        await expect(
          page.locator(".detail-globe-frame .globe-host"),
        ).toHaveCount(0);
      }
      if (id === "sparse")
        await expect(page.locator(".detail-metadata-shelf")).toHaveCount(0);
      else {
        await expect(page.locator(".detail-metadata-shelf")).toHaveCount(1);
        expect(geometry.shelf!.top).toBeCloseTo(geometry.heroBottom + 32, 0);
      }
      if (id === "rich")
        await expect(page.locator(".detail-metadata-shelf")).toContainText(
          "N12010",
        );
    }
    await expectHealthyPage(page, errors);
  });
}

test("WebGL failure keeps a compact explanation and a working retry", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (type === "webgl2" || type === "webgl") return null;
      return (original as (...args: unknown[]) => unknown).call(
        this,
        type,
        ...rest,
      );
    } as typeof original;
  });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await page.setViewportSize({ width: 390, height: 900 });
  await importRecords(page);
  await openFlight(page, "ca1831");
  for (const [width, height] of [
    [1440, 900],
    [3840, 2160],
    [1200, 390],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expect(
      page.locator(".detail-globe-frame .globe-stage"),
    ).toHaveAttribute("data-error", /webgl2-unavailable/);
    const geometry = await settle(page, width);
    const retry = page.locator(".detail-globe-frame .globe-fallback button");
    await expect(retry).toBeEnabled();
    const button = (await retry.boundingBox())!;
    expect(button.y).toBeGreaterThanOrEqual(geometry.map!.top - 1);
    expect(button.y + button.height).toBeLessThanOrEqual(
      geometry.map!.bottom + 1,
    );
    await expect(page.locator(".detail-globe-space")).toHaveCSS("opacity", "0");
  }
});

test("notices stay in normal flow through banner, warning, resize and breakpoint changes", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo" }).click();
  await page.getByRole("button", { name: /Open UA123/ }).click();
  await settle(page, 1440);
  const state = () =>
    page.evaluate(() => {
      const notices = [...document.querySelectorAll(".page-notices")];
      const noticesBottom = Math.max(
        0,
        ...notices.map((n) => n.getBoundingClientRect().bottom),
      );
      const page = document
        .querySelector(".detail-page")!
        .getBoundingClientRect();
      const hero = document
        .querySelector(".detail-hero-grid")!
        .getBoundingClientRect();
      const title = document
        .querySelector(".detail-heading h1")!
        .getBoundingClientRect();
      return {
        noticesBottom,
        pageTop: page.top,
        heroTop: hero.top,
        heroHeight: hero.height,
        titleTop: title.top,
      };
    });
  await expect(page.locator(".demo-banner")).toBeVisible();
  const withBanner = await state();
  expect(withBanner.pageTop).toBeGreaterThanOrEqual(
    withBanner.noticesBottom - 0.5,
  );

  // A taller notice (e.g. a wrapped save failure) pushes content down 1:1.
  await page.evaluate(() => {
    const notices = document.querySelector(".page-notices")!;
    const warning = document.createElement("div");
    warning.className = "storage-warning";
    warning.setAttribute("role", "alert");
    warning.dataset.test = "simulated";
    warning.innerHTML =
      "<span>Changes were not saved.</span><button type=button>Retry</button>";
    notices.prepend(warning);
  });
  const withWarning = await state();
  expect(withWarning.titleTop - withWarning.noticesBottom).toBeCloseTo(
    withBanner.titleTop - withBanner.noticesBottom,
    0,
  );
  expect(withWarning.titleTop).toBeGreaterThan(withBanner.titleTop);
  expect(withWarning.heroHeight).toBeCloseTo(withBanner.heroHeight, 0);

  // Removing every notice returns the title to the header-driven position.
  await page.evaluate(() =>
    document
      .querySelectorAll<HTMLElement>(".page-notices")
      .forEach((element) => (element.style.display = "none")),
  );
  const withoutNotices = await state();
  expect(withoutNotices.heroHeight).toBeCloseTo(withBanner.heroHeight, 0);
  expect(withoutNotices.titleTop).toBeLessThan(withBanner.titleTop);
  await page.evaluate(() =>
    document
      .querySelectorAll<HTMLElement>(".page-notices")
      .forEach((element) => element.style.removeProperty("display")),
  );
  await page.locator('[data-test="simulated"]').evaluate((e) => e.remove());

  // Resize and mobile ↔ desktop round trips restore the same geometry.
  await page.setViewportSize({ width: 1440, height: 640 });
  await settle(page, 1440);
  await page.setViewportSize({ width: 390, height: 844 });
  await settle(page, 390);
  await page.setViewportSize({ width: 1440, height: 900 });
  await settle(page, 1440);
  const restored = await state();
  expect(restored.titleTop).toBeCloseTo(withBanner.titleTop, 0);
  expect(restored.heroHeight).toBeCloseTo(withBanner.heroHeight, 0);
});

test("content-led Hero holds in every released language", async ({ page }) => {
  test.setTimeout(300_000);
  const errors = collectBrowserErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 900 });
  await importRecords(page);
  const geometry: Record<string, number> = {};
  for (const language of supportedLanguages) {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/#settings");
    await page.locator("#settings-language").selectOption(language);
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    await page.goto("/#passport");
    await openFlight(page, "rich");
    await page.setViewportSize({ width: 1440, height: 900 });
    const hero = await settle(page, 1440);
    geometry[language] = Math.round(hero.heading.top);
  }
  // The title's position never depends on the language's text length.
  expect(new Set(Object.values(geometry)).size).toBe(1);
  await expectHealthyPage(page, errors);
});
