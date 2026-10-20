// Reproducible Before/After capture for the Flight Detail content-led Hero.
//
// Usage (from the repository root, with a dev server for the checkout under
// review already running):
//   BASE_URL=http://127.0.0.1:5173 LABEL=after OUT=/tmp/detail-review \
//     node docs/review/detail-content-led-hero/capture.mjs
//
// Every shot imports the same deterministic archive
// (e2e/fixtures/detail-content-hero.keepraw-fly.json), uses DPR 1, reduced
// motion, waits for document.fonts.ready and, where a Globe is mounted, for
// the real WebGL scene to report data-ready="true". Geometry is written next
// to the PNGs as <LABEL>.json.
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const base = process.env.BASE_URL ?? "http://127.0.0.1:5173";
const label = process.env.LABEL ?? "after";
const out = process.env.OUT ?? "detail-review";
const archive = await readFile(
  new URL(
    "../../../e2e/fixtures/detail-content-hero.keepraw-fly.json",
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
  const host = page.locator(".detail-globe-frame .globe-host");
  await page.locator(".detail-hero-grid").waitFor();
  // The Detail Globe is lazy: wait for the real frame, not the placeholder.
  if (width >= 1200)
    await page.locator(".detail-globe-frame").waitFor({ timeout: 60000 });
  if (await host.count())
    await page.waitForSelector(
      '.detail-globe-frame .globe-host[data-ready="true"]',
      {
        timeout: 60000,
      },
    );
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(800);
  results[name] = await page.evaluate(() => {
    const rect = (s) => document.querySelector(s)?.getBoundingClientRect();
    const host = document.querySelector(".detail-globe-frame .globe-host");
    const scene = host?.dataset.scene ? JSON.parse(host.dataset.scene) : null;
    const canvas = document.createElement("canvas").getContext("webgl2");
    const debug = canvas?.getExtension("WEBGL_debug_renderer_info");
    return {
      viewport: `${innerWidth}x${innerHeight}`,
      dpr: devicePixelRatio,
      titleTop: Math.round(rect(".detail-heading h1").top),
      heroTop: Math.round(rect(".detail-hero-grid").top),
      heroHeight: Math.round(rect(".detail-hero-grid").height),
      globeFrame: rect(".detail-route-map")
        ? `${Math.round(rect(".detail-route-map").width)}x${Math.round(rect(".detail-route-map").height)}`
        : null,
      // The real WebGL drawing surface, not a wrapper.
      globeCanvas: rect(".detail-globe-frame canvas")
        ? `${Math.round(rect(".detail-globe-frame canvas").width)}x${Math.round(rect(".detail-globe-frame canvas").height)}`
        : null,
      sceneViewport: scene
        ? `${scene.viewport.width}x${scene.viewport.height}`
        : null,
      shelfTop: rect(".detail-metadata-shelf")
        ? Math.round(rect(".detail-metadata-shelf").top)
        : null,
      scrollHeight: document.documentElement.scrollHeight,
      verticalScroll: document.documentElement.scrollHeight > innerHeight,
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
      renderer: debug
        ? canvas.getParameter(debug.UNMASKED_RENDERER_WEBGL)
        : null,
    };
  });
  await page.screenshot({ path: `${out}/${label}-${name}.png` });
  await context.close();
  console.log(name, JSON.stringify(results[name]));
}
await browser.close();
await writeFile(`${out}/${label}.json`, JSON.stringify(results, null, 2));
