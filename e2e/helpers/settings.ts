import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { supportedLanguages } from "../../apps/web/src/locales/registry";

// Canonical English names keep callers readable; activate the translated,
// user-visible button in the current locale rather than a hidden section.
const resources = Object.fromEntries(
  supportedLanguages.map((language) => [
    language,
    JSON.parse(
      readFileSync(
        new URL(`../../apps/web/src/locales/${language}.json`, import.meta.url),
        "utf8",
      ),
    ),
  ]),
);
const categoryKeys: Record<string, string> = {
  General: "general",
  Profile: "profile",
  "Frequent flyer profiles": "frequentFlyerProfiles",
  "Data and backup": "dataAndBackup",
  Advanced: "advanced",
  "Danger zone": "dangerZone",
};

export async function openSettingsCategory(page: Page, name: string) {
  await expect(page.locator(".settings-page")).toBeVisible();
  const selectedLanguage = await page
    .locator("#settings-language")
    .inputValue();
  await expect(page.locator("html")).toHaveAttribute("lang", selectedLanguage);
  const language = (await page.locator("html").getAttribute("lang")) ?? "en";
  const resource = resources[language];
  name = resource?.settings?.[categoryKeys[name] ?? ""] ?? name;
  const navigation = page.getByRole("navigation", {
    name: resource?.nav?.settings ?? "Settings",
    exact: true,
  });
  const heading = page.getByRole("heading", { name, exact: true, level: 2 });
  const desktop = await page.evaluate(
    () => matchMedia("(min-width: 761px)").matches,
  );
  if (desktop) {
    await expect(navigation).toBeVisible();
    const button = navigation.getByRole("button", { name, exact: true });
    await button.click();
    await expect(button).toHaveAttribute("aria-current", "true");
  } else {
    await expect(navigation).toBeHidden();
    await heading.scrollIntoViewIfNeeded();
  }
  await expect(heading).toBeVisible();
  // Categories remain mounted but revealing one restarts its entrance animation.
  // Readiness includes the final opacity so contrast audits see rendered colors.
  await expect(page.getByRole("region", { name, exact: true })).toHaveCSS(
    "opacity",
    "1",
  );
}

/**
 * Sets the appearance from General settings. A skin with one appearance
 * disables the control: its own appearance needs nothing, any other value
 * first switches to the `minimal` skin, which offers a choice. Pass `skin`
 * when the assertions that follow are about that skin's palette.
 */
export async function chooseAppearance(
  page: Page,
  appearance: "light" | "dark" | "system",
  skin?: "minimal",
) {
  const control = page.locator("#settings-appearance");
  await expect(control).toBeVisible();
  if (skin) {
    await page.locator("#settings-skin").selectOption(skin);
    await expect(control).toBeEnabled();
  } else if (await control.isDisabled()) {
    if ((await control.inputValue()) === appearance) return;
    await page.locator("#settings-skin").selectOption("minimal");
    await expect(control).toBeEnabled();
  }
  await control.selectOption(appearance);
  await expect(control).toHaveValue(appearance);
}
