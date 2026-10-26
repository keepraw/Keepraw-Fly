import { disablePassportWebGL } from "./helpers/passport-svg";
test.beforeEach(async ({ page }) => disablePassportWebGL(page));

import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  passportTypographyBounds,
  waitForPassportLayout,
} from "../scripts/passport-typography-evidence.mjs";

const fixture = "e2e/fixtures/chinese-passport.keepraw-fly.json";
async function importFixture(page) {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await page
    .getByRole("button", { name: "Import this archive", exact: true })
    .click();
}
async function settle(page) {
  await waitForPassportLayout(page);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
  });
}

test("Chinese stylesheets are locale-scoped, pinned, non-blocking and deduplicated @cross-browser", async ({
  page,
}) => {
  const requests = [];
  await page.route(
    "https://cdn.jsdelivr.net/npm/misans-webfont@4.3.1/**",
    async (route) => {
      const url = route.request().url();
      // WOFF2 subsets are not needed for CSSOM weight mapping; rendered glyphs
      // are verified by capture-task-2c.mjs.
      if (!url.endsWith("/result.min.css")) return route.abort();
      requests.push(url);
      // The pinned stylesheets carry SRI, so only their genuine bytes can load:
      // fetch them from the CDN instead of substituting a synthetic sheet.
      return route.fulfill({ response: await route.fetch() });
    },
  );
  await importFixture(page);
  await expect(page.locator("link[data-chinese-webfont]")).toHaveCount(0);
  expect(requests).toHaveLength(0);
  await page.locator("#passport-flight-search").fill("TAO");
  for (const locale of ["zh-CN", "zh-TW", "en-US", "zh-CN"]) {
    await page.goto("/#settings");
    await page.locator(".settings-fields select").first().selectOption(locale);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await page.goto("/#passport");
    await expect(page.locator(".passport-map-title")).toHaveCSS(
      "font-family",
      locale === "en-US"
        ? /Inter/
        : locale === "zh-TW"
          ? /MiSans TC/
          : /MiSans/,
    );
    await expect(page.locator("#passport-flight-search")).toHaveValue("TAO");
    await expect(page.locator(".flight-row")).toHaveCount(5);
  }
  await expect(page.locator("link[data-chinese-webfont]")).toHaveCount(6);
  expect(requests).toHaveLength(6);
  expect(requests.filter((url) => url.includes("/misans/"))).toHaveLength(3);
  expect(requests.filter((url) => url.includes("/misans-tc/"))).toHaveLength(3);
  for (const weight of ["regular", "medium", "semibold"])
    expect(requests.filter((url) => url.includes(`-${weight}/`))).toHaveLength(
      2,
    );
  expect(
    await page
      .locator("link[data-chinese-webfont]")
      .evaluateAll((links) =>
        links.every(
          (link) =>
            link.dataset.fontStatus === "loaded" &&
            link.crossOrigin === "anonymous" &&
            link.referrerPolicy === "no-referrer" &&
            [...link.sheet.cssRules].every(
              (rule) =>
                rule.style.fontFamily.replaceAll('"', "") ===
                  link.dataset.fontFamily &&
                rule.style.fontWeight === link.dataset.fontWeight,
            ),
        ),
      ),
  ).toBe(true);
});

