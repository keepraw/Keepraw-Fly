import { expect, test } from "@playwright/test";
import {
  collectBrowserErrors,
  expectHealthyPage,
  expectReachable,
  importArchive,
} from "./helpers/responsive";
import { disablePassportWebGL } from "./helpers/passport-svg";

test.beforeEach(async ({ page }) => {
  await disablePassportWebGL(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 800 });
  await importArchive(page);
  await page.goto("/#settings");
});

test("mobile Settings edits memberships and preserves all preferences after reload @cross-browser", async ({
  page,
}) => {
  const errors = collectBrowserErrors(page);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.getByLabel("Native name", { exact: true }).fill("张鸿川");
  await page
    .getByLabel("Romanized name", { exact: true })
    .fill("Zhang Hongchuan");
  await page
    .getByRole("group", { name: "Primary name", exact: true })
    .getByRole("radio", { name: "Romanized", exact: true })
    .check();
  await page
    .getByRole("combobox", { name: "Appearance", exact: true })
    .selectOption("dark");
  await page
    .getByRole("combobox", { name: "Distance", exact: true })
    .selectOption("kilometers");
  await page
    .getByRole("combobox", { name: "Time format", exact: true })
    .selectOption("12-hour");
  await page
    .getByLabel("Solar illumination", { exact: true })
    .selectOption("realtime");
  await page.getByRole("switch", { name: /Power User Mode/ }).check();

  const add = page.getByRole("button", {
    name: "Add frequent flyer program",
    exact: true,
  });
  await expectReachable(add);
  await add.focus();
  await add.press("Enter");
  const membership = page.locator(".settings-membership").last();
  await membership.getByLabel("Program name").fill("Mobile review program");
  await membership.getByLabel("Member number").fill("KF-2026");
  await membership.getByLabel("Current tier", { exact: true }).fill("Gold");
  const airlines = membership.getByRole("combobox", {
    name: "Associated airlines",
    exact: true,
  });
  await airlines.fill("UA");
  await expect(
    membership.getByRole("option", { name: /^UA United Airlines/ }),
  ).toBeVisible();
  await airlines.press("Enter");
  await expect(membership.getByLabel("Default airline")).toHaveValue("UA");
  await airlines.fill("CA");
  await expect(
    membership.getByRole("option", { name: /^CA Air China/ }),
  ).toBeVisible();
  await airlines.press("Enter");
  await membership.getByLabel("Default airline").selectOption("CA");
  const removeAirline = membership.getByRole("button", {
    name: "Remove CA · Air China",
    exact: true,
  });
  await expectReachable(removeAirline);
  await removeAirline.click();
  await expect(membership.getByLabel("Default airline")).toHaveValue("UA");
  await membership
    .getByRole("button", { name: "Collapse", exact: true })
    .click();
  await expect(membership.getByLabel("Member number")).toHaveCount(0);

  // Wait for the real IndexedDB writes before refreshing, rather than relying on
  // UI values that could still be pending in the persistence queue.
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const modulePath = "/src/storage/browser.ts";
        const { browserStorage } = await import(modulePath);
        const archive = await browserStorage.loadDocument();
        const settings = await browserStorage.loadSettings();
        return {
          settings,
          profile: archive.status === "valid" ? archive.document.profile : null,
          memberships:
            archive.status === "valid"
              ? archive.document.frequentFlyerMemberships
              : null,
        };
      }),
    )
    .toMatchObject({
      settings: {
        appearance: "dark",
        distanceUnit: "kilometers",
        timeFormat: "12-hour",
        solarMode: "realtime",
        powerUserMode: true,
      },
      profile: {
        name: {
          native: "张鸿川",
          romanized: "Zhang Hongchuan",
          primary: "romanized",
        },
      },
      memberships: expect.arrayContaining([
        expect.objectContaining({
          programName: "Mobile review program",
          memberNumber: "KF-2026",
          tier: "Gold",
          associatedAirlines: ["UA"],
          defaultAirline: "UA",
        }),
      ]),
    });
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Appearance", exact: true }),
  ).toHaveValue("dark");
  await expect(
    page.getByRole("combobox", { name: "Distance", exact: true }),
  ).toHaveValue("kilometers");
  await expect(
    page.getByRole("combobox", { name: "Time format", exact: true }),
  ).toHaveValue("12-hour");
  await expect(
    page.getByLabel("Solar illumination", { exact: true }),
  ).toHaveValue("realtime");
  await expect(
    page.getByRole("switch", { name: /Power User Mode/ }),
  ).toBeChecked();
  await expect(
    page
      .getByRole("group", { name: "Primary name", exact: true })
      .getByRole("radio", { name: "Romanized", exact: true }),
  ).toBeChecked();
  await membership.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(membership.getByLabel("Member number")).toHaveValue("KF-2026");
  const restoredMembership = page.locator(".settings-membership").first();
  await add.click();
  const additionalMembership = page.locator(".settings-membership").last();
  await additionalMembership.getByLabel("Program name").fill("Another program");
  await expect(restoredMembership.getByLabel("Member number")).toHaveCount(0);
  await expect(
    restoredMembership.locator(".settings-membership-summary"),
  ).toContainText("KF-2026");
  await additionalMembership
    .getByRole("button", { name: "Collapse", exact: true })
    .click();
  await expect(page.locator(".settings-membership-editor-fields")).toHaveCount(
    0,
  );
  const edit = restoredMembership.getByRole("button", {
    name: "Edit",
    exact: true,
  });
  await expectReachable(edit);
  await edit.focus();
  await edit.press("Enter");
  await expect(page.locator(".settings-membership-editor-fields")).toHaveCount(
    1,
  );
  await expect(restoredMembership.getByLabel("Member number")).toHaveValue(
    "KF-2026",
  );
  await expect(additionalMembership.getByLabel("Member number")).toHaveCount(0);
  const remove = restoredMembership.getByRole("button", {
    name: "Remove membership",
    exact: true,
  });
  await expectReachable(remove);
  await remove.click();
  await expect(
    page.getByText("Mobile review program", { exact: true }),
  ).toHaveCount(0);
  await additionalMembership
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await additionalMembership
    .getByRole("button", { name: "Remove membership", exact: true })
    .click();
  await expect(page.locator(".settings-membership")).toHaveCount(0);
  await expectHealthyPage(page, errors);
});

