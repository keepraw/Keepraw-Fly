import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { expectFlightRowGeometry } from "./helpers/flight-row-geometry";

// Native text wrapping and 12-hour/day-offset sizing need all three engines;
// broader viewport, theme and Globe interaction matrices remain in their suites.
for (const [locale, origin, destination] of [
  ["en", "Addis Ababa", "Johannesburg"],
  ["zh-CN", "亚的斯亚贝巴", "约翰内斯堡"],
  ["zh-TW", "亞的斯亞貝巴", "約翰內斯堡"],
] as const) {
  test(`compact flight list keeps complete cities and one time pair in ${locale} @cross-browser`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/");
    await page
      .locator('input[type="file"]')
      .setInputFiles(
        fileURLToPath(
          new URL(
            "./fixtures/flight-list-review.keepraw-fly.json",
            import.meta.url,
          ),
        ),
      );
    await page
      .getByRole("button", { name: "Import this archive", exact: true })
      .click();
    await expect(page.locator(".flight-row")).toHaveCount(7);

    for (const sample of [
      {
        width: 360,
        theme: "light",
        timeFormat: "24-hour",
        colorScheme: "light",
      },
      { width: 761, theme: "dark", timeFormat: "24-hour", colorScheme: "dark" },
      {
        width: 360,
        theme: "system",
        timeFormat: "12-hour",
        colorScheme: "dark",
      },
    ] as const) {
      await page.setViewportSize({ width: sample.width, height: 800 });
      await page.emulateMedia({ colorScheme: sample.colorScheme });
      await page.goto("/#settings");
      await page.locator(".settings-fields select").nth(0).selectOption(locale);
      await page
        .locator(".settings-fields select")
        .nth(1)
        .selectOption(sample.theme);
      await page
        .getByRole("combobox")
        .filter({ has: page.locator('option[value="12-hour"]') })
        .selectOption(sample.timeFormat);
      await page.goto("/#passport");
      const rows = page.locator(".flight-row");
      await expect(rows).toHaveCount(7);
      await expect(page.locator(".app-shell")).toHaveCSS(
        "background-color",
        sample.colorScheme === "dark"
          ? "rgb(18, 25, 35)"
          : "rgb(243, 246, 250)",
      );
      await expect(page.locator(".year-heading h1")).toHaveCSS(
        "color",
        sample.colorScheme === "dark"
          ? "rgb(229, 234, 242)"
          : "rgb(30, 43, 62)",
      );
      await expect(rows.locator(".flight-times time")).toHaveCount(14);
      await expect(rows.locator(".airport-code-display")).toHaveCount(14);
      await expect(rows.locator(".flight-status")).toHaveCount(2);
      await expect(
        rows.locator(
          ".flight-scheduled-times, .flight-deviation, .flight-ledger-duration, .flight-ledger-exception",
        ),
      ).toHaveCount(0);
      const actual = rows.filter({ hasText: "ZH9911" });
      const scheduled = rows.filter({ hasText: "ET809" });
      if (sample.timeFormat === "24-hour") {
        await expect(actual.locator(".flight-times time")).toHaveText([
          "10:57",
          "13:31",
        ]);
        await expect(scheduled.locator(".flight-times time")).toHaveText([
          "05:20",
          "07:05",
        ]);
      } else {
        await expect(actual.locator(".flight-times time")).toHaveText([
          /10:57/,
          /1:31/,
        ]);
      }
      await expect(
        rows.filter({ hasText: "CX696" }).locator(".time-day-offset"),
      ).toHaveText(" +1");
      await expect(
        scheduled.locator(".flight-route-cities > span:not(.route-direction)"),
      ).toHaveText([origin, destination]);
      await scheduled.scrollIntoViewIfNeeded();
      await expectFlightRowGeometry(scheduled, sample.width > 760);
      const readability = await rows.evaluateAll((elements) =>
        elements.every((row) => {
          const fits = (el: Element) => el.scrollWidth <= el.clientWidth + 1;
          return (
            fits(row) &&
            [
              ...row.querySelectorAll(
                ".flight-route-cities > span:not(.route-direction), .flight-date, .flight-times time",
              ),
            ].every(
              (el) =>
                fits(el) && getComputedStyle(el).textOverflow !== "ellipsis",
            )
          );
        }),
      );
      expect(readability).toBe(true);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (sample.width <= 760) {
        await expect(page.locator(".route-map, .globe-webgl")).toHaveCount(0);
        await expect(
          page.locator(
            ".passport-mobile-summary, .passport-delay-panel, .passport-network-panel",
          ),
        ).toHaveCount(3);
      }
    }
  });
}
