import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const exampleArchive = fileURLToPath(new URL("../examples/basic.keepraw-fly.json", import.meta.url));
const exampleCsv = fileURLToPath(new URL("../examples/flights.csv", import.meta.url));

test("creates, edits and deletes a personal flight without a JSON file", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create my archive" }).click();

  const editor = page.getByRole("dialog", { name: "Add a flight" });
  await expect(editor).toBeVisible();
  await editor.getByLabel("Flight number").fill("UA123");
  await editor.getByRole("combobox", { name: "Origin" }).fill("SFO");
  await editor.getByRole("combobox", { name: "Destination" }).fill("LAX");
  await editor.locator(".editor-optional > summary").click();
  await expect(editor.getByLabel("Destination gate")).toHaveCount(0);
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
  await expect(page.locator(".detail-stop--arrival .operation-badge")).toContainText("D05");
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
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Add membership" }).click();

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
  await page.getByRole("link", { name: "Passport" }).click();
  await expect(page.getByText("Flight archive · 1 flight")).toHaveCount(0);
  await expect(page.getByText("张鸿川", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("group", { name: /World map showing 1 flight/ })).toBeVisible();
  await expect(page.getByText("Your world")).toHaveCount(0);
  await expect(page.getByText("Highlights")).toHaveCount(0);
});

test("explores personal airport, airline and route history from Passport", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo" }).click();
  await page.getByRole("link", { name: "Passport" }).click();
  await expect(page.locator(".route-map-canvas > svg")).toBeVisible();

  const airportNode = page.locator(".map-airport").first();
  await airportNode.focus();
  await page.keyboard.press("Enter");
  const exploration = page.locator(".passport-exploration");
  await expect(exploration.getByText("Airport history")).toBeVisible();
  await expect(exploration.getByText("First visited")).toBeVisible();
  await expect(exploration.getByRole("button")).not.toHaveCount(0);

  await page.locator("button.passport-highlight").first().click();
  await expect(exploration.getByText("Airline history")).toBeVisible();

  const route = page.locator(".map-route").first();
  await route.focus();
  await page.keyboard.press("Enter");
  await expect(exploration.getByText("Route history")).toBeVisible();
  await expect(exploration.getByText(/flight/).first()).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

  await exploration.locator(".passport-related-flights button").first().click();
  await expect(page.locator(".detail-flight-card")).toBeVisible();
});

