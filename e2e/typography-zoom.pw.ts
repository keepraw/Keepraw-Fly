import { chromium, expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { globeMode } from "./helpers/globe-capability";
import {
  passportTypographyBounds,
  passportViewportDiagnostics,
  waitForPassportLayout,
} from "../scripts/passport-typography-evidence.mjs";

for (const zoom of [1, 1.25]) {
  test(`native ${zoom * 100}% zoom preserves desktop and mobile breakpoint layout`, async ({
    browserName,
  }, testInfo) => {
    test.skip(browserName !== "chromium", "Native Chromium profile zoom model");
    const profile = testInfo.outputPath("profile");
    await mkdir(`${profile}/Default`, { recursive: true });
    await writeFile(
      `${profile}/Default/Preferences`,
      JSON.stringify({
        partition: {
          default_zoom_level: { x: Math.log(zoom) / Math.log(1.2) },
        },
      }),
    );
    const context = await chromium.launchPersistentContext(profile, {
      headless: true,
      channel: "chromium",
      viewport: { width: 1440, height: 900 },
      locale: "en-US",
      reducedMotion: "reduce",
    });
    const records = [];
    try {
      const page = await context.newPage();
      await page.route("https://cdn.jsdelivr.net/**", (route) => route.abort());
      await page.goto("http://127.0.0.1:5173");
      await page
        .locator('input[type="file"]')
        .setInputFiles("e2e/fixtures/chinese-passport.keepraw-fly.json");
      await page
        .getByRole("button", { name: "Import this archive", exact: true })
        .click();
      for (const locale of ["en", "zh-CN", "zh-TW"]) {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto("http://127.0.0.1:5173/#settings");
        await page
          .locator(".settings-fields select")
          .first()
          .selectOption(locale);
        await page.goto("http://127.0.0.1:5173/#passport");
        const mode = await globeMode(page);
        for (const [width, height] of [
          [1440, 900],
          [761, 900],
          [1024, 768],
          [1440, 540],
        ]) {
          await page.setViewportSize({ width, height });
          await waitForPassportLayout(page);
          const diagnostics = await passportViewportDiagnostics(page);
          expect(diagnostics.devicePixelRatio).toBe(zoom);
          expect(diagnostics.document.scrollWidth).toBeLessThanOrEqual(
            diagnostics.innerWidth + 1,
          );
          if (diagnostics.desktop) {
            // A return from Mobile mounts a fresh lazy Globe. Measure the ready
            // scene and settled text, retaining all original clipping assertions.
            if (mode === "webgl")
              await expect(page.locator(".globe-host")).toHaveAttribute(
                "data-ready",
                "true",
              );
            else
              await expect(
                page.locator(".globe-fallback svg[role=group]"),
              ).toBeVisible();
            await page.evaluate(async () => {
              await document.fonts.ready;
              await Promise.all(
                document
                  .getAnimations()
                  .filter((a) => a.effect?.getTiming().iterations !== Infinity)
                  .map((a) => a.finished.catch(() => {})),
              );
              await new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              );
            });
            const bounds = await passportTypographyBounds(page);
            expect(bounds.documentFits).toBe(true);
            expect(bounds.singleScreen).toBe(true);
            expect(bounds.rightScroll.required).toBe(false);
            expect(bounds.archiveScroll.overflowY).toBe("auto");
            expect(bounds.failures).toEqual([]);
            expect(bounds.kpis).toHaveLength(6);
            expect(bounds.longestHasMap).toBe(false);
            if (diagnostics.compact)
              await expect(page.locator(".passport-highlights")).toBeHidden();
            else {
              await expect(page.locator(".passport-highlights")).toBeVisible();
              expect(bounds.bottomSafety).toBeGreaterThanOrEqual(23.99);
            }
          } else {
            await expect(page.locator(".passport-highlights")).toHaveCount(0);
            expect(diagnostics.shell.rect.height).toBeGreaterThan(
              diagnostics.innerHeight,
            );
          }
          records.push({
            locale,
            physicalViewport: [width, height],
            diagnostics,
          });
        }
      }
    } finally {
      await testInfo.attach("native-zoom-geometry", {
        body: JSON.stringify(records, null, 2),
        contentType: "application/json",
      });
      await context.close();
    }
  });
}
