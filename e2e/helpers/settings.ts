import { expect, type Page } from "@playwright/test";

export async function openSettingsCategory(page: Page, name: string) {
  const navigation = page.getByRole("navigation", {
    name: /^(Settings|设置|設定)$/,
  });
  const heading = page.getByRole("heading", { name, exact: true, level: 2 });
  if (await navigation.isVisible()) {
    const button = navigation.getByRole("button", { name, exact: true });
    await button.click();
    await expect(button).toHaveAttribute("aria-current", "true");
  } else {
    await heading.scrollIntoViewIfNeeded();
  }
  await expect(heading).toBeVisible();
}