test("keeps Passport as a complete desktop workspace and a mobile document", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo" }).click();
  await expect(page.locator(".route-map-canvas > svg")).toBeVisible();

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    const workspace = await page.evaluate(() => {
      const archive = document.querySelector<HTMLElement>(".passport-archive");
      const archiveScroll = document.querySelector<HTMLElement>(".passport-archive-scroll");
      const visual = document.querySelector<HTMLElement>(".passport-visual");
      const highlights = Array.from(document.querySelectorAll<HTMLElement>(".passport-highlight"));
      const flightRows = Array.from(document.querySelectorAll<HTMLElement>(".flight-row"));
      const airlineLogos = Array.from(document.querySelectorAll<HTMLElement>(".flight-row .airline-logo"));
      const periodSelector = document.querySelector<HTMLElement>(".archive-controls .view-switcher");
      const addFlight = document.querySelector<HTMLElement>(".archive-controls .add-flight-button");
      if (!archive || !archiveScroll || !visual || highlights.length !== 4) {
        throw new Error("Passport workspace landmarks are missing");
      }
      if (!periodSelector || !addFlight || airlineLogos.length !== flightRows.length) {
        throw new Error("Passport archive controls or airline marks are missing");
      }
      const highlightBounds = highlights.map((item) => item.getBoundingClientRect());
      const highlightRowTops = ["span", "strong", "small"].map((selector) => new Set(
        highlights.map((item) => Math.round(item.querySelector<HTMLElement>(selector)!.getBoundingClientRect().top)),
      ).size === 1);
      const typography = (selector: string) => new Set(
        Array.from(document.querySelectorAll<HTMLElement>(selector)).map((element) => {
          const style = getComputedStyle(element);
          return [style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight].join("|");
        }),
      ).size;
      const logoBounds = airlineLogos.map((item) => item.getBoundingClientRect());
      const logoStarts = airlineLogos.map((item) => {
        const logoBounds = item.getBoundingClientRect();
        const rowBounds = item.closest<HTMLElement>(".flight-row")!.getBoundingClientRect();
        return Math.round(logoBounds.left - rowBounds.left);
      });
      return {
        archiveScrollsInternally: getComputedStyle(archiveScroll).overflowY === "auto",
        bodyFitsViewport: document.documentElement.scrollHeight <= window.innerHeight,
        highlightLabelTypographyCount: typography(".passport-highlight > span"),
        highlightMetadataTypographyCount: typography(".passport-highlight > small"),
        highlightTopAligned: new Set(highlightBounds.map((bounds) => Math.round(bounds.top))).size === 1,
        highlightRowsAligned: highlightRowTops.every(Boolean),
        highlightValueTypographyCount: typography(".passport-highlight > strong"),
        highlightWidths: highlightBounds.map((bounds) => Math.round(bounds.width)),
        labelsShareTypography: typography(".primary-stats span, .passport-counts span, .passport-highlight > span, .passport-highlight > small"),
        brandedLogoCount: airlineLogos.filter((logo) => logo.querySelector("img")).length,
        fallbackLogoCount: airlineLogos.filter((logo) => logo.classList.contains("airline-logo--fallback")).length,
        logoContentPresent: airlineLogos.every((logo) => Boolean(logo.querySelector("img") || logo.textContent?.trim())),
        logoSourcesAreLocal: airlineLogos.every((logo) => {
          const source = logo.querySelector<HTMLImageElement>("img")?.currentSrc;
          return !source || source.startsWith("data:") || new URL(source).origin === window.location.origin;
        }),
        logoSizes: logoBounds.map((bounds) => `${Math.round(bounds.width)}x${Math.round(bounds.height)}`),
        logoStarts,
        mapHeight: document.querySelector<HTMLElement>(".route-map-canvas")!.getBoundingClientRect().height,
        primaryStats: document.querySelectorAll(".primary-stats > div").length,
        primaryValueTypographyCount: typography(".primary-stats strong"),
        secondaryStats: document.querySelectorAll(".passport-counts > div").length,
        secondaryValueTypographyCount: typography(".passport-counts strong"),
        selectorFlexGrow: getComputedStyle(periodSelector).flexGrow,
        selectorPrecedesAddFlight: periodSelector.getBoundingClientRect().right <= addFlight.getBoundingClientRect().left,
        selectorUsesAvailableContentWidth: periodSelector.getBoundingClientRect().width < archive.getBoundingClientRect().width,
        visualFitsViewport: visual.getBoundingClientRect().bottom <= window.innerHeight + 0.5,
      };
    });

    expect(workspace.archiveScrollsInternally).toBe(true);
    expect(workspace.bodyFitsViewport).toBe(true);
    expect(workspace.highlightTopAligned).toBe(true);
    expect(workspace.highlightRowsAligned).toBe(true);
    expect(workspace.highlightLabelTypographyCount).toBe(1);
    expect(workspace.highlightValueTypographyCount).toBe(1);
    expect(workspace.highlightMetadataTypographyCount).toBe(1);
    expect(workspace.labelsShareTypography).toBe(1);
    expect(new Set(workspace.highlightWidths).size).toBe(1);
    expect(workspace.brandedLogoCount).toBeGreaterThan(0);
    expect(workspace.fallbackLogoCount).toBeGreaterThan(0);
    expect(workspace.logoContentPresent).toBe(true);
    expect(workspace.logoSourcesAreLocal).toBe(true);
    expect(new Set(workspace.logoSizes).size).toBe(1);
    expect(new Set(workspace.logoStarts).size).toBe(1);
    expect(workspace.mapHeight).toBeGreaterThanOrEqual(240);
    expect(workspace.primaryStats).toBe(3);
    expect(workspace.primaryValueTypographyCount).toBe(1);
    expect(workspace.secondaryStats).toBe(4);
    expect(workspace.secondaryValueTypographyCount).toBe(1);
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
  await expect(page.locator('.passport-archive .view-switcher[aria-label="Passport period"]')).toBeVisible();

  for (const locale of ["zh-CN", "zh-TW", "en"]) {
    await page.locator('a[href="#settings"]').click();
    await page.locator(".settings-fields select").first().selectOption(locale);
    await page.locator('.site-navigation a[href="#passport"]').click();
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
});

