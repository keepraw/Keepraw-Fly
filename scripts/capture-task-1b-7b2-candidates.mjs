// Task 1B-7B2 camera candidates: control Home vs two alternates.
// All shots use approved 0.7/2.0/2.0 lighting, Fixed sun unchanged.
// Candidates applied via DEV-only globeReviewView (no default change).
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";

const BASE = process.env.GLOBE_LAB_URL ?? "http://127.0.0.1:5173/globe-lab";
const PREFIX = process.env.TASK_1B_7B2_PREFIX ?? "candidate";
const OUT_DIR = path.join(
  process.cwd(),
  "docs",
  "visual-review",
  "task-1b-7b2",
);
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined;

function spherePoint(lat, lon) {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return [
    Math.cos(la) * Math.cos(lo),
    Math.sin(la),
    -Math.cos(la) * Math.sin(lo),
  ];
}

// Control = current data-dependent Home (no override).
// B = Europe-to-Asia: Tibet/North India center, slightly farther to hold LHR/FRA + HND.
// C = Cinematic close Asia: South China center, tight crop on domestic triangle + night cities.
const CANDIDATES = {
  control: null,
  "B-europe-asia": {
    direction: spherePoint(30, 85),
    distance: 2.45,
    offset: { x: 0, y: -0.5 },
  },
  "C-close-asia": {
    direction: spherePoint(24, 112),
    distance: 1.75,
    offset: { x: 0, y: -0.45 },
  },
};

async function meta(page) {
  const lighting = JSON.parse(
    await page.locator(".globe-host").getAttribute("data-lighting"),
  );
  const sc = JSON.parse(
    await page.locator(".globe-host").getAttribute("data-scene"),
  );
  const camera = JSON.parse(
    await page.locator(".globe-host").getAttribute("data-camera"),
  );
  const solarMode = await page
    .locator(".globe-stage")
    .getAttribute("data-solar-mode");
  return { lighting, sc, camera, solarMode };
}
async function shoot(page, name) {
  const { lighting, sc, camera, solarMode } = await meta(page);
  const file = path.join(OUT_DIR, `${PREFIX}-${name}.png`);
  await page.locator(".globe-stage").screenshot({ path: file });
  const bytes = await readFile(file);
  return {
    file: `${PREFIX}-${name}.png`,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
    solarMode,
    theme: lighting.theme,
    sunDirection: lighting.sunDirection,
    lighting: {
      sunIntensity: lighting.sunIntensity,
      twilightWidth: lighting.twilightWidth,
      atmosphereIntensity: lighting.atmosphereIntensity,
      nightIntensity: lighting.nightIntensity,
    },
    camera,
    viewOffset: sc.viewOffset,
    viewport: sc.viewport,
    home: sc.home,
    atHome: sc.atHome,
    physicalRoutes: sc.physicalRoutes,
  };
}
async function flyTo(page, view) {
  await page
    .locator(".globe-host")
    .evaluate((host, v) => host.globeReviewView(v), view);
  await page.waitForTimeout(900);
}

const browser = await chromium.launch(executablePath ? { executablePath } : {});
const errors = [];
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
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(BASE);
  await page
    .locator(".globe-host[data-ready=true]")
    .waitFor({ timeout: 25000 });
  await page.waitForTimeout(500);
  await mkdir(OUT_DIR, { recursive: true });
  await page.getByRole("radio", { name: "Fixed", exact: true }).check();

  const records = [];
  for (const [key, view] of Object.entries(CANDIDATES)) {
    // Reset to Home first, then apply candidate (control stays Home).
    await page
      .getByRole("button", { name: "Fit recorded routes", exact: true })
      .click();
    await page.waitForTimeout(800);
    if (view) await flyTo(page, view);

    await page.getByRole("button", { name: "Dark", exact: true }).click();
    await page.waitForTimeout(500);
    records.push(await shoot(page, `${key}-fixed-dark`));

    await page.getByRole("button", { name: "Light", exact: true }).click();
    await page.waitForTimeout(500);
    records.push(await shoot(page, `${key}-fixed-light`));

    // Selected-route hierarchy from the same candidate viewpoint (real Demo SFO-HKG).
    await page.getByRole("button", { name: "Dark", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Route", exact: true })
      .selectOption("SFO-HKG");
    await page.waitForTimeout(900);
    if (view) await flyTo(page, view); // re-assert candidate framing, keep highlight
    await page.waitForTimeout(400);
    records.push(await shoot(page, `${key}-selected-SFO-HKG-dark`));
    await page
      .getByRole("combobox", { name: "Route", exact: true })
      .selectOption("");
    await page.waitForTimeout(400);
  }

  // Passport-size for each candidate (996x574 stage, Fixed Dark).
  await page.goto(BASE.replace(/\/globe-lab$/, "/"));
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await page.locator(".passport-archive-page .route-map-canvas").waitFor();
  const passport = await page
    .locator(".passport-archive-page .route-map")
    .evaluate((el) => ({
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height,
    }));
  await page.goto(BASE);
  await page
    .locator(".globe-host[data-ready=true]")
    .waitFor({ timeout: 25000 });
  await page.waitForTimeout(400);
  await page.getByRole("radio", { name: "Fixed", exact: true }).check();
  await page.locator(".globe-stage").evaluate((el, size) => {
    el.style.width = "996px";
    el.style.height = "574px";
  }, passport);
  await page.waitForTimeout(400);
  for (const [key, view] of Object.entries(CANDIDATES)) {
    await page
      .getByRole("button", { name: "Fit recorded routes", exact: true })
      .click();
    await page.waitForTimeout(800);
    if (view) await flyTo(page, view);
    await page.getByRole("button", { name: "Dark", exact: true }).click();
    await page.waitForTimeout(500);
    records.push(await shoot(page, `${key}-passport-dark`));
  }

  const manifest = {
    prefix: PREFIX,
    passport,
    candidates: Object.keys(CANDIDATES),
    records,
    errors,
  };
  await writeFile(
    path.join(OUT_DIR, `${PREFIX}-manifest.json`),
    JSON.stringify(manifest, null, 2),
  );
  console.log(JSON.stringify(manifest, null, 2));
  if (errors.length) throw new Error(errors.join("; "));
} finally {
  await browser.close();
}
