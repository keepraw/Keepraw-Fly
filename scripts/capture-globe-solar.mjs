import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const folder = "docs/visual-review/task-1b-4";
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    reducedMotion: "reduce",
  });
  const errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      !r.url().startsWith("http://127.0.0.1:5173")
    )
      external.push(r.url());
  });
  await page.goto("http://127.0.0.1:5173/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await page.locator(".passport-archive-page .route-map-canvas").waitFor();
  const passport = await page
    .locator(".passport-archive-page .route-map")
    .evaluate((el) => ({
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height,
      clientWidth: el.querySelector(".route-map-canvas").clientWidth,
      clientHeight: el.querySelector(".route-map-canvas").clientHeight,
    }));
  await page.goto("http://127.0.0.1:5173/globe-lab");
  const host = page.locator(".globe-host");
  await page.locator(".globe-host[data-ready=true]").waitFor();
  const earth = page.getByRole("checkbox", { name: "Earth only", exact: true });
  const diagnostic = page.getByRole("checkbox", {
    name: "Solar regions (diagnostic)",
    exact: true,
  });
  const read = async () => ({
    scene: JSON.parse(await host.getAttribute("data-scene")),
    lighting: JSON.parse(await host.getAttribute("data-lighting")),
  });
  const old = JSON.parse(
    await readFile("docs/visual-review/task-1b-3/after-scenes.json", "utf8"),
  );
  const gpu = await page.locator(".globe-webgl").evaluate((canvas) => {
    const gl = canvas.getContext("webgl2"),
      info = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      version: gl.getParameter(gl.VERSION),
      renderer: info
        ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
    };
  });
  const records = [];
  async function pair(view, referenceKey) {
    let reference;
    for (const theme of ["light", "dark"]) {
      await page
        .getByRole("button", {
          name: theme === "light" ? "Light" : "Dark",
          exact: true,
        })
        .click();
      await page.mouse.move(0, 0);
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(150);
      const current = await read();
      if (reference) {
        assert.deepEqual(current.scene, reference.scene);
        assert.deepEqual(
          current.lighting.sunDirection,
          reference.lighting.sunDirection,
        );
      } else reference = current;
      if (referenceKey) {
        const before = old.records.find(
          (r) =>
            r.candidate === "A" &&
            r.mode === theme &&
            r.view === referenceKey &&
            r.viewport.width === 1440,
        );
        assert.deepEqual(current.scene, before.scene);
        assert.deepEqual(
          current.lighting.sunDirection,
          before.lighting.sunDirection,
        );
      }
      const name = `${theme}-${view}-1440.png`,
        file = `${folder}/${name}`;
      await page.screenshot({ path: file });
      records.push({
        name,
        ...current,
        flights: await page.locator(".globe-flight-list .flight-row").count(),
        sha256: createHash("sha256")
          .update(await readFile(file))
          .digest("hex"),
      });
    }
  }
  await earth.check();
  await pair("earth", "earth");
  await earth.uncheck();
  await pair("default", "default");
  await earth.check();
  await page
    .getByRole("button", { name: "Twilight Review", exact: true })
    .click();
  await pair("twilight");
  await diagnostic.check();
  await pair("solar-diagnostic");
  await diagnostic.uncheck();
  await earth.uncheck();
  await page.locator(".globe-stage").evaluate((el, size) => {
    el.style.width = `${size.width}px`;
    el.style.height = `${size.height}px`;
  }, passport);
  await page
    .getByRole("button", { name: "Fit recorded routes", exact: true })
    .click();
  await pair("passport-size", "passport-size");
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  await writeFile(
    `${folder}/manifest.json`,
    JSON.stringify(
      {
        baselineCommit: "38c61266915edc1252769c305623d56a1ffb563e",
        browser: await browser.version(),
        gpu,
        launch: "Chrome / ANGLE D3D11",
        data: "Unmodified Demo, all years, 24 flights, 23 directed routes, 22 physical strokes, 20 airports, 4K, DPR1",
        passport,
        records,
        errors,
        external,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({ screenshots: records.length, passport, errors, external }),
  );
} finally {
  await browser.close();
}
