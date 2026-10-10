import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const [phase = "after", url = "http://127.0.0.1:5173/globe-lab"] =
  process.argv.slice(2);
const folder = "docs/visual-review/task-1b-3";
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
  const records = [],
    errors = [],
    externalRequests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      !r.url().startsWith("http://127.0.0.1:5173")
    )
      externalRequests.push(r.url());
  });
  // Measure the existing formal map, including its border separately. No Passport edits.
  await page.goto(new URL("/", url).href);
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await page.locator(".passport-archive-page .route-map-canvas").waitFor();
  const passport = await page
    .locator(".passport-archive-page .route-map")
    .evaluate((el) => {
      const canvas = el.querySelector(".route-map-canvas"),
        style = getComputedStyle(el);
      return {
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
        canvasWidth: canvas.clientWidth,
        canvasHeight: canvas.clientHeight,
        border: [style.borderLeftWidth, style.borderTopWidth],
        provenance:
          "Live Desktop Passport .route-map/.route-map-canvas at 1440x900; passport-desktop.css and passport.css grid allocation",
      };
    });
  const load = async () => {
    await page.goto(url);
    await page.locator(".globe-host[data-ready=true]").waitFor();
    await page.getByRole("button", { name: "Dark", exact: true }).click();
    await page.mouse.move(0, 0);
  };
  const direction = page.getByRole("combobox", {
    name: "Art Direction",
    exact: true,
  });
  const earth = page.getByRole("checkbox", { name: "Earth only", exact: true });
  const baseline =
    phase === "after"
      ? JSON.parse(await readFile(`${folder}/before-scenes.json`, "utf8"))
      : null;
  async function shot(name, mode, candidate, view, selected = null) {
    await page.evaluate(() => scrollTo(0, 0));
    await page.mouse.move(0, 0);
    await page.waitForTimeout(250);
    const scene = JSON.parse(
      await page.locator(".globe-host").getAttribute("data-scene"),
    );
    const lighting = JSON.parse(
      await page.locator(".globe-host").getAttribute("data-lighting"),
    );
    const key = `${mode}-${view}-${page.viewportSize().width}`;
    if (baseline) {
      const reference = baseline.records.find((r) => r.key === key);
      assert(reference, `Missing baseline ${key}`);
      assert.deepEqual(
        scene,
        reference.scene,
        `Camera/geometry changed: ${key}`,
      );
      assert.deepEqual(
        lighting.sunDirection,
        reference.lighting.sunDirection,
        `Sun changed: ${key}`,
      );
      assert.equal(lighting.exposure, reference.lighting.exposure);
    }
    const path = `${folder}/${name}.png`;
    await page.screenshot({ path });
    records.push({
      name,
      key,
      mode,
      candidate,
      view,
      selected,
      viewport: page.viewportSize(),
      scene,
      lighting,
      flights: await page.locator(".globe-flight-list .flight-row").count(),
      visibleLabels: await page
        .locator(".globe-airport-label:visible")
        .allTextContents(),
      sha256: createHash("sha256")
        .update(await readFile(path))
        .digest("hex"),
    });
  }
  await load();
  for (const candidate of phase === "before" ? ["before"] : ["A", "B"]) {
    if (candidate !== "before") await direction.selectOption(candidate);
    for (const mode of ["dark", "light"]) {
      await page
        .getByRole("button", {
          name: mode === "dark" ? "Dark" : "Light",
          exact: true,
        })
        .click();
      await shot(
        `${candidate.toLowerCase()}-${mode}-default-1440`,
        mode,
        candidate,
        "default",
      );
      await earth.check();
      await shot(
        `${candidate.toLowerCase()}-${mode}-earth-1440`,
        mode,
        candidate,
        "earth",
      );
      await earth.uncheck();
    }
  }
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Route", exact: true })
    .selectOption("PEK-PVG");
  for (const candidate of phase === "before" ? ["before"] : ["A", "B"]) {
    if (candidate !== "before") await direction.selectOption(candidate);
    await shot(
      `${candidate.toLowerCase()}-dark-selected-1440`,
      "dark",
      candidate,
      "selected",
      "PEK-PVG",
    );
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await load();
  for (const candidate of phase === "before" ? ["before"] : ["A", "B"]) {
    if (candidate !== "before") await direction.selectOption(candidate);
    await shot(
      `${candidate.toLowerCase()}-dark-default-1280`,
      "dark",
      candidate,
      "default",
    );
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await load();
  // Resize only the Lab stage to the measured formal map's exact outer size.
  await page.locator(".globe-stage").evaluate((el, size) => {
    el.style.width = `${size.width}px`;
    el.style.height = `${size.height}px`;
  }, passport);
  for (const candidate of phase === "before" ? ["before"] : ["A", "B"]) {
    if (candidate !== "before") await direction.selectOption(candidate);
    for (const mode of ["dark", "light"]) {
      await page
        .getByRole("button", {
          name: mode === "dark" ? "Dark" : "Light",
          exact: true,
        })
        .click();
      await shot(
        `${candidate.toLowerCase()}-${mode}-passport-size-1440`,
        mode,
        candidate,
        "passport-size",
      );
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, []);
  await writeFile(
    `${folder}/${phase}-scenes.json`,
    JSON.stringify(
      {
        phase,
        baselineCommit: "b9d32b3be9b6791a5a2861846d220c96ca0d59f0",
        url,
        data: "Unmodified Demo; all years; 24 flights; 23 directed routes; 22 physical strokes; 20 airports; 4K; DPR 1",
        browser: await browser.version(),
        launch: "Chrome / ANGLE D3D11",
        passport,
        errors,
        externalRequests,
        records,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({
      phase,
      passport,
      screenshots: records.length,
      errors,
      externalRequests,
    }),
  );
} finally {
  await browser.close();
}
