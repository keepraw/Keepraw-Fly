import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

async function imageStats(page: Page, reference?: string) {
  const png = await page.locator(".globe-webgl").screenshot();
  const scene = JSON.parse(
    (await page.locator(".globe-host").getAttribute("data-scene"))!,
  );
  return page.evaluate(
    async ({ base64, scene, reference }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ).data;
      let changedPixels = 0;
      if (reference) {
        const previous = new Image();
        previous.src = `data:image/png;base64,${reference}`;
        await previous.decode();
        context.drawImage(previous, 0, 0);
        const prior = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        ).data;
        for (let i = 0; i < pixels.length; i += 4) {
          if (
            Math.max(
              Math.abs(pixels[i]! - prior[i]!),
              Math.abs(pixels[i + 1]! - prior[i + 1]!),
              Math.abs(pixels[i + 2]! - prior[i + 2]!),
            ) > 2
          )
            changedPixels++;
        }
      }
      let warmPixels = 0,
        totalLuminance = 0,
        centerLuminance = 0,
        centerPixels = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i]!,
          g = pixels[i + 1]!,
          b = pixels[i + 2]!;
        if (r > 100 && g > 50 && r > g * 1.12 && g > b * 1.2) warmPixels++;
        totalLuminance += 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const x = (i / 4) % canvas.width,
          y = Math.floor(i / 4 / canvas.width);
        // The new close-up exposes space inside the old rectangular sample.
        // Sample only the analytic inner sphere disk, excluding atmosphere/space.
        const distance = Math.hypot(...scene.camera);
        const radius =
          canvas.height /
          (2 *
            Math.tan((scene.fov * Math.PI) / 360) *
            Math.sqrt(distance * distance - 1));
        const sphereX = canvas.width * (0.5 - scene.viewOffset.x),
          sphereY = canvas.height * (0.5 - scene.viewOffset.y);
        if (
          x > canvas.width * 0.25 &&
          x < canvas.width * 0.75 &&
          y > canvas.height * 0.2 &&
          y < canvas.height * 0.8 &&
          Math.hypot(x - sphereX, y - sphereY) < radius * 0.9
        ) {
          centerLuminance += 0.2126 * r + 0.7152 * g + 0.0722 * b;
          centerPixels++;
        }
      }
      return {
        changedPixels,
        warmPixels,
        meanLuminance: totalLuminance / (pixels.length / 4),
        meanCenterLuminance: centerLuminance / centerPixels,
      };
    },
    { base64: png.toString("base64"), scene, reference },
  );
}

test("cinematic layers produce real pixels and keep the world-space sun fixed @cross-browser", async ({
  page,
  browserName,
}) => {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/globe-lab");
  await expect(page.locator(".globe-host")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.getByRole("checkbox", { name: "Earth only", exact: true }).check();
  await expect(page.locator(".globe-airport-label:visible")).toHaveCount(0);
  const host = page.locator(".globe-host");
  const read = async () =>
    JSON.parse((await host.getAttribute("data-lighting"))!);
  const initial = await read();
  const lit = await imageStats(page);
  const litPixels = (await page.locator(".globe-webgl").screenshot()).toString(
    "base64",
  );
  await page
    .getByRole("checkbox", { name: "City lights", exact: true })
    .uncheck();
  await expect.poll(async () => (await read()).nightLights).toBe(false);
  const withoutCities = await imageStats(page, litPixels);
  // Neutral, quiet cities no longer satisfy the old orange-pixel classifier.
  // Verify actual emission by toggling ONLY the city layer at a fixed camera.
  expect(withoutCities.changedPixels).toBeGreaterThan(500);
  expect(withoutCities.meanCenterLuminance).toBeLessThan(
    lit.meanCenterLuminance,
  );
  await page
    .getByRole("checkbox", { name: "City lights", exact: true })
    .check();
  await expect.poll(async () => (await read()).nightLights).toBe(true);
  expect((await imageStats(page, litPixels)).changedPixels).toBe(0);
  const before = await host.getAttribute("data-camera");
  await page.locator(".globe-webgl").focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => host.getAttribute("data-camera")).not.toBe(before);
  expect((await read()).sunDirection).toEqual(initial.sunDirection);
  await page.getByRole("button", { name: "Light", exact: true }).click();
  expect((await read()).sunDirection).toEqual(initial.sunDirection);
  // Remove every render layer; no unaccounted glow or baked city-light photo.
  for (const name of ["Day surface", "City lights", "Atmosphere"])
    await page.getByRole("checkbox", { name, exact: true }).uncheck();
  await expect.poll(async () => (await read()).atmosphere).toBe(false);
  const disabled = await imageStats(page);
  expect(disabled.meanCenterLuminance).toBeLessThan(0.1);
  await page
    .getByRole("button", { name: "Reset lighting", exact: true })
    .click();
  await expect(
    page.locator(".globe-airport-label:visible").first(),
  ).toBeVisible();
  await expect.poll(async () => (await read()).sunIntensity).toBe(2.2);
  expect(errors).toEqual([]);
  await mkdir("artifacts/globe-lab", { recursive: true });
  await writeFile(
    `artifacts/globe-lab/${browserName}-lighting-pixels.json`,
    JSON.stringify(
      {
        lit,
        withoutCities,
        disabled,
        sunDirection: initial.sunDirection,
        errors,
      },
      null,
      2,
    ),
  );
});

test("night texture failure falls back locally and retries both textures @cross-browser", async ({
  page,
}) => {
  await page.route("**/night-4096.webp", (route) => route.abort());
  await page.goto("/globe-lab");
  await expect(page.locator('.globe-fallback svg[role="group"]')).toBeVisible();
  await page.unroute("**/night-4096.webp");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator(".globe-host")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(page.locator(".globe-fallback")).toHaveCount(0);
});
