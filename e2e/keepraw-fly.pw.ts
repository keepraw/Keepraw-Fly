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
  await editor.getByLabel("Airline code").fill("UA");
  await editor.getByLabel("Flight number").fill("123");
  await editor.getByRole("combobox", { name: "Origin" }).fill("SFO");
  await editor.getByRole("combobox", { name: "Destination" }).fill("LAX");
  await editor.locator(".editor-optional > summary").click();
  await expect(editor.getByLabel("Destination gate")).toHaveCount(0);
  await expect(editor.getByText("Single-letter airline booking code", { exact: false })).toHaveCount(0);
  await editor.getByLabel("Booking class").fill("P");
  await editor.getByLabel("Checked baggage").selectOption("checked");
  await editor.getByLabel("Baggage carousel").fill("8");
  await editor.getByLabel("Checked baggage").selectOption("not-checked");
  await expect(editor.getByLabel("Baggage carousel")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 720 });
  await editor.getByRole("button", { name: "Save flight" }).click();

  await expect(page.getByRole("heading", { name: "UA123" })).toBeVisible();
  await expect(page.getByText("Booking class")).toBeVisible();
  await expect(page.getByText("P", { exact: true })).toBeVisible();
  await expect(page.getByText("Checked baggage")).toBeVisible();
  await expect(page.getByText("No", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit flight" }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit flight" });
  await editDialog.getByLabel("Flight number").fill("124");
  await editDialog.getByRole("button", { name: "Save flight" }).click();
  await expect(page.getByRole("heading", { name: "UA124" })).toBeVisible();

  await page.getByRole("button", { name: "Duplicate as new" }).click();
  const duplicateDialog = page.getByRole("dialog", { name: "Duplicate flight" });
  await expect(duplicateDialog.getByRole("combobox", { name: "Origin" })).toHaveValue("SFO");
  await duplicateDialog.getByLabel("Flight number").fill("125");
  await duplicateDialog.getByRole("button", { name: "Save flight" }).click();
  await expect(page.getByRole("heading", { name: "UA125" })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Edit flight" }).click();
  await page.getByRole("dialog", { name: "Edit flight" })
    .getByRole("button", { name: "Delete flight" }).click();
  await expect(page.getByRole("button", { name: /Open UA124/ })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Passport" })).toBeVisible();
  await expect(page.getByText("张鸿川", { exact: false })).toBeVisible();
  await expect(page.getByRole("group", { name: /World map showing 1 flight/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Highlights" })).toBeVisible();
});

test("explores personal airport, airline and route history from Passport", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo" }).click();
  await page.getByRole("link", { name: "Passport" }).click();
  await expect(page.locator(".route-map svg")).toBeVisible();

  const airportNode = page.locator(".map-airport").first();
  await airportNode.focus();
  await page.keyboard.press("Enter");
  const exploration = page.locator(".passport-exploration");
  await expect(exploration.getByText("Airport history")).toBeVisible();
  await expect(exploration.getByText("First visited")).toBeVisible();
  await expect(exploration.getByRole("button")).not.toHaveCount(0);

  await page.locator(".passport-highlights dd button").first().click();
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

test("keeps delay facts inside their section at desktop and mobile widths", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo" }).click();
  await page.getByRole("button", { name: /Open / }).first().click();

  const delaySummary = page.locator(".delay-summary");
  await expect(delaySummary).toBeVisible();

  const expectContentContained = async () => {
    const insets = await delaySummary.evaluate((summary) => {
      const bounds = summary.getBoundingClientRect();
      return Array.from(summary.querySelectorAll(":scope > div > *")).map((element) => {
        const item = element.getBoundingClientRect();
        return Math.min(item.left - bounds.left, bounds.right - item.right);
      });
    });
    expect(Math.min(...insets)).toBeGreaterThanOrEqual(-0.5);
  };

  await expectContentContained();
  await page.setViewportSize({ width: 390, height: 844 });
  await expectContentContained();
  const fitsViewport = await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth);
  expect(fitsViewport).toBe(true);
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

  await page.getByRole("link", { name: "Flights" }).click();
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

  await page.getByRole("link", { name: "Flights" }).click();
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

  await page.getByRole("link", { name: "Flights" }).click();
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
  expect(bodyMetrics.family).toContain("Segoe UI Variable Text");
  expect(flightDataMetrics.family).toContain("Bahnschrift");
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
  expect(chineseHeadingMetrics.family).toContain("Microsoft YaHei UI");
  expect(chineseHeadingMetrics.size).toBeLessThan(englishTitleSize);
  expect(chineseHeadingMetrics.tracking).toBe("normal");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "航班" }).click();
  const fitsViewport = await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth);
  expect(fitsViewport).toBe(true);
});

