import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { solarPixels } from "../scripts/lib/globe-solar-pixels.mjs";

test("real WebGL shares day/twilight/night geography and nighttime cities across themes and art", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/globe-lab");
  const host = page.locator(".globe-host"),
    canvas = page.locator(".globe-webgl");
  await expect(host).toHaveAttribute("data-ready", "true");
  await page.getByRole("checkbox", { name: "Earth only", exact: true }).check();
  await page
    .getByRole("checkbox", { name: "Atmosphere", exact: true })
    .uncheck();
  await page
    .getByRole("button", { name: "Twilight Review", exact: true })
    .click();
  const read = async () => ({
    scene: JSON.parse((await host.getAttribute("data-scene"))!),
    lighting: JSON.parse((await host.getAttribute("data-lighting"))!),
  });
  await expect.poll(async () => (await read()).scene.atHome).toBe(false);
  const initial = await read();
  const diagnostic = page.getByRole("checkbox", {
    name: "Solar regions (diagnostic)",
    exact: true,
  });
  const cities = page.getByRole("checkbox", {
    name: "City lights",
    exact: true,
  });
  const art = page.getByRole("combobox", {
    name: "Art Direction",
    exact: true,
  });
  const png = async () => (await canvas.screenshot()).toString("base64");
  let reference: number | undefined;
  const records = [];
  for (const theme of ["Light", "Dark"])
    for (const candidate of ["A", "B"]) {
      await page.getByRole("button", { name: theme, exact: true }).click();
      await art.selectOption(candidate);
      await expect
        .poll(async () => (await read()).lighting.artDirection)
        .toBe(candidate);
      expect((await read()).scene).toEqual(initial.scene);
      expect((await read()).lighting.sunDirection).toEqual(
        initial.lighting.sunDirection,
      );
      await diagnostic.check();
      const mask = await png();

      await diagnostic.uncheck();
      await cities.check();
      const lit = await png();
      await cities.uncheck();
      const unlit = await png();
      const stats = await page.evaluate(solarPixels, {
        diagnostic: mask,
        lit,
        unlit,
        scene: initial.scene,
        sun: initial.lighting.sunDirection,
        width: initial.lighting.twilightWidth,
      });
      if (reference) expect(stats.signature).toBe(reference);
      else reference = stats.signature;
      expect(stats.compared).toBeGreaterThan(20000);
      expect(stats.mismatched / stats.compared).toBeLessThan(0.005);
      for (const group of Object.values(stats.groups))
        expect(group.count).toBeGreaterThan(1000);
      // Geographic albedo can make a night desert brighter than twilight sea.
      // A neutral reflectance exercises the SAME actual surface illumination
      // path without that confound, rather than asserting an arbitrary map mean.
      await page
        .getByRole("checkbox", {
          name: "Neutral solar probe (diagnostic)",
          exact: true,
        })
        .check();
      const probe = await png();
      const irradiance = await page.evaluate(solarPixels, {
        diagnostic: mask,
        lit: probe,
        unlit: probe,
        scene: initial.scene,
        sun: initial.lighting.sunDirection,
        width: initial.lighting.twilightWidth,
      });
      expect(irradiance.groups.day.luminance).toBeGreaterThan(
        irradiance.groups.twilight.luminance * 1.3,
      );
      expect(irradiance.groups.twilight.luminance).toBeGreaterThan(
        irradiance.groups.night.luminance * 1.15,
      );
      for (const group of Object.values(stats.groups))
        expect(group.luminance).toBeGreaterThan(8);
      expect(stats.groups.day.luminance).toBeGreaterThan(
        stats.groups.night.luminance * 1.3,
      );
      await page
        .getByRole("checkbox", {
          name: "Neutral solar probe (diagnostic)",
          exact: true,
        })
        .uncheck();
      expect(stats.groups.night.changed).toBeGreaterThan(100);
      expect(stats.groups.night.emission).toBeGreaterThan(0.2);
      expect(stats.groups.day.emission).toBeLessThan(0.05);
      expect((await read()).scene).toEqual(initial.scene);
      await diagnostic.check();
      expect(
        createHash("sha256")
          .update(await png())
          .digest("hex"),
      ).toBe(createHash("sha256").update(mask).digest("hex"));
      await diagnostic.uncheck();
      records.push({ theme, candidate, ...stats, irradiance });
    }
  expect(errors).toEqual([]);
  await mkdir("artifacts/globe-lab", { recursive: true });
  await writeFile(
    "artifacts/globe-lab/solar-pixels.json",
    JSON.stringify(
      {
        scene: initial.scene,
        sun: initial.lighting.sunDirection,
        records,
        errors,
      },
      null,
      2,
    ),
  );
});