test("keeps the operational summary inside the flight header at desktop and mobile widths", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo" }).click();
  await page.getByRole("button", { name: /Open / }).first().click();

  const delaySummary = page.locator(".detail-operational-status");
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
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const layout = await page.evaluate(() => {
      const style = (selector: string) => getComputedStyle(document.querySelector<HTMLElement>(selector)!);
      const grid = document.querySelector<HTMLElement>(".detail-operational-grid")!;
      const map = document.querySelector<HTMLElement>(".detail-route-map")!;
      const actual = document.querySelector<HTMLElement>(".detail-airport-time")!;
      const scheduled = document.querySelector<HTMLElement>(".detail-scheduled-time")!;
      const card = document.querySelector<HTMLElement>(".detail-flight-card")!;
      return {
        gridColumns: style(".detail-operational-grid").gridTemplateColumns.split(" ").length,
        mapHeight: map.getBoundingClientRect().height,
        mapRadius: style(".detail-route-map").borderRadius,
        actualDominatesSchedule: Number.parseFloat(getComputedStyle(actual).fontSize) > Number.parseFloat(getComputedStyle(scheduled).fontSize),
        operationBadges: document.querySelectorAll(".operation-badge").length,
        metadataColumns: document.querySelectorAll(".detail-metadata-column").length,
        cardShadow: getComputedStyle(card).boxShadow,
        cardRadius: getComputedStyle(card).borderRadius,
        gridWidth: grid.getBoundingClientRect().width,
        demoNoticeIsCompact: document.querySelector(".demo-banner")?.classList.contains("demo-banner--compact") ?? false,
        fitsViewport: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      };
    });

    expect(layout.gridColumns).toBe(viewport.width <= 760 ? 1 : 2);
    expect(layout.mapHeight).toBeCloseTo(viewport.width <= 760 ? 300 : 380, 1);
    expect(layout.mapRadius).toBe("16px");
    expect(layout.actualDominatesSchedule).toBe(true);
    expect(layout.operationBadges).toBeGreaterThanOrEqual(1);
    expect(layout.metadataColumns).toBe(2);
    expect(layout.cardShadow).toBe("none");
    expect(layout.cardRadius).toBe("0px");
    expect(layout.gridWidth).toBeGreaterThan(0);
    expect(layout.demoNoticeIsCompact).toBe(true);
    expect(layout.fitsViewport).toBe(true);
  }

  await page.getByRole("button", { name: "Passport" }).click();
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Appearance").selectOption("light");
  await page.getByLabel("Language").selectOption("zh-CN");
  await page.getByRole("link", { name: "飞行护照" }).click();
  await page.getByRole("button", { name: /打开 UA123/ }).click();
  await expect(page.locator(".route-origin-city")).toHaveText("旧金山");
  await expect(page.locator(".route-origin-airport")).toHaveText("旧金山国际机场");
  await expect(page.locator(".detail-stops")).not.toContainText(/舊|國際|機場/);
});

test("maps and previews CSV columns before appending flights", async ({ page }) => {
  await page.goto("/#settings");
  await page.locator('input[type="file"][accept*=".csv"]').setInputFiles(exampleCsv);
  const preview = page.getByRole("region", { name: "Review CSV import" });
  await expect(preview).toBeVisible();
  await expect(preview.getByLabel("Flight number", { exact: true })).toHaveValue("0");
  await expect(preview.getByLabel("Import preflight summary")).toContainText(
    "Recognized1Valid1With issues0New1Possible duplicate0Existing / duplicate0",
  );
  await expect(preview.getByText("MU589")).toBeVisible();
  await preview.getByRole("button", { name: "Add 1 flight" }).click();

  await page.getByRole("link", { name: "Passport" }).click();
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
  await page.getByRole("link", { name: "Settings" }).click();

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

  await page.getByRole("link", { name: "Passport" }).click();
  await expect(page.getByRole("button", { name: /Open UA123/ })).toHaveCount(2);
});

