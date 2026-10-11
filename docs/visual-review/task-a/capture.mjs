import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const phase = process.argv[2];
if (!["before", "after"].includes(phase))
  throw new Error("Use before or after");
const sourceVersion = execFileSync("git", ["rev-parse", "HEAD"])
  .toString()
  .trim();
if (
  phase === "before" &&
  sourceVersion !== "802c5d510d1e4c96633a4259e58fccb0fb83522b"
)
  throw new Error("Capture before only from Task A's recorded main baseline.");
execFileSync("git", ["diff", "--quiet", "HEAD", "--", "apps/web/src"]);
const origin = process.env.TASK_A_CAPTURE_ORIGIN ?? "http://127.0.0.1:5173";
const directory = `${process.env.TASK_A_CAPTURE_OUTPUT ?? "docs/visual-review/task-a"}/${phase}`;
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const records = [];
try {
  for (const width of [390, 1440]) {
    for (const theme of ["light", "dark"]) {
      const page = await browser.newPage({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        deviceScaleFactor: 1,
      });
      await page.clock.setFixedTime(new Date("2026-10-11T12:00:00Z"));
      await page.emulateMedia({
        reducedMotion: "reduce",
        colorScheme: "light",
      });
      await page.goto(`${origin}/`);
      await page.getByRole("button", { name: "Try demo", exact: true }).click();
      await expect(page.locator(".flight-row")).toHaveCount(24);
      await page.goto(`${origin}/#settings`);
      await page
        .getByRole("combobox", { name: "Appearance", exact: true })
        .selectOption(theme);
      for (const name of ["passport", "detail", "settings", "clear-dialog"]) {
        if (name === "passport") {
          await page.goto(`${origin}/#passport`);
          if (width > 760) {
            await expect(
              page.locator(".globe-webgl, .route-map-canvas > svg"),
            ).toBeVisible({ timeout: 30000 });
            if (await page.locator(".globe-webgl").count()) {
              await expect
                .poll(() =>
                  page.locator(".globe-host").getAttribute("data-scene"),
                )
                .not.toBeNull();
              await expect(page.locator(".globe-host")).toHaveAttribute(
                "data-ready",
                "true",
              );
            } else {
              await expect(
                page.locator(".map-relief-texture:visible"),
              ).toHaveCount(1);
            }
          }
        } else if (name === "detail") {
          await page.locator(".flight-row").first().click();
          await expect(page.locator(".detail-page")).toBeVisible();
          if (width > 760)
            await expect(
              page.locator(".detail-route-map-canvas > svg"),
            ).toBeVisible();
        } else if (name === "settings") {
          await page.goto(`${origin}/#settings`);
          await expect(page.locator(".settings-page")).toBeVisible();
        } else {
          await page.locator(".danger-action").click();
          await expect(page.getByRole("alertdialog")).toBeVisible();
        }
        await page.evaluate(() => document.fonts.ready);
        await page.locator("img").evaluateAll(async (images) => {
          await Promise.all(images.map((img) => img.decode().catch(() => {})));
        });
        await page.evaluate(() => scrollTo(0, 0));
        await page.mouse.move(0, 0);
        const filename = `${name}-${width}x${width === 390 ? 844 : 1000}-${theme}.png`;
        await page.screenshot({
          path: `${directory}/${filename}`,
          fullPage: name !== "clear-dialog",
          animations: "disabled",
        });
        const computed = await page
          .locator(
            name === "clear-dialog" ? ".confirmation-backdrop" : ".app-shell",
          )
          .evaluate((el) => {
            const properties = [
              "color",
              "background-color",
              "border-top-color",
              "border-right-color",
              "border-bottom-color",
              "border-left-color",
              "outline-color",
              "outline-width",
              "box-shadow",
              "fill",
              "stroke",
              "opacity",
              "display",
              "font-size",
              "width",
              "height",
            ];
            return [el, ...el.querySelectorAll("*")].map((node) => {
              const style = getComputedStyle(node);
              return {
                tag: node.tagName,
                class: node.getAttribute("class"),
                values: properties.map((property) =>
                  style.getPropertyValue(property),
                ),
              };
            });
          });
        if (process.env.TASK_A_CAPTURE_COMPUTED_OUTPUT) {
          await mkdir(process.env.TASK_A_CAPTURE_COMPUTED_OUTPUT, {
            recursive: true,
          });
          await writeFile(
            `${process.env.TASK_A_CAPTURE_COMPUTED_OUTPUT}/${phase}-${filename}.json`,
            JSON.stringify(computed, null, 2) + "\n",
          );
        }
        records.push({
          filename,
          viewport: page.viewportSize(),
          theme,
          locale: "en",
          version: sourceVersion,
          applicationTreeClean: true,
          renderer: (await page.locator(".globe-webgl").count())
            ? "production WebGL"
            : width > 760 && name === "passport"
              ? "production SVG fallback"
              : undefined,
          sha256: createHash("sha256")
            .update(await readFile(`${directory}/${filename}`))
            .digest("hex"),
          computedSha256: createHash("sha256")
            .update(JSON.stringify(computed))
            .digest("hex"),
        });
      }
      await page.close();
    }
  }
  await writeFile(
    `${directory}/manifest.json`,
    JSON.stringify(records, null, 2) + "\n",
  );
} finally {
  await browser.close();
}
console.log(
  `Captured ${records.length} real Chromium screenshots in ${directory}`,
);