test("presents the flight archive as a route-first open ledger", async ({ page }) => {
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
        routeComesFirst: row.firstElementChild?.classList.contains("flight-route") ?? false,
        searchBorderRadius: searchStyle.borderRadius,
        searchBoxShadow: searchStyle.boxShadow,
      };
    });

    expect(presentation.routeComesFirst).toBe(true);
    expect(presentation.routeCodeSize).toBeGreaterThan(presentation.flightNumberSize);
    expect(presentation.flightNumberSize).toBeGreaterThan(presentation.dateSize);
    expect(presentation.listDisplay).toBe("grid");
    expect(presentation.listColumns).toBe(viewport.width > 760 ? 2 : 1);
    expect(presentation.rowBorderRadius).toBe("4px");
    expect(presentation.rowBoxShadow).toBe("none");
    expect(presentation.searchBorderRadius).toBe("3px");
    expect(presentation.searchBoxShadow).toBe("none");
  }
});

test("keeps core archive surfaces precise and non-decorative", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo" }).click();

  await expect(page.locator(".flight-row .aviation-icon")).toHaveCount(0);
  await expect(page.locator(".flight-row .route-direction").first()).toHaveText("→");

  await page.locator(".flight-row").first().click();
  await expect(page.locator(".detail-route-map svg")).toBeVisible();
  await expect(page.locator(".detail-map-route")).toHaveCount(1);
  await expect(page.locator(".gate-sign").first()).toBeVisible();
  const detailPresentation = await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>(".detail-flight-card");
    const timeline = document.querySelector<HTMLElement>(".timeline");
    const facts = document.querySelector<HTMLElement>(".flight-facts");
    if (!hero || !timeline) throw new Error("Flight detail presentation landmarks are missing");
    const heroStyle = getComputedStyle(hero);
    const timelineStyle = getComputedStyle(timeline);
    const factsStyle = facts ? getComputedStyle(facts) : undefined;
    return {
      factsBoxShadow: factsStyle?.boxShadow ?? "none",
      heroBackgroundImage: heroStyle.backgroundImage,
      heroBorderRadius: heroStyle.borderRadius,
      heroBoxShadow: heroStyle.boxShadow,
      routeIcons: hero.querySelectorAll(".aviation-icon").length,
      routeTrackChildren: hero.querySelectorAll(".route-track > *").length,
      timelineBackgroundImage: timelineStyle.backgroundImage,
      timelineBorderRadius: timelineStyle.borderRadius,
      timelineBoxShadow: timelineStyle.boxShadow,
    };
  });
  expect(detailPresentation).toEqual({
    factsBoxShadow: "none",
    heroBackgroundImage: "none",
    heroBorderRadius: "8px",
    heroBoxShadow: "none",
    routeIcons: 0,
    routeTrackChildren: 2,
    timelineBackgroundImage: "none",
    timelineBorderRadius: "0px",
    timelineBoxShadow: "none",
  });

  await page.getByRole("link", { name: "Passport" }).click();
  await expect(page.locator(".route-map svg")).toBeVisible();
  const passportPresentation = await page.evaluate(() => {
    const map = document.querySelector<HTMLElement>(".route-map");
    const canvas = document.querySelector<HTMLElement>(".route-map-canvas");
    const switcher = document.querySelector<HTMLElement>(".view-switcher");
    const highlights = document.querySelector<HTMLElement>(".passport-highlights");
    const yearHistory = document.querySelector<HTMLElement>(".year-history");
    if (!map || !canvas || !switcher || !highlights || !yearHistory) {
      throw new Error("Passport presentation landmarks are missing");
    }
    const mapStyle = getComputedStyle(map);
    const switcherStyle = getComputedStyle(switcher);
    return {
      canvasBackgroundImage: getComputedStyle(canvas).backgroundImage,
      highlightsDisplay: getComputedStyle(highlights).display,
      mapBorderRadius: mapStyle.borderRadius,
      mapBoxShadow: mapStyle.boxShadow,
      countryPaths: map.querySelectorAll(".map-country").length,
      graticules: map.querySelectorAll(".map-graticule").length,
      permanentAirportLabels: map.querySelectorAll(".map-airport-label").length,
      routeFilter: getComputedStyle(document.querySelector<SVGGElement>(".map-routes")!).filter,
      svgDefinitions: map.querySelectorAll("defs").length,
      visitedCountries: map.querySelectorAll(".map-country.is-visited").length,
      switcherBorderRadius: switcherStyle.borderRadius,
      switcherBackgroundImage: switcherStyle.backgroundImage,
      yearHistoryDisplay: getComputedStyle(yearHistory).display,
    };
  });
  expect(passportPresentation).toEqual({
    canvasBackgroundImage: "none",
    countryPaths: 177,
    graticules: 0,
    highlightsDisplay: "block",
    mapBorderRadius: "4px",
    mapBoxShadow: "none",
    permanentAirportLabels: 5,
    routeFilter: "none",
    svgDefinitions: 1,
    switcherBorderRadius: "4px",
    switcherBackgroundImage: "none",
    visitedCountries: 9,
    yearHistoryDisplay: "block",
  });
});