test("mobile Settings wraps all languages with system fonts and keeps membership controls reachable @cross-browser", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const errors = collectBrowserErrors(page);
  // Exercise the documented system-font fallback without depending on the
  // optional font CDN. The existing typography journeys retain live font coverage.
  await page.route(
    "https://cdn.jsdelivr.net/npm/misans-webfont@*/**/result.min.css",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/css",
        headers: { "access-control-allow-origin": "*" },
        body: "/* Use the system font stack for this layout smoke. */",
      }),
  );
  await page
    .getByRole("button", { name: "Add frequent flyer program" })
    .click();
  const membership = page.locator(".settings-membership").last();
  await membership
    .getByLabel("Program name")
    .fill("A long frequent flyer program name 常旅客計劃名稱");
  await membership.getByLabel("Member number").fill("KF-2026-0123456789");

  for (const language of ["en", "zh-CN", "zh-TW"]) {
    await page
      .locator(".settings-display-fields select")
      .first()
      .selectOption(language);
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    for (const theme of ["light", "dark"]) {
      await page
        .locator(".settings-display-fields select")
        .nth(1)
        .selectOption(theme);
      for (const width of [390, 360, 320]) {
        await page.setViewportSize({ width, height: 800 });
        const layout = await page
          .locator(".settings-content")
          .evaluate((content) => {
            const elements = Array.from(
              content.querySelectorAll<HTMLElement>(
                ".settings-row-label, .settings-row-copy > small, .settings-membership-summary-copy, input:not([type=file]):not([type=radio]):not([role=switch]), select, button, .settings-action",
              ),
            ).filter((element) => element.getBoundingClientRect().width > 0);
            return {
              clipped: elements
                .filter((element) => {
                  const rect = element.getBoundingClientRect();
                  return (
                    rect.left < 0 ||
                    rect.right > innerWidth ||
                    (!(element instanceof HTMLInputElement) &&
                      element.scrollWidth > element.clientWidth + 1)
                  );
                })
                .map((element) => element.className),
              nestedScrollers: Array.from(
                content.querySelectorAll<HTMLElement>(
                  ".settings-sections, .settings-section, .settings-panel, .settings-membership-editor-fields",
                ),
              ).filter((element) =>
                /auto|scroll/.test(getComputedStyle(element).overflowY),
              ).length,
            };
          });
        expect(layout.clipped).toEqual([]);
        expect(layout.nestedScrollers).toBe(0);
        await expectReachable(membership.locator(".settings-membership-edit"));
        await expectReachable(membership.locator(".membership-delete"));
        await expectReachable(page.locator(".danger-action"));
        await expectHealthyPage(page, errors);
      }
    }
  }
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const modulePath = "/src/storage/browser.ts";
        const { browserStorage } = await import(modulePath);
        return (await browserStorage.loadSettings())?.language;
      }),
    )
    .toBe("zh-TW");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-TW");
  await expect(
    page.locator(".settings-display-fields select").first(),
  ).toHaveValue("zh-TW");
});
