// Captures Task 1B-7B first visual pass: Fixed/Realtime x Light/Dark + Passport-size.
// Controlled: same viewport/data/Home camera between before/after (except passport-size
// which uses its own recomputed Home for that aspect). No navigation between theme shots.
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";

const BASE = process.env.GLOBE_LAB_URL ?? "http://127.0.0.1:5173/globe-lab";
const PREFIX = process.env.TASK_1B_7B_PREFIX ?? "after";
const OUT_DIR = path.join(process.cwd(), "docs", "visual-review", "task-1b-7b");
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
  const solarMode = await page
    .locator(".globe-stage")
    .getAttribute("data-solar-mode");
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
    if (/^https?:/.test(url) && !url.startsWith("http://127.0.0.1:"))
      external.push(url);
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(BASE);
  await page.locator(".globe-host").waitFor({ state: "attached" });
  await page.locator(".globe-host").evaluate((el) =>
    el.hasAttribute("data-ready")
      ? true
      : new Promise((resolve) => {
          const obs = new MutationObserver(() =>
            el.hasAttribute("data-ready")
              ? (obs.disconnect(), resolve(true))
              : 0,
          );
          obs.observe(el, { attributes: true });
        }),
  );
  await page.waitForTimeout(600);
  await mkdir(OUT_DIR, { recursive: true });

  // Fixed is default. Order: Fixed/Dark -> Fixed/Light -> Realtime/Light -> Realtime/Dark.
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
      const raw = document
        .querySelector(".globe-host")
        ?.getAttribute("data-lighting");
      if (!raw) return false;
      const sun = JSON.parse(raw).sunDirection;
      return (
        Math.hypot(sun[0] - fixed[0], sun[1] - fixed[1], sun[2] - fixed[2]) >
        0.01
      );
    },
    fixedDark.sunDirection,
    { timeout: 10000 },
  );
  await page.waitForTimeout(500);
  const realtimeLight = await shoot(page, "realtime-light");

  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.waitForTimeout(500);
  const realtimeDark = await shoot(page, "realtime-dark");

  // Passport-size: measure official Desktop Passport map allocation, resize Lab stage.
  await page.goto(BASE.replace(/\/globe-lab$/, "/"));
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
  await page.goto(BASE);
  await page
    .locator(".globe-host[data-ready=true]")
    .waitFor({ timeout: 25000 });
  await page.waitForTimeout(400);
  await page.getByRole("radio", { name: "Fixed", exact: true }).check();
  await page.locator(".globe-stage").evaluate((el, size) => {
    el.style.width = `${size.width}px`;
    el.style.height = `${size.height}px`;
  }, passport);
  // Home recomputes for the new aspect on resize; Fit ensures the recorded home.
  await page
    .getByRole("button", { name: "Fit recorded routes", exact: true })
    .click();
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
    data: "Demo archive, all years (default filter), Home camera unmoved between Fixed/Realtime theme shots; passport-size uses its own aspect Home",
    passport,
    records: [
      fixedDark,
      fixedLight,
      realtimeLight,
      realtimeDark,
      passportDark,
      passportLight,
    ],
    errors,
    external,
  };
  await writeFile(
    path.join(OUT_DIR, `${PREFIX}-manifest.json`),
    JSON.stringify(manifest, null, 2),
  );
  console.log(JSON.stringify(manifest, null, 2));
  if (errors.length) throw new Error(`page errors: ${errors.join("; ")}`);
  if (external.length)
    throw new Error(`external requests: ${external.join("; ")}`);
} finally {
  await browser.close();
}