test("localizes airport identity and keeps sparse facility and map layouts legible", async ({ page }) => {
  const archive = JSON.parse(await readFile(exampleArchive, "utf8"));
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
    extensions: {},
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

  await expect(page.locator(".airport-block").first().locator("small"))
    .toHaveText("SZX · Shenzhen Bao'an International Airport");
  await expect(page.locator(".facility-grid--single .facility-stop")).toHaveCount(1);
  await expect(page.locator(".gate-sign")).toContainText("338");

  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Appearance").selectOption("light");
  await page.getByLabel("Language").selectOption("zh-CN");
  await page.getByRole("link", { name: "航班" }).click();
  await page.getByRole("button", { name: /打开 ZH9911/ }).click();

  const airportBlocks = page.locator(".airport-block");
  await expect(airportBlocks.nth(0).locator(".detail-airport-city")).toHaveText("深圳");
  await expect(airportBlocks.nth(0).locator("small")).toHaveText("深圳宝安机场");
  await expect(airportBlocks.nth(1).locator(".detail-airport-city")).toHaveText("青岛");
  await expect(airportBlocks.nth(1).locator("small")).toHaveText("青岛胶东机场");

  const heroAlignment = await page.locator(".route-hero").evaluate((hero) => {
    const primaries = [...hero.querySelectorAll<HTMLElement>(".detail-route-primary")];
    const names = [...hero.querySelectorAll<HTMLElement>(".detail-airport-city")];
    return {
      primaryTopDelta: Math.abs(primaries[0].getBoundingClientRect().top - primaries[1].getBoundingClientRect().top),
      cityTopDelta: Math.abs(names[0].getBoundingClientRect().top - names[1].getBoundingClientRect().top),
    };
  });
  expect(heroAlignment.primaryTopDelta).toBeLessThanOrEqual(1);
  expect(heroAlignment.cityTopDelta).toBeLessThanOrEqual(1);

  const mapSurface = await page.locator(".detail-route-map").evaluate((element) => {
    const channels = getComputedStyle(element).backgroundColor.match(/\d+/g)?.slice(0, 3).map(Number) ?? [];
    return channels.reduce((sum, channel) => sum + channel, 0) / channels.length;
  });
  expect(mapSurface).toBeGreaterThan(180);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test("keeps every page aligned to the shared responsive shell", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo" }).click();

  for (const width of [320, 760, 761, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });

    for (const pageName of ["Flights", "Passport", "Settings"]) {
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
      expect(layout.mainPaddingTop).toBe(width <= 760 ? 24 : 32);
      expect(layout.mainPaddingBottom).toBe(width <= 760 ? 64 : 120);
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
    await page.getByRole("link", { name: "Flights" }).click();

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
        ".flight-number strong, .flight-route time, .airport-code-display",
      )).filter(visible);
      const routeValues = Array.from(row.querySelectorAll<HTMLElement>(
        ".flight-route .airport-code-display, .flight-route time",
      )).filter(visible);
      const airportNames = Array.from(row.querySelectorAll<HTMLElement>(".flight-airport small"));
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

    expect(archive.listColumns).toBe(viewport.width <= 760 ? 1 : 2);
    expect(archive.airportNamesVisible).toBe(true);

    await page.locator(".flight-row").first().click();
    const detail = await page.evaluate(() => {
      const values = Array.from(document.querySelectorAll<HTMLElement>(
        ".detail-heading h1, .detail-airport-time, .airport-code",
      ));
      const airportNames = Array.from(document.querySelectorAll<HTMLElement>(".airport-block small"));
      return {
        airportNamesConstrained: airportNames.every((element) => {
          const style = getComputedStyle(element);
          return style.display === "none" || (
            element.scrollWidth <= element.clientWidth + 0.5
            && ["anywhere", "break-word"].includes(style.overflowWrap)
          );
        }),
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
    await page.getByRole("link", { name: "Flights" }).click();
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
