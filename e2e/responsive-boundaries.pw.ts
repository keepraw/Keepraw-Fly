import { openSettingsCategory } from "./helpers/settings";
import { expectDetailGlobe } from "./helpers/detail-globe";
import { expectFlightRowGeometry } from "./helpers/flight-row-geometry";
import { disablePassportWebGL } from "./helpers/passport-svg";
test.beforeEach(async ({ page }) => disablePassportWebGL(page));

import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  collectBrowserErrors,
  expectDetailLayout,
  expectHealthyPage,
  expectPassportLayout,
  expectReachable,
  expectSeparateBoxes,
  expectSettingsLayout,
  expectShell,
  expectUnclipped,
  importArchive,
  navigateTo,
} from "./helpers/responsive";

const viewports = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 760, height: 900 },
  { width: 761, height: 900 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
];

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

for (const viewport of viewports) {
  test(`Passport, Flight Detail and Settings remain reachable without document overflow at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    const errors = collectBrowserErrors(page);
    const mobile = viewport.width <= 760;
    await page.setViewportSize(viewport);
    await importArchive(page);

    await test.step("Passport: correct layout mode, navigation, scrollable flight rows and add-flight entry", async () => {
      await expectShell(page, mobile, "passport");
      await expectPassportLayout(page, mobile);
      await expectHealthyPage(page, errors);
      await expectReachable(page.locator(".flight-row").last());
      await expectReachable(
        page.getByRole("button", { name: "Add flight", exact: true }),
      );
      await page
        .getByRole("button", { name: "Add flight", exact: true })
        .click();
      const editor = page.getByRole("dialog", {
        name: "Add a flight",
        exact: true,
      });
      await expect(editor).toBeVisible();
      await expectReachable(
        editor.getByRole("button", { name: "Cancel", exact: true }).last(),
      );
      await expectHealthyPage(page, errors);
      await editor
        .getByRole("button", { name: "Cancel", exact: true })
        .last()
        .click();
      await expect(editor).toHaveCount(0);
      if (!mobile && viewport.height > 540) {
        // Normal desktop shows all Highlights without a right scrollport.
        await expectReachable(
          page.locator("button.passport-spotlight-item").first(),
        );
      }
      await expectHealthyPage(page, errors);
    });

    await test.step("Flight Detail: correct column/map mode, flight content and edit/back actions", async () => {
      await page.getByRole("button", { name: /Open UA123/ }).click();
      await expect(page.locator(".detail-heading-eyebrow")).toContainText(
        "UA123",
      );
      await expectDetailLayout(page);
      await expectReachable(
        page.locator(".detail-stop--arrival .detail-airport-time"),
      );
      const edit = page.getByRole("button", {
        name: "Edit flight",
        exact: true,
      });
      await expectReachable(edit);
      await edit.click();
      const editor = page.getByRole("dialog", {
        name: "Edit flight",
        exact: true,
      });
      await expect(editor.getByLabel("Flight number")).toHaveValue("UA123");
      await expectReachable(
        editor.getByRole("button", { name: "Cancel", exact: true }).last(),
      );
      await expectHealthyPage(page, errors);
      await editor
        .getByRole("button", { name: "Cancel", exact: true })
        .last()
        .click();
      await expect(editor).toHaveCount(0);
      await expectHealthyPage(page, errors);
      await expectReachable(page.locator(".detail-header-back"));
      await page.locator(".detail-header-back").click();
    });

    await test.step("Settings: accessible navigation, responsive rows and operable preferences", async () => {
      await navigateTo(page, "settings");
      await expectShell(page, mobile, "settings");
      await expectSettingsLayout(page, mobile);
      const appearance = page.getByRole("combobox", {
        name: "Appearance",
        exact: true,
      });
      await expectReachable(appearance);
      await appearance.selectOption("dark");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await openSettingsCategory(page, "Data and backup");
      await expectReachable(
        page.locator(".import-control-settings > .settings-action"),
      );
      await expectHealthyPage(page, errors);
      await navigateTo(page, "passport");
      await expectPassportLayout(page, mobile);
      await expectHealthyPage(page, errors);
    });

    await test.step("Resize: switching to the opposite mode and back leaves no stale layout or page errors", async () => {
      await page.setViewportSize(
        mobile ? { width: 761, height: 900 } : { width: 760, height: 900 },
      );
      await expectPassportLayout(page, !mobile);
      await expectHealthyPage(page, errors);
      await page.setViewportSize(viewport);
      await expectShell(page, mobile, "passport");
      await expectPassportLayout(page, mobile);
      await expect(page.locator(".flight-row")).toHaveCount(12);
      await expectHealthyPage(page, errors);
    });
  });
}

test(
  "Passport and Settings retain 760/761 layouts while Flight Detail switches at 1199/1200",
  { tag: "@cross-browser" },
  async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.setViewportSize({ width: 760, height: 900 });
    await importArchive(page);
    await page.getByRole("searchbox").fill("UA123");
    await expect(page.locator(".flight-row")).toHaveCount(1);

    await test.step("Passport: 760→761→760→761 updates CSS and map/highlights DOM without losing search", async () => {
      for (const width of [760, 761, 760, 761]) {
        await page.setViewportSize({ width, height: 900 });
        await expectShell(page, width === 760, "passport");
        await expectPassportLayout(page, width === 760);
        await expect(page.getByRole("searchbox")).toHaveValue("UA123");
        await expect(page.locator(".flight-row")).toHaveCount(1);
        await expectHealthyPage(page, errors);
      }
    });

    await page.getByRole("button", { name: /Open UA123/ }).click();
    await test.step("Flight Detail: narrow resizes retain mobile layout and 1199↔1200 toggles Hero/map on the same flight", async () => {
      for (const width of [
        761, 760, 761, 760, 1023, 1024, 1199, 1200, 1199, 1200,
      ]) {
        await page.setViewportSize({ width, height: 900 });
        await expectDetailLayout(page);
        await expect(page.locator(".detail-heading-eyebrow")).toContainText(
          "UA123",
        );
        await expectReachable(page.locator(".detail-header-back"));
        await expectHealthyPage(page, errors);
      }
    });
    await page.locator(".detail-header-back").click();
    await navigateTo(page, "settings");
    await test.step("Settings: 760→761→760→761 updates category navigation and single-column controls without remounting", async () => {
      await openSettingsCategory(page, "Profile");
      const nativeName = page.getByRole("textbox", {
        name: "Native name",
        exact: true,
      });
      await nativeName.fill("Boundary profile");
      const profileInput = await nativeName.elementHandle();
      for (const width of [760, 761, 760, 761]) {
        await page.setViewportSize({ width, height: 900 });
        await expectShell(page, width === 760, "settings");
        await expectSettingsLayout(page, width === 760);
        // CSS visibility changes must retain the mounted field and its value.
        expect(await profileInput!.evaluate((input) => input.isConnected)).toBe(
          true,
        );
        await openSettingsCategory(page, "Profile");
        await expect(nativeName).toHaveValue("Boundary profile");
        await expectReachable(nativeName);
        await expectHealthyPage(page, errors);
      }
    });
  },
);

for (const theme of ["light", "dark"]) {
  test(`Passport legend and complete flight dates fit their visible containers in ${theme}`, async ({
    page,
  }) => {
    // Full Chromium acceptance matrix: 96 rows across eight viewports.
    // The tagged smoke samples boundary sizes and representative rows instead.
    test.setTimeout(180_000);
    const errors = collectBrowserErrors(page);
    await importArchive(page);
    await navigateTo(page, "settings");
    await page
      .getByRole("combobox", { name: "Appearance", exact: true })
      .selectOption(theme);
    await navigateTo(page, "passport");

    for (const viewport of viewports) {
      await test.step(`${viewport.width}x${viewport.height}`, async () => {
        await page.setViewportSize(viewport);
        await expectPassportLayout(page, viewport.width <= 760);
        if (viewport.width > 760) {
          const legend = page.locator(".passport-map-frequency-legend");
          const controls = page.locator(".route-map .map-zoom-controls");
          await legend.scrollIntoViewIfNeeded();
          await expectUnclipped(legend);
          await expectUnclipped(controls);
          await expectSeparateBoxes(legend, controls);
          const camera = page.locator(".route-map .map-viewport-content");
          const initial = await camera.getAttribute("transform");
          // A short route can already be fitted at maximum zoom in a tall map.
          await controls
            .getByRole("button", { name: "Zoom out", exact: true })
            .click();
          await expect(camera).not.toHaveAttribute("transform", initial!);
          await controls
            .getByRole("button", { name: "Zoom in", exact: true })
            .click();
          await controls
            .getByRole("button", { name: "Fit recorded routes", exact: true })
            .click();
        }
        // Check every row, including rows initially outside the archive scrollport.
        for (const row of await page.locator(".flight-row").all()) {
          const date = row.locator(".flight-date");
          // Reachability scrolls the row, not the date; scrolling the date can
          // silently shift an overflow-x:hidden ancestor sideways.
          await expectReachable(row);
          await expect(date).toHaveText("Aug 19");
          await expectUnclipped(date);
          await expectFlightRowGeometry(row, viewport.width > 760);
        }
        await expectHealthyPage(page, errors);
      });
    }
  });

  test(`Short landscape import, editors and confirmations remain scrollable and operable in ${theme}`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const errors = collectBrowserErrors(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await importArchive(page);
    await navigateTo(page, "settings");
    await page
      .getByRole("combobox", { name: "Appearance", exact: true })
      .selectOption(theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await navigateTo(page, "passport");

    await page.locator(".route-map .map-route").first().focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".flight-row.is-selected")).toHaveCount(1);

    await test.step("Add: header, expanded fields, footer, close and Escape", async () => {
      const add = page.getByRole("button", { name: "Add flight", exact: true });
      await add.click();
      const editor = page.getByRole("dialog", {
        name: "Add a flight",
        exact: true,
      });
      await expectReachable(
        editor.getByRole("heading", { name: "Add a flight", exact: true }),
      );
      await editor.locator(".editor-optional summary").click();
      for (const field of await editor
        .locator("input:not([readonly]), select")
        .all())
        await expectReachable(field);
      await expectReachable(
        editor.getByRole("button", { name: "Save flight", exact: true }),
      );
      await expectHealthyPage(page, errors);
      const close = editor.locator(".editor-close");
      await expectReachable(close);
      await close.click();
      await expect(editor).toHaveCount(0);
      await add.click();
      await page.keyboard.press("Escape");
      await expect(editor).toHaveCount(0);
      await expectReachable(page.locator(".flight-row").last());
    });

    await test.step("Detail and Edit: map, operational data, adjacent navigation, save and delete confirmation", async () => {
      await page.getByRole("button", { name: /Open UA123/ }).click();
      await expectDetailLayout(page);
      await expectReachable(page.locator(".detail-header-more summary"));
      await page.locator(".detail-header-more summary").click();
      await expectReachable(page.locator(".detail-header-more-menu button"));
      await page.keyboard.press("Escape");
      await expect(page.locator(".detail-header-more")).not.toHaveAttribute(
        "open",
        "",
      );
      // Retain the full map/adjacent-flight contracts at their desktop boundary.
      await page.setViewportSize({ width: 1200, height: 390 });
      await expectDetailLayout(page);
      await expect(page.locator(".detail-header-more")).toBeHidden();
      const capable = await expectDetailGlobe(page);
      const controls = page.locator(".detail-globe-frame .globe-controls");
      if (capable) {
        await page
          .locator(".detail-globe-frame")
          .hover({ position: { x: 12, y: 12 } });
        await expectReachable(
          controls.getByRole("button", { name: "Zoom out", exact: true }),
        );
        await controls
          .getByRole("button", { name: "Zoom out", exact: true })
          .click();
        await controls
          .getByRole("button", { name: "Zoom in", exact: true })
          .click();
        await controls
          .getByRole("button", { name: "Fit recorded routes", exact: true })
          .click();
      }
      await expectReachable(
        page.locator(".detail-stop--arrival .detail-airport-time"),
      );
      await expectReachable(
        page.getByRole("button", { name: "Next", exact: true }),
      );
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await expect(page.locator(".detail-heading-eyebrow")).toContainText(
        "UA124",
      );
      await page.getByRole("button", { name: "Previous", exact: true }).click();
      await expect(page.locator(".detail-heading-eyebrow")).toContainText(
        "UA123",
      );
      await page
        .getByRole("button", { name: "Edit flight", exact: true })
        .click();
      const editor = page.getByRole("dialog", {
        name: "Edit flight",
        exact: true,
      });
      await expectReachable(
        editor.getByRole("heading", { name: "Edit flight", exact: true }),
      );
      await editor.getByLabel("Flight number").fill("UA123");
      await expectReachable(
        editor.getByRole("button", { name: "Delete flight", exact: true }),
      );
      await editor
        .getByRole("button", { name: "Delete flight", exact: true })
        .click();
      const confirmation = page.getByRole("alertdialog", {
        name: "Delete flight",
        exact: true,
      });
      await expectReachable(confirmation.getByRole("heading"));
      await expectReachable(
        confirmation.getByRole("button", {
          name: "Delete flight",
          exact: true,
        }),
      );
      await expectReachable(
        confirmation.getByRole("button", { name: "Cancel", exact: true }),
      );
      await expectHealthyPage(page, errors);
      await confirmation
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      await expect(confirmation).toHaveCount(0);
      await expectReachable(
        editor.getByRole("button", { name: "Save flight", exact: true }),
      );
      await editor
        .getByRole("button", { name: "Save flight", exact: true })
        .click();
      await expect(editor).toHaveCount(0);
      await expectHealthyPage(page, errors);
      await expectReachable(page.locator(".detail-header-back"));
      await page.locator(".detail-header-back").click();
    });

    await test.step("Settings: profile, backup export, import preview/actions and clear confirmation", async () => {
      await navigateTo(page, "settings");
      await openSettingsCategory(page, "Profile");
      await expectReachable(page.locator("#settings-profile"));
      await expectReachable(
        page.getByRole("textbox", { name: "Native name", exact: true }),
      );
      await expectReachable(
        page.getByRole("textbox", { name: "Romanized name", exact: true }),
      );
      await openSettingsCategory(page, "Frequent flyer profiles");
      await expectReachable(
        page.getByRole("button", {
          name: "Add frequent flyer program",
          exact: true,
        }),
      );
      await page
        .getByRole("button", {
          name: "Add frequent flyer program",
          exact: true,
        })
        .click();
      for (const field of await page
        .locator(
          ".settings-membership.is-expanded input:not([disabled]), .settings-membership.is-expanded select:not([disabled])",
        )
        .all())
        await expectReachable(field);
      await openSettingsCategory(page, "Data and backup");
      const backup = page.getByRole("button", {
        name: "Export Keepraw Fly JSON",
        exact: true,
      });
      await expectReachable(backup);
      const download = page.waitForEvent("download");
      await backup.click();
      const file = await download;
      expect(await file.failure()).toBeNull();
      const path = await file.path();
      expect(path).not.toBeNull();
      const exported = JSON.parse(await readFile(path!, "utf8"));
      expect(exported.format).toBe("keepraw-fly");
      expect(exported.formatVersion).toBe("0.1.0");
      expect(exported.flights).toHaveLength(12);
      const stored = await page.evaluate(async () => {
        const modulePath = "/src/storage/browser.ts";
        const { browserStorage } = await import(modulePath);
        const archive = await browserStorage.loadDocument();
        return archive.status === "valid" ? archive.document : null;
      });
      expect(exported).toEqual(stored);
      const archive = JSON.parse(
        await readFile(
          new URL("../examples/basic.keepraw-fly.json", import.meta.url),
          "utf8",
        ),
      );
      archive.flights[0].id = "landscape-import";
      archive.flights[0].flightNumber = "UA999";
      const importer = page.locator(".import-control-settings");
      await expectReachable(importer.locator(".settings-action"));
      // Round-trip the actual downloaded bytes through the import validator.
      await importer.locator('input[type="file"]').setInputFiles(path!);
      await expect(
        importer.getByRole("button", {
          name: "No new flights to import",
          exact: true,
        }),
      ).toBeDisabled();
      await expect(importer.getByRole("alert")).toHaveCount(0);
      await importer
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      // Intercept Playwright's chooser event; never drive the native OS dialog.
      const chooser = page.waitForEvent("filechooser");
      await importer.locator(".settings-action").click();
      await (
        await chooser
      ).setFiles({
        name: "landscape.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(archive)),
      });
      await importer
        .locator(".import-preview-heading")
        .evaluate((element) => element.scrollIntoView({ block: "center" }));
      await expectReachable(importer.locator(".import-preview-heading"));
      const confirm = importer.getByRole("button", {
        name: "Import 1 new flight",
        exact: true,
      });
      await expectReachable(confirm);
      await expectHealthyPage(page, errors);
      await importer
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      await expect(importer.locator(".import-preview")).toHaveCount(0);
      await importer.locator('input[type="file"]').setInputFiles({
        name: "landscape.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(archive)),
      });
      await expectReachable(confirm);
      await confirm.click();
      await expect(importer.locator(".import-preview")).toHaveCount(0);
      await expect(page.locator(".flight-row")).toHaveCount(13);
      await expectHealthyPage(page, errors);
      await navigateTo(page, "settings");
      await openSettingsCategory(page, "Danger zone");
      await page
        .getByRole("button", { name: "Clear local data", exact: true })
        .click();
      const clear = page.getByRole("alertdialog");
      await expectReachable(clear.getByRole("heading"));
      await expectReachable(
        clear.getByRole("button", { name: "Clear local data", exact: true }),
      );
      await expectReachable(
        clear.getByRole("button", { name: "Cancel", exact: true }),
      );
      await expectHealthyPage(page, errors);
      await page.keyboard.press("Escape");
      await expect(clear).toHaveCount(0);
      await expectReachable(
        page.getByRole("button", { name: "Clear local data", exact: true }),
      );
      await navigateTo(page, "passport");
      await expect(page.locator(".flight-row")).toHaveCount(13);
      await expectReachable(page.locator(".flight-row").last());
      await expectHealthyPage(page, errors);
    });
  });
}
