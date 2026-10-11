import { chromium, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { format } from "prettier";

const phase = process.argv[2];
if (!["before", "after"].includes(phase))
  throw new Error("Usage: node scripts/flight-list-review.mjs before|after");
const archive = await readFile(
  "e2e/fixtures/flight-list-review.keepraw-fly.json",
);
const directory = `docs/reviews/task-5b/${phase}`;
await mkdir(directory, { recursive: true });
const cases = [
  { width: 1440, height: 900, locale: "zh-CN", theme: "light" },
  { width: 1440, height: 900, locale: "zh-CN", theme: "dark" },
  { width: 390, height: 844, locale: "zh-CN", theme: "light" },
  { width: 390, height: 844, locale: "zh-CN", theme: "dark" },
  { width: 1024, height: 768, locale: "en", theme: "light" },
  { width: 430, height: 932, locale: "en", theme: "dark" },
  { width: 761, height: 900, locale: "zh-TW", theme: "dark" },
  { width: 360, height: 800, locale: "zh-TW", theme: "light" },
];
const browser = await chromium.launch();
const measurements = [];
try {
  for (const sample of cases) {
    const context = await browser.newContext({
      viewport: sample,
      locale: "en-US",
      reducedMotion: "reduce",
      colorScheme: "light",
    });
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:5173/");
    await page.locator('input[type="file"]').setInputFiles({
      name: "review.keepraw-fly.json",
      mimeType: "application/json",
      buffer: archive,
    });
    await page
      .getByRole("button", { name: "Import this archive", exact: true })
      .click();
    await expect(page.locator(".flight-row")).toHaveCount(7);
    await page.goto("http://127.0.0.1:5173/#settings");
    await page
      .locator(".settings-fields select")
      .nth(0)
      .selectOption(sample.locale);
    await page
      .locator(".settings-fields select")
      .nth(1)
      .selectOption(sample.theme);
    await page.goto("http://127.0.0.1:5173/#passport");
    await expect(page.locator("html")).toHaveAttribute("lang", sample.locale);
    await expect(page.locator(".flight-row")).toHaveCount(7);
    await page.evaluate(() => document.fonts.ready);
    await page
      .locator(".flight-row img")
      .evaluateAll((images) =>
        Promise.all(images.map((img) => img.decode().catch(() => {}))),
      );
    if (sample.width > 760) {
      await expect(
        page.locator('.globe-host[data-ready="true"], .globe-fallback svg'),
      ).toBeVisible({ timeout: 30_000 });
    } else {
      await page.locator(".archive-heading").scrollIntoViewIfNeeded();
      await page.evaluate(() =>
        window.scrollBy(
          0,
          document.querySelector(".archive-heading").getBoundingClientRect()
            .top - 16,
        ),
      );
    }
    const name = `${sample.locale}-${sample.theme}-${sample.width}x${sample.height}`;
    if (sample.width === 1440 || sample.width <= 760)
      await page.screenshot({ path: `${directory}/${name}.png` });
    if (sample.width > 760)
      await page
        .locator(".passport-archive")
        .screenshot({ path: `${directory}/${name}-list.png` });
    measurements.push({
      ...sample,
      ...(await page.evaluate(() => ({
        documentFits: document.documentElement.scrollWidth <= innerWidth,
        rowHeights: [...document.querySelectorAll(".flight-row")].map(
          (el) => el.getBoundingClientRect().height,
        ),
        renderer:
          document.querySelector(".globe-host")?.getAttribute("data-ready") ===
          "true"
            ? "webgl"
            : document.querySelector(".globe-fallback")
              ? "svg"
              : "none",
        rows: [...document.querySelectorAll(".flight-row")].map(
          (el) => el.textContent,
        ),
      }))),
    });
    await context.close();
    console.log(`${phase}: ${name}`);
  }
} finally {
  await browser.close();
}
await writeFile(
  `${directory}/measurements.json`,
  await format(
    JSON.stringify({
      phase,
      baseCommit: execFileSync("git", ["merge-base", "origin/main", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      cases: measurements,
    }),
    { parser: "json" },
  ),
);
