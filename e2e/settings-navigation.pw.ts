import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { disablePassportWebGL } from "./helpers/passport-svg";

test.beforeEach(async ({ page }) => {
  await disablePassportWebGL(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
});

test("Settings categories have native keyboard navigation and named current regions @cross-browser", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  const navigation = page.getByRole("navigation", {
    name: "Settings",
    exact: true,
  });
  const general = navigation.getByRole("button", {
    name: "General",
    exact: true,
  });
  await expect(general).toHaveAttribute("aria-current", "true");
  await expect(
    page.getByRole("region", { name: "General", exact: true }),
  ).toBeVisible();
  await general.focus();
  for (const name of [
    "Profile",
    "Frequent flyer profiles",
    "Data and backup",
    "Advanced",
    "Danger zone",
  ]) {
    await page.keyboard.press("Tab");
    const button = navigation.getByRole("button", { name, exact: true });
    await expect(button).toBeFocused();
    await page.keyboard.press(name === "Profile" ? "Space" : "Enter");
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute("aria-current", "true");
    await expect(navigation.locator('[aria-current="true"]')).toHaveCount(1);
    await expect(page.getByRole("region", { name, exact: true })).toBeVisible();
    await expect(
      page.getByRole("region", { name: "General", exact: true }),
    ).toBeHidden();
    await expect(
      page.getByRole("region", { name, exact: true }),
    ).toHaveAttribute("id", (await button.getAttribute("aria-controls"))!);
  }
  await page.keyboard.press("Shift+Tab");
  await expect(
    navigation.getByRole("button", { name: "Advanced", exact: true }),
  ).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("Passport import opens Data independent of hover or retained button focus @cross-browser", async ({
  page,
}) => {
  const importButton = page.getByRole("button", {
    name: "Import flights",
    exact: true,
  });
  await page.mouse.move(0, 0);
  await importButton.focus();
  // Some browsers clear button focus on activation; navigation must not infer intent from it.
  await importButton.evaluate((button) =>
    button.addEventListener("click", () => (button as HTMLElement).blur(), {
      capture: true,
      once: true,
    }),
  );
  await importButton.press("Enter");
  const navigation = page.getByRole("navigation", {
    name: "Settings",
    exact: true,
  });
  await expect(
    navigation.getByRole("button", { name: "Data and backup", exact: true }),
  ).toHaveAttribute("aria-current", "true");
  await expect(
    page.getByRole("region", { name: "Data and backup", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Open Keepraw Fly file", { exact: true }),
  ).toBeAttached();
  // Leaving through the location hash must clear the import intent too.
  await page.evaluate(() => {
    window.location.hash = "passport";
  });
  await expect(importButton).toBeVisible();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(
    navigation.getByRole("button", { name: "General", exact: true }),
  ).toHaveAttribute("aria-current", "true");
  await page
    .getByRole("link", { name: "Flight Passport", exact: true })
    .click();
  await importButton.click();
  await expect(
    navigation.getByRole("button", { name: "Data and backup", exact: true }),
  ).toHaveAttribute("aria-current", "true");
});
