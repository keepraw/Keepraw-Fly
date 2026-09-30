import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const exampleArchive = fileURLToPath(new URL("../examples/basic.keepraw-fly.json", import.meta.url));
const exampleCsv = fileURLToPath(new URL("../examples/flights.csv", import.meta.url));
const reviewScreenshotDirectory = fileURLToPath(new URL("../test-results/review/", import.meta.url));

async function navigateTo(page: Page, destination: "passport" | "settings") {
  if (await page.locator(".mobile-page-heading").isVisible()) {
    if (destination === "settings") await page.locator(".mobile-settings-button").click();
    else if (await page.locator(".mobile-page-back").isVisible()) await page.locator(".mobile-page-back").click();
    else if (await page.locator(".detail-header-back").isVisible()) await page.locator(".detail-header-back").click();
    return;
  }
  await page.locator(`.site-navigation a[href="#${destination}"]`).click();
}

test("creates, edits and deletes a personal flight without a JSON file", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create my archive" }).click();

  const editor = page.getByRole("dialog", { name: "Add a flight" });
  await expect(editor).toBeVisible();
  await editor.getByLabel("Flight number").fill("UA123");
  await editor.getByRole("combobox", { name: "Origin" }).fill("SFO");
  await editor.getByRole("combobox", { name: "Destination" }).fill("LAX");
  await editor.locator(".editor-optional > summary").click();
await expect(editor.getByLabel("Destination gate")).toBeVisible();
  await expect(editor.getByText("Single-letter airline booking code", { exact: false })).toHaveCount(0);
  await editor.getByLabel("Booking class").fill("P");
  await editor.getByLabel("Baggage carousel").fill("D05");
  await expect(editor.getByLabel("Baggage carousel")).toHaveValue("D05");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 720 });
  await editor.getByRole("button", { name: "Save flight" }).click();

  await expect(page.locator(".detail-heading-eyebrow")).toContainText("UA123");
  await expect(page.locator(".detail-metadata-column").first()).toContainText("P");
  await expect(page.locator(".detail-stop--arrival .detail-stop-facts")).toContainText("D05");
  await page.getByRole("button", { name: "Edit flight" }).click();
  const editFormDialog = page.getByRole("dialog", { name: "Edit flight" });
  await editFormDialog.getByLabel("Flight number").fill("UA124");
  await editFormDialog.getByRole("button", { name: "Save flight" }).click();
  await expect(page.locator(".detail-heading-eyebrow")).toContainText("UA124");

  await page.getByRole("button", { name: "Duplicate as new" }).click();
  const duplicateDialog = page.getByRole("dialog", { name: "Duplicate flight" });
  await expect(duplicateDialog.getByRole("combobox", { name: "Origin" })).toHaveValue("SFO");
  await duplicateDialog.getByLabel("Flight number").fill("UA125");
  await duplicateDialog.getByRole("button", { name: "Save flight" }).click();
  await expect(page.locator(".detail-heading-eyebrow")).toContainText("UA125");

  await page.getByRole("button", { name: "Edit flight" }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit flight" });
  const deleteButton = editDialog.getByRole("button", { name: "Delete flight" });
  await page.setViewportSize({ width: 390, height: 844 });
  await deleteButton.click();
  const deleteConfirmation = page.getByRole("alertdialog", { name: "Delete flight" });
  await expect(deleteConfirmation).toBeVisible();
  await expect(deleteConfirmation.getByRole("button", { name: "Cancel" })).toBeFocused();
  expect(await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(deleteConfirmation).toHaveCount(0);
  await expect(deleteButton).toBeFocused();
  await deleteButton.click();
  await deleteConfirmation.getByRole("button", { name: "Delete flight" }).click();
  await expect(page.getByRole("button", { name: /Open UA124/ })).toBeVisible();
});

test("manages associated airlines as searchable chips with a constrained default", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create my archive" }).click();
  await page.getByRole("dialog", { name: "Add a flight" }).locator(".button-secondary").click();
  await navigateTo(page, "settings");
  await page.getByRole("button", { name: "Add frequent flyer program" }).click();

  const membership = page.locator(".membership-row").last();
  const airlineSearch = membership.getByRole("combobox", { name: "Associated airlines" });
  const defaultAirline = membership.getByLabel("Default airline");

  await airlineSearch.fill("ZH");
  await membership.getByRole("option", { name: /ZH.*Shenzhen Airlines/ }).click();
  await expect(membership.locator('[data-airline-code="ZH"]')).toContainText("Shenzhen Airlines");
  await expect(airlineSearch).toBeFocused();
  await expect(defaultAirline).toHaveValue("ZH");

  await airlineSearch.fill("CA");
  await membership.getByRole("option", { name: /CA.*Air China/ }).click();
  await expect(membership.locator(".airline-chip")).toHaveCount(2);
  await expect(defaultAirline.locator("option")).toHaveText(["No default", "ZH · Shenzhen Airlines", "CA · Air China"]);

  await airlineSearch.fill("ZH");
  await expect(membership.locator(".airline-options").getByRole("option", { name: /ZH.*Shenzhen Airlines/ })).toHaveCount(0);
  await airlineSearch.fill("");
  await defaultAirline.selectOption("CA");
  await membership.getByRole("button", { name: "Remove CA · Air China" }).click();
  await expect(defaultAirline).toHaveValue("ZH");
  await expect(defaultAirline.locator('option[value="CA"]')).toHaveCount(0);

  await airlineSearch.fill("CA");
  await membership.getByRole("option", { name: /CA.*Air China/ }).click();
  await expect(membership.locator(".airline-chip")).toHaveCount(2);
});

