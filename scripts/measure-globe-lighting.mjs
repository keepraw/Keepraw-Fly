import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const [url, output, backend = "chrome"] = process.argv.slice(2);
if (!url || !output)
  throw new Error(
    "Usage: node scripts/measure-globe-lighting.mjs URL OUTPUT [chrome|software]",
  );
const launchOptions =
  backend === "software"
    ? {}
    : {
        channel: "chrome",
        headless: true,
        args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"],
      };
const browser = await chromium.launch(launchOptions);
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    reducedMotion: "reduce",
  });
  await page.goto(url);
  await page.locator(".globe-host[data-ready=true]").waitFor();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  const gpu = await page.locator("canvas").evaluate((canvas) => {
    const gl = canvas.getContext("webgl2");
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      renderer: ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
      vendor: ext
        ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)
        : gl.getParameter(gl.VENDOR),
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    };
  });
  const measurements = [];
  for (const quality of ["4096", "2048"]) {
    await page
      .getByRole("combobox", { name: "Texture", exact: true })
      .selectOption(quality);
    await page.waitForFunction(
      (size) =>
        document.querySelector(".globe-host")?.globeMetrics?.textureSize ===
          size &&
        document.querySelector(".globe-host")?.dataset.ready === "true",
      Number(quality),
    );
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(300);
    const initial = await page
      .locator(".globe-host")
      .evaluate((el) => JSON.parse(JSON.stringify(el.globeMetrics)));
    const cadence = await page.locator("canvas").evaluate(async (canvas) => {
      const samples = [];
      // Warm the driver, then measure exactly 120 rendered-frame intervals.
      let previous;
      for (let i = 0; i < 151; i++) {
        const now = await new Promise(requestAnimationFrame);
        if (i > 30) samples.push(now - previous);
        previous = now;
        canvas.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
        );
      }
      const sorted = [...samples].sort((a, b) => a - b);
      const total = samples.reduce((a, b) => a + b, 0);
      return {
        samples: samples.length,
        totalMs: total,
        medianMs: sorted[60],
        p95Ms: sorted[114],
        observedRafHz: (samples.length * 1000) / total,
      };
    });
    // Drain the final scheduled render before measuring idle work.
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    const frames = await page
      .locator(".globe-host")
      .evaluate((el) => el.globeMetrics.frames);
    await page.waitForTimeout(300);
    const idleFrames = await page
      .locator(".globe-host")
      .evaluate((el, count) => el.globeMetrics.frames - count, frames);
    measurements.push({
      quality: Number(quality),
      initial,
      cadence,
      idleFramesAfter300ms: idleFrames,
      lighting: await page.locator(".globe-host").getAttribute("data-lighting"),
    });
  }
  const data = {
    url,
    backend,
    launchOptions,
    gpu,
    viewport: { width: 1440, height: 900 },
    devicePixelRatio: 1,
    data: "Repository Demo; all years; 24 flights; no selection; complete globe",
    measurements,
    note: "RAF cadence includes browser/driver work; engine lastFrameMs is JS submission time, not GPU timing. Observed Hz is not a native display FPS counter.",
  };
  await writeFile(output, JSON.stringify(data, null, 2) + "\n");
  console.log(JSON.stringify(data));
} finally {
  await browser.close();
}
