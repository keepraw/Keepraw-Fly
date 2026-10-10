import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile } from "node:fs/promises";
import type { KeeprawFlight } from "@keepraw-fly/schema";

test("preserves desktop flight highlights and removes them only on mobile", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const archive = JSON.parse(
    await readFile(
      new URL("../examples/basic.keepraw-fly.json", import.meta.url),
      "utf8",
    ),
  );
  const route = (
    id: string,
    origin: string,
    destination: string,
    airline: string,
  ): KeeprawFlight => ({
    id,
    flightNumber: `${airline}${100 + Number(id)}`,
    serviceDate: "2026-09-22",
    airline: { iata: airline },
    origin: { iata: origin },
    destination: { iata: destination },
    scheduledDeparture: "2026-09-22T10:00:00+08:00",
    actualDeparture: "2026-09-22T10:00:00+08:00",
    scheduledArrival: "2026-09-22T12:00:00+08:00",
    actualArrival: "2026-09-22T12:10:00+08:00",
    extensions: { "keepraw-fly.aircraft": { type: "A320" } },
  });
  archive.flights = [
    route("1", "SZX", "TAO", "ZH"),
    ...["2", "3", "4"].map((id) => route(id, "SHA", "TAO", "CA")),
    route("5", "SHA", "TAO", "ZH"),
    ...["6", "7", "8"].map((id) => route(id, "TAO", "HKG", "CX")),
    {
      ...route("9", "HKG", "BOM", "CX"),
      scheduledArrival: "2026-09-22T12:00:00+05:30",
      actualArrival: "2026-09-22T12:10:00+05:30",
    },
  ];
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "legend.keepraw-fly.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(archive)),
  });
  await page.getByRole("button", { name: "Import this archive" }).click();
  await expect(page.locator(".passport-core-stat:nth-child(2)")).toContainText(
    "9Flights",
  );
  await expect(page.locator(".passport-delay-highlight > strong")).toHaveText(
    "1h 30m",
  );
  await expect(page.locator(".passport-visual")).not.toContainText(
    "Early arrivals do not offset delays",
  );
  await expect(page.locator(".passport-delay-highlight")).toHaveAttribute(
    "title",
    "Early arrivals do not offset delays",
  );
  await expect(
    page.locator(".primary-stats, .passport-counts, .highlight-list"),
  ).toHaveCount(0);
  await expect(page.locator(".passport-core-stat")).toHaveCount(6);
  await expect(page.locator(".passport-core-stat").nth(3)).toHaveText(
    "5Airports",
  );
  await expect(page.locator(".passport-core-stat").nth(4)).toHaveText(
    "3Airlines",
  );
  await expect(page.locator(".passport-core-stat").nth(5)).toHaveText(
    "3Countries",
  );
  await expect(page.locator(".passport-visual")).not.toContainText(
    "Aircraft types",
  );

  await expect(page.locator(".passport-highlights")).toBeVisible();
  await expect(page.locator(".passport-highlight")).toHaveCount(5);
  await page.locator("#passport-flight-search").fill("TAO");
  await expect(page.locator(".flight-row")).toHaveCount(8);
  await expect(page.locator(".passport-core-stat:nth-child(2)")).toContainText(
    "8Flights",
  );
  await page.locator("#passport-flight-search").fill("");
  await expect(page.locator(".flight-row")).toHaveCount(9);
  await expect(page.locator(".passport-exploration")).toHaveCount(0);

  const airport = page.getByRole("button", {
    name: /Filter flights visiting .*TAO/,
  });
  await expect(airport).toContainText("8 visits");
  await airport.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".flight-row")).toHaveCount(8);
  await expect(airport).toHaveAttribute("aria-pressed", "true");
  await airport.click();
  await expect(page.locator(".flight-row")).toHaveCount(9);
  await expect(
    page.getByRole("button", {
      name: /Filter flights flown with Cathay Pacific/,
    }),
  ).toHaveCount(0);
  await page.locator("#passport-flight-search").fill("CX");
  await expect(page.locator(".flight-row")).toHaveCount(4);
  await page.locator("#passport-flight-search").fill("");
  await page
    .getByRole("button", {
      name: /Longest flight: filter flights from HKG to BOM/,
    })
    .click();
  await expect(page.locator(".flight-row")).toHaveCount(1);
  await page.locator(".passport-exploration-close").click();
  await expect(
    page.getByRole("button", { name: /Shortest flight: filter/ }),
  ).toHaveCount(0);
  await page.locator("#passport-flight-search").fill("SHA");
  await expect(page.locator(".flight-row")).toHaveCount(4);
  await page.locator("#passport-flight-search").fill("");

  await mkdir("test-results/passport-legend", { recursive: true });
  for (const locale of ["en", "zh-CN", "zh-TW"]) {
    for (const theme of ["light", "dark"]) {
      await page.goto("/#settings");
      const settings = page.locator(".settings-display-fields select");
      await settings.nth(0).selectOption(locale);
      await settings.nth(1).selectOption(theme);
      await page.goto("/#passport");
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      for (const width of [1440, 1366, 1280, 1024, 761, 390]) {
        await page.setViewportSize({ width, height: 720 });
        expect(
          await page
            .locator("html")
            .evaluate((element) => element.scrollWidth <= element.clientWidth),
        ).toBe(true);
        if (width > 760) {
          await expect(page.locator(".passport-highlights")).toBeVisible();
          await expect(page.locator(".passport-highlight")).toHaveCount(5);
          await expect(page.locator(".passport-legend")).toBeVisible();
          expect(
            await page
              .locator(".passport-visual-sticky")
              .evaluate(
                (element) => element.scrollWidth <= element.clientWidth + 1,
              ),
          ).toBe(true);
          const sizes = await page
            .locator(".passport-core-stat")
            .first()
            .evaluate((element) =>
              ["strong", "span"].map((selector) =>
                parseFloat(
                  getComputedStyle(element.querySelector(selector)!).fontSize,
                ),
              ),
            );
          expect(sizes[0]).toBeGreaterThan(sizes[1]!);
          expect(
            await page
              .locator(".passport-visual-sticky")
              .evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
          ).toBe(true);
        } else {
          await expect(
            page.locator(
              ".passport-highlights, .passport-highlight, .passport-spotlight",
            ),
          ).toHaveCount(0);
          await expect(page.locator(".passport-legend")).toBeHidden();
          await expect(page.locator(".passport-mobile-summary")).toBeVisible();
          await expect(page.locator(".passport-delay-panel")).toBeVisible();
          await expect(page.locator(".passport-network-panel")).toBeVisible();
        }
        await page.screenshot({
          path: `test-results/passport-legend/${locale}-${theme}-${width}.png`,
          fullPage: true,
        });
      }
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    }
  }

  for (const width of [760, 761, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    if (width > 760) {
      await expect(page.locator(".passport-highlights")).toBeVisible();
      await expect(page.locator(".passport-highlight")).toHaveCount(5);
    } else {
      await expect(page.locator(".passport-highlights")).toHaveCount(0);
      const highlightsInTabOrder = await page
        .locator("button")
        .evaluateAll((buttons) =>
          buttons.some(
            (button) => button.closest(".passport-highlights") !== null,
          ),
        );
      expect(highlightsInTabOrder).toBe(false);
    }
  }
});