test("keeps grouped Settings readable and operable at desktop, tablet and mobile widths", async ({ page }) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const archive = JSON.parse(await readFile(exampleArchive, "utf8"));
  archive.frequentFlyerMemberships = [{
    id: "settings-phoenixmiles",
    programId: "phoenixmiles",
    memberNumber: "ZH-88301924",
    tier: "Gold",
    associatedAirlines: ["ZH", "CA"],
    defaultAirline: "ZH",
  }];
  archive.flights[0].frequentFlyer = { membershipId: "settings-phoenixmiles", tierAtFlight: "Gold" };
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "settings.keepraw-fly.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(archive)),
  });
  await page.getByRole("button", { name: "Import this archive" }).click();
  await page.goto("/#settings");
  await expect(page.locator(".settings-page")).toBeVisible();
  await expect(page.locator(".settings-section-title")).toHaveText([
    "General", "Profile", "Frequent flyer profiles", "Data and backup", "Advanced", "Danger zone",
  ]);
  await expect(page.locator(".settings-section-icon, .settings-section-heading .eyebrow, .settings-row-value")).toHaveCount(0);

  const membership = page.locator(".membership-row").first();
  await expect(membership.getByRole("button", { name: "Remove membership" })).toBeDisabled();
  await expect(membership.getByLabel("Default airline")).toHaveValue("ZH");
  await page.getByRole("button", { name: "Add frequent flyer program" }).click();
  const addedMembership = page.locator(".membership-row").last();
  await addedMembership.getByLabel("Program name").fill("Settings test program");
  await addedMembership.getByLabel("Member number").fill("KF-2026");
  await expect(addedMembership.locator("legend")).toHaveText("Settings test program");
  await addedMembership.getByRole("button", { name: "Remove membership" }).click();
  await expect(page.locator(".membership-row")).toHaveCount(1);

  await page.getByLabel("Native name", { exact: true }).fill("  张鸿川");
  await expect(page.getByLabel("Native name", { exact: true })).toHaveValue("张鸿川");
  await page.getByLabel("Romanized name", { exact: true }).fill("Zhang Hongchuan");
  const primaryName = page.getByRole("group", { name: "Primary name", exact: true });
  await primaryName.getByRole("radio", { name: "Romanized", exact: true }).check();
  await expect(primaryName.getByRole("radio", { name: "Romanized", exact: true })).toBeChecked();
  await primaryName.getByRole("radio", { name: "Native", exact: true }).check();
  const powerUserMode = page.getByRole("switch", { name: /Power User Mode/ });
  await powerUserMode.check();
  await expect(powerUserMode).toBeChecked();
  await powerUserMode.uncheck();
  await page.reload();
  await expect(page.getByLabel("Romanized name", { exact: true })).toHaveValue("Zhang Hongchuan");
  await expect(powerUserMode).not.toBeChecked();

  await page.getByRole("combobox", { name: "Appearance", exact: true }).selectOption("light");
  await page.getByRole("combobox", { name: "Language", exact: true }).selectOption("zh-CN");
  await expect(page.locator(".settings-section-title")).toHaveText([
    "常规", "个人资料", "常旅客资料", "数据与备份", "高级", "危险操作",
  ]);
  const screenshotDirectory = fileURLToPath(new URL("../test-results/settings-review/", import.meta.url));
  await mkdir(screenshotDirectory, { recursive: true });

  for (const viewport of [
    { width: 1440, height: 900, name: "desktop-1440" },
    { width: 1024, height: 900, name: "tablet-1024" },
    { width: 390, height: 844, name: "mobile-390" },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.evaluate(async () => { window.scrollTo(0, 0); await document.fonts.ready; });
    const layout = await page.evaluate(() => {
      const content = document.querySelector<HTMLElement>(".settings-content")!;
      const controlElements = Array.from(document.querySelectorAll<HTMLElement>(
        ".settings-display-fields select, .settings-profile-fields > .settings-row > .settings-row-control",
      ));
      const controls = controlElements.map((element) => {
        const bounds = element.getBoundingClientRect();
        const label = element.closest(".settings-row")!.querySelector(".settings-row-label")!.getBoundingClientRect();
        return { left: bounds.left, right: bounds.right, width: bounds.width, height: bounds.height, top: bounds.top, labelBottom: label.bottom };
      });
      const actionableElements = Array.from(content.querySelectorAll<HTMLElement>(
        'button, select, input:not([type="file"]):not([type="radio"]):not([role="switch"]), .settings-action, .radio-row label, .settings-toggle-row',
      )).filter((element) => getComputedStyle(element).display !== "none" && element.getBoundingClientRect().width);
      const contentBounds = content.getBoundingClientRect();
      return {
        fitsViewport: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        content: { left: contentBounds.left, right: contentBounds.right, width: contentBounds.width },
        controls,
        selectsVisible: Array.from(document.querySelectorAll<HTMLSelectElement>(".settings-display-fields select"))
          .every((element) => getComputedStyle(element).opacity === "1" && getComputedStyle(element).position !== "absolute"),
        actionableElementsFit: actionableElements.every((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.left >= -0.5 && bounds.right <= window.innerWidth + 0.5 && element.scrollWidth <= element.clientWidth + 1;
        }),
        touchTargets: actionableElements.every((element) => element.getBoundingClientRect().height >= 44),
        membershipColumns: getComputedStyle(document.querySelector(".settings-membership-grid")!).gridTemplateColumns.split(" ").length,
      };
    });
    expect(layout.fitsViewport).toBe(true);
    expect(layout.actionableElementsFit).toBe(true);
    expect(layout.selectsVisible).toBe(true);
    expect(layout.controls).toHaveLength(7);
    expect(Math.max(...layout.controls.map((control) => control.left)) - Math.min(...layout.controls.map((control) => control.left))).toBeLessThan(1);
    expect(Math.max(...layout.controls.map((control) => control.width)) - Math.min(...layout.controls.map((control) => control.width))).toBeLessThan(1);
    expect(layout.controls.every((control) => control.height >= 44)).toBe(true);
    if (viewport.width === 1440) {
      expect(layout.content.width).toBeGreaterThanOrEqual(960);
      expect(layout.content.width).toBeLessThanOrEqual(1000);
      expect(Math.abs(layout.content.left - (viewport.width - layout.content.right))).toBeLessThan(1);
      expect(layout.controls[0]!.width).toBeGreaterThanOrEqual(300);
      expect(layout.controls[0]!.width).toBeLessThanOrEqual(320);
      await expect(page.locator(".settings-page-heading h1")).toBeVisible();
    }
    if (viewport.width === 390) {
      expect(layout.controls.every((control) => control.top >= control.labelBottom)).toBe(true);
      expect(layout.touchTargets).toBe(true);
    }
    expect(layout.membershipColumns).toBe(viewport.width === 390 ? 1 : 2);
    await page.screenshot({ path: join(screenshotDirectory, `${viewport.name}.png`), fullPage: true, animations: "disabled" });
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("combobox", { name: "语言", exact: true }).selectOption("en");
  await page.locator('#settings-import input[type="file"]').setInputFiles(exampleArchive);
  const jsonPreview = page.getByRole("region", { name: "Review before importing" });
  await expect(jsonPreview).toBeVisible();
  await expect(jsonPreview.getByRole("button", { name: "No new flights to import" })).toBeDisabled();
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const previewWidth = await jsonPreview.evaluate((element) => {
      const row = element.closest(".settings-import-row")!;
      const style = getComputedStyle(row);
      return { actual: element.getBoundingClientRect().width, available: row.getBoundingClientRect().width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight), fits: document.documentElement.scrollWidth <= document.documentElement.clientWidth };
    });
    expect(Math.abs(previewWidth.actual - previewWidth.available)).toBeLessThan(2);
    expect(previewWidth.fits).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: join(screenshotDirectory, "desktop-preview.png"), fullPage: true, animations: "disabled" });
  await jsonPreview.getByRole("button", { name: "Cancel" }).click();
  await page.getByLabel("Open CSV file").setInputFiles(exampleCsv);
  const csvPreview = page.getByRole("region", { name: "Review CSV import" });
  await expect(csvPreview.getByLabel("Flight number", { exact: true })).toHaveValue("0");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await csvPreview.evaluate((element) => {
      const row = element.closest(".settings-import-row")!;
      return element.getBoundingClientRect().width > row.getBoundingClientRect().width * 0.9
        && document.documentElement.scrollWidth <= document.documentElement.clientWidth;
    })).toBe(true);
  }
  await csvPreview.getByRole("button", { name: "Cancel" }).click();
  const clearButton = page.locator(".settings-danger-zone").getByRole("button", { name: "Clear local data", exact: true });
  await expect(page.locator(".settings-data-panel").getByRole("button", { name: "Clear local data", exact: true })).toHaveCount(0);
  await clearButton.click();
  const confirmation = page.getByRole("alertdialog", { name: "Clear local data", exact: true });
  await expect(confirmation.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(confirmation).toHaveCount(0);
  await expect(clearButton).toBeFocused();
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.getByRole("combobox", { name: "Appearance", exact: true }).selectOption("dark");
  await page.getByRole("combobox", { name: "Language", exact: true }).selectOption("zh-TW");
  await expect(page.locator(".settings-section-title").first()).toHaveText("常規");
  expect(await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("previews a JSON import and renders its Passport route map", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(exampleArchive);
  const preview = page.getByRole("region", { name: "Review before importing" });
  await expect(preview).toBeVisible();
  await expect(preview.getByLabel("Import preflight summary")).toContainText(
    "Recognized1Valid1With issues0New1Possible duplicate0Existing / duplicate0",
  );
  await expect(preview.getByText("张鸿川")).toBeVisible();
  await preview.getByRole("button", { name: "Import this archive" }).click();

  await expect(page.getByRole("button", { name: /Open UA123/ })).toBeVisible();
  await navigateTo(page, "passport");
  await expect(page.getByText("Flight archive · 1 flight")).toHaveCount(0);
  await expect(page.getByText("张鸿川", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("group", { name: /World map showing 1 flight/ })).toBeVisible();
  await expect(page.getByText("Your world")).toHaveCount(0);
  await expect(page.getByText("Highlights")).toBeHidden();
});

test("selects map records and filters the main ledger through search", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo" }).click();
  await page.locator(".map-airport").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('.flight-row[aria-current="true"]')).toHaveCount(1);
  const count = await page.locator(".flight-row").count();
  const routeCode = await page.locator('.flight-row[aria-current="true"] .airport-code-display').first().textContent();
  await page.locator("#passport-flight-search").fill(routeCode!.trim());
  expect(await page.locator(".flight-row").count()).toBeLessThan(count);
  await page.locator(".map-route").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('.flight-row[aria-current="true"]')).toHaveCount(1);
  await page.locator("#passport-flight-search").fill("");
  await expect(page.locator(".flight-row")).toHaveCount(count);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /Open / }).first().click();
  await expect(page.locator(".detail-flight-card")).toBeVisible();
});

