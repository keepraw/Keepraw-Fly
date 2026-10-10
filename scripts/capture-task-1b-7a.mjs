// Captures Task 1B-7A deliverable screenshots: Fixed/Realtime x Light/Dark.
// Same viewport, same Demo data, same Home camera (no navigation between shots).
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.env.GLOBE_LAB_URL ?? "http://127.0.0.1:5173/globe-lab";
const OUT_DIR = path.join(process.cwd(), "docs", "visual-review", "task-1b-7a");
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
  await page.locator(".globe-stage").screenshot({
    path: path.join(OUT_DIR, `${name}.png`),
  });
  return {
    name: `${name}.png`,
    solarMode,
    theme: lighting.theme,
    utc,
    sunDirection: lighting.sunDirection,
    camera: JSON.parse(camera),
    sceneCamera: sc.camera,
    viewport: sc.viewport,
    physicalRoutes: sc.physicalRoutes,
  };
}

const browser = await chromium.launch(executablePath ? { executablePath } : {});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: "en-US",
});
const page = await context.newPage();
await page.emulateMedia({ reducedMotion: "reduce" });
await page.goto(BASE.replace(/\/globe-lab$/, "/globe-lab"));
await page.locator(".globe-host").waitFor({
  state: "attached",
});
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

// Fixed is default. Lock order: Fixed/Dark -> Fixed/Light -> Realtime/Light -> Realtime/Dark.
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
      Math.hypot(sun[0] - fixed[0], sun[1] - fixed[1], sun[2] - fixed[2]) > 0.01
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

const manifest = {
  baseCommit: "6df4ae08cc29c6217148bd40d7459cc8ce2ca651",
  viewport: { width: 1440, height: 900 },
  data: "Demo archive, all years (default filter), Home camera unmoved between shots",
  records: [fixedDark, fixedLight, realtimeLight, realtimeDark],
};
await writeFile(
  path.join(OUT_DIR, "manifest.json"),
  JSON.stringify(manifest, null, 2),
);
console.log(JSON.stringify(manifest, null, 2));
await browser.close();
