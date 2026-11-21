import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(repositoryRoot, "artifacts/neon-lab");
const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:5173";
const viewports = [
  { name: "3840x2160_dpr1", width: 3840, height: 2160, dpr: 1 },
  { name: "1920x1080_dpr2", width: 1920, height: 1080, dpr: 2 },
  { name: "1440x900_dpr1", width: 1440, height: 900, dpr: 1 },
  { name: "390x844_dpr3", width: 390, height: 844, dpr: 3 },
];

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const scenarios = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.dpr,
    });
    const page = await context.newPage();

    for (const density of ["sparse", "dense"]) {
      for (const state of ["normal", "hover", "selected"]) {
        const name = `world_${density}_${state}_${viewport.name}`;
        const record = await captureScenario({
          page,
          viewport,
          name,
          query: `sample=world&density=${density}&state=${state}`,
          selector: ".neon-sample-panel--world",
          mode: "element",
          measureWheel: true,
        });
        scenarios.push(record);
      }
    }

    for (const route of ["tpe-lax", "pvg-cdg"]) {
      const name = `detail_${route}_${viewport.name}`;
      scenarios.push(
        await captureScenario({
          page,
          viewport,
          name,
          query: `sample=detail&route=${route}`,
          selector: ".neon-detail-sample",
          mode: "element",
          measureWheel: true,
          wheelSourceQuery: "sample=world&density=sparse&state=normal",
        }),
      );
    }

    const passportName = `passport_${viewport.name}`;
    scenarios.push(
      await captureScenario({
        page,
        viewport,
        name: passportName,
        query: "sample=passport",
        selector: ".neon-passport-sample",
        mode: "page",
        measureWheel: true,
        wheelSourceQuery: "sample=world&density=sparse&state=normal",
      }),
    );
    if (viewport.name === "3840x2160_dpr1") {
      await page.waitForFunction(
        () => typeof window.__neonPassportExport === "function",
      );
      for (const scale of [1, 2]) {
        const dataUrl = await page.evaluate(
          (exportScale) => window.__neonPassportExport?.(exportScale) ?? null,
          scale,
        );
        if (!dataUrl)
          throw new Error(`Canvas export at scale ${scale} was unavailable.`);
        const outputPath = resolve(
          outputDirectory,
          `passport_export_${1080 * scale}x${1350 * scale}.png`,
        );
        await writeFile(
          outputPath,
          Buffer.from(dataUrl.split(",")[1], "base64"),
        );
      }
    }

    if (viewport.name === "1920x1080_dpr2") {
      await page.goto(scenarioUrl(`sample=world&density=sparse&state=normal`), {
        waitUntil: "domcontentloaded",
      });
      await page.locator('[data-neon-samples-ready="true"]').waitFor({
        state: "visible",
      });
      const map = page.locator(".neon-map-viewport > svg");
      await map.evaluate((svg) => {
        const bounds = svg.getBoundingClientRect();
        svg.dispatchEvent(
          new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            clientX: bounds.left + bounds.width / 2,
            clientY: bounds.top + bounds.height / 2,
            deltaY: -866,
          }),
        );
      });
      await page.waitForFunction(
        () =>
          Number(
            document
              .querySelector(".neon-map-viewport")
              ?.getAttribute("data-zoom"),
          ) >= 3.99,
      );
      const bounds = await map.boundingBox();
      if (!bounds) throw new Error("Could not measure the zoom-four map crop.");
      await page.screenshot({
        path: resolve(
          outputDirectory,
          "world_zoom4_moire_crop_1920x1080_dpr2.png",
        ),
        scale: "device",
        clip: {
          x: bounds.x + bounds.width * 0.25,
          y: bounds.y + bounds.height * 0.25,
          width: bounds.width * 0.5,
          height: bounds.height * 0.5,
        },
      });
    }

    await context.close();
  }

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    browser: "Playwright Chromium",
    viewports,
    scenarios,
  };
  await writeFile(
    resolve(outputDirectory, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(
    `Captured ${scenarios.length} scenarios and wrote ${resolve(outputDirectory, "report.json")}`,
  );
} finally {
  await browser.close();
}

async function captureScenario({
  page,
  viewport,
  name,
  query,
  selector,
  mode,
  measureWheel,
  wheelSourceQuery,
}) {
  const startedAt = performance.now();
  await page.goto(scenarioUrl(query), { waitUntil: "domcontentloaded" });
  await page.locator('[data-neon-samples-ready="true"]').waitFor({
    state: "visible",
    timeout: 120_000,
  });
  const renderMs = Number((performance.now() - startedAt).toFixed(2));
  await page.evaluate(() => document.fonts.ready.then(() => true));
  if (query.startsWith("sample=passport"))
    await page.locator(".neon-passport-canvas[data-ready='true']").waitFor();
  const outputPath = resolve(outputDirectory, `${name}.png`);
  if (mode === "page") {
    await page.screenshot({
      path: outputPath,
      fullPage: true,
      scale: "device",
    });
  } else {
    await page.locator(selector).screenshot({
      path: outputPath,
      scale: "device",
    });
  }
  const svgMetrics = await page.evaluate(() => ({
    svgNodeCount: document.querySelectorAll(".neon-aviation svg *").length,
    filterCount: document.querySelectorAll(".neon-aviation svg filter").length,
  }));
  let wheelZoom = null;
  if (measureWheel) {
    const wheelPage = wheelSourceQuery ? await page.context().newPage() : page;
    if (wheelSourceQuery) {
      await wheelPage.goto(scenarioUrl(wheelSourceQuery), {
        waitUntil: "domcontentloaded",
      });
      await wheelPage.locator('[data-neon-samples-ready="true"]').waitFor({
        state: "visible",
        timeout: 120_000,
      });
    }
    wheelZoom = await sampleWheelZoom(wheelPage);
    if (wheelSourceQuery) await wheelPage.close();
    if (!wheelZoom)
      throw new Error(`Wheel zoom sample was unavailable for ${name}.`);
  }
  return {
    name,
    query,
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.dpr,
    renderMs,
    ...svgMetrics,
    wheelZoom,
    wheelZoomSource: wheelSourceQuery ? "sparse normal world companion" : name,
    screenshot: outputPath,
  };
}

async function sampleWheelZoom(page) {
  return page.evaluate(
    () =>
      new Promise((resolveSample) => {
        const svg = document.querySelector(".neon-map-viewport > svg");
        if (!(svg instanceof SVGSVGElement)) {
          resolveSample(null);
          return;
        }
        const bounds = svg.getBoundingClientRect();
        const samples = [];
        const startedAt = performance.now();
        let previous = startedAt;
        let tick = 0;
        const wheelTimer = window.setInterval(() => {
          svg.dispatchEvent(
            new WheelEvent("wheel", {
              bubbles: true,
              cancelable: true,
              clientX: bounds.left + bounds.width / 2,
              clientY: bounds.top + bounds.height / 2,
              deltaY: tick++ % 2 ? 8 : -8,
            }),
          );
        }, 90);
        const measure = (timestamp) => {
          samples.push(timestamp - previous);
          previous = timestamp;
          if (timestamp - startedAt >= 3000) {
            window.clearInterval(wheelTimer);
            samples.sort((left, right) => left - right);
            resolveSample({
              sampleCount: samples.length,
              averageMs: Number(
                (
                  samples.reduce((sum, value) => sum + value, 0) /
                  samples.length
                ).toFixed(2),
              ),
              p95Ms: Number(
                samples[
                  Math.min(
                    samples.length - 1,
                    Math.ceil(samples.length * 0.95) - 1,
                  )
                ].toFixed(2),
              ),
            });
            return;
          }
          requestAnimationFrame(measure);
        };
        requestAnimationFrame(measure);
      }),
  );
}

function scenarioUrl(query) {
  const url = new URL("/neon-lab", baseUrl);
  url.search = query;
  return url.toString();
}