test("keeps Passport as a complete desktop workspace and a mobile document", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo" }).click();
  await expect(page.locator(".route-map-canvas > svg")).toBeVisible();

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1366, height: 600 },
  ]) {
    await page.setViewportSize(viewport);
    const workspace = await page.evaluate(() => {
      const archive = document.querySelector<HTMLElement>(".passport-archive");
      const archiveScroll = document.querySelector<HTMLElement>(".passport-archive-scroll");
      const visual = document.querySelector<HTMLElement>(".passport-visual");
      const flightRows = Array.from(document.querySelectorAll<HTMLElement>(".flight-row"));
      const airlineLogos = Array.from(document.querySelectorAll<HTMLElement>(".flight-row .airline-logo"));
      const periodSelector = document.querySelector<HTMLElement>(".passport-period");
      const addFlight = document.querySelector<HTMLElement>(".archive-controls .add-flight-button");
      if (!archive || !archiveScroll || !visual) {
        throw new Error("Passport workspace landmarks are missing");
      }
      if (!periodSelector || !addFlight || airlineLogos.length !== flightRows.length) {
        throw new Error("Passport archive controls or airline marks are missing");
      }
      const hero = document.querySelector<HTMLElement>(".passport-legend-hero strong")!;
      const support = document.querySelector<HTMLElement>(".passport-legend-support")!;
      const delay = document.querySelector<HTMLElement>(".passport-legend-delay")!;
      const legend = document.querySelector<HTMLElement>(".passport-legend")!;
      const network = document.querySelector<HTMLElement>(".passport-network-line")!;
      const logoBounds = airlineLogos.map((item) => item.getBoundingClientRect());
      const logoStarts = airlineLogos.map((item) => {
        const logoBounds = item.getBoundingClientRect();
        const rowBounds = item.closest<HTMLElement>(".flight-row")!.getBoundingClientRect();
        return Math.round(logoBounds.left - rowBounds.left);
      });
      return {
        archiveScrollsInternally: getComputedStyle(archiveScroll).overflowY === "auto",
        bodyFitsViewport: document.documentElement.scrollHeight <= window.innerHeight,
        highlightsVisible: document.querySelectorAll(".passport-highlight").length === 4
          && getComputedStyle(document.querySelector(".passport-highlights")!).display !== "none",
        distanceLeads: parseFloat(getComputedStyle(hero).fontSize) > parseFloat(getComputedStyle(support).fontSize)
          && parseFloat(getComputedStyle(support).fontSize) > parseFloat(getComputedStyle(delay).fontSize),
        legendIsNarrative: getComputedStyle(legend).display === "block",
        networkIsSentence: network.tagName === "P" && getComputedStyle(network).display === "block",
        noLegacyStatGrids: document.querySelectorAll(".primary-stats, .passport-counts, .highlight-list").length === 0,
        brandedLogoCount: airlineLogos.filter((logo) => logo.querySelector("img")).length,
        fallbackLogoCount: airlineLogos.filter((logo) => logo.classList.contains("airline-logo--fallback")).length,
        logoContentPresent: airlineLogos.every((logo) => Boolean(logo.querySelector("img") || logo.textContent?.trim())),
        logoSourcesAreLocal: airlineLogos.every((logo) => {
          const source = logo.querySelector<HTMLImageElement>("img")?.currentSrc;
          return !source || source.startsWith("data:") || new URL(source).origin === window.location.origin;
        }),
        logoSizes: logoBounds.map((bounds) => `${Math.round(bounds.width)}x${Math.round(bounds.height)}`),
        logoStarts,
        // Layout height avoids fractional DOMRect rounding during entrance transforms.
        mapHeight: document.querySelector<HTMLElement>(".route-map-canvas")!.clientHeight,
        selectorFlexGrow: getComputedStyle(periodSelector).flexGrow,
        selectorPrecedesAddFlight: periodSelector.getBoundingClientRect().bottom <= addFlight.getBoundingClientRect().top,
        selectorUsesAvailableContentWidth: periodSelector.getBoundingClientRect().width <= archive.getBoundingClientRect().width + 0.5,
        visualFitsViewport: visual.getBoundingClientRect().bottom <= window.innerHeight + 0.5,
      };
    });

    expect(workspace.archiveScrollsInternally).toBe(true);
    expect(workspace.bodyFitsViewport).toBe(true);
    expect(workspace.highlightsVisible).toBe(true);
    expect(workspace.distanceLeads).toBe(true);
    expect(workspace.legendIsNarrative).toBe(true);
    expect(workspace.networkIsSentence).toBe(true);
    expect(workspace.noLegacyStatGrids).toBe(true);
    expect(workspace.brandedLogoCount).toBeGreaterThan(0); 
    expect(workspace.logoContentPresent).toBe(true);
    expect(workspace.logoSourcesAreLocal).toBe(true);
    expect(new Set(workspace.logoSizes).size).toBe(1);
    expect(new Set(workspace.logoStarts).size).toBe(1);
    expect(workspace.mapHeight).toBeGreaterThanOrEqual(180);
    expect(workspace.selectorFlexGrow).toBe("0");
    expect(workspace.selectorPrecedesAddFlight).toBe(true);
    expect(workspace.selectorUsesAvailableContentWidth).toBe(true);
    expect(workspace.visualFitsViewport).toBe(true);
  }

  const search = page.locator(".passport-search-field");
  const searchInput = page.locator("#passport-flight-search");
  const searchBoundsBeforeFocus = await search.boundingBox();
  await searchInput.focus();
  const searchFocus = await search.evaluate((control) => {
    const controlBounds = control.getBoundingClientRect();
    const iconBounds = control.querySelector("svg")!.getBoundingClientRect();
    const inputStyle = getComputedStyle(control.querySelector("input")!);
    return {
      borderWidth: getComputedStyle(control).borderWidth,
      iconInside: iconBounds.left >= controlBounds.left && iconBounds.right <= controlBounds.right,
      inputOutline: inputStyle.outlineStyle,
    };
  });
  expect(await search.boundingBox()).toEqual(searchBoundsBeforeFocus);
  expect(searchFocus.borderWidth).toBe("1px");
  expect(searchFocus.iconInside).toBe(true);
  expect(searchFocus.inputOutline).toBe("none");

  await expect(page.locator(".passport-heading, .route-map-heading, .route-map-legend, .passport-highlights .section-heading")).toHaveCount(0);
  await expect(page.locator(".passport-archive").getByRole("button", { name: "Add flight" })).toBeVisible();
  await expect(page.locator('.passport-period[aria-label="Passport period"]')).toBeVisible();

  for (const locale of ["zh-CN", "zh-TW", "en"]) {
    await page.locator('.site-navigation a[href="#settings"]').click();
    await page.locator(".settings-fields select").first().selectOption(locale);
    await page.locator('.site-navigation a[href="#passport"]').click();
    await expect(page.locator(".passport-highlights")).toBeVisible();
    await expect(page.locator(".passport-highlight")).toHaveCount(4);
    expect(await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.evaluate(() => {
    const archiveScroll = document.querySelector<HTMLElement>(".passport-archive-scroll");
    const pageShell = document.querySelector<HTMLElement>(".passport-archive-page");
    if (!archiveScroll || !pageShell) throw new Error("Mobile Passport landmarks are missing");
    return {
      archiveUsesDocumentFlow: getComputedStyle(archiveScroll).overflowY === "visible",
      pageOverflow: getComputedStyle(pageShell).overflow,
      pageScrolls: document.documentElement.scrollHeight > window.innerHeight,
      fitsWidth: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    };
  });
  expect(mobile.archiveUsesDocumentFlow).toBe(true);
  expect(mobile.pageOverflow).toBe("visible");
  expect(mobile.pageScrolls).toBe(true);
  expect(mobile.fitsWidth).toBe(true);
  await expect(page.locator(".route-map-canvas, .route-map-loading")).toHaveCount(0);
  await page.setViewportSize({ width: 901, height: 900 });
  await expect(page.locator(".route-map-canvas > svg")).toBeVisible();
});

