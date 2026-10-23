import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const cases = [
  { width: 390, height: 844, theme: "light" },
  { width: 390, height: 844, theme: "dark" },
  { width: 430, height: 932, theme: "light" },
  { width: 430, height: 932, theme: "dark" },
  { width: 375, height: 812, theme: "dark" },
];

test.describe("Mobile Passport palette", { tag: "@cross-browser" }, () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
    await page.goto("/");
    await page.getByRole("button", { name: "Try demo", exact: true }).click();
    await expect(page.locator(".flight-row")).toHaveCount(24);
  });

  for (const language of ["en-US", "zh-CN", "zh-TW"]) {
    test(`keeps mobile panels, readable controls and map-free navigation in ${language}`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      const loadedGlobeResources: string[] = [];
      page.on("request", (request) => {
        if (
          /PassportGlobe|three(?:\.js|\/)|earth-\d|night-\d/.test(request.url())
        )
          loadedGlobeResources.push(request.url());
      });
      await page.reload();
      await expect(page.locator(".flight-row")).toHaveCount(24);
      for (const viewport of cases) {
        await page.setViewportSize(viewport);
        await page.goto("/#settings");
        await page
          .locator(".settings-fields select")
          .nth(0)
          .selectOption(language);
        await page
          .locator(".settings-fields select")
          .nth(1)
          .selectOption(viewport.theme);
        await page.goto("/#passport");
        await expect(page.locator("html")).toHaveAttribute("lang", language);
        const canvas =
          viewport.theme === "dark" ? "rgb(18, 25, 35)" : "rgb(243, 246, 250)";
        await expect(page.locator(".app-shell")).toHaveCSS(
          "background-color",
          canvas,
        );
        const primaryText =
          viewport.theme === "dark" ? "rgb(229, 234, 242)" : "rgb(30, 43, 62)";
        await expect(page.locator(".flight-row").first()).toHaveCSS(
          "color",
          primaryText,
        );
        await expect(page.locator(".year-heading h2").first()).toHaveCSS(
          "color",
          primaryText,
        );
        await expect(page.locator(".passport-mobile-summary")).toBeVisible();
        await expect(page.locator(".passport-delay-panel")).toBeVisible();
        await expect(page.locator(".passport-network-panel")).toBeVisible();
        await expect(page.locator(".flight-row")).toHaveCount(24);
        await expect(page.locator(".route-map, .globe-webgl")).toHaveCount(0);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        const heading = page.locator(".mobile-page-heading h1");
        await expect(heading).toHaveCSS("color", primaryText);
        await expect(page.locator(".site-header")).toHaveCSS(
          "background-color",
          canvas,
        );
        expect(
          await heading.evaluate((el) => el.scrollWidth <= el.clientWidth),
        ).toBe(true);

        const accessibility = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect(accessibility.violations).toEqual([]);

        const search = page.locator(".passport-search-field input");
        await search.focus();
        await expect(page.locator(".passport-search-field")).toHaveCSS(
          "border-top-color",
          viewport.theme === "dark"
            ? "rgb(183, 167, 245)"
            : "rgb(101, 88, 199)",
        );
        await search.fill("UA123");
        await expect(page.locator(".flight-row")).toHaveCount(1);
        await search.fill("");
        await expect(page.locator(".flight-row")).toHaveCount(24);
        const row = page.locator(".flight-row").first();
        await search.focus();
        await page.keyboard.press("Tab");
        await expect(row).toBeFocused();
        await expect(row).toHaveCSS("outline-style", "solid");
        await expect(row).toHaveCSS(
          "outline-color",
          viewport.theme === "dark"
            ? "rgb(183, 167, 245)"
            : "rgb(101, 88, 199)",
        );
        await row.press("Enter");
        await expect(page.locator(".detail-heading-eyebrow")).toContainText(
          "UA123",
        );
        await page.locator(".detail-header-back").click();
        await expect(page.locator(".passport-mobile-summary")).toBeVisible();
      }
      expect(loadedGlobeResources).toEqual([]);
    });
  }

  test("reduced motion updates inherited header text and canvas together", async ({
    page,
  }) => {
    await expect(page.locator(".mobile-page-heading h1")).toHaveCSS(
      "color",
      "rgb(30, 43, 62)",
    );
    for (const theme of ["dark", "light"] as const) {
      // Change the CSS theme source and sample in the same task: polling here
      // would hide transitions that leave inherited text on the old palette.
      const palette = await page.evaluate((nextTheme) => {
        document.documentElement.dataset.theme = nextTheme;
        return {
          canvas: getComputedStyle(document.querySelector(".site-header")!)
            .backgroundColor,
          text: getComputedStyle(
            document.querySelector(".mobile-page-heading h1")!,
          ).color,
        };
      }, theme);
      expect(palette).toEqual({
        canvas: theme === "dark" ? "rgb(18, 25, 35)" : "rgb(243, 246, 250)",
        text: theme === "dark" ? "rgb(229, 234, 242)" : "rgb(30, 43, 62)",
      });
    }
  });

  test("cancelled status stays readable on a keyboard-focused row", async ({
    page,
  }) => {
    await page.locator(".flight-row").first().click();
    await page
      .getByRole("button", { name: "Edit flight", exact: true })
      .click();
    await page.getByRole("checkbox", { name: "Canceled", exact: true }).check();
    await page
      .getByRole("button", { name: "Save flight", exact: true })
      .click();
    await page.locator(".detail-header-back").click();
    for (const theme of ["light", "dark"]) {
      await page.goto("/#settings");
      await page.locator(".settings-fields select").nth(1).selectOption(theme);
      await page.goto("/#passport");
      await page.locator(".passport-search-field input").focus();
      await page.keyboard.press("Tab");
      const row = page.locator(".flight-row").first();
      await expect(row).toBeFocused();
      const status = row.locator(".flight-status.is-cancelled");
      await expect(status).toHaveText("Canceled");
      const contrast = await status.evaluate((element) => {
        const luminance = (color: string) => {
          const channels = color
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .map(Number);
          return channels.reduce((sum, channel, index) => {
            const value = channel / 255;
            const linear =
              value <= 0.04045
                ? value / 12.92
                : ((value + 0.055) / 1.055) ** 2.4;
            return sum + linear * [0.2126, 0.7152, 0.0722][index]!;
          }, 0);
        };
        const text = luminance(getComputedStyle(element).color);
        const background = luminance(
          getComputedStyle(element.closest(".flight-row")!).backgroundColor,
        );
        return (
          (Math.max(text, background) + 0.05) /
          (Math.min(text, background) + 0.05)
        );
      });
      expect(contrast).toBeGreaterThanOrEqual(4.5);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(results.violations).toEqual([]);
    }
  });

  test("System follows the OS while explicit Light and Dark take precedence", async ({
    page,
  }) => {
    for (const [appearance, os, expected] of [
      ["system", "dark", "rgb(18, 25, 35)"],
      ["system", "light", "rgb(243, 246, 250)"],
      ["light", "dark", "rgb(243, 246, 250)"],
      ["dark", "light", "rgb(18, 25, 35)"],
    ] as const) {
      await page.goto("/#settings");
      await page
        .locator(".settings-fields select")
        .nth(1)
        .selectOption(appearance);
      await page.emulateMedia({ colorScheme: os });
      await page.goto("/#passport");
      await expect(page.locator(".app-shell")).toHaveCSS(
        "background-color",
        expected,
      );
      await page.reload();
      await expect(page.locator(".app-shell")).toHaveCSS(
        "background-color",
        expected,
      );
    }
  });

  test("Passport palette is shared by Settings and Flight Detail", async ({
    page,
  }) => {
    for (const theme of ["light", "dark"]) {
      await page.goto("/#settings");
      await page.locator(".settings-fields select").nth(1).selectOption(theme);
      const canvas =
        theme === "dark" ? "rgb(18, 25, 35)" : "rgb(243, 246, 250)";
      await expect(page.locator(".site-header")).toHaveCSS(
        "background-color",
        canvas,
      );
      const settingsAccent = await page
        .locator(".app-shell")
        .evaluate((el) =>
          getComputedStyle(el).getPropertyValue("--color-accent"),
        );
      await page.goto("/#passport");
      await page.locator(".flight-row").first().click();
      await expect(page.locator(".app-shell")).toHaveCSS(
        "background-color",
        canvas,
      );
      expect(
        await page
          .locator(".app-shell")
          .evaluate((el) =>
            getComputedStyle(el).getPropertyValue("--color-accent"),
          ),
      ).toBe(settingsAccent);
      await page.locator(".detail-header-back").click();
      await page.locator(".mobile-settings-button").click();
      await expect(page.locator(".site-header")).toHaveCSS(
        "background-color",
        canvas,
      );
    }
  });
});
