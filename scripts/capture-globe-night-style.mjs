import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { nightStylePixels } from "./lib/globe-night-style-pixels.mjs";
import { nightPixels } from "./lib/globe-night-pixels.mjs";
const folder = "docs/visual-review/task-1b-6";
await mkdir(folder, { recursive: true });
await mkdir("artifacts/task-1b-6", { recursive: true });
const baseline = JSON.parse(
  await readFile("docs/visual-review/task-1b-5/manifest.json", "utf8"),
);
const regions = JSON.parse(
  await readFile("docs/visual-review/task-1b-5/display-pixels.json", "utf8"),
).regions;
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"],
});
const records = [],
  diagnostics = {},
  invariants = {};
let previousSurface, previousLight;
const sha = (b) => createHash("sha256").update(b).digest("hex");
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
    await page.goto(origin + "/globe-lab");
    await page.locator(".globe-host[data-ready=true]").waitFor();
    const host = page.locator(".globe-host"),
      canvas = page.locator(".globe-webgl"),
      cb = (n) => page.getByRole("checkbox", { name: n, exact: true });
    const read = async () => ({
      scene: JSON.parse(await host.getAttribute("data-scene")),
      lighting: JSON.parse(await host.getAttribute("data-lighting")),
    });
    const gpu = await canvas.evaluate((c) => {
      const g = c.getContext("webgl2"),
        i = g.getExtension("WEBGL_debug_renderer_info");
      return {
        version: g.getParameter(g.VERSION),
        renderer: g.getParameter(i.UNMASKED_RENDERER_WEBGL),
      };
    });
    await page.getByRole("button", { name: "Dark", exact: true }).click();
    await cb("Earth only").check();
    const initial = await read(),
      expected = baseline.records.find((r) => r.name === "dark-earth.png");
    assert.deepEqual(initial, {
      scene: expected.scene,
      lighting: expected.lighting,
    });
    const exclusions = await page
      .locator(".globe-caption,.globe-controls,.globe-twilight-review")
      .evaluateAll((els) => {
        const c = document
          .querySelector(".globe-webgl")
          .getBoundingClientRect();
        return els.map((el) => {
          const r = el.getBoundingClientRect();
          return {
            x: r.x - c.x - 3,
            y: r.y - c.y - 3,
            width: r.width + 6,
            height: r.height + 6,
          };
        });
      });
    const clip = { x: 650, y: 310, width: 580, height: 370 },
      layers = {};
    async function frame(name, save, full = false) {
      await page.mouse.move(0, 0);
      await page.evaluate(() => scrollTo(0, 0));
      const buffer = await canvas.screenshot();
      layers[name] = buffer.toString("base64");
      if (save) {
        const file = `${folder}/${version}-${name}.png`;
        const product = await page.screenshot({
          path: file,
          ...(full ? {} : { clip }),
        });
        records.push({
          name: `${version}-${name}.png`,
          ...(await read()),
          clip: full ? undefined : clip,
          sha256: sha(product),
        });
      }
      assert.deepEqual((await read()).scene, initial.scene);
      return buffer;
    }
    await cb("City lights").uncheck();
    await cb("Atmosphere").uncheck();
    const surface = await frame("surface", version === "after");
    if (version === "before") previousSurface = surface;
    else {
      invariants.surfaceIdentical = sha(surface) === sha(previousSurface);
      assert.ok(invariants.surfaceIdentical);
    }
    await cb("City lights").check();
    await cb("Day surface").uncheck();
    await frame("emission", true);
    diagnostics[version] = {
      emission: await page.evaluate(nightStylePixels, {
        image: layers.emission,
        scene: initial.scene,
        exclusions,
      }),
      exclusions,
    };
    await cb("Day surface").check();
    await cb("Atmosphere").check();
    await frame("combined", version === "after");
    if (version === "before") {
      const old = await page.screenshot({ clip });
      invariants.baselineClipMatches =
        sha(old) ===
        baseline.records.find((r) => r.name === "after-east-asia.png").sha256;
      assert.ok(invariants.baselineClipMatches);
    }
    await cb("City lights").uncheck();
    await frame("without-cities", false);
    await cb("City lights").check();
    await cb("Earth only").uncheck();
    await frame("routes", version === "after", true);
    diagnostics[version].geography = await page.evaluate(nightPixels, {
      on: layers.combined,
      off: layers["without-cities"],
      routes: layers.routes,
      scene: initial.scene,
      regions,
    });
    await page.getByRole("button", { name: "Light", exact: true }).click();
    await cb("Earth only").check();
    const light = await frame("light", false);
    if (version === "before") previousLight = light;
    else {
      invariants.lightIdentical = sha(light) === sha(previousLight);
      assert.ok(invariants.lightIdentical);
    }
    // 2K is exercised without adding another review PNG.
    if (version === "after") {
      await page.getByRole("button", { name: "Dark", exact: true }).click();
      await page
        .getByRole("combobox", { name: "Texture", exact: true })
        .selectOption("2048");
      await page.waitForFunction(
        () =>
          document.querySelector(".globe-host")?.globeMetrics?.textureSize ===
            2048 &&
          document.querySelector(".globe-host")?.dataset.ready === "true",
      );
      await cb("Day surface").uncheck();
      await cb("Atmosphere").uncheck();
      const image = (await canvas.screenshot()).toString("base64");
      diagnostics.after.emission2K = await page.evaluate(nightStylePixels, {
        image,
        scene: (await read()).scene,
        exclusions,
      });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    records.push({
      version,
      browser: await browser.version(),
      gpu,
      errors,
      external,
    });
    await page.close();
  }
  await writeFile(
    `${folder}/manifest.json`,
    JSON.stringify(
      {
        baselineCommit: "280f29c443e8728bb4de1c34ba978c8e7ac73ab7",
        baselineCombined: "../task-1b-5/after-east-asia.png",
        baselineRoutes: "../task-1b-5/dark-routes.png",
        data: baseline.data,
        invariants,
        records,
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    `${folder}/display-diagnostics.json`,
    JSON.stringify({ invariants, diagnostics }, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      invariants,
      emissionBefore: diagnostics.before.emission,
      emissionAfter: diagnostics.after.emission,
    }),
  );
} finally {
  await browser.close();
}