test("keeps the mobile Passport composition visually stable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".mobile-page-heading h1")).toHaveText("Flight Passport");
  await expect(page.locator(".mobile-navigation")).toHaveCount(0);
  await page.getByRole("button", { name: "Try demo" }).click();
  await expect(page.locator(".route-map-canvas, .route-map-loading")).toHaveCount(0);
  await mkdir(reviewScreenshotDirectory, { recursive: true });

  for (const viewport of [
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 760, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.locator(".route-map-canvas, .route-map-loading")).toHaveCount(0);
    await page.evaluate(async () => {
      window.scrollTo({ top: 0, behavior: "instant" });
      await document.fonts.ready;
      await Promise.all(Array.from(document.images, (item) => item.decode().catch(() => undefined)));
    });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.mouse.move(0, 0);

    if (viewport.width === 390 || viewport.width === 430) {
      await page.screenshot({
        path: join(reviewScreenshotDirectory, `passport-mobile-${viewport.width}x${viewport.height}.png`),
        animations: "disabled",
        caret: "hide",
      });
    }

    const composition = await page.evaluate(() => {
      const summary = document.querySelector<HTMLElement>(".passport-mobile-summary")!;
      const delay = document.querySelector<HTMLElement>(".passport-delay-panel")!;
      const network = document.querySelector<HTMLElement>(".passport-network-panel")!;
      const archive = document.querySelector<HTMLElement>(".archive-heading")!;
      const firstFlightYear = document.querySelector<HTMLElement>(".flight-year")!;
      const header = document.querySelector<HTMLElement>(".site-header")!;
      const settings = document.querySelector<HTMLElement>(".mobile-settings-button")!;
      const panels = [summary, delay, network];
      return {
        noBottomNav: !document.querySelector(".mobile-navigation"),
        title: document.querySelector(".mobile-page-heading h1")?.textContent,
        headerScrolls: getComputedStyle(header).position === "relative",
        touchTarget: settings.getBoundingClientRect().width >= 44 && settings.getBoundingClientRect().height >= 44,
        fitsViewport: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        summaryVisible: getComputedStyle(summary).display !== "none",
        panelsDistinct: new Set(panels.map((panel) => getComputedStyle(panel).backgroundColor)).size === 3,
        panelContentsFit: panels.every((panel) => {
          const bounds = panel.getBoundingClientRect();
          return Array.from(panel.querySelectorAll("*"))
            .every((element) => {
              const content = element.getBoundingClientRect();
              return content.width === 0 || (content.left >= bounds.left - 0.5 && content.right <= bounds.right + 0.5);
            });
        }),
        panelsOrdered: summary.getBoundingClientRect().top < delay.getBoundingClientRect().top
          && delay.getBoundingClientRect().top < network.getBoundingClientRect().top
          && network.getBoundingClientRect().top < archive.getBoundingClientRect().top,
        archiveFollowsPanels: firstFlightYear.getBoundingClientRect().top > network.getBoundingClientRect().bottom,
        noMapPlaceholder: document.querySelector(".route-map, .route-map-loading") === null,
        highlightsAbsent: document.querySelector(".passport-highlights, .passport-highlight") === null,
        periodYears: Array.from(document.querySelectorAll(".passport-period button")).map((button) => button.textContent),
        pastFlightsTitle: archive.querySelector(".passport-mobile-section-title")?.textContent?.trim(),
        archiveActions: ["Add flight", "Import flights"].every((label) => Array.from(archive.querySelectorAll("button")).some((button) => button.textContent?.includes(label))),
      };
    });
    expect(composition.noBottomNav).toBe(true);
    expect(composition.title).toBe("Flight Passport");
    expect(composition.headerScrolls).toBe(true);
    expect(composition.touchTarget).toBe(true);
    expect(composition.fitsViewport).toBe(true);
    expect(composition.summaryVisible).toBe(true);
    expect(composition.panelsDistinct).toBe(true);
    expect(composition.panelContentsFit).toBe(true);
    expect(composition.panelsOrdered).toBe(true);
    expect(composition.archiveFollowsPanels).toBe(true);
    expect(composition.noMapPlaceholder).toBe(true);
    expect(composition.highlightsAbsent).toBe(true);
    expect(composition.periodYears).toEqual(["All", "2026", "2025", "2024"]);
    expect(composition.pastFlightsTitle).toBe("Past flights");
    expect(composition.archiveActions).toBe(true);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.locator(".mobile-page-heading h1")).toHaveText("Settings");
  await expect(page).toHaveURL(/#settings$/);
  await page.getByRole("button", { name: "Back to Flight Passport" }).click();
  await expect(page.locator(".mobile-page-heading h1")).toHaveText("Flight Passport");
  await page.getByRole("button", { name: "Import flights" }).click();
  await expect(page.locator("#settings-import")).toBeInViewport();
  await page.getByRole("button", { name: "Back to Flight Passport" }).click();
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await expect.poll(() => page.locator(".flight-row").last().evaluate((row) => row.getBoundingClientRect().bottom <= window.innerHeight)).toBe(true);
  await page.getByRole("button", { name: /Open / }).last().click();
  await expect(page.locator(".detail-header-back")).toBeVisible();
});

test.describe("Chinese distance defaults", () => {
  test.use({ locale: "zh-CN" });

  test("starts in kilometers and keeps an explicit miles choice", async ({ page }) => {
    await page.goto("/");
    await page.locator(".welcome-actions .button-secondary").click();
    await expect(page.locator(".passport-legend")).toContainText("公里");
    await page.getByRole("button", { name: /Open |打开 |打開 / }).first().click();
    await expect(page.locator(".detail-heading-route-summary")).toContainText("公里");

    await page.locator(".detail-header-back").click();
    await page.locator('.site-navigation a[href="#settings"]').click();
    const distanceSelect = page.locator(".settings-display-fields label").nth(2).locator("select");
    await expect(distanceSelect).toHaveValue("kilometers");
    await distanceSelect.selectOption("miles");
    await page.locator('.site-navigation a[href="#passport"]').click();
    await expect(page.locator(".passport-legend")).toContainText("英里");
    await page.getByRole("button", { name: /Open |打开 |打開 / }).first().click();
    await expect(page.locator(".detail-heading-route-summary")).toContainText("英里");
  });
});

test("keeps the operational summary inside the flight header at desktop and mobile widths", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo" }).click();
  await page.getByRole("button", { name: /Open / }).first().click();

  const delaySummary = page.locator(".detail-heading-summary .flight-deviation").first();
  await expect(delaySummary).toBeVisible();

  const expectContentContained = async () => {
    const insets = await delaySummary.evaluate((summary) => {
      const bounds = summary.closest(".detail-heading")!.getBoundingClientRect();
      const item = summary.getBoundingClientRect();
      return [item.left - bounds.left, bounds.right - item.right];
    });
    expect(Math.min(...insets)).toBeGreaterThanOrEqual(-0.5);
  };

  await expectContentContained();
  await page.setViewportSize({ width: 390, height: 844 });
  await expectContentContained();
  const fitsViewport = await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth);
  expect(fitsViewport).toBe(true);
});

test("aligns Flight Detail to one grid without dashboard or table patterns", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo" }).click();
  await page.getByRole("button", { name: /Open UA123/ }).click();
  await expect(page.locator(".detail-route-map-canvas > svg")).toBeVisible();

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 900 },
    { width: 901, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.locator(".detail-route-map, .detail-route-map-loading")).toHaveCount(viewport.width <= 760 ? 0 : 1);
    const layout = await page.evaluate(() => {
      const style = (selector: string) => getComputedStyle(document.querySelector<HTMLElement>(selector)!);
      const grid = document.querySelector<HTMLElement>(".detail-operational-grid")!;
      const map = document.querySelector<HTMLElement>(".detail-route-map");
      const actual = document.querySelector<HTMLElement>(".detail-airport-time")!;
      const scheduled = document.querySelector<HTMLElement>(".detail-scheduled-time")!;
      const card = document.querySelector<HTMLElement>(".detail-flight-card")!;
      return {
        gridColumns: style(".detail-operational-grid").gridTemplateColumns.split(" ").length,
        mapHeight: map?.getBoundingClientRect().height ?? 0,
        mapRadius: map ? getComputedStyle(map).borderRadius : null,
        actualDominatesSchedule: Number.parseFloat(getComputedStyle(actual).fontSize) > Number.parseFloat(getComputedStyle(scheduled).fontSize),
        operationBadges: document.querySelectorAll(".detail-stop-facts").length,
        metadataColumns: document.querySelectorAll(".detail-metadata-column").length,
        cardShadow: getComputedStyle(card).boxShadow,
        cardRadius: getComputedStyle(card).borderRadius,
        gridWidth: grid.getBoundingClientRect().width,
        demoNoticeIsCompact: document.querySelector(".demo-banner")?.classList.contains("demo-banner--compact") ?? false,
        fitsViewport: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      };
    });

    expect(layout.gridColumns).toBe(viewport.width <= 760 ? 1 : 2);
    if (viewport.width <= 760) {
      expect(layout.mapHeight).toBe(0);
      expect(layout.mapRadius).toBeNull();
      await expect(page.locator(".detail-heading-route-summary")).toBeVisible();
      await expect(page.locator(".detail-route-map-canvas")).toHaveCount(0);
    } else {
      expect(layout.mapHeight).toBeCloseTo(Math.min(440, Math.max(340, viewport.height * 0.48)), 1);
      expect(layout.mapRadius).toBe("0px");
    }
    expect(layout.actualDominatesSchedule).toBe(true);
    expect(layout.operationBadges).toBeGreaterThanOrEqual(1);
    expect(layout.metadataColumns).toBe(1);
    expect(layout.cardShadow).toBe("none");
    expect(layout.cardRadius).toBe("0px");
    expect(layout.gridWidth).toBeGreaterThan(0);
    expect(layout.demoNoticeIsCompact).toBe(true);
    expect(layout.fitsViewport).toBe(true);
  }

  await page.getByRole("button", { name: "Flight Passport" }).click();
  await navigateTo(page, "settings");
  await page.getByLabel("Appearance").selectOption("light");
  await page.getByLabel("Language").selectOption("zh-CN");
  await navigateTo(page, "passport");
  await page.getByRole("button", { name: /打开 UA123/ }).click();
  await expect(page.locator(".route-origin-city")).toHaveText("旧金山");
  await expect(page.locator(".route-origin-airport")).toHaveText("旧金山国际机场");
  await expect(page.locator(".detail-stops")).not.toContainText(/舊|國際|機場/);
});

