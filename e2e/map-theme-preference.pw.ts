import { expect, test, type Page } from "@playwright/test";

async function savedTheme(page: Page) {
  return page.evaluate(async () => {
    const path = "/src/storage/browser.ts";
    const { browserStorage } = await import(/* @vite-ignore */ path);
    return (await browserStorage.loadSettings())?.mapTheme;
  });
}

test("map theme switches both maps at once and survives reload @cross-browser", async ({
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

  await page.goto("/#settings");
  const control = page.getByRole("combobox", {
    name: "Map theme",
    exact: true,
  });
  await expect(control).toHaveValue("neon-aviation");
  await expect(control.locator("option")).toHaveCount(2);
  await control.selectOption("daylight-chart");
  await expect.poll(() => savedTheme(page)).toBe("daylight-chart");

  await page.goto("/#passport");
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

  // The preference is stored, so a reload comes back in the chosen theme.
  await page.goto("/#/map");
  await page.reload();
  await expect(passportMap).toHaveAttribute("data-map-theme", "daylight-chart");

  // Switching back needs no reload and restyles the mounted routes.
  await page.goto("/#settings");
  await control.selectOption("neon-aviation");
  await page.goto("/#passport");
  await expect(passportMap).toHaveAttribute("data-map-theme", "neon-aviation");
  expect(
    await passportMap
      .locator(".map-route-line")
      .first()
      .evaluate((element) => getComputedStyle(element).stroke),
  ).not.toBe(daylightRoute);
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("an unknown stored map theme falls back to the default", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await expect(page.locator(".route-map")).toBeVisible();
  await page.evaluate(async () => {
    const path = "/src/storage/browser.ts";
    const { browserStorage } = await import(/* @vite-ignore */ path);
    const settings = await browserStorage.loadSettings();
    await browserStorage.saveSettings({
      ...settings,
      mapTheme: "removed-theme",
    });
  });
  await page.reload();
  await expect(page.locator(".route-map")).toHaveAttribute(
    "data-map-theme",
    "neon-aviation",
  );
  await page.goto("/#settings");
  await expect(
    page.getByRole("combobox", { name: "Map theme", exact: true }),
  ).toHaveValue("neon-aviation");
});
