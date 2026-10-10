import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { nightPixels } from "../scripts/lib/globe-night-pixels.mjs";

test("real urban peripheries survive ACES output while peaks and remote backgrounds stay restrained", async ({
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
    await readFile("docs/visual-review/task-1b-5/display-pixels.json", "utf8"),
  );
  const baseline = evidence.pixels["before-dark"];
  const scene = JSON.parse((await host.getAttribute("data-scene"))!);
  const readScene = () => host.getAttribute("data-scene");
  const original = await readScene();
  const earth = page.getByRole("checkbox", { name: "Earth only", exact: true });
  const cities = page.getByRole("checkbox", {
    name: "City lights",
    exact: true,
  });
  const png = async () => (await canvas.screenshot()).toString("base64");
  for (const theme of ["Dark", "Light"]) {
    await page.getByRole("button", { name: theme, exact: true }).click();
    await earth.check();
    await cities.check();
    const on = await png();
    await cities.uncheck();
    const off = await png();
    await cities.check();
    await earth.uncheck();
    const routes = await png();
    expect(await readScene()).toBe(original);
    const output = await page.evaluate(nightPixels, {
      on,
      off,
      routes,
      scene,
      regions: evidence.regions,
    });
    expect(output.global.nearWhite).toBe(0);
    for (const id of [
      "beijing-tianjin",
      "yangtze-delta",
      "pearl-delta",
      "chengdu",
      "tokyo",
      "seoul",
    ]) {
      const current = output.regions[id],
        old = baseline.regions[id];
      expect(current.all.count).toBe(old.all.count);
      expect(current.core.delta.mean).toBeGreaterThan(
        current.periphery.delta.mean,
      );
      if (theme === "Dark") {
        // Measured B4 baseline, rather than a threshold copied from new parameters.
        expect(current.periphery.delta.mean).toBeGreaterThan(
          old.periphery.delta.mean * 1.1,
        );
        expect(current.all.coveragePercent).toBeGreaterThan(
          old.all.coveragePercent,
        );
        expect(current.core.delta.mean).toBeLessThan(
          old.core.delta.mean * 1.15,
        );
      } else expect(current.all.changed).toBeGreaterThan(0);
    }
    for (const id of ["tibet", "visible-pacific"]) {
      expect(output.regions[id].all.count).toBeGreaterThan(1000);
      expect(output.regions[id].all.changed).toBe(0);
    }
    // Route/airport overlay contrast must exceed ordinary urban peripheral emission.
    const urban = Math.max(
      ...["beijing-tianjin", "yangtze-delta", "pearl-delta"].map(
        (id) => output.regions[id].periphery.delta.mean,
      ),
    );
    expect(output.global.routeDelta.p50).toBeGreaterThan(urban);
  }
});