test("maps and previews CSV columns before appending flights", async ({ page }) => {
  await page.goto("/#settings");
  await page.getByLabel("Open CSV file").setInputFiles(exampleCsv);
  const preview = page.getByRole("region", { name: "Review CSV import" });
  await expect(preview).toBeVisible();
  await expect(preview.getByLabel("Flight number", { exact: true })).toHaveValue("0");
  await expect(preview.getByLabel("Import preflight summary")).toContainText(
    "Recognized1Valid1With issues0New1Possible duplicate0Existing / duplicate0",
  );
  await expect(preview.getByText("MU589")).toBeVisible();
  await preview.getByRole("button", { name: "Add 1 flight" }).click();

  await navigateTo(page, "passport");
  await expect(page.getByRole("button", { name: /Open MU589/ })).toBeVisible();
});

test("blocks a partially invalid JSON archive before writing anything", async ({ page }) => {
  const archive = JSON.parse(await readFile(exampleArchive, "utf8"));
  archive.flights.push({
    ...archive.flights[0],
    id: "invalid-record",
    flightNumber: undefined,
  });

  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "partial.keepraw-fly.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(archive)),
  });

  const preview = page.getByRole("region", { name: "Review before importing" });
  await expect(preview.getByLabel("Import preflight summary")).toContainText(
    "Recognized2Valid1With issues1New0Possible duplicate0Existing / duplicate0",
  );
  await expect(preview.getByText("Flight #2", { exact: false })).toBeVisible();
  await expect(preview.getByRole("button", { name: "Resolve issues to import" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Create my archive" })).toBeVisible();
});

test("skips an exact JSON duplicate without replacing the existing archive", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"][accept*=".json"]').setInputFiles(exampleArchive);
  await page.getByRole("button", { name: "Import this archive" }).click();
  await navigateTo(page, "settings");

  await page.locator('input[type="file"][accept*=".json"]').setInputFiles(exampleArchive);
  const preview = page.getByRole("region", { name: "Review before importing" });
  await expect(preview.getByLabel("Import preflight summary")).toContainText(
    "Recognized1Valid1With issues0New0Possible duplicate0Existing / duplicate1",
  );
  await expect(preview.getByText("1 exact duplicate will be skipped", { exact: false })).toBeVisible();
  await expect(preview.getByRole("button", { name: "No new flights to import" })).toBeDisabled();

  await preview.getByRole("button", { name: "Cancel" }).click();
  const possibleArchive = JSON.parse(await readFile(exampleArchive, "utf8"));
  possibleArchive.flights[0] = {
    ...possibleArchive.flights[0],
    id: "possible-ua123",
    scheduledDeparture: "2026-08-19T11:20:00-07:00",
    scheduledArrival: "2026-08-19T12:52:00-07:00",
    actualDeparture: "2026-08-19T11:57:00-07:00",
    actualArrival: "2026-08-19T13:21:00-07:00",
  };
  await page.locator('input[type="file"][accept*=".json"]').setInputFiles({
    name: "possible.keepraw-fly.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(possibleArchive)),
  });

  const possiblePreview = page.getByRole("region", { name: "Review before importing" });
  await expect(possiblePreview.getByLabel("Import preflight summary")).toContainText(
    "Recognized1Valid1With issues0New0Possible duplicate1Existing / duplicate0",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(possiblePreview.getByRole("button", { name: "No new flights to import" })).toBeDisabled();
  await possiblePreview.getByRole("checkbox", { name: /Also import 1 possible duplicate/ }).check();
  await possiblePreview.getByRole("button", { name: "Import 1 selected flight" }).click();

  await navigateTo(page, "passport");
  await expect(page.getByRole("button", { name: /Open UA123/ })).toHaveCount(2);
});

test("supports dark mode, keyboard modal controls and WCAG checks", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  const welcomeAudit = await new AxeBuilder({ page }).analyze();
  expect(welcomeAudit.violations).toEqual([]);
  await page.getByRole("button", { name: "Try demo" }).click();

  await navigateTo(page, "settings");
  await page.getByLabel("Appearance").selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const lightSettingsAudit = await new AxeBuilder({ page }).analyze();
  expect(lightSettingsAudit.violations).toEqual([]);
  await page.getByLabel("Appearance").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const settingsAudit = await new AxeBuilder({ page }).analyze();
  expect(settingsAudit.violations).toEqual([]);

  const exportButton = page.getByRole("button", { name: "Export Keepraw Fly JSON" });
  await exportButton.click();
  const exportConfirmation = page.getByRole("dialog", { name: "Export demo archive?" });
  await expect(exportConfirmation.getByRole("button", { name: "Cancel" })).toBeFocused();
  const confirmationAudit = await new AxeBuilder({ page }).include(".confirmation-dialog").analyze();
  expect(confirmationAudit.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(exportButton).toBeFocused();

  const clearButton = page.getByRole("button", { name: "Clear local data" });
  await clearButton.click();
  const clearConfirmation = page.getByRole("alertdialog", { name: "Clear local data" });
  await expect(clearConfirmation.getByRole("button", { name: "Cancel" })).toBeFocused();
  await clearConfirmation.getByRole("button", { name: "Cancel" }).click();
  await expect(clearButton).toBeFocused();

  await navigateTo(page, "passport");
  const reducedMotionDurations = await page.locator(".flight-row").first().evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      animation: Number.parseFloat(style.animationDuration),
      transition: Math.max(...style.transitionDuration.split(",").map(Number.parseFloat)),
    };
  });
  expect(reducedMotionDurations.animation).toBeLessThanOrEqual(0.001);
  expect(reducedMotionDurations.transition).toBeLessThanOrEqual(0.001);

  const addButton = page.getByRole("button", { name: "Add flight" });
  await addButton.focus();
  await addButton.click();
  const dialog = page.getByRole("dialog", { name: "Add a flight" });
  await expect(dialog).toBeVisible();
  const modalAudit = await new AxeBuilder({ page }).include(".flight-editor").analyze();
  expect(modalAudit.violations).toEqual([]);
  await dialog.getByRole("button", { name: "Save flight" }).focus();
  await page.keyboard.press("Tab");
  await expect(dialog.locator(".editor-close")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(addButton).toBeFocused();

  const archiveAudit = await new AxeBuilder({ page }).analyze();
  expect(archiveAudit.violations).toEqual([]);
});

