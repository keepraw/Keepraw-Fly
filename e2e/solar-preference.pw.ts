import { expect, test, type Page } from "@playwright/test";

async function savedMode(page: Page) {
  return page.evaluate(async () => {
    const path = "/src/storage/browser.ts";
    const { browserStorage } = await import(path);
    return (await browserStorage.loadSettings())?.solarMode;
  });
}

test("solar preference survives Settings, Lab, reset lighting and reload @cross-browser", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await page.goto("/#settings");
  const control = page.getByRole("combobox", {
    name: "Solar illumination",
    exact: true,
  });
  await expect(control).toHaveValue("fixed");
  await control.selectOption("realtime");
  await expect.poll(() => savedMode(page)).toBe("realtime");
  await page.reload();
  await expect(control).toHaveValue("realtime");
  await page.goto("/globe-lab");
  await expect(
    page.getByRole("radio", { name: "Real-time", exact: true }),
  ).toBeChecked();
  // This assertion also applies when WebGL2 is unavailable: the controls and
  // persistence remain functional in the established SVG fallback.
  await page.getByRole("button", { name: "2026", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Airport", exact: true })
    .selectOption("SFO");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page
    .getByRole("button", { name: "Reset lighting", exact: true })
    .click();
  await expect(
    page.getByRole("radio", { name: "Real-time", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("button", { name: "2026", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("combobox", { name: "Airport", exact: true }),
  ).toHaveValue("SFO");
  await expect(page.locator(".globe-lab")).toHaveAttribute(
    "data-theme",
    "dark",
  );
  await page.getByRole("radio", { name: "Fixed", exact: true }).check();
  await expect.poll(() => savedMode(page)).toBe("fixed");
  await page.reload();
  await expect(
    page.getByRole("radio", { name: "Fixed", exact: true }),
  ).toBeChecked();
  await page.goto("/#settings");
  await expect(control).toHaveValue("fixed");
  for (const [locale, label, fixed, realtime] of [
    ["en", "Solar illumination", "Fixed Sun", "Real-time Sun"],
    ["zh-CN", "太阳光照", "固定太阳", "真实太阳（实时）"],
    ["zh-TW", "太陽光照", "固定太陽", "真實太陽（即時）"],
  ]) {
    await page
      .locator(".settings-display-fields select")
      .first()
      .selectOption(locale!);
    const localized = page.getByRole("combobox", { name: label!, exact: true });
    await expect(localized).toHaveValue("fixed");
    await expect(localized.locator('option[value="fixed"]')).toHaveText(fixed!);
    await expect(localized.locator('option[value="realtime"]')).toHaveText(
      realtime!,
    );
  }
});
