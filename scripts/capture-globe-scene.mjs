import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const [phase = "before", url = "http://127.0.0.1:5173/globe-lab"] =
  process.argv.slice(2);
const folder = "docs/visual-review/task-1b-2";
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
  const records = [];
  async function shot(name) {
    await page.waitForTimeout(350);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `${folder}/${phase}-${name}.png` });
    records.push({
      name,
      viewport: page.viewportSize(),
      camera: await page.locator(".globe-host").getAttribute("data-camera"),
      scene: await page.locator(".globe-host").getAttribute("data-scene"),
      baselineProjection:
        phase === "before"
          ? {
              provenance:
                "B1 source: PerspectiveCamera 34deg; Home offset (0,-.16), selected offset (0,0). Camera measured from browser.",
              fov: 34,
              viewOffset: {
                x: 0,
                y:
                  name.includes("default") || name.includes("earth")
                    ? -0.16
                    : 0,
              },
              viewport: await page.locator(".globe-host").evaluate((el) => ({
                width: el.clientWidth,
                height: el.clientHeight,
              })),
            }
          : undefined,
      lighting: await page.locator(".globe-host").getAttribute("data-lighting"),
      routes: await page
        .getByRole("combobox", { name: "Route", exact: true })
        .locator("option")
        .allTextContents(),
      flights: await page.locator(".globe-flight-list .flight-row").count(),
      visibleLabels: await page
        .locator(".globe-airport-label:visible")
        .allTextContents(),
    });
  }
  await page.goto(url);
  await page.locator(".globe-host[data-ready=true]").waitFor();
  for (const theme of ["Dark", "Light"]) {
    await page.getByRole("button", { name: theme, exact: true }).click();
    await shot(`${theme.toLowerCase()}-default-1440`);
    await page
      .getByRole("checkbox", { name: "Earth only", exact: true })
      .check();
    await shot(`${theme.toLowerCase()}-earth-1440`);
    await page
      .getByRole("checkbox", { name: "Earth only", exact: true })
      .uncheck();
  }
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Airport", exact: true })
    .selectOption("PVG");
  await shot("dark-asia-1440");
  await page
    .getByRole("combobox", { name: "Airport", exact: true })
    .selectOption("SFO");
  await shot("dark-north-america-1440");
  await page
    .getByRole("combobox", { name: "Route", exact: true })
    .selectOption("NRT-DFW");
  await shot("dark-selected-long-haul-1440");
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(url);
  await page.locator(".globe-host[data-ready=true]").waitFor();
  for (const theme of ["Dark", "Light"]) {
    await page.getByRole("button", { name: theme, exact: true }).click();
    await shot(`${theme.toLowerCase()}-default-1280`);
  }
  if (phase === "after") {
    const before = JSON.parse(
      await readFile(`${folder}/before-scenes.json`, "utf8"),
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url);
    await page.locator(".globe-host[data-ready=true]").waitFor();
    const lock = async (name) => {
      const record = before.records.find((r) => r.name === name),
        camera = JSON.parse(record.camera),
        distance = Math.hypot(...camera);
      await page
        .locator(".globe-host")
        .evaluate((host, view) => host.globeReviewView(view), {
          direction: camera.map((n) => n / distance),
          distance,
          offset: record.baselineProjection.viewOffset,
        });
    };
    await lock("dark-default-1440");
    for (const theme of ["Dark", "Light"]) {
      await page.getByRole("button", { name: theme, exact: true }).click();
      await shot(`${theme.toLowerCase()}-fixed-b1-default-1440`);
      await page
        .getByRole("checkbox", { name: "Earth only", exact: true })
        .check();
      await shot(`${theme.toLowerCase()}-fixed-b1-earth-1440`);
      await page
        .getByRole("checkbox", { name: "Earth only", exact: true })
        .uncheck();
    }
    await page.getByRole("button", { name: "Dark", exact: true }).click();
    for (const [code, name] of [
      ["PVG", "asia"],
      ["SFO", "north-america"],
    ]) {
      await page
        .getByRole("combobox", { name: "Airport", exact: true })
        .selectOption(code);
      await lock(`dark-${name}-1440`);
      await shot(`dark-fixed-b1-${name}-1440`);
    }
  }
  await writeFile(
    `${folder}/${phase}-scenes.json`,
    JSON.stringify(
      {
        phase,
        url,
        baselineCommit: "45f92e9c78a118417803dc7f43f027a821f95c65",
        data: "Unmodified Demo, all years; 24 flights; 23 directed routes; 20 airports. Regional views select existing PVG/SFO airports, retain all routes.",
        records,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      phase,
      records: records.map(({ name, camera, visibleLabels }) => ({
        name,
        camera,
        visibleLabels,
      })),
    }),
  );
} finally {
  await browser.close();
}