test("keeps bilingual typography distinct, scannable and inside the viewport", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo" }).click();

  const bodyMetrics = await page.locator("body").evaluate((element) => {
    const style = getComputedStyle(element);
    return { family: style.fontFamily, size: Number.parseFloat(style.fontSize) };
  });
  const flightDataMetrics = await page.locator(".flight-number strong").first().evaluate((element) => {
    const style = getComputedStyle(element);
    return { family: style.fontFamily, features: style.fontFeatureSettings };
  });

  expect(bodyMetrics.size).toBeGreaterThanOrEqual(15);
  expect(bodyMetrics.family).toContain("Inter");
  expect(bodyMetrics.family).toContain("Segoe UI Variable Text");
  expect(flightDataMetrics.family).toContain("Inter");
  expect(flightDataMetrics.features).toContain("tnum");

  await navigateTo(page, "settings");
  const englishTitleSize = await page.locator(".settings-section-title").first().evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
  await page.getByLabel("Language").selectOption("zh-CN");
  await page.locator(".settings-fields select").nth(1).selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const chineseHeadingMetrics = await page.locator(".settings-section-title").first().evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      family: style.fontFamily,
      size: Number.parseFloat(style.fontSize),
      tracking: style.letterSpacing,
    };
  });
  expect(chineseHeadingMetrics.family).toContain("PingFang SC");
  expect(chineseHeadingMetrics.family).toContain("Microsoft YaHei UI");
  expect(chineseHeadingMetrics.family).not.toContain("SimSun");
  expect(chineseHeadingMetrics.size).toBe(englishTitleSize);
  expect(chineseHeadingMetrics.tracking).toBe("normal");

  await page.setViewportSize({ width: 390, height: 844 });
  await navigateTo(page, "passport");
  const fitsViewport = await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth);
  expect(fitsViewport).toBe(true);
});

test("presents the flight archive as a single-column open ledger", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo" }).click();

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);

    const presentation = await page.locator(".flight-row").first().evaluate((row) => {
      const list = row.closest<HTMLElement>(".flight-list");
      const routeCity = row.querySelector<HTMLElement>(".flight-route-cities");
      const routeCode = row.querySelector<HTMLElement>(".flight-route-codes .airport-code-display");
      const flightNumber = row.querySelector<HTMLElement>(".flight-number strong");
      const serviceDate = row.querySelector<HTMLElement>(".flight-date");
      const search = document.querySelector<HTMLElement>(".search-field");
      if (!list || !routeCity || !routeCode || !flightNumber || !serviceDate || !search) {
        throw new Error("Flight archive presentation landmarks are missing");
      }

      const listStyle = getComputedStyle(list);
      const rowStyle = getComputedStyle(row);
      const searchStyle = getComputedStyle(search);
      return {
        dateSize: Number.parseFloat(getComputedStyle(serviceDate).fontSize),
        flightNumberSize: Number.parseFloat(getComputedStyle(flightNumber).fontSize),
        listColumns: listStyle.gridTemplateColumns.split(" ").length,
        listDisplay: listStyle.display,
        rowBorderRadius: rowStyle.borderRadius,
        rowBoxShadow: rowStyle.boxShadow,
        routeCitySize: Number.parseFloat(getComputedStyle(routeCity).fontSize),
        routeCodeSize: Number.parseFloat(getComputedStyle(routeCode).fontSize),
        searchBorderRadius: searchStyle.borderRadius,
        searchBoxShadow: searchStyle.boxShadow,
      };
    });

    if (viewport.width > 760) expect(presentation.routeCodeSize).toBeGreaterThan(presentation.routeCitySize);
    else expect(presentation.routeCitySize).toBeGreaterThan(presentation.routeCodeSize);
    expect(presentation.flightNumberSize).toBeGreaterThan(presentation.dateSize);
    expect(presentation.listDisplay).toBe("grid");
    expect(presentation.listColumns).toBe(1);
    expect(presentation.rowBorderRadius).toBe("0px");
    expect(presentation.rowBoxShadow).toBe("none");
    expect(presentation.searchBorderRadius).toBe("0px");
    expect(presentation.searchBoxShadow).toBe("none");
  }
});

test("keeps core archive surfaces precise and non-decorative", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo" }).click();

  await expect(page.locator(".flight-row .aviation-icon")).toHaveCount(0);
  await expect(page.locator(".flight-row .route-direction").first()).toHaveText("→");

  await page.getByRole("button", { name: /Open |打开 |打開 / }).first().click();
  await expect(page.locator(".detail-route-map-canvas > svg")).toBeVisible();
  await expect(page.locator(".detail-map-route")).toHaveCount(1);
  await expect(page.locator(".detail-stop--departure .detail-stop-facts")).toContainText("F12");
  const detailPresentation = await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>(".detail-flight-card");
    const performance = document.querySelector<HTMLElement>(".detail-heading-summary .flight-deviation");
    const map = document.querySelector<HTMLElement>(".detail-route-map");
    if (!hero || !performance) throw new Error("Flight detail presentation landmarks are missing");
    const heroStyle = getComputedStyle(hero);
    const performanceStyle = getComputedStyle(performance);
    const mapStyle = map ? getComputedStyle(map) : undefined;
    return {
      heroBackgroundImage: heroStyle.backgroundImage,
      heroBorderRadius: heroStyle.borderRadius,
      heroBoxShadow: heroStyle.boxShadow,
      fullWidthStatusBars: hero.querySelectorAll(".detail-performance").length,
      routeIcons: hero.querySelectorAll(".detail-stop-place svg").length,
      operationBadges: hero.querySelectorAll(".detail-stop-facts").length,
      mapBorderRadius: mapStyle?.borderRadius,
      timelineBackgroundImage: performanceStyle.backgroundImage,
      timelineBorderRadius: performanceStyle.borderRadius,
      timelineBoxShadow: performanceStyle.boxShadow,
    };
  });
  expect(detailPresentation).toEqual({
    heroBackgroundImage: "none",
    heroBorderRadius: "0px",
    heroBoxShadow: "none",
    fullWidthStatusBars: 0,
    routeIcons: 0,
    operationBadges: 2,
    mapBorderRadius: "0px",
    timelineBackgroundImage: "none",
    timelineBorderRadius: "0px",
    timelineBoxShadow: "none",
  });

  await page.getByRole("button", { name: "Flight Passport" }).click();
  await navigateTo(page, "passport");
  await expect(page.locator(".route-map-canvas > svg")).toBeVisible();
  const passportPresentation = await page.evaluate(() => {
    const map = document.querySelector<HTMLElement>(".route-map");
    const canvas = document.querySelector<HTMLElement>(".route-map-canvas");
    const switcher = document.querySelector<HTMLElement>(".view-switcher");
    if (!map || !canvas || !switcher) {
      throw new Error("Passport presentation landmarks are missing");
    }
    const mapStyle = getComputedStyle(map);
    const switcherStyle = getComputedStyle(switcher);
    return {
      canvasHasDepth: getComputedStyle(canvas).backgroundImage !== "none",
      highlightsVisible: document.querySelectorAll(".passport-highlight").length === 4
        && getComputedStyle(document.querySelector(".passport-highlights")!).display !== "none",
      mapBorderRadius: mapStyle.borderRadius,
      mapBoxShadow: mapStyle.boxShadow,
      countryPaths: map.querySelectorAll(".map-country").length,
      graticules: map.querySelectorAll(".map-graticule").length,
      permanentAirportLabels: map.querySelectorAll(".map-airport-label").length,
      zoomControls: map.querySelectorAll(".map-zoom-controls button").length,
      routeFilter: getComputedStyle(document.querySelector<SVGGElement>(".map-routes")!).filter,
      svgDefinitions: map.querySelectorAll("defs").length,
      visitedCountries: map.querySelectorAll(".map-country.is-visited").length,
      worldSilhouettes: map.querySelectorAll(".map-world > .map-sphere").length,
      switcherBorderRadius: switcherStyle.borderRadius,
      switcherBackgroundImage: switcherStyle.backgroundImage,
    };
  });
  expect(passportPresentation).toEqual({
    canvasHasDepth: false,
    countryPaths: 177,
    graticules: 0,
    highlightsVisible: true,
    mapBorderRadius: "0px",
    mapBoxShadow: "none",
    permanentAirportLabels: expect.any(Number),
    routeFilter: "none",
    svgDefinitions: 0,
    switcherBorderRadius: "0px",
    switcherBackgroundImage: "none",
    visitedCountries: 9,
    worldSilhouettes: 1,
    zoomControls: 3,
  });

  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.waitForTimeout(280);
  expect(Number(await page.locator(".route-map-canvas").getAttribute("data-zoom"))).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Fit recorded routes" }).click();
  await page.waitForTimeout(280);
  expect(await page.locator(".route-map-canvas").getAttribute("data-zoom")).toBe("1.00");

  for (let index = 0; index < 6; index += 1) {
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.waitForTimeout(260);
  }
  expect(await page.locator(".route-map-canvas").getAttribute("data-zoom")).toBe("8.00");
  await expect(page.locator(".route-map-canvas .map-world > .map-sphere")).toHaveCount(1);
  await page.getByRole("button", { name: "Fit recorded routes" }).click();
  await page.waitForTimeout(280);

  const mapSvg = page.locator(".route-map-canvas > svg");
  await mapSvg.hover({ position: { x: 220, y: 120 } });
  await page.mouse.wheel(0, -360);
  await page.waitForTimeout(80);
  expect(Number(await page.locator(".route-map-canvas").getAttribute("data-zoom"))).toBeGreaterThan(1);
  const beforePan = await page.locator(".route-map-canvas .map-viewport-content").getAttribute("transform");
  const mapBounds = await mapSvg.boundingBox();
  if (!mapBounds) throw new Error("Passport map bounds are unavailable");
  await page.mouse.move(mapBounds.x + mapBounds.width * 0.55, mapBounds.y + mapBounds.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(mapBounds.x + mapBounds.width * 0.42, mapBounds.y + mapBounds.height * 0.48, { steps: 4 });
  await page.mouse.up();
  expect(await page.locator(".route-map-canvas .map-viewport-content").getAttribute("transform")).not.toBe(beforePan);
  await expect(page.locator(".route-map-canvas .map-world > .map-sphere")).toHaveCount(1);
  await page.getByRole("button", { name: "Fit recorded routes" }).click();
  await page.waitForTimeout(280);
});

