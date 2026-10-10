import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { nightStylePixels } from "../scripts/lib/globe-night-style-pixels.mjs";

test("real Dark emission separates warm compact accents from quiet city fabric at both texture sizes", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/globe-lab");
  const host = page.locator(".globe-host"),
    canvas = page.locator(".globe-webgl");
  await expect(host).toHaveAttribute("data-ready", "true");
  const evidence = JSON.parse(
    await readFile(
      "docs/visual-review/task-1b-6/display-diagnostics.json",
      "utf8",
    ),
  );
  const before = evidence.diagnostics.before.emission;
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  for (const [name, value] of [
    ["Earth only", true],
    ["Day surface", false],
    ["Atmosphere", false],
  ] as const)
    await page.getByRole("checkbox", { name, exact: true }).setChecked(value);
  const exclusions = await page
    .locator(".globe-caption,.globe-controls,.globe-twilight-review")
    .evaluateAll((els) => {
      const c = document.querySelector(".globe-webgl")!.getBoundingClientRect();
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
  for (const quality of ["4096", "2048"]) {
    await page
      .getByRole("combobox", { name: "Texture", exact: true })
      .selectOption(quality);
    await page.waitForFunction(
      (size) =>
        (
          document.querySelector(".globe-host") as HTMLElement & {
            globeMetrics: { textureSize: number };
          }
        )?.globeMetrics?.textureSize === size &&
        document.querySelector(".globe-host")?.getAttribute("data-ready") ===
          "true",
      Number(quality),
    );
    const scene = JSON.parse((await host.getAttribute("data-scene"))!);
    const output = await page.evaluate(nightStylePixels, {
      image: (await canvas.screenshot()).toString("base64"),
      scene,
      exclusions,
    });
    expect(output.warmSeparation.p50).toBeGreaterThan(
      before.warmSeparation.p95,
    );
    expect(output.meanLuminance).toBeLessThan(before.meanLuminance);
    expect(output.light.p95 / output.light.p50).toBeGreaterThan(
      before.light.p95 / before.light.p50,
    );
    expect(output.light.max).toBeGreaterThan(before.light.max);
    // Bright accents occupy a small fraction, not a continent-sized glow.
    expect(output.accent.count).toBeGreaterThan(0);
    expect(output.accent.count / output.light.count).toBeLessThan(0.02);
    expect(output.nearWhite).toBe(0);
    expect(output.clipped).toBe(0);
  }
});
