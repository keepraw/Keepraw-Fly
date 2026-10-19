import { expect, test, type Page } from "@playwright/test";
import { disablePassportWebGL } from "./helpers/passport-svg";

// Passport desktop density: 1920x1080 is the reference composition. Larger
// CSS viewports grow the whole workspace together (shell, archive, map,
// stats, highlights, header) instead of only the map; laptop and 1080p
// layouts are unchanged, and other pages keep their own widths.

test.beforeEach(async ({ page }) => disablePassportWebGL(page));

const reference = { width: 1920, height: 1080 };

async function openDemo(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize(reference);
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo" }).click();
  await page.goto("/#passport");
  await expect(page.locator(".route-map-canvas > svg")).toBeVisible();
}

async function settle(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await expect
    .poll(() => page.evaluate(() => `${innerWidth}x${innerHeight}`))
    .toBe(`${viewport.width}x${viewport.height}`);
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}

function layout(page: Page) {
  return page.evaluate(() => {
    const box = (selector: string) => {
      const rect = document.querySelector(selector)!.getBoundingClientRect();
      return { left: rect.left, width: rect.width, height: rect.height };
    };
    const font = (selector: string) =>
      parseFloat(getComputedStyle(document.querySelector(selector)!).fontSize);
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:absolute;visibility:hidden;width:calc(1000 * var(--passport-px, 1px))";
    document.querySelector(".app-shell")!.append(probe);
    const scale = probe.getBoundingClientRect().width / 1000;
    probe.remove();
    const stats = [
      ...document.querySelectorAll<HTMLElement>(".passport-core-stat strong"),
    ];
    return {
      scale,
      page: box(".passport-archive-page"),
      header: box(".site-header-inner"),
      archive: box(".passport-archive"),
      report: box(".passport-visual-sticky"),
      map: box(".route-map"),
      stats: box(".passport-core-stats"),
      highlights: box(".passport-highlights"),
      row: box(".passport-archive .flight-row"),
      statFont: font(".passport-core-stat strong"),
      cityFont: font(".passport-archive .flight-route-cities"),
      titleFont: font(".passport-map-title"),
      statsSingleLine: stats.every(
        (el) =>
          el.getBoundingClientRect().height <
          parseFloat(getComputedStyle(el).fontSize) * 2,
      ),
      overflowX: document.documentElement.scrollWidth > innerWidth,
      clipped: [".passport-archive-scroll", ".passport-visual-sticky"].some(
        (selector) => {
          const el = document.querySelector(selector)!;
          return el.scrollWidth > el.clientWidth + 1;
        },
      ),
    };
  });
}

test("Passport desktop grows as one composition above the 1080p reference", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openDemo(page);
  await settle(page, reference);
  const base = await layout(page);
  expect(base.scale).toBe(1);

  for (const viewport of [
    { width: 2560, height: 1440 },
    { width: 3840, height: 2160 },
  ]) {
    await test.step(`${viewport.width}x${viewport.height}`, async () => {
      await settle(page, viewport);
      const view = await layout(page);
      expect(view.scale).toBeGreaterThan(1);
      // Every region keeps the reference proportions in layout units; one
      // layout unit of slack covers unscaled hairline borders.
      const near = (actual: number, expected: number) =>
        expect(Math.abs(actual - expected)).toBeLessThanOrEqual(view.scale * 2);
      near(view.page.width, base.page.width * view.scale);
      near(view.header.width, view.page.width);
      near(view.archive.width, base.archive.width * view.scale);
      near(view.report.width, base.report.width * view.scale);
      near(view.map.width, base.map.width * view.scale);
      near(view.stats.height, base.stats.height * view.scale);
      near(view.highlights.height, base.highlights.height * view.scale);
      near(view.row.height, base.row.height * view.scale);
      near(view.statFont, base.statFont * view.scale);
      near(view.cityFont, base.cityFont * view.scale);
      near(view.titleFont, base.titleFont * view.scale);
      expect(view.statsSingleLine).toBe(true);
      expect(view.overflowX).toBe(false);
      expect(view.clipped).toBe(false);
    });
  }

  await test.step("continuous resize returns to the reference layout", async () => {
    for (const width of [3600, 3000, 2400, 2000, 1700, 1440, 1920])
      await settle(page, { width, height: Math.round((width * 9) / 16) });
    await settle(page, reference);
    expect(await layout(page)).toEqual(base);
  });
});

test("laptop sizes and browser zoom keep CSS-pixel Passport layout", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  await openDemo(page);
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1280, height: 720 },
    // Wider than the reference but shorter (or the reverse): the smaller
    // ratio wins, so neither axis inflates the layout.
    { width: 2560, height: 1080 },
    { width: 1920, height: 1600 },
  ]) {
    await settle(page, viewport);
    expect((await layout(page)).scale).toBe(1);
  }

  // A 4K display at 200% OS scaling reports a 1920x1080 CSS viewport at DPR 2:
  // the layout matches DPR 1 exactly, since scale follows CSS pixels only.
  await settle(page, reference);
  const dpr1 = await layout(page);
  const context = await browser.newContext({
    viewport: reference,
    deviceScaleFactor: 2,
  });
  const zoomed = await context.newPage();
  await disablePassportWebGL(zoomed);
  await openDemo(zoomed);
  await settle(zoomed, reference);
  expect(await layout(zoomed)).toEqual(dpr1);
  await context.close();
});

for (const [language, theme] of [
  ["zh-CN", "dark"],
  ["zh-TW", "light"],
] as const) {
  test(`${language} ${theme} Passport stays readable at 4K without wrapping stats`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openDemo(page);
    await page.goto("/#settings");
    await page
      .getByRole("combobox", { name: "Appearance", exact: true })
      .selectOption(theme);
    await page.getByLabel("Language").selectOption(language);
    await page.goto("/#passport");
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    await settle(page, { width: 3840, height: 2160 });
    const view = await layout(page);
    expect(view.scale).toBe(2);
    expect(view.statsSingleLine).toBe(true);
    expect(view.overflowX).toBe(false);
    expect(view.clipped).toBe(false);
  });
}

test("other pages keep their own width at 4K", async ({ page }) => {
  await openDemo(page);
  await page.goto("/#settings");
  await settle(page, reference);
  const header = () =>
    page.evaluate(
      () =>
        document.querySelector(".site-header-inner")!.getBoundingClientRect()
          .width,
    );
  const atReference = await header();
  await settle(page, { width: 3840, height: 2160 });
  const shell = await page.evaluate(() => ({
    header: document
      .querySelector(".site-header-inner")!
      .getBoundingClientRect().width,
    navFont: parseFloat(
      getComputedStyle(document.querySelector(".site-navigation a")!).fontSize,
    ),
  }));
  expect(shell.header).toBe(atReference);
  expect(shell.navFont).toBe(14);
});