test("localizes airport identity and keeps sparse facility and map layouts legible", async ({ page }) => {
  const archive = JSON.parse(await readFile(exampleArchive, "utf8"));
  archive.frequentFlyerMemberships = [{
    id: "ff_phoenixmiles_01",
    programId: "phoenixmiles",
    memberNumber: "ZH-88301924",
    tier: "Gold",
    associatedAirlines: ["ZH"],
    defaultAirline: "ZH",
  }];
  archive.flights[0] = {
    ...archive.flights[0],
    id: "example-zh9911-20260917",
    flightNumber: "ZH9911",
    serviceDate: "2026-09-17",
    airline: { iata: "ZH" },
    origin: { iata: "SZX", gate: "338" },
    destination: { iata: "TAO" },
    scheduledDeparture: "2026-09-17T20:45:00+08:00",
    scheduledArrival: "2026-09-18T00:05:00+08:00",
    actualDeparture: "2026-09-17T20:56:00+08:00",
    actualArrival: "2026-09-17T23:30:00+08:00",
    ticketNumber: "4792401988421",
    bookingReference: "KY78M9",
    baggageCarousel: "10",
    frequentFlyer: { membershipId: "ff_phoenixmiles_01", tierAtFlight: "Gold" },
    extensions: {
      "keepraw-fly.aircraft": { type: "Airbus A320neo", registration: "B-1234" },
      "keepraw-fly.seat": { seat: "2A", cabin: "business", bookingClass: "J" },
    },
  };

  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "localized-flight.keepraw-fly.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(archive)),
  });
  await page.getByRole("region", { name: "Review before importing" })
    .getByRole("button", { name: "Import this archive" }).click();
  await page.getByRole("button", { name: /Open ZH9911/ }).click();

  await expect(page.locator(".route-origin-airport"))
    .toHaveText("Shenzhen Bao'an International Airport");
  await expect(page.locator(".detail-stop--departure .detail-stop-facts")).toContainText("338");

  await page.getByRole("button", { name: "Flight Passport" }).click();
  await navigateTo(page, "settings");
  await page.getByLabel("Appearance").selectOption("light");
  await page.getByLabel("Language").selectOption("zh-CN");
  await navigateTo(page, "passport");
  await page.getByRole("button", { name: /打开 ZH9911/ }).click();

  await expect(page.locator(".route-origin-city")).toHaveText("深圳");
  await expect(page.locator(".route-origin-airport")).toHaveText("深圳宝安国际机场");
  await expect(page.locator(".route-arrival-city")).toHaveText("青岛");
  await expect(page.locator(".route-arrival-airport")).toHaveText("青岛胶东国际机场");
  await expect(page.locator(".detail-heading-eyebrow")).toContainText("深圳航空");
  await expect(page.locator(".detail-heading-eyebrow time")).toHaveText("2026年9月17日周四");
  await expect(page.getByRole("heading", { name: "深圳 飞往 青岛" })).toBeVisible();
  await expect(page.locator(".detail-heading-summary")).toContainText("已到达");
  await expect(page.locator(".detail-heading-summary")).toContainText("到达提前 35 分");
  await expect(page.locator(".detail-heading-summary")).toContainText("英里");
  await expect(page.locator(".detail-heading-route-summary")).toHaveCount(1);
  await expect(page.locator(".detail-journey-summary")).toHaveCount(0);
  await expect(page.locator(".detail-metadata-column").first()).toContainText("商务舱");
  await expect(page.locator(".detail-metadata-column").first()).not.toContainText("business");
  await expect(page.locator(".detail-metadata-column").first()).toContainText("B-1234");
  await expect(page.locator(".detail-metadata-column").nth(1)).not.toContainText("B-1234");
  await expect(page.getByRole("button", { name: "复制为新航班" })).toBeVisible();
  await expect(page.getByRole("button", { name: "编辑航班" })).toBeVisible();

  const simplifiedTypography = await page.evaluate(() => {
    const title = document.querySelector<HTMLElement>(".detail-heading h1")!;
    const time = document.querySelector<HTMLElement>(".detail-airport-time")!;
    const rootStyle = getComputedStyle(document.documentElement);
    return {
      titleFamily: getComputedStyle(title).fontFamily,
      titleWeight: getComputedStyle(title).fontWeight,
      timeFamily: getComputedStyle(time).fontFamily,
      chineseStack: rootStyle.getPropertyValue("--font-family-cjk-sc").trim(),
    };
  });
  expect(simplifiedTypography.titleFamily).toContain("Inter");
  expect(simplifiedTypography.titleFamily).toContain("PingFang SC");
  expect(simplifiedTypography.titleFamily).toContain("Microsoft YaHei UI");
  expect(simplifiedTypography.titleFamily).not.toContain("SimSun");
  expect(simplifiedTypography.timeFamily).toContain("Inter");
  expect(simplifiedTypography.titleWeight).toBe("700");
  expect(simplifiedTypography.chineseStack).toBe('"PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", sans-serif');

  const stopHierarchy = await page.locator(".detail-stops").evaluate((hero) => {
    const cities = [...hero.querySelectorAll<HTMLElement>(".detail-stop-place > div > span")];
    const times = [...hero.querySelectorAll<HTMLElement>(".detail-airport-time")];
    const schedules = [...hero.querySelectorAll<HTMLElement>(".detail-scheduled-time")];
    return {
      citiesVisible: cities.every((element) => element.getBoundingClientRect().width > 0),
      actualTimesWhole: times.every((element) => getComputedStyle(element).whiteSpace === "nowrap"),
      schedulesStruck: schedules.every((element) => getComputedStyle(element).textDecorationLine.includes("line-through")),
      actualDominatesSchedule: Number.parseFloat(getComputedStyle(times[0]).fontSize) > Number.parseFloat(getComputedStyle(schedules[0]).fontSize),
    };
  });
  expect(stopHierarchy.citiesVisible).toBe(true);
  expect(stopHierarchy.actualTimesWhole).toBe(true);
  expect(stopHierarchy.schedulesStruck).toBe(false);
  await expect(page.locator(".detail-stop--arrival .detail-scheduled-time")).toContainText("计划");
  await expect(page.locator(".detail-stop--arrival .detail-scheduled-time")).toContainText("+1");
  expect(stopHierarchy.actualDominatesSchedule).toBe(true);

  const mapSurface = await page.locator(".detail-route-map").evaluate((element) => {
    const channels = getComputedStyle(element).backgroundColor.match(/\d+/g)?.slice(0, 3).map(Number) ?? [];
    return channels.reduce((sum, channel) => sum + channel, 0) / channels.length;
  });
  expect(mapSurface).toBeGreaterThan(180);
  expect(Number(await page.locator(".detail-route-map-canvas").getAttribute("data-zoom"))).toBeGreaterThan(4);
  await expect(page.locator(".detail-map-route")).toHaveCount(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".detail-route-map-canvas, .detail-route-map-loading")).toHaveCount(0);
  await expect(page.locator(".detail-metadata-column").first()).toContainText("B-1234");
  expect(await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

  await page.getByRole("button", { name: "飞行护照", exact: true }).click();
  await navigateTo(page, "settings");
  await page.getByLabel("语言").selectOption("zh-TW");
  await navigateTo(page, "passport");
  await page.getByRole("button", { name: /打開 ZH9911/ }).click();
  await expect(page.locator(".route-arrival-city")).toHaveText("青島");
  await expect(page.locator(".route-arrival-airport")).toHaveText("青島膠東國際機場");
  await expect(page.locator(".detail-heading-eyebrow")).toContainText("深圳航空");
  await expect(page.locator(".detail-metadata-column").first()).toContainText("商務艙");
  const traditionalTypography = await page.evaluate(() => {
    const title = document.querySelector<HTMLElement>(".detail-heading h1")!;
    const rootStyle = getComputedStyle(document.documentElement);
    return {
      titleFamily: getComputedStyle(title).fontFamily,
      titleWeight: getComputedStyle(title).fontWeight,
      chineseStack: rootStyle.getPropertyValue("--font-family-cjk-tc").trim(),
    };
  });
  expect(traditionalTypography.titleFamily).toContain("Inter");
  expect(traditionalTypography.titleFamily).toContain("PingFang TC");
  expect(traditionalTypography.titleFamily).toContain("Microsoft JhengHei UI");
  expect(traditionalTypography.titleFamily).not.toContain("SimSun");
  expect(traditionalTypography.titleWeight).toBe("700");
  expect(traditionalTypography.chineseStack).toBe('"PingFang TC", "Microsoft JhengHei UI", "Microsoft JhengHei", "Noto Sans CJK TC", "Source Han Sans TC", sans-serif');
});

