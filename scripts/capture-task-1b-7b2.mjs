// Task 1B-7B2 baseline: approved Sun 0.7 / Night 2.0 / Atmosphere 2.0.
// Fixed Dark/Light, Real-time Dark/Light, Passport-size Dark/Light, plus
// selected-route states (real Demo data, no fabrication).
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";

const BASE = process.env.GLOBE_LAB_URL ?? "http://127.0.0.1:5173/globe-lab";
const PREFIX = process.env.TASK_1B_7B2_PREFIX ?? "baseline-approved";
const OUT_DIR = path.join(process.cwd(), "docs", "visual-review", "task-1b-7b2");
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined;

async function sun(page) {
  const raw = await page.locator(".globe-host").getAttribute("data-lighting");
  return JSON.parse(raw);
}
async function scene(page) {
  const raw = await page.locator(".globe-host").getAttribute("data-scene");
  return JSON.parse(raw);
}
async function shoot(page, name) {
  const lighting = await sun(page);
  const sc = await scene(page);
  const camera = await page.locator(".globe-host").getAttribute("data-camera");
  const solarMode = await page.locator(".globe-stage").getAttribute("data-solar-mode");
  const utc = new Date().toISOString();
  const file = path.join(OUT_DIR, `${PREFIX}-${name}.png`);
  await page.locator(".globe-stage").screenshot({ path: file });
  const bytes = await readFile(file);
  return {
    file: `${PREFIX}-${name}.png`,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
    solarMode,
    theme: lighting.theme,
    utc,
    sunDirection: lighting.sunDirection,
    exposure: lighting.exposure,
    lighting: {
      sunIntensity: lighting.sunIntensity,
      twilightWidth: lighting.twilightWidth,
      atmosphereIntensity: lighting.atmosphereIntensity,
      nightIntensity: lighting.nightIntensity,
      artDirection: lighting.artDirection,
    },
    selection: sc.selection ?? null,
    camera: JSON.parse(camera),
    sceneCamera: sc.camera,
    fov: sc.fov,
    viewOffset: sc.viewOffset,
    viewport: sc.viewport,
    home: sc.home,
    atHome: sc.atHome,
    physicalRoutes: sc.physicalRoutes,
  };
}

const browser = await chromium.launch(executablePath ? { executablePath } : {});
const errors = [];
const external = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: "en-US",
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("request", (r) => {
    const url = r.url();
    if (/^https?:/.test(url) && !url.startsWith("http://127.0.0.1:")) external.push(url);
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(BASE);
  await page.locator(".globe-host").waitFor({ state: "attached" });
  await page.locator(".globe-host").evaluate((el) =>
    el.hasAttribute("data-ready")
      ? true
      : new Promise((resolve) => {
          const obs = new MutationObserver(() =>
            el.hasAttribute("data-ready") ? (obs.disconnect(), resolve(true)) : 0,
          );
          obs.observe(el, { attributes: true });
        }),
  );
  await page.waitForTimeout(600);
  await mkdir(OUT_DIR, { recursive: true });

  const lighting0 = await sun(page);
  console.log("initial lighting", JSON.stringify(lighting0));

  await page.getByRole("radio", { name: "Fixed", exact: true }).check();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.waitForTimeout(500);
  const fixedDark = await shoot(page, "fixed-dark");

  await page.getByRole("button", { name: "Light", exact: true }).click();
  await page.waitForTimeout(500);
  const fixedLight = await shoot(page, "fixed-light");

  await page.getByRole("radio", { name: "Real-time", exact: true }).check();
  await page.waitForFunction(
    (fixed) => {
      const raw = document.querySelector(".globe-host")?.getAttribute("data-lighting");
      if (!raw) return false;
      const s = JSON.parse(raw).sunDirection;
      return Math.hypot(s[0] - fixed[0], s[1] - fixed[1], s[2] - fixed[2]) > 0.01;
    },
    fixedDark.sunDirection,
    { timeout: 10000 },
  );
  await page.waitForTimeout(500);
  const realtimeLight = await shoot(page, "realtime-light");

  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.waitForTimeout(500);
  const realtimeDark = await shoot(page, "realtime-dark");

  // Back to Fixed for selected-route states (deterministic sun).
  await page.getByRole("radio", { name: "Fixed", exact: true }).check();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.waitForTimeout(300);
  // Compelling long-haul focal point from real Demo data.
  await page.getByRole("combobox", { name: "Route", exact: true }).selectOption("SFO-HKG");
  await page.waitForTimeout(900);
  const selectedDark = await shoot(page, "selected-SFO-HKG-dark");
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await page.waitForTimeout(500);
  const selectedLight = await shoot(page, "selected-SFO-HKG-light");
  // Short domestic focal point closest to concept's SZX-TAO shape (real data).
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.getByRole("combobox", { name: "Route", exact: true }).selectOption("PEK-PVG");
  await page.waitForTimeout(900);
  const selectedPekPvgDark = await shoot(page, "selected-PEK-PVG-dark");

  // Reset selection via All filter (clears selection? use empty route choice).
  await page.getByRole("combobox", { name: "Route", exact: true }).selectOption("");
  await page.waitForTimeout(400);

  // Passport-size allocation from official Desktop Passport.
  await page.goto(BASE.replace(/\/globe-lab$/, "/"));
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await page.locator(".passport-archive-page .route-map-canvas").waitFor();
  const passport = await page.locator(".passport-archive-page .route-map").evaluate((el) => ({
    width: el.getBoundingClientRect().width,
    height: el.getBoundingClientRect().height,
    clientWidth: el.querySelector(".route-map-canvas").clientWidth,
    clientHeight: el.querySelector(".route-map-canvas").clientHeight,
  }));
  await page.goto(BASE);
  await page.locator(".globe-host[data-ready=true]").waitFor({ timeout: 25000 });
  await page.waitForTimeout(400);
  await page.getByRole("radio", { name: "Fixed", exact: true }).check();
  await page.locator(".globe-stage").evaluate((el, size) => {
    el.style.width = `${size.width}px`;
    el.style.height = `${size.height}px`;
  }, passport);
  await page.getByRole("button", { name: "Fit recorded routes", exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.waitForTimeout(500);
  const passportDark = await shoot(page, "passport-dark");
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await page.waitForTimeout(500);
  const passportLight = await shoot(page, "passport-light");

  const manifest = {
    prefix: PREFIX,
    base: BASE,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    data: "Demo archive, all years (default filter), Home unmoved between Fixed/Realtime theme shots; passport-size uses its own aspect Home; selected states use real Demo routes only",
    passport,
    records: [fixedDark, fixedLight, realtimeLight, realtimeDark, selectedDark, selectedLight, selectedPekPvgDark, passportDark, passportLight],
    errors,
    external,
  };
  await writeFile(path.join(OUT_DIR, `${PREFIX}-manifest.json`), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
  if (errors.length) throw new Error(`page errors: ${errors.join("; ")}`);
  if (external.length) throw new Error(`external requests: ${external.join("; ")}`);
} finally {
  await browser.close();
}
