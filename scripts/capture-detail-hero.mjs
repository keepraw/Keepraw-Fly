// Reproducible Before/After capture for the Flight Detail content-led Hero.
//
// Usage (from the repository root, with a dev server for the checkout under
// review already running):
//   BASE_URL=http://127.0.0.1:5173 LABEL=after OUT=artifacts/detail-hero \
//     node scripts/capture-detail-hero.mjs
//
// Every shot imports the same deterministic archive
// (e2e/fixtures/detail-content-hero.keepraw-fly.json), uses DPR 1, reduced
// motion, waits for document.fonts.ready and, on desktop, for the 2D route
// map to mount. Geometry is written next
// to the PNGs as <LABEL>.json.
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const base = process.env.BASE_URL ?? "http://127.0.0.1:5173";
const label = process.env.LABEL ?? "after";
const out = process.env.OUT ?? "artifacts/detail-hero";
const archive = await readFile(
  new URL(
    "../e2e/fixtures/detail-content-hero.keepraw-fly.json",
    import.meta.url,
  ),
);

export const shots = [
  ["standard-dark-1440x900", "ca1831", "dark", 1440, 900],
  ["standard-dark-1920x1080", "ca1831", "dark", 1920, 1080],
  ["standard-dark-1366x768", "ca1831", "dark", 1366, 768],
  ["standard-dark-1280x720", "ca1831", "dark", 1280, 720],
  ["standard-dark-3840x2160", "ca1831", "dark", 3840, 2160],
  ["standard-dark-2560x1440", "ca1831", "dark", 2560, 1440],
  ["standard-dark-1200x900", "ca1831", "dark", 1200, 900],
  ["standard-dark-1200x390", "ca1831", "dark", 1200, 390],
  ["standard-dark-1199x900", "ca1831", "dark", 1199, 900],
  ["standard-dark-390x844", "ca1831", "dark", 390, 844],
  ["standard-light-1440x900", "ca1831", "light", 1440, 900],
  ["standard-light-1920x1080", "ca1831", "light", 1920, 1080],
  ["zh9911-dark-1440x900", "overnight", "dark", 1440, 900],
  ["sparse-dark-1440x900", "sparse", "dark", 1440, 900],
  ["rich-light-1440x900", "rich", "light", 1440, 900],
  ["cancelled-dark-1440x900", "cancelled", "dark", 1440, 900],
];

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const results = {};
for (const [name, id, theme, width, height] of shots) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    colorScheme: theme,
    locale: "en-US",
  });
  await context.addInitScript(
    (value) => localStorage.setItem("keepraw-fly-appearance", value),
    theme,
  );
  const page = await context.newPage();
  await page.goto(base);
  await page.getByRole("button", { name: "Create my archive" }).waitFor();
  await page.locator('input[type="file"]').setInputFiles({
    name: "review.keepraw-fly.json",
    mimeType: "application/json",
    buffer: archive,
  });
  await page.getByRole("button", { name: "Import this archive" }).click();
  await page
    .locator(`.flight-record[data-flight-id="${id}"] .flight-row`)
    .click();
  await page.setViewportSize({ width, height });
  await page.locator(".detail-hero-grid").waitFor();
  if (width >= 1200) await page.locator(".detail-flight-map").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(800);
  results[name] = await page.evaluate(() => {
    const rect = (s) => document.querySelector(s)?.getBoundingClientRect();
    return {
      viewport: `${innerWidth}x${innerHeight}`,
      dpr: devicePixelRatio,
      titleTop: Math.round(rect(".detail-heading h1").top),
      heroTop: Math.round(rect(".detail-hero-grid").top),
      heroHeight: Math.round(rect(".detail-hero-grid").height),
      mapFrame: rect(".detail-flight-map")
        ? `${Math.round(rect(".detail-flight-map").width)}x${Math.round(rect(".detail-flight-map").height)}`
        : null,
      shelfTop: rect(".detail-metadata-shelf")
        ? Math.round(rect(".detail-metadata-shelf").top)
        : null,
      scrollHeight: document.documentElement.scrollHeight,
      verticalScroll: document.documentElement.scrollHeight > innerHeight,
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
  await page.screenshot({ path: `${out}/${label}-${name}.png` });
  await context.close();
  console.log(name, JSON.stringify(results[name]));
}
await browser.close();
await writeFile(`${out}/${label}.json`, JSON.stringify(results, null, 2));
