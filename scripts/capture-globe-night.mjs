import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { nightRegions } from "./lib/globe-night-regions.mjs";
import { nightPixels } from "./lib/globe-night-pixels.mjs";
const folder = "docs/visual-review/task-1b-5";
await mkdir(folder, { recursive: true });
const baseline = JSON.parse(
  await readFile("docs/visual-review/task-1b-4/manifest.json", "utf8"),
);
const regions = [
  ...nightRegions,
  { id: "visible-pacific", bounds: [150, 20, 155, 25], cores: [], dark: true },
];
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"],
});
const records = [],
  pixels = {};
try {
  for (const version of ["before", "after"]) {
    const origin = `http://127.0.0.1:${version === "before" ? 5174 : 5173}`;
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
      if (/^https?:/.test(r.url()) && !r.url().startsWith(origin))
        external.push(r.url());
    });
    await page.goto(origin);
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
    assert.deepEqual(passport, baseline.passport);
    await page.goto(origin + "/globe-lab");
    const host = page.locator(".globe-host");
    await page.locator(".globe-host[data-ready=true]").waitFor();
    const gpu = await page.locator(".globe-webgl").evaluate((c) => {
      const g = c.getContext("webgl2"),
        i = g.getExtension("WEBGL_debug_renderer_info");
      return {
        version: g.getParameter(g.VERSION),
        renderer: g.getParameter(i.UNMASKED_RENDERER_WEBGL),
      };
    });
    const earth = page.getByRole("checkbox", {
        name: "Earth only",
        exact: true,
      }),
      cities = page.getByRole("checkbox", { name: "City lights", exact: true });
    const read = async () => ({
      scene: JSON.parse(await host.getAttribute("data-scene")),
      lighting: JSON.parse(await host.getAttribute("data-lighting")),
    });
    const shot = async (name, clip) => {
      await page.mouse.move(0, 0);
      await page.evaluate(() => scrollTo(0, 0));
      const file = `${folder}/${name}.png`;
      await page.screenshot({ path: file, ...(clip ? { clip } : {}) });
      records.push({
        name: `${name}.png`,
        ...(await read()),
        browser: await browser.version(),
        gpu,
        sha256: createHash("sha256")
          .update(await readFile(file))
          .digest("hex"),
        clip,
        passport,
        errors,
        external,
      });
    };
    for (const theme of version === "before" ? ["dark"] : ["dark", "light"]) {
      await page
        .getByRole("button", {
          name: theme === "dark" ? "Dark" : "Light",
          exact: true,
        })
        .click();
      await earth.check();
      await page.waitForTimeout(150);
      const current = await read(),
        expected = baseline.records.find(
          (r) => r.name === `${theme}-earth-1440.png`,
        );
      assert.deepEqual(current.scene, expected.scene);
      assert.deepEqual(current.lighting, expected.lighting);
      const on = (await page.locator(".globe-webgl").screenshot()).toString(
        "base64",
      );
      if (version === "after") await shot(`${theme}-earth`);
      if (theme === "dark")
        await shot(`${version}-east-asia`, {
          x: 650,
          y: 310,
          width: 580,
          height: 370,
        });
      await cities.uncheck();
      await page.waitForTimeout(100);
      const off = (await page.locator(".globe-webgl").screenshot()).toString(
        "base64",
      );
      await cities.check();
      await earth.uncheck();
      await page.waitForTimeout(100);
      const routes = (await page.locator(".globe-webgl").screenshot()).toString(
        "base64",
      );
      if (version === "after" && theme === "dark") await shot("dark-routes");
      pixels[`${version}-${theme}`] = await page.evaluate(nightPixels, {
        on,
        off,
        routes,
        scene: current.scene,
        regions,
      });
    }
    if (version === "after") {
      await page.getByRole("button", { name: "Dark", exact: true }).click();
      await page.locator(".globe-stage").evaluate((el, size) => {
        el.style.width = `${size.width}px`;
        el.style.height = `${size.height}px`;
      }, passport);
      await page
        .getByRole("button", { name: "Fit recorded routes", exact: true })
        .click();
      await page.waitForTimeout(150);
      const current = await read(),
        expected = baseline.records.find(
          (r) => r.name === "dark-passport-size-1440.png",
        );
      assert.deepEqual(current.scene, expected.scene);
      assert.deepEqual(current.lighting, expected.lighting);
      await shot("dark-passport-size");
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    await page.close();
  }
  await writeFile(
    `${folder}/manifest.json`,
    JSON.stringify(
      {
        baselineCommit: "2720002ef01845aa1b04bb31fce6d619a54a30bf",
        baselineEarth: "../task-1b-4/dark-earth-1440.png",
        data: baseline.data,
        records,
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    `${folder}/display-pixels.json`,
    JSON.stringify({ regions, pixels }, null, 2) + "\n",
  );
  console.log(JSON.stringify({ screenshots: records.length, pixels }));
} finally {
  await browser.close();
}
