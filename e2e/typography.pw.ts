import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { passportTypographyBounds } from "../scripts/passport-typography-evidence.mjs";

const fixture = "e2e/fixtures/chinese-passport.keepraw-fly.json";
async function importFixture(page) {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await page
    .getByRole("button", { name: "Import this archive", exact: true })
    .click();
}
async function settle(page) {
  await page.waitForFunction(
    () =>
      Math.abs(
        parseFloat(
          getComputedStyle(document.querySelector(".app-shell")).height,
        ) - innerHeight,
      ) < 1,
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
  });
}

test("Chinese stylesheets are locale-scoped, pinned, non-blocking and deduplicated", async ({
  page,
}) => {
  const requests = [];
  await page.route(
    "https://cdn.jsdelivr.net/npm/misans-webfont@4.3.1/**",
    (route) => {
      requests.push(route.request().url());
      // Exercise native link load events deterministically. Actual CDN CSS/WOFF2
      // downloads and rendered glyphs are verified by capture-task-2c.mjs.
      return route.fulfill({
        status: 200,
        contentType: "text/css",
        body: "/* font link lifecycle fixture */",
      });
    },
  );
  await importFixture(page);
  await expect(page.locator("link[data-chinese-webfont]")).toHaveCount(0);
  expect(requests).toHaveLength(0);
  await page.locator("#passport-flight-search").fill("TAO");
  for (const locale of ["zh-CN", "zh-TW", "en", "zh-CN"]) {
    await page.goto("/#settings");
    await page.locator(".settings-fields select").first().selectOption(locale);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await page.goto("/#passport");
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
            link.referrerPolicy === "no-referrer",
        ),
      ),
  ).toBe(true);
});

for (const locale of ["zh-CN", "zh-TW"])
  for (const theme of ["dark", "light"]) {
    test(`Chinese desktop stays on one screen with unavailable CDN: ${locale} ${theme} @cross-browser`, async ({
      page,
    }) => {
      await page.route("https://cdn.jsdelivr.net/**", (route) => route.abort());
      await page.emulateMedia({ reducedMotion: "reduce" });
      await importFixture(page);
      await page.goto("/#settings");
      await page.locator(".settings-fields select").nth(0).selectOption(locale);
      await page.locator(".settings-fields select").nth(1).selectOption(theme);
      await page
        .locator(".settings-fields select")
        .nth(2)
        .selectOption("kilometers");
      await page.goto("/#passport");
      await expect(page.locator(".flight-row")).toHaveCount(12);
      for (const [width, height] of [
        [1646, 928],
        [1440, 900],
        [1366, 768],
        [1280, 720],
        [1024, 768],
        [761, 900],
      ]) {
        await page.setViewportSize({ width, height });
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
      }
      await page.setViewportSize({ width: 1440, height: 900 });
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
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator(".flight-row")).toHaveCount(12);
    });
  }
