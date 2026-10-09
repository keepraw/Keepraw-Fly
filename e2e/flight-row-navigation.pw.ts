import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

test("opens details from every row area and from keyboard focus", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .setInputFiles(
      fileURLToPath(
        new URL("../examples/basic.keepraw-fly.json", import.meta.url),
      ),
    );
  await page.getByRole("button", { name: "Import this archive" }).click();
  const row = page.getByRole("button", {
    name: "Open UA123, SFO to LAX",
    exact: true,
  });
  await expect(row).toBeVisible();
  await expect(page.locator(".flight-record").getByRole("button")).toHaveCount(
    1,
  );
  await expect(row.locator("button, a")).toHaveCount(0);
  await expect(row.locator(".flight-row-open")).toHaveCount(0);
  const restingBackground = await row.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  await row.hover();
  await expect
    .poll(() =>
      row.evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .not.toBe(restingBackground);

  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const selector of [
      ".airline-logo",
      ".flight-number",
      ...(width > 760
        ? [".flight-ledger-duration", ".flight-route-cities"]
        : [".flight-times", ".flight-route", ".flight-status"]),
      ".flight-date",
    ]) {
      await row.locator(selector).click();
      await expect(page.locator(".detail-heading-eyebrow")).toContainText(
        "UA123",
      );
      await page.locator(".detail-header-back").click();
      await expect(row).toBeVisible();
    }
    const bounds = await row.boundingBox();
    if (!bounds) throw new Error("Flight row bounds missing");
    await row.click({
      position: { x: bounds.width / 2, y: bounds.height - 5 },
    });
    await expect(page.locator(".detail-heading-eyebrow")).toContainText(
      "UA123",
    );
    await page.locator(".detail-header-back").click();
  }

  await mkdir("test-results/flight-row-navigation", { recursive: true });
  for (const theme of ["light", "dark"]) {
    await page.goto("/#settings");
    await page
      .locator(".settings-display-fields select")
      .nth(1)
      .selectOption(theme);
    await page.goto("/#passport");
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator("#passport-flight-search").focus();
      await page.keyboard.press("Tab");
      await expect(row).toBeFocused();
      const focus = await row.evaluate((element) => ({
        visible: element.matches(":focus-visible"),
        style: getComputedStyle(element).outlineStyle,
        width: parseFloat(getComputedStyle(element).outlineWidth),
      }));
      expect(focus.visible).toBe(true);
      expect(focus.style).toBe("solid");
      expect(focus.width).toBeGreaterThanOrEqual(2);
      await page.screenshot({
        path: `test-results/flight-row-navigation/focus-${theme}-${width}.png`,
        fullPage: true,
      });
      await page.keyboard.press("Enter");
      await expect(page.locator(".detail-heading-eyebrow")).toContainText(
        "UA123",
      );
      await page.locator(".detail-header-back").click();
    }
  }
});