for (const locale of ["zh-CN", "zh-TW"])
  for (const theme of ["dark", "light"]) {
    test.describe(`Chinese desktop with unavailable CDN: ${locale} ${theme}`, () => {
      test.beforeEach(async ({ page }) => {
        await page.route("https://cdn.jsdelivr.net/**", (route) =>
          route.abort(),
        );
        await page.emulateMedia({ reducedMotion: "reduce" });
        await importFixture(page);
        await page.goto("/#settings");
        await page
          .locator(".settings-fields select")
          .nth(0)
          .selectOption(locale);
        await page
          .locator(".settings-fields select")
          .nth(1)
          .selectOption(theme);
        await page
          .locator(".settings-fields select")
          .nth(2)
          .selectOption("kilometers");
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await page.goto("/#passport");
        await expect(page.locator(".flight-row")).toHaveCount(12);
      });

      // Each viewport keeps the normal test budget. Resizing through the whole
      // matrix before axe + reload left WebKit's startup assertion no time.
      for (const [width, height] of [
        [1646, 928],
        [1440, 900],
        [1366, 768],
        [1280, 720],
        [1024, 768],
        [761, 900],
      ]) {
        test.describe(`${width}x${height}`, () => {
          test.use({ viewport: { width, height } });
          test("stays on one screen @cross-browser", async ({ page }) => {
            await settle(page);
            const bounds = await passportTypographyBounds(page);
            expect(bounds.documentFits).toBe(true);
            expect(bounds.singleScreen).toBe(true);
            expect(bounds.rightScroll.required).toBe(false);
            expect(bounds.failures).toEqual([]);
            expect(bounds.bottomSafety).toBeGreaterThanOrEqual(24);
            expect(bounds.controlsContained).toBe(true);
            expect(bounds.longestHasMap).toBe(false);
            expect(bounds.archiveScroll.overflowY).toBe("auto");
          });
        });
      }

      test.describe("keyboard, accessibility and persistence", () => {
        test.use({ viewport: { width: 1440, height: 900 } });
        test("keeps Chinese preferences after reload @cross-browser", async ({
          page,
        }) => {
          await settle(page);
          const longest = page.locator(".passport-longest-flight");
          await longest.focus();
          await page.keyboard.press("Space");
          await expect(longest).toHaveAttribute("aria-pressed", "true");
          await page.keyboard.press("Space");
          await expect(page.locator(".flight-row")).toHaveCount(12);
          await page.locator('[data-airport="TAO"]').focus();
          await page.keyboard.press("Enter");
          await expect(page.locator(".flight-row")).toHaveCount(5);
          await page.keyboard.press("Enter");
          await expect(page.locator(".flight-row")).toHaveCount(12);
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
          // Observe the actual commit before navigating; a language change and a
          // document load event alone do not imply preference/startup readiness.
          await expect
            .poll(() =>
              page.evaluate(async () => {
                const modulePath = "/src/storage/browser.ts";
                const { browserStorage } = await import(modulePath);
                return browserStorage.loadSettings();
              }),
            )
            .toMatchObject({
              language: locale,
              appearance: theme,
              distanceUnit: "kilometers",
            });
          await page.reload();
          await expect(page.locator(".passport-archive-page")).toBeVisible();
          await expect(page.locator("html")).toHaveAttribute("lang", locale);
          await expect(page.locator(".flight-row")).toHaveCount(12);
        });
      });
    });
  }

for (const locale of ["zh-CN", "zh-TW"]) {
  test(
    "real long Chinese city names stay readable: " + locale + " @cross-browser",
    async ({ page }) => {
      await page.route("https://cdn.jsdelivr.net/**", (route) => route.abort());
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      await page
        .locator('input[type="file"]')
        .setInputFiles(
          "e2e/fixtures/chinese-long-city-passport.keepraw-fly.json",
        );
      await page
        .getByRole("button", { name: "Import this archive", exact: true })
        .click();
      for (const theme of ["dark", "light"]) {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto("/#settings");
        await page
          .locator(".settings-fields select")
          .nth(0)
          .selectOption(locale);
        await page
          .locator(".settings-fields select")
          .nth(1)
          .selectOption(theme);
        await page.goto("/#passport");
        await expect(
          page.locator(".flight-route-cities").first(),
        ).toContainText(locale === "zh-CN" ? "亚的斯亚贝巴" : "亞的斯亞貝巴");
        await expect(
          page.locator(".flight-route-cities").first(),
        ).toContainText(locale === "zh-CN" ? "约翰内斯堡" : "約翰內斯堡");
        for (const [width, height] of [
          [1440, 900],
          [1280, 720],
          [1024, 768],
          [819, 614],
          [761, 900],
        ]) {
          await page.setViewportSize({ width, height });
          await settle(page);
          const bounds = await passportTypographyBounds(page);
          expect(bounds.documentFits).toBe(true);
          expect(bounds.singleScreen).toBe(true);
          expect(bounds.failures).toEqual([]);
          expect(bounds.controlsContained).toBe(true);
          expect(bounds.longestHasMap).toBe(false);
          expect(bounds.kpis).toHaveLength(6);
          expect(
            await page
              .locator(".passport-longest-endpoint > span")
              .evaluateAll((nodes) =>
                nodes.every(
                  (node) => getComputedStyle(node).textOverflow !== "ellipsis",
                ),
              ),
          ).toBe(true);
        }
      }
    },
  );
}
