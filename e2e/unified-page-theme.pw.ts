import { openSettingsCategory } from "./helpers/settings";
import { expectDetailGlobe } from "./helpers/detail-globe";
import { chromium, expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import {
  importArchive,
  expectHealthyPage,
  collectBrowserErrors,
} from "./helpers/responsive";
import { disablePassportWebGL } from "./helpers/passport-svg";

const colors = {
  light: {
    canvas: "rgb(243, 246, 250)",
    text: "rgb(30, 43, 62)",
    surface: "rgb(247, 249, 252)",
    focus: "rgb(101, 88, 199)",
    warning: "rgb(137, 84, 8)",
    positive: "rgb(40, 121, 93)",
    map: "rgb(220, 233, 245)",
  },
  dark: {
    canvas: "rgb(18, 25, 35)",
    text: "rgb(229, 234, 242)",
    surface: "rgb(21, 30, 42)",
    focus: "rgb(183, 167, 245)",
    warning: "rgb(219, 173, 102)",
    positive: "rgb(116, 186, 149)",
    map: "rgb(9, 25, 45)",
  },
};
async function appearance(page: Page, value: string) {
  const navigation = page.getByRole("navigation", {
    name: /^(Settings|设置|設定)$/,
  });
  const previous = (await navigation.isVisible())
    ? await navigation.locator('[aria-current="true"]').textContent()
    : null;
  await openSettingsCategory(page, "General");
  await page
    .getByRole("combobox", { name: /^(Appearance|外观|外觀)$/ })
    .selectOption(value);
  // Theme changes must preserve expanded editors, queries and import previews
  // even though desktop categories hide their controls while General is open.
  if (previous) await openSettingsCategory(page, previous);
}
async function shell(page: Page, dark: boolean) {
  const palette = colors[dark ? "dark" : "light"];
  await expect(page.locator(".app-shell")).toHaveCSS(
    "background-color",
    palette.canvas,
  );
  await expect(page.locator(".app-shell")).toHaveCSS("color", palette.text);
  await expect(page.locator(".site-header")).toBeVisible();
  expect(
    await page
      .locator(".app-shell")
      .evaluate((el) =>
        getComputedStyle(el).getPropertyValue("--color-focus").trim(),
      ),
  ).toBe(dark ? "#b7a7f5" : "#6558c7");
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await disablePassportWebGL(page);
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
});

for (const width of [360, 390, 430, 760, 761, 1024, 1199, 1200, 1440]) {
  for (const language of ["en-US", "zh-CN", "zh-TW"]) {
    test(`shared page colors and live System at ${width}px in ${language}`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      const errors = collectBrowserErrors(page);
      await page.setViewportSize({ width, height: 900 });
      await importArchive(page);
      for (const [mode, os, dark] of [
        ["light", "dark", false],
        ["dark", "light", true],
        ["system", "light", false],
        ["system", "dark", true],
      ] as const) {
        await page.goto("/#settings");
        await page
          .locator(".settings-display-fields select")
          .first()
          .selectOption(language);
        await appearance(page, mode);
        await page.emulateMedia({ colorScheme: os });
        await shell(page, dark);
        await expect(page.locator(".settings-panel").first()).toHaveCSS(
          "background-color",
          "rgba(0, 0, 0, 0)",
        );
        const control = page.locator(".settings-display-fields select").first();
        await control.focus();
        await page.keyboard.press("Tab");
        await expect(
          page.locator(".settings-display-fields select").nth(1),
        ).toHaveCSS("outline-color", colors[dark ? "dark" : "light"].focus);
        await page.goto("/#passport");
        await shell(page, dark);
        await page.locator(".flight-row").first().click();
        await shell(page, dark);
        await expect(
          page.locator(".detail-airport-time .time-source"),
        ).toHaveCount(2);
        await expect(
          page.locator(".detail-scheduled-time .time-source"),
        ).toHaveCount(2);
        await expect(page.locator(".detail-stop-facts").first()).toContainText(
          "F12",
        );
        await expect(
          page.locator(".flight-deviation.is-late").first(),
        ).toHaveCSS("color", colors[dark ? "dark" : "light"].warning);
        if (width >= 1200) {
          await expectDetailGlobe(page);
          await expect(
            page.locator(".detail-globe-frame .globe-stage"),
          ).toHaveAttribute("data-theme", dark ? "dark" : "light");
        } else await expect(page.locator(".detail-route-map")).toHaveCount(0);
        // Switch the OS on the mounted Detail page, without a reload or navigation.
        if (mode === "system") {
          await page.emulateMedia({ colorScheme: dark ? "light" : "dark" });
          await shell(page, !dark);
          await expect(page.locator(".detail-heading-eyebrow")).toContainText(
            "UA123",
          );
          if (width < 1200)
            await expect(
              page.locator(".detail-route-map, .detail-globe-frame, canvas"),
            ).toHaveCount(0);
        }
        await page.locator(".detail-header-back").click();
        await expect(page.locator(".flight-row")).toHaveCount(12);
      }
      await expectHealthyPage(page, errors);
    });
  }
}

