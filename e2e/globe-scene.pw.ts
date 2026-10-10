import { expect, test } from "@playwright/test";
import { globeMode, exerciseSvgFallback } from "./helpers/globe-capability";

test("regional composition, shared reverse strokes and manual camera ownership @cross-browser", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/globe-lab");
  if ((await globeMode(page)) === "svg") {
    const route = page.getByRole("combobox", { name: "Route", exact: true });
    for (const key of ["PEK-PVG", "PVG-PEK", "LHR-FRA"]) {
      await route.selectOption(key);
      await expect(route).toHaveValue(key);
      await expect(
        page.locator(".globe-fallback .map-route.is-selected"),
      ).toHaveCount(1);
      const [origin, destination] = key.split("-");
      await expect(
        page.locator(".globe-fallback .map-airport.is-selected title"),
      ).toHaveCount(2);
      expect(
        (
          await page
            .locator(".globe-fallback .map-airport.is-selected title")
            .allTextContents()
        )
          .map((text) => text.split(" ·")[0])
          .sort(),
      ).toEqual([origin, destination].sort());
    }
    await exerciseSvgFallback(page);
    expect(errors).toEqual([]);
    return;
  }
  const host = page.locator(".globe-host");
  await expect(host).toHaveAttribute("data-ready", "true");
  const scene = async () =>
    JSON.parse((await host.getAttribute("data-scene"))!);
  const lighting = async () =>
    JSON.parse((await host.getAttribute("data-lighting"))!);
  const initial = await scene(),
    sun = (await lighting()).sunDirection;
  expect(initial.physicalRoutes).toBe(22);
  expect(initial.routes).toHaveLength(23);
  expect(
    initial.routes.reduce(
      (sum: number, r: { count: number }) => sum + r.count,
      0,
    ),
  ).toBe(24);
  expect(
    initial.routes.every((r: { maxAltitude: number }) => r.maxAltitude < 0.035),
  ).toBe(true);
  expect(initial.atHome).toBe(true);
  await expect(page.locator(".globe-airport-label:visible")).not.toHaveCount(0);
  const camera = await host.getAttribute("data-camera");
  await page.getByRole("button", { name: "Light", exact: true }).click();
  expect(await host.getAttribute("data-camera")).toBe(camera);
  expect((await lighting()).sunDirection).toEqual(sun);
  // Hover a flight row: route styling changes, without automatic camera movement.
  await page.locator(".globe-flight-list .flight-row").first().hover();
  await page.waitForTimeout(150);
  expect(await host.getAttribute("data-camera")).toBe(camera);
  const route = page.getByRole("combobox", { name: "Route", exact: true });
  for (const key of ["PEK-PVG", "PVG-PEK"]) {
    await route.selectOption(key);
    await expect
      .poll(async () => JSON.stringify((await scene()).camera))
      .not.toBe(camera);
    await expect(
      page.locator(".globe-airport-label.is-selected:visible"),
    ).toHaveCount(2);
    expect((await scene()).physicalRoutes).toBe(22);
    expect((await lighting()).sunDirection).toEqual(sun);
    await expect(route).toHaveValue(key);
  }
  // Backside Europe remains selectable; both endpoints become visible.
  await route.selectOption("LHR-FRA");
  await expect(
    page.locator(".globe-airport-label.is-selected:visible"),
  ).toHaveCount(2);
  const canvas = page.locator(".globe-webgl");
  await canvas.focus();
  const beforeManual = await host.getAttribute("data-camera");
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => host.getAttribute("data-camera"))
    .not.toBe(beforeManual);
  await expect.poll(async () => (await scene()).atHome).toBe(false);
  const manual = await host.getAttribute("data-camera");
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect
    .poll(async () => (await scene()).viewport.height)
    .toBeLessThan(initial.viewport.height);
  expect(await host.getAttribute("data-camera")).toBe(manual);
  expect((await lighting()).sunDirection).toEqual(sun);
  await page
    .getByRole("button", { name: "Fit recorded routes", exact: true })
    .click();
  await expect.poll(async () => (await scene()).atHome).toBe(true);
  const reset = await scene();
  reset.camera.forEach((n: number, i: number) =>
    expect(n).toBeCloseTo(reset.home.direction[i] * reset.home.distance, 8),
  );
  expect(reset.viewOffset).toEqual(reset.home.offset);
  expect((await lighting()).sunDirection).toEqual(sun);
  expect(errors).toEqual([]);
});