test("keeps every page aligned to the shared responsive shell", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo" }).click();

  for (const width of [320, 760, 768, 900, 901, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });

    for (const pageName of ["Passport", "Settings"] as const) {
      await navigateTo(page, pageName.toLowerCase() as "passport" | "settings");

      const layout = await page.evaluate(() => {
        const main = document.querySelector<HTMLElement>(".page-shell");
        const header = document.querySelector<HTMLElement>(".site-header-inner");
        if (!main || !header) throw new Error("Shared page shell is missing");

        const contentEdges = (element: HTMLElement) => {
          const bounds = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            left: bounds.left + Number.parseFloat(style.paddingLeft),
            right: bounds.right - Number.parseFloat(style.paddingRight),
          };
        };

        return {
          fitsViewport: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          header: contentEdges(header),
          main: contentEdges(main),
          mainPaddingTop: Number.parseFloat(getComputedStyle(main).paddingTop),
          mainPaddingBottom: Number.parseFloat(getComputedStyle(main).paddingBottom),
        };
      });

      expect(layout.fitsViewport).toBe(true);
      if (pageName === "Passport" && width > 760 && width <= 900) {
        expect(layout.main.left).toBeGreaterThanOrEqual(layout.header.left);
        expect(layout.main.right).toBeLessThanOrEqual(layout.header.right);
        expect(Math.abs(layout.main.left - layout.header.left - (layout.header.right - layout.main.right))).toBeLessThan(1);
      } else {
        expect(Math.abs(layout.header.left - layout.main.left)).toBeLessThan(1);
        expect(Math.abs(layout.header.right - layout.main.right)).toBeLessThan(1);
      }
      expect(layout.main.right - layout.main.left).toBeLessThanOrEqual(1280);
      if (pageName === "Passport" && width > 760) {
        expect(layout.mainPaddingTop).toBeLessThanOrEqual(22);
        expect(layout.mainPaddingBottom).toBeLessThanOrEqual(18);
      } else {
        expect(layout.mainPaddingTop).toBe(width <= 760 ? 16 : 32);
        expect(layout.mainPaddingBottom).toBe(width <= 760 ? 48 : 120);
      }
    }
  }
});

test("enforces the static responsive UI acceptance constraints", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo" }).click();

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const detailBack = page.getByRole("button", { name: "Flight Passport" });
    if (await detailBack.isVisible()) await detailBack.click();
    else await navigateTo(page, "passport");

    const archive = await page.evaluate(() => {
      window.scrollTo(0, 0);
      const visible = (element: Element | null) => Boolean(
        element && getComputedStyle(element).display !== "none" && element.getBoundingClientRect().width,
      );
      const row = document.querySelector<HTMLElement>(".flight-row");
      const header = document.querySelector<HTMLElement>(".site-header");
      const main = document.querySelector<HTMLElement>(".page-shell");
      if (!row || !header || !main) throw new Error("Responsive archive landmarks are missing");

      const overflowingButtons = Array.from(document.querySelectorAll<HTMLElement>("button"))
        .filter(visible)
        .filter((button) => {
          const bounds = button.getBoundingClientRect();
          return bounds.left < -0.5 || bounds.right > window.innerWidth + 0.5;
        }).length;
      const atomicValues = Array.from(row.querySelectorAll<HTMLElement>(
        ".flight-number strong, .flight-times time, .airport-code-display",
      )).filter(visible);
      const routeValues = Array.from(row.querySelectorAll<HTMLElement>(
        ".flight-route .airport-code-display, .flight-times time",
      )).filter(visible);
      const airportNames = Array.from(row.querySelectorAll<HTMLElement>(".flight-route-cities > span:not(.route-direction)"));
      const list = row.closest<HTMLElement>(".flight-list");
      const headerBounds = header.getBoundingClientRect();
      const mainBounds = main.getBoundingClientRect();
      if (!list) throw new Error("Responsive archive list is missing");

      return {
        atomicValues: atomicValues.length,
        atomicValuesStayWhole: atomicValues.every((element) => getComputedStyle(element).whiteSpace === "nowrap"),
        airportNamesVisible: airportNames.some(visible),
        identityVisible: visible(row.querySelector(".flight-number")),
        routeValues: routeValues.length,
        routeVisible: visible(row.querySelector(".flight-route")),
        statusVisible: visible(row.querySelector(".flight-status")),
        fitsViewport: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        listColumns: getComputedStyle(list).gridTemplateColumns.split(" ").length,
        headerClearsContent: headerBounds.bottom <= mainBounds.top + 1,
        headerIsSticky: getComputedStyle(header).position === "sticky",
        overflowingButtons,
        rowIsActionable: row.tagName === "BUTTON",
      };
    });

    expect(archive.fitsViewport).toBe(true);
    expect(archive.overflowingButtons).toBe(0);
    expect(archive.headerIsSticky).toBe(viewport.width > 760);
    expect(archive.headerClearsContent).toBe(true);
    expect(archive.rowIsActionable).toBe(true);
    expect(archive.atomicValues).toBeGreaterThanOrEqual(5);
    expect(archive.atomicValuesStayWhole).toBe(true);
    expect(archive.identityVisible).toBe(true);
    expect(archive.routeVisible).toBe(true);
    expect(archive.routeValues).toBe(4);
    expect(archive.statusVisible).toBe(true);

    expect(archive.listColumns).toBe(1);
    expect(archive.airportNamesVisible).toBe(true);

    await page.getByRole("button", { name: /Open |打开 |打開 / }).first().click();
    const detail = await page.evaluate(() => {
      const values = Array.from(document.querySelectorAll<HTMLElement>(
        ".detail-heading-eyebrow strong, .detail-airport-time, .detail-scheduled-time, .detail-stop-facts strong",
      ));
      const airportNames = Array.from(document.querySelectorAll<HTMLElement>(".detail-stop-place p"));
      return {
        airportNamesConstrained: airportNames.every((element) => element.scrollWidth <= element.clientWidth + 0.5),
        atomicValuesStayWhole: values.every((element) => getComputedStyle(element).whiteSpace === "nowrap"),
        fitsViewport: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      };
    });
    expect(detail.fitsViewport).toBe(true);
    expect(detail.atomicValuesStayWhole).toBe(true);
    expect(detail.airportNamesConstrained).toBe(true);
  }

  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const detailBack = page.getByRole("button", { name: "Flight Passport" });
    if (await detailBack.isVisible()) await detailBack.click();
    else await navigateTo(page, "passport");
    await page.getByRole("button", { name: "Add flight" }).click();

    const dialog = await page.getByRole("dialog", { name: "Add a flight" }).evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        fitsViewport: bounds.top >= 0
          && bounds.left >= 0
          && bounds.right <= window.innerWidth
          && bounds.bottom <= window.innerHeight,
        scrollable: ["auto", "scroll"].includes(getComputedStyle(element).overflowY),
      };
    });
    expect(dialog.fitsViewport).toBe(true);
    expect(dialog.scrollable).toBe(true);
    await page.getByRole("dialog").locator(".editor-close").click();
  }
});