test("supports dark mode, keyboard modal controls and WCAG checks", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  const welcomeAudit = await new AxeBuilder({ page }).analyze();
  expect(welcomeAudit.violations).toEqual([]);
  await page.getByRole("button", { name: "Try demo" }).click();

  await page.getByRole("link", { name: "Settings" }).click();
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

  await page.getByRole("link", { name: "Passport" }).click();
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

  await page.getByRole("link", { name: "Settings" }).click();
  const englishTitleSize = await page.locator(".settings-heading h1").evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
  await page.getByLabel("Language").selectOption("zh-CN");
  await page.locator(".settings-fields select").nth(1).selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const chineseHeadingMetrics = await page.locator(".settings-heading h1").evaluate((element) => {
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
  expect(chineseHeadingMetrics.size).toBeLessThan(englishTitleSize);
  expect(chineseHeadingMetrics.tracking).toBe("normal");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "飞行护照" }).click();
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
      const routeCode = row.querySelector<HTMLElement>(".airport-code-display");
      const flightNumber = row.querySelector<HTMLElement>(".flight-number strong");
      const serviceDate = row.querySelector<HTMLElement>(".flight-date");
      const search = document.querySelector<HTMLElement>(".search-field");
      if (!list || !routeCode || !flightNumber || !serviceDate || !search) {
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
        routeCodeSize: Number.parseFloat(getComputedStyle(routeCode).fontSize),
        searchBorderRadius: searchStyle.borderRadius,
        searchBoxShadow: searchStyle.boxShadow,
      };
    });

    expect(presentation.routeCodeSize).toBeGreaterThan(presentation.flightNumberSize);
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

  await page.locator(".flight-row").first().click();
  await expect(page.locator(".detail-route-map-canvas > svg")).toBeVisible();
  await expect(page.locator(".detail-map-route")).toHaveCount(1);
  await expect(page.locator(".detail-stop--departure .operation-badge")).toContainText("F12");
  const detailPresentation = await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>(".detail-flight-card");
    const performance = document.querySelector<HTMLElement>(".detail-operational-status");
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
      operationBadges: hero.querySelectorAll(".operation-badge").length,
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
    routeIcons: 2,
    operationBadges: 1,
    mapBorderRadius: "16px",
    timelineBackgroundImage: "none",
    timelineBorderRadius: "0px",
    timelineBoxShadow: "none",
  });

  await page.getByRole("button", { name: "Passport" }).click();
  await page.getByRole("link", { name: "Passport" }).click();
  await expect(page.locator(".route-map-canvas > svg")).toBeVisible();
  const passportPresentation = await page.evaluate(() => {
    const map = document.querySelector<HTMLElement>(".route-map");
    const canvas = document.querySelector<HTMLElement>(".route-map-canvas");
    const switcher = document.querySelector<HTMLElement>(".view-switcher");
    const highlights = document.querySelector<HTMLElement>(".passport-highlights");
    if (!map || !canvas || !switcher || !highlights) {
      throw new Error("Passport presentation landmarks are missing");
    }
    const mapStyle = getComputedStyle(map);
    const switcherStyle = getComputedStyle(switcher);
    return {
      canvasHasDepth: getComputedStyle(canvas).backgroundImage !== "none",
      highlightsDisplay: getComputedStyle(highlights).display,
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
    canvasHasDepth: true,
    countryPaths: 177,
    graticules: 0,
    highlightsDisplay: "block",
    mapBorderRadius: "0px",
    mapBoxShadow: "none",
    permanentAirportLabels: 1,
    routeFilter: "none",
    svgDefinitions: 1,
    switcherBorderRadius: "4px",
    switcherBackgroundImage: "none",
    visitedCountries: 9,
    worldSilhouettes: 1,
    zoomControls: 3,
  });

  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.waitForTimeout(280);
  expect(Number(await page.locator(".route-map-canvas").getAttribute("data-zoom"))).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Show the whole world" }).click();
  await page.waitForTimeout(280);
  expect(await page.locator(".route-map-canvas").getAttribute("data-zoom")).toBe("1.00");

  for (let index = 0; index < 5; index += 1) {
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.waitForTimeout(260);
  }
  expect(await page.locator(".route-map-canvas").getAttribute("data-zoom")).toBe("6.00");
  await expect(page.locator(".route-map-canvas .map-world > .map-sphere")).toHaveCount(1);
  await page.getByRole("button", { name: "Show the whole world" }).click();
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
  await page.getByRole("button", { name: "Show the whole world" }).click();
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
  await expect(page.locator(".detail-stop--departure .operation-badge")).toContainText("338");

  await page.getByRole("button", { name: "Passport" }).click();
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Appearance").selectOption("light");
  await page.getByLabel("Language").selectOption("zh-CN");
  await page.getByRole("link", { name: "飞行护照" }).click();
  await page.getByRole("button", { name: /打开 ZH9911/ }).click();

  await expect(page.locator(".route-origin-city")).toHaveText("深圳");
  await expect(page.locator(".route-origin-airport")).toHaveText("深圳宝安国际机场");
  await expect(page.locator(".route-arrival-city")).toHaveText("青岛");
  await expect(page.locator(".route-arrival-airport")).toHaveText("青岛胶东国际机场");
  await expect(page.locator(".detail-heading-eyebrow")).toContainText("深圳航空");
  await expect(page.locator(".detail-heading-eyebrow time")).toHaveText("2026年9月17日周四");
  await expect(page.getByRole("heading", { name: "深圳 飞往 青岛" })).toBeVisible();
  await expect(page.locator(".detail-heading-summary")).toContainText("已到达");
  await expect(page.locator(".detail-heading-summary")).toContainText("提前 35 分钟");
  await expect(page.locator(".detail-heading-summary")).toContainText("英里");
  await expect(page.locator(".detail-metadata-column").first()).toContainText("商务舱");
  await expect(page.locator(".detail-metadata-column").first()).not.toContainText("business");
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
  expect(stopHierarchy.schedulesStruck).toBe(true);
  expect(stopHierarchy.actualDominatesSchedule).toBe(true);

  const mapSurface = await page.locator(".detail-route-map").evaluate((element) => {
    const channels = getComputedStyle(element).backgroundColor.match(/\d+/g)?.slice(0, 3).map(Number) ?? [];
    return channels.reduce((sum, channel) => sum + channel, 0) / channels.length;
  });
  expect(mapSurface).toBeGreaterThan(180);
  expect(Number(await page.locator(".detail-route-map-canvas").getAttribute("data-zoom"))).toBeGreaterThan(4);
  await expect(page.locator(".detail-map-route")).toHaveCount(1);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

  await page.getByRole("button", { name: "飞行护照", exact: true }).click();
  await page.getByRole("link", { name: "设置" }).click();
  await page.getByLabel("语言").selectOption("zh-TW");
  await page.getByRole("link", { name: "飛行護照" }).click();
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

  for (const width of [320, 760, 761, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });

    for (const pageName of ["Passport", "Settings"]) {
      await page.getByRole("link", { name: pageName }).click();

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
      expect(Math.abs(layout.header.left - layout.main.left)).toBeLessThan(1);
      expect(Math.abs(layout.header.right - layout.main.right)).toBeLessThan(1);
      expect(layout.main.right - layout.main.left).toBeLessThanOrEqual(1280);
      if (pageName === "Passport" && width > 760) {
        expect(layout.mainPaddingTop).toBeLessThanOrEqual(22);
        expect(layout.mainPaddingBottom).toBeLessThanOrEqual(18);
      } else {
        expect(layout.mainPaddingTop).toBe(width <= 760 ? 24 : 32);
        expect(layout.mainPaddingBottom).toBe(width <= 760 ? 64 : 120);
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
    const detailBack = page.getByRole("button", { name: "Passport" });
    if (await detailBack.isVisible()) await detailBack.click();
    else await page.getByRole("link", { name: "Passport" }).click();

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
      const airportNames = Array.from(row.querySelectorAll<HTMLElement>(".flight-route p span:not([aria-hidden='true'])"));
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
    expect(archive.headerIsSticky).toBe(true);
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

    await page.locator(".flight-row").first().click();
    const detail = await page.evaluate(() => {
      const values = Array.from(document.querySelectorAll<HTMLElement>(
        ".detail-heading-eyebrow strong, .detail-airport-time, .detail-scheduled-time, .operation-badge strong",
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
    const detailBack = page.getByRole("button", { name: "Passport" });
    if (await detailBack.isVisible()) await detailBack.click();
    else await page.getByRole("link", { name: "Passport" }).click();
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
