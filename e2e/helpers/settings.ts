import { expect, type Page } from "@playwright/test";

// Canonical English names keep callers readable; activate the translated,
// user-visible button in the current locale rather than a hidden section.
const categoryNames: Record<string, Record<string, string>> = {
  "zh-CN": {
    General: "常规",
    Profile: "个人资料",
    "Frequent flyer profiles": "常旅客资料",
    "Data and backup": "数据与备份",
    Advanced: "高级",
    "Danger zone": "危险操作",
  },
  "zh-TW": {
    General: "常規",
    Profile: "個人資料",
    "Frequent flyer profiles": "常旅客資料",
    "Data and backup": "數據與備份",
    Advanced: "高級",
    "Danger zone": "危險操作",
  },
};

export async function openSettingsCategory(page: Page, name: string) {
  await expect(page.locator(".settings-page")).toBeVisible();
  const language = (await page.locator("html").getAttribute("lang")) ?? "en";
  name = categoryNames[language]?.[name] ?? name;
  const navigation = page.getByRole("navigation", {
    name: /^(Settings|设置|設置)$/,
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
