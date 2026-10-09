import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const phase = process.argv[2] || "before";
const url = process.argv[3] || "http://127.0.0.1:5173/globe-lab";
const backend = process.argv[4] || "chrome";
const folder = "docs/visual-review/task-1b-1";
await mkdir(folder, { recursive: true });
const browser = await chromium.launch(
  backend === "software"
    ? {}
    : {
        channel: "chrome",
        headless: true,
        args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"],
      },
);
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
  locale: "en-US",
});
await page.goto(url);
await page.locator(".globe-host[data-ready=true]").waitFor();
const records = [];
for (const theme of ["dark", "light"]) {
  await page
    .getByRole("button", {
      name: theme === "dark" ? "Dark" : "Light",
      exact: true,
    })
    .click();
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  const camera = await page.locator(".globe-host").getAttribute("data-camera");
  await page.screenshot({
    path: `${folder}/${phase}-${theme}-complete-1440.png`,
  });
  // The baseline predates Earth-only controls: preserve its complete view as-is.
  if (phase === "after") {
    await page
      .getByRole("checkbox", { name: "Earth only", exact: true })
      .check();
    await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `${folder}/${phase}-${theme}-earth-1440.png`,
    });
    await page
      .getByRole("checkbox", { name: "Earth only", exact: true })
      .uncheck();
  }
  records.push({
    theme,
    camera,
    metrics: await page
      .locator(".globe-host")
      .evaluate((el) => el.globeMetrics),
    lighting: await page.locator(".globe-host").getAttribute("data-lighting"),
  });
}
const gpu = await page.locator("canvas").evaluate((c) => {
  const g = c.getContext("webgl2");
  const x = g.getExtension("WEBGL_debug_renderer_info");
  return {
    renderer: x
      ? g.getParameter(x.UNMASKED_RENDERER_WEBGL)
      : g.getParameter(g.RENDERER),
    vendor: x
      ? g.getParameter(x.UNMASKED_VENDOR_WEBGL)
      : g.getParameter(g.VENDOR),
    maxTextureSize: g.getParameter(g.MAX_TEXTURE_SIZE),
  };
});
await page.getByRole("button", { name: "Dark", exact: true }).click();
if (phase === "after") {
  await page.getByRole("checkbox", { name: "Earth only", exact: true }).check();
  await page.locator("canvas").focus();
  for (let i = 0; i < 9; i++) await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${folder}/after-dark-rotated-1440.png` });
  records.push({
    view: "rotated",
    camera: await page.locator(".globe-host").getAttribute("data-camera"),
    lighting: await page.locator(".globe-host").getAttribute("data-lighting"),
  });
  await page
    .getByRole("button", { name: "Fit recorded routes", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Earth only", exact: true })
    .uncheck();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `${folder}/after-dark-review-controls.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${folder}/after-dark-complete-1280.png` });
  await page.setViewportSize({ width: 1440, height: 900 });
}
const cadence = await page.evaluate(async () => {
  const canvas = document.querySelector("canvas");
  let prior = 0;
  const intervals = [];
  for (let i = 0; i < 121; i++) {
    const now = await new Promise(requestAnimationFrame);
    if (prior) intervals.push(now - prior);
    prior = now;
    canvas.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
  }
  const sorted = [...intervals].sort((a, b) => a - b);
  const total = intervals.reduce((a, b) => a + b, 0);
  return {
    samples: intervals.length,
    totalMs: total,
    medianMs: sorted[60],
    p95Ms: sorted[114],
    observedRafHz: (intervals.length * 1000) / total,
  };
});
await writeFile(
  `${folder}/${phase}-measurements.json`,
  JSON.stringify(
    {
      phase,
      url,
      backend,
      baselineCommit: "04fb505",
      data: "Repository Demo archive; All years; 24 flights; 23 directed routes; 20 airports",
      viewport: { width: 1440, height: 900 },
      quality: 4096,
      devicePixelRatio: 1,
      gpu,
      records,
      cadence,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ phase, gpu, cadence, records }));
await browser.close();