for (const theme of ["light", "dark"] as const) {
  test(`Settings ${theme}: previews, errors, membership edits, storage, export and clear cancellation`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.addInitScript(() => {
      let granted = false;
      Object.defineProperty(navigator, "storage", {
        configurable: true,
        value: {
          persisted: async () => granted,
          persist: async () => {
            granted = true;
            return true;
          },
        },
      });
    });
    await importArchive(page);
    await page.goto("/#settings");
    await appearance(page, theme);
    const palette = colors[theme];
    await openSettingsCategory(page, "Frequent flyer profiles");
    await page
      .getByRole("button", { name: "Add frequent flyer program" })
      .click();
    const membership = page.locator(".settings-membership").last();
    await membership.getByLabel("Program name").fill("Theme review membership");
    await membership.getByLabel("Member number").fill("KF-2026");
    const airlines = membership.getByRole("combobox", {
      name: "Associated airlines",
    });
    await airlines.fill("United");
    await expect(page.locator(".airline-options")).toHaveCSS(
      "background-color",
      palette.surface,
    );
    await expect(
      page.locator(".airline-options [aria-selected=true]"),
    ).toBeVisible();
    await airlines.press("Enter");
    await expect(
      membership.locator('.airline-chip[data-airline-code="UA"]'),
    ).toBeVisible();
    await airlines.fill("Shenzhen");
    // Keep an unsaved search query and expanded form while the theme changes.
    await appearance(page, theme === "light" ? "dark" : "light");
    await expect(airlines).toHaveValue("Shenzhen");
    await expect(membership.getByLabel("Member number")).toHaveValue("KF-2026");
    await expect(
      membership.locator(".settings-membership-editor-fields"),
    ).toBeVisible();
    await appearance(page, theme);
    await airlines.focus();
    await expect(page.locator(".airline-options")).toHaveCSS(
      "background-color",
      palette.surface,
    );
    await airlines.press("Escape");
    await openSettingsCategory(page, "Data and backup");
    const json = page.locator('#settings-import input[type="file"]');
    await json.setInputFiles("examples/basic.keepraw-fly.json");
    const preview = page.locator(".import-preview");
    await expect(preview).toHaveCSS("background-color", palette.canvas);
    await expect(preview.locator(".import-stat-valid dd")).toHaveCSS(
      "color",
      palette.positive,
    );
    await appearance(page, "system");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(preview).toHaveCSS("background-color", colors.dark.canvas);
    await page.emulateMedia({ colorScheme: "light" });
    await expect(preview).toHaveCSS("background-color", colors.light.canvas);
    await expect(preview).toContainText("basic.keepraw-fly.json");
    await appearance(page, theme);
    await preview.getByRole("button", { name: "Cancel", exact: true }).click();
    await json.setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from("{broken"),
    });
    await expect(page.locator(".validation-errors")).toBeVisible();
    await expect(page.locator(".validation-errors strong")).toHaveCSS(
      "color",
      theme === "dark" ? "rgb(237, 139, 124)" : "rgb(189, 68, 58)",
    );
    await page
      .getByLabel("Open CSV file", { exact: true })
      .setInputFiles("examples/flights.csv");
    await expect(page.locator(".csv-preview")).toHaveCSS(
      "background-color",
      palette.canvas,
    );
    await page
      .locator(".csv-preview")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await page
      .getByLabel("Open Flighty CSV", { exact: true })
      .setInputFiles("examples/flighty.csv");
    await expect(page.locator(".csv-preview")).toHaveCSS(
      "background-color",
      palette.canvas,
    );
    await page
      .locator(".csv-preview")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Request persistent storage", exact: true })
      .click();
    await expect(
      page.locator(".settings-storage-status.is-protected"),
    ).toHaveCSS("color", palette.positive);
    await expect(
      page.locator(".settings-protection-actions > button"),
    ).toBeDisabled();
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export Keepraw Fly JSON", exact: true })
      .click();
    const download = await downloadPromise;
    const exported = JSON.parse(
      await readFile((await download.path())!, "utf8"),
    );
    expect(exported.flights).toHaveLength(12);
    expect(exported.frequentFlyerMemberships.at(-1).memberNumber).toBe(
      "KF-2026",
    );
    await openSettingsCategory(page, "Danger zone");
    const clear = page.locator(".danger-action");
    for (const cancel of ["Escape", "button", "backdrop"] as const) {
      await clear.focus();
      await clear.press("Enter");
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toHaveCSS("background-color", palette.surface);
      await expect(dialog).toHaveCSS("color", palette.text);
      expect(
        await page
          .locator(".confirmation-backdrop--settings")
          .evaluate((el) => el.parentElement === document.body),
      ).toBe(true);
      await expect(
        dialog.getByRole("button", { name: "Cancel", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(
        dialog.getByRole("button", { name: "Clear local data", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(
        dialog.getByRole("button", { name: "Cancel", exact: true }),
      ).toBeFocused();
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(results.violations).toEqual([]);
      if (cancel === "Escape") await page.keyboard.press("Escape");
      else if (cancel === "button")
        await dialog
          .getByRole("button", { name: "Cancel", exact: true })
          .click();
      else
        await page
          .locator(".confirmation-backdrop")
          .click({ position: { x: 2, y: 2 } });
      await expect(dialog).toHaveCount(0);
      await expect(clear).toBeFocused();
    }
    await page.goto("/#passport");
    await page.reload();
    await expect(page.locator(".flight-row")).toHaveCount(12);
    await page.goto("/#settings");
    await openSettingsCategory(page, "Frequent flyer profiles");
    await page.locator(".settings-membership-edit").last().click();
    await page.locator(".membership-delete").last().click();
    await expect(page.locator(".settings-membership")).toHaveCount(
      exported.frequentFlyerMemberships.length - 1,
    );
  });
}

test("Settings Portal follows live System; unrelated editor confirmations retain default colors @cross-browser", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await page.goto("/#settings");
  await appearance(page, "system");
  await openSettingsCategory(page, "Danger zone");
  await page.locator(".danger-action").focus();
  await page.locator(".danger-action").press("Enter");
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByRole("button").first()).toBeFocused();
  // Native Tab navigation establishes focus-visible consistently in every engine.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  for (const theme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await expect(dialog).toHaveCSS("background-color", colors[theme].surface);
    await expect(dialog).toHaveCSS("color", colors[theme].text);
    await expect(dialog.getByRole("button").first()).toHaveCSS(
      "outline-color",
      colors[theme].focus,
    );
  }
  await page.keyboard.press("Escape");
  await openSettingsCategory(page, "Data and backup");
  await page
    .getByRole("button", { name: "Export Keepraw Fly JSON", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCSS(
    "background-color",
    colors.light.surface,
  );
  await page.keyboard.press("Escape");
  await page.goto("/#passport");
  await page.locator(".flight-row").first().click();
  await page.getByRole("button", { name: "Edit flight", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete flight", exact: true })
    .click();
  await expect(page.locator(".confirmation-backdrop--settings")).toHaveCount(0);
  await expect(page.getByRole("alertdialog")).toHaveCSS(
    "background-color",
    "rgb(253, 252, 248)",
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Delete flight", exact: true }),
  ).toBeFocused();
});

test("125% layout zoom and live 760/761px boundaries keep page state and controls reachable", async ({
  page,
}) => {
  await importArchive(page);
  await page.goto("/#settings");
  for (const theme of ["light", "dark"]) {
    await appearance(page, theme);
    for (const width of [360, 390, 430, 760, 761, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => {
        document.documentElement.style.zoom = "1.25";
      });
      await shell(page, theme === "dark");
      await openSettingsCategory(page, "Danger zone");
      await page.locator(".danger-action").click();
      await expect(
        page.getByRole("alertdialog").getByRole("button").first(),
      ).toBeInViewport();
      await page.keyboard.press("Escape");
      await page.goto("/#passport");
      await page.locator(".flight-row").first().click();
      await shell(page, theme === "dark");
      await expect(page.locator(".detail-heading h1")).toContainText(
        "San Francisco",
      );
      await page.goto("/#settings");
      await page.evaluate(() => {
        document.documentElement.style.zoom = "";
      });
    }
  }
});

for (const language of ["en-US", "zh-CN", "zh-TW"] as const) {
  test(`Detail cities, long names, operational colors and complete times in ${language}`, async ({
    page,
  }) => {
    const archive = JSON.parse(
      await readFile("examples/basic.keepraw-fly.json", "utf8"),
    );
    const original = archive.flights[0];
    const flights = [
      {
        ...original,
        id: "cities",
        origin: { iata: "KHN" },
        destination: { iata: "TAO" },
      },
      {
        ...original,
        id: "long",
        origin: { iata: "SGN" },
        destination: { iata: "TPE" },
        actualArrival: "2026-08-19T11:21:00-07:00",
      },
      {
        ...original,
        id: "diversion",
        origin: { iata: "EWR" },
        destination: { iata: "TPE" },
        divertedTo: { iata: "CAN" },
      },
      {
        ...original,
        id: "cancelled",
        origin: { iata: "ZZZ" },
        destination: { iata: "SGN" },
        cancelled: true,
      },
    ];
    await importArchive(page, flights);
    await page.goto("/#settings");
    await page
      .locator(".settings-display-fields select")
      .first()
      .selectOption(language);
    for (const theme of ["light", "dark"] as const) {
      await appearance(page, theme);
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/#passport");
        for (const [index, id] of [
          "cities",
          "long",
          "diversion",
          "cancelled",
        ].entries()) {
          const row = page.locator(
            `.flight-record[data-flight-id="${id}"] .flight-row`,
          );
          const cityLabels = await row
            .locator(".flight-route-cities > span:not(.route-direction)")
            .allTextContents();
          await row.click();
          await expect(page.locator(".detail-heading h1")).toContainText(
            cityLabels[0]!,
          );
          await expect(page.locator(".detail-heading h1")).toContainText(
            cityLabels[1]!,
          );
          await expect(page.locator(".route-origin-city")).toHaveText(
            cityLabels[0]!,
          );
          await expect(page.locator(".route-arrival-city")).toHaveText(
            id === "diversion"
              ? { "en-US": "Guangzhou", "zh-CN": "广州", "zh-TW": "廣州" }[
                  language
                ]
              : cityLabels[1]!,
          );
          await expect(page.locator(".detail-airport-time time")).toHaveCount(
            2,
          );
          await expect(page.locator(".detail-scheduled-time time")).toHaveCount(
            2,
          );
          await expect(
            page.locator(".detail-airport-time time").first(),
          ).toHaveAttribute("datetime", original.actualDeparture);
          await expect(
            page.locator(".detail-scheduled-time time").first(),
          ).toHaveAttribute("datetime", original.scheduledDeparture);
          await expect(page.locator(".detail-metadata-shelf")).toContainText(
            "N12345",
          );
          if (index === 0)
            await expect(
              page.locator(".flight-deviation.is-late").first(),
            ).toHaveCSS("color", colors[theme].warning);
          if (id === "long")
            await expect(
              page.locator(".flight-deviation.is-early").first(),
            ).toHaveCSS("color", colors[theme].positive);
          if (id === "diversion") {
            await expect(
              page.locator(".detail-flight-phase.is-diverted"),
            ).toHaveCSS("color", colors[theme].warning);
            await expect(
              page.locator(".detail-stop--arrival strong").first(),
            ).toHaveText("CAN");
            await expect(page.locator(".detail-diversion-note")).toContainText(
              "CAN",
            );
          }
          if (id === "cancelled") {
            await expect(
              page.locator(".detail-flight-phase.is-cancelled"),
            ).toHaveCSS(
              "color",
              theme === "dark"
                ? "rgb(237, 139, 124)"
                : width <= 760
                  ? "rgb(180, 64, 54)"
                  : "rgb(189, 68, 58)",
            );
            await expect(page.locator(".route-origin-city")).toHaveText("ZZZ");
          }
          const heading = page.locator(".detail-heading h1");
          expect(
            await heading.evaluate((el) => el.scrollWidth <= el.clientWidth),
          ).toBe(true);
          await shell(page, theme === "dark");
          await page.locator(".detail-header-back").click();
        }
      }
      await page.goto("/#settings");
    }
  });
}

test("native 125% browser zoom keeps Detail and Settings themed and reachable across all boundaries", async ({}, testInfo) => {
  test.setTimeout(120_000);
  const profile = testInfo.outputPath("task-a-native-zoom-profile");
  await mkdir(`${profile}/Default`, { recursive: true });
  await writeFile(
    `${profile}/Default/Preferences`,
    JSON.stringify({
      partition: { default_zoom_level: { x: Math.log(1.25) / Math.log(1.2) } },
    }),
  );
  const context = await chromium.launchPersistentContext(profile, {
    headless: true,
    channel: "chromium",
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    viewport: { width: 1440, height: 1000 },
    baseURL: "http://127.0.0.1:5173",
    locale: "en-US",
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    await disablePassportWebGL(page);
    await importArchive(page);
    for (const language of ["en-US", "zh-CN", "zh-TW"]) {
      await page.goto("/#settings");
      await page
        .locator(".settings-display-fields select")
        .first()
        .selectOption(language);
      for (const theme of ["light", "dark"] as const) {
        await appearance(page, theme);
        for (const width of [360, 390, 430, 760, 761, 1024, 1440]) {
          await page.setViewportSize({ width, height: 1000 });
          expect(await page.evaluate(() => devicePixelRatio)).toBe(1.25);
          await shell(page, theme === "dark");
          await openSettingsCategory(page, "Danger zone");
          await page.locator(".danger-action").focus();
          await page.locator(".danger-action").press("Enter");
          const dialog = page.getByRole("alertdialog");
          await expect(dialog).toHaveCSS(
            "background-color",
            colors[theme].surface,
          );
          await expect(dialog.getByRole("button").first()).toBeFocused();
          await expect(dialog.getByRole("button").first()).toBeInViewport();
          await page.keyboard.press("Escape");
          await expect(page.locator(".danger-action")).toBeFocused();
          await page.goto("/#passport");
          await page.locator(".flight-row").first().click();
          await shell(page, theme === "dark");
          await expect(
            page.locator(".detail-airport-time .time-source"),
          ).toHaveCount(2);
          await expect(
            page.locator(".detail-scheduled-time .time-source"),
          ).toHaveCount(2);
          await page.locator(".detail-header-back").focus();
          await page.locator(".detail-header-back").press("Enter");
          await expect(page.locator(".flight-row")).toHaveCount(12);
          await page.goto("/#settings");
        }
      }
    }
  } finally {
    await context.close();
  }
  // Failed runs retain the profile; successful browser caches are not evidence.
  await rm(profile, { recursive: true, force: true });
});
