import { chromium, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { format } from "prettier";
import {
  passportTypographyBounds,
  passportViewportDiagnostics,
  waitForTypography,
  waitForPassportLayout,
} from "./passport-typography-evidence.mjs";

const directory = "docs/visual-review/task-3/screenshots";
const origin = process.env.TASK_3_ORIGIN ?? "http://127.0.0.1:5173";
const sizes = [
  [1440, 900],
  [1366, 768],
  [1280, 720],
  [1024, 768],
  [761, 900],
];
const records = [];
await mkdir(directory, { recursive: true });
for (const zoom of [1, 1.25]) {
  const profile = resolve(`artifacts/task-3-profile-${zoom}-${Date.now()}`);
  await mkdir(`${profile}/Default`, { recursive: true });
  await writeFile(
    `${profile}/Default/Preferences`,
    JSON.stringify({
      partition: { default_zoom_level: { x: Math.log(zoom) / Math.log(1.2) } },
    }),
  );
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin);
    await page
      .locator('input[type="file"]')
      .setInputFiles("e2e/fixtures/chinese-passport.keepraw-fly.json");
    await page
      .getByRole("button", { name: "Import this archive", exact: true })
      .click();
    for (const language of ["en", "zh-CN", "zh-TW"])
      for (const theme of ["dark", "light"]) {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(`${origin}/#settings`);
        await page
          .locator(".settings-fields select")
          .nth(0)
          .selectOption(language);
        await page
          .locator(".settings-fields select")
          .nth(1)
          .selectOption(theme);
        await page
          .locator(".settings-fields select")
          .nth(2)
          .selectOption("kilometers");
        await page.goto(`${origin}/#passport`);
        await waitForTypography(page, language);
        for (const [width, height] of sizes) {
          await page.setViewportSize({ width, height });
          await page.mouse.move(0, 0);
          await waitForPassportLayout(page);
          const diagnostics = await passportViewportDiagnostics(page);
          assert(
            Math.abs(diagnostics.devicePixelRatio - zoom) < 0.02,
            "Native browser zoom must be verified",
          );
          let geometry = null,
            scene = null,
            lighting = null;
          if (diagnostics.desktop) {
            await expect(page.locator(".globe-host")).toHaveAttribute(
              "data-ready",
              "true",
              { timeout: 25000 },
            );
            await expect(page.locator(".globe-fallback")).toHaveCount(0);
            await page.waitForTimeout(150);
            geometry = await passportTypographyBounds(page);
            assert(
              geometry.documentFits &&
                geometry.singleScreen &&
                geometry.controlsContained,
            );
            assert(
              !geometry.rightScroll.required && geometry.bottomSafety >= 0,
            );
            assert.equal(geometry.kpis.length, 6);
            assert.equal(geometry.longestHasMap, false);
            assert.deepEqual(geometry.failures, []);
            const map = geometry.components[".route-map"];
            assert(
              map.width > 250 && map.height > 180,
              `Map must fill a usable cell: ${JSON.stringify(map)}`,
            );
            scene = JSON.parse(
              await page.locator(".globe-host").getAttribute("data-scene"),
            );
            lighting = JSON.parse(
              await page.locator(".globe-host").getAttribute("data-lighting"),
            );
            const hostSize = await page
              .locator(".globe-host")
              .evaluate((el) => ({
                width: el.clientWidth,
                height: el.clientHeight,
              }));
            assert.deepEqual(scene.viewport, hostSize);
            assert(scene.routes.length > 0 && scene.physicalRoutes > 0);
          } else {
            await expect(page.locator(".passport-globe-frame")).toHaveCount(0);
            await expect(
              page.locator(".passport-mobile-summary"),
            ).toBeVisible();
          }
          const file = `passport-${language}-${theme}-${width}x${height}-zoom${zoom * 100}.png`;
          const pixels = await page.screenshot({
            path: `${directory}/${file}`,
          });
          const labels = await page
            .locator(".globe-airport-label:visible")
            .allTextContents();
          records.push({
            file,
            fixture: "chinese-passport",
            language,
            theme,
            zoom,
            physicalViewport: { width, height },
            diagnostics,
            geometry,
            scene,
            lighting,
            labels,
            sha256: createHash("sha256").update(pixels).digest("hex"),
          });
          console.log(
            `${file}: ${diagnostics.desktop ? `${scene.physicalRoutes} routes, ${labels.length} labels` : "Mobile"}`,
          );
        }
      }
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}
// Long city names use the validated archive import flow on the official page.
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    reducedMotion: "reduce",
    locale: "en-US",
  });
  await page.goto(origin);
  await page
    .locator('input[type="file"]')
    .setInputFiles("e2e/fixtures/chinese-long-city-passport.keepraw-fly.json");
  await page
    .getByRole("button", { name: "Import this archive", exact: true })
    .click();
  for (const language of ["en", "zh-CN", "zh-TW"]) {
    await page.goto(`${origin}/#settings`);
    await page.locator(".settings-fields select").nth(0).selectOption(language);
    await page.locator(".settings-fields select").nth(1).selectOption("dark");
    await page.goto(`${origin}/#passport`);
    await waitForTypography(page, language);
    await page.mouse.move(0, 0);
    await expect(page.locator(".globe-host")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await page.waitForTimeout(150);
    const geometry = await passportTypographyBounds(page);
    assert.deepEqual(geometry.failures, []);
    assert(geometry.singleScreen);
    const file = `passport-${language}-dark-long-cities-1280x720.png`;
    const pixels = await page.screenshot({ path: `${directory}/${file}` });
    records.push({
      file,
      fixture: "chinese-long-city-passport",
      language,
      theme: "dark",
      zoom: 1,
      geometry,
      sha256: createHash("sha256").update(pixels).digest("hex"),
    });
  }
} finally {
  await browser.close();
}
await writeFile(
  "docs/visual-review/task-3/browser-evidence.json",
  await format(
    JSON.stringify({
      origin,
      zoomMethod:
        "Native Chromium profile partition.default_zoom_level; devicePixelRatio and effective CSS viewport asserted. No CSS zoom or DPR-only emulation.",
      records,
    }),
    { parser: "json" },
  ),
);
await writeFile(
  "docs/visual-review/task-3/SCREENSHOTS.md",
  await format(
    `# Formal Passport Task 3 screenshots\n\nAll images come from the official /#passport using validated flight archives. Native 125% zoom makes the physical 761px case Mobile (effective CSS width 609px); all other captures are Desktop 3D.\n\n| Screenshot | Fixture | Zoom |\n| --- | --- | --- |\n${records.map((r) => `| [${r.file}](screenshots/${r.file}) | ${r.fixture} | ${r.zoom * 100}% |`).join("\n")}\n\n[Browser dimensions, route data, labels and SHA-256](browser-evidence.json)\n`,
    { parser: "markdown" },
  ),
);
console.log(
  `Captured and verified ${records.length} formal Passport screenshots.`,
);
