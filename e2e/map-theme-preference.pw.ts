import { expect, test } from "@playwright/test";
import { chooseAppearance } from "./helpers/settings";

test("the skin sets the map theme for both maps at once and it survives reload @cross-browser", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  const passportMap = page.locator(".route-map");
  await expect(passportMap).toHaveAttribute("data-map-theme", "neon-aviation");
  const background = () =>
    passportMap.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--map-theme-background-top"),
    );
  const neonOcean = await background();
  expect(neonOcean).not.toBe("");

  // The theme follows the skin; Settings offers no separate control for it.
  await page.goto("/#settings");
  await expect(
    page.getByRole("combobox", { name: "Map theme", exact: true }),
  ).toHaveCount(0);
  await chooseAppearance(page, "light");

  await page.goto("/#/map");
  await expect(passportMap).toHaveAttribute("data-map-theme", "daylight-chart");
  await expect(passportMap.locator(".map-land-hatch")).toHaveCount(1);
  const daylightRoute = await passportMap
    .locator(".map-route-line")
    .first()
    .evaluate((element) => getComputedStyle(element).stroke);
  expect(await background()).not.toBe(neonOcean);

  await page.getByRole("button", { name: /Open UA123/ }).click();
  await expect(page.locator(".detail-heading")).toBeVisible();
  await expect(page.locator(".detail-flight-map")).toHaveAttribute(
    "data-map-theme",
    "daylight-chart",
  );

  // The skin is stored, so a reload comes back in its theme.
  await page.goto("/#/map");
  await page.reload();
  await expect(passportMap).toHaveAttribute("data-map-theme", "daylight-chart");

  // Switching back needs no reload and restyles the mounted routes.
  await page.goto("/#settings");
  await page.locator("#settings-skin").selectOption("aviation");
  await page.goto("/#/map");
  await expect(passportMap).toHaveAttribute("data-map-theme", "neon-aviation");
  expect(
    await passportMap
      .locator(".map-route-line")
      .first()
      .evaluate((element) => getComputedStyle(element).stroke),
  ).not.toBe(daylightRoute);
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("a map theme stored by an earlier version does not override the skin", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await expect(page.locator(".route-map")).toBeVisible();
  for (const mapTheme of ["daylight-chart", "removed-theme"]) {
    await page.evaluate(async (stored) => {
      const path = "/src/storage/browser.ts";
      const { browserStorage } = await import(/* @vite-ignore */ path);
      const settings = await browserStorage.loadSettings();
      await browserStorage.saveSettings({ ...settings, mapTheme: stored });
    }, mapTheme);
    await page.reload();
    await expect(page.locator(".route-map")).toHaveAttribute(
      "data-map-theme",
      "neon-aviation",
    );
  }
});
