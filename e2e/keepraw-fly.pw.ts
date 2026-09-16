import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
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
  await editor.getByRole("button", { name: "Save flight" }).click();

  await expect(page.getByRole("heading", { name: "UA123" })).toBeVisible();
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
  await expect(page.getByRole("region", { name: "Review before importing" })).toBeVisible();
  await expect(page.getByText("张鸿川")).toBeVisible();
  await page.getByRole("button", { name: "Import this archive" }).click();

  await expect(page.getByRole("button", { name: /Open UA123/ })).toBeVisible();
  await page.getByRole("link", { name: "Passport" }).click();
  await expect(page.getByRole("heading", { name: "张鸿川" })).toBeVisible();
  await expect(page.getByRole("img", { name: /World map showing 1 flight/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Highlights" })).toBeVisible();
});

test("keeps delay facts inside their card at desktop and mobile widths", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo" }).click();
  await page.getByRole("button", { name: /Open / }).first().click();

  const delaySummary = page.locator(".delay-summary");
  await expect(delaySummary).toBeVisible();

  const expectContentInset = async (minimumInset: number) => {
    const insets = await delaySummary.evaluate((summary) => {
      const bounds = summary.getBoundingClientRect();
      return Array.from(summary.querySelectorAll(":scope > div > *")).map((element) => {
        const item = element.getBoundingClientRect();
        return Math.min(item.left - bounds.left, bounds.right - item.right);
      });
    });
    expect(Math.min(...insets)).toBeGreaterThanOrEqual(minimumInset);
  };

  await expectContentInset(29);
  await page.setViewportSize({ width: 390, height: 844 });
  await expectContentInset(19);
  const fitsViewport = await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth);
  expect(fitsViewport).toBe(true);
});

test("maps and previews CSV columns before appending flights", async ({ page }) => {
  await page.goto("/#settings");
  await page.locator('input[type="file"][accept*=".csv"]').setInputFiles(exampleCsv);
  const preview = page.getByRole("region", { name: "Review CSV import" });
  await expect(preview).toBeVisible();
  await expect(preview.getByLabel("Flight number", { exact: true })).toHaveValue("0");
  await expect(preview.getByText("MU589")).toBeVisible();
  await preview.getByRole("button", { name: "Add 1 flight" }).click();

  await page.getByRole("link", { name: "Flights" }).click();
  await expect(page.getByRole("button", { name: /Open MU589/ })).toBeVisible();
});

test("supports dark mode, keyboard modal controls and WCAG checks", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const welcomeAudit = await new AxeBuilder({ page }).analyze();
  expect(welcomeAudit.violations).toEqual([]);
  await page.getByRole("button", { name: "Try demo" }).click();

  await page.getByRole("link", { name: "Settings" }).click();
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
  expect(flightDataMetrics.family).toContain("Segoe UI Variable Display");
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
      const searchStyle = getComputedStyle(search);
      return {
        dateSize: Number.parseFloat(getComputedStyle(serviceDate).fontSize),
        flightNumberSize: Number.parseFloat(getComputedStyle(flightNumber).fontSize),
        listBorderRadius: listStyle.borderRadius,
        listBoxShadow: listStyle.boxShadow,
        listSideBorders: [listStyle.borderLeftWidth, listStyle.borderRightWidth],
        routeCodeSize: Number.parseFloat(getComputedStyle(routeCode).fontSize),
        routeComesFirst: row.firstElementChild?.classList.contains("flight-route") ?? false,
        searchBorderRadius: searchStyle.borderRadius,
        searchBoxShadow: searchStyle.boxShadow,
      };
    });

    expect(presentation.routeComesFirst).toBe(true);
    expect(presentation.routeCodeSize).toBeGreaterThan(presentation.flightNumberSize);
    expect(presentation.flightNumberSize).toBeGreaterThan(presentation.dateSize);
    expect(presentation.listBorderRadius).toBe("0px");
    expect(presentation.listBoxShadow).toBe("none");
    expect(presentation.listSideBorders).toEqual(["0px", "0px"]);
    expect(presentation.searchBorderRadius).toBe("0px");
    expect(presentation.searchBoxShadow).toBe("none");
  }
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
      expect(layout.main.right - layout.main.left).toBeLessThanOrEqual(1120);
      expect(layout.mainPaddingTop).toBe(width <= 760 ? 40 : 48);
      expect(layout.mainPaddingBottom).toBe(width <= 760 ? 80 : 120);
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
      const airportNames = Array.from(row.querySelectorAll<HTMLElement>(".flight-airport-heading small"));
      const headerBounds = header.getBoundingClientRect();
      const mainBounds = main.getBoundingClientRect();
      const rowStyle = getComputedStyle(row);

      return {
        atomicValues: atomicValues.length,
        atomicValuesStayWhole: atomicValues.every((element) => getComputedStyle(element).whiteSpace === "nowrap"),
        airportNamesVisible: airportNames.some(visible),
        identityVisible: visible(row.querySelector(".flight-number")),
        routeValues: routeValues.length,
        routeVisible: visible(row.querySelector(".flight-route")),
        statusVisible: visible(row.querySelector(":scope > .flight-status")),
        cueVisible: visible(row.querySelector(".flight-open-cue")),
        fitsViewport: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        gridAreas: rowStyle.gridTemplateAreas,
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

    if (viewport.width === 390) {
      expect(archive.gridAreas).toContain('"route route route"');
      expect(archive.airportNamesVisible).toBe(false);
      expect(archive.cueVisible).toBe(false);
    } else {
      expect(archive.gridAreas).toBe('"route identity date status cue"');
      expect(archive.airportNamesVisible).toBe(true);
      expect(archive.cueVisible).toBe(true);
    }

    await page.locator(".flight-row").first().click();
    const detail = await page.evaluate(() => {
      const values = Array.from(document.querySelectorAll<HTMLElement>(
        ".detail-heading h1, .detail-airport-time, .airport-code",
      ));
      const airportNames = Array.from(document.querySelectorAll<HTMLElement>(".airport-block small"));
      return {
        airportNamesConstrained: airportNames.every((element) => {
          const style = getComputedStyle(element);
          return style.display === "none" || (style.overflow === "hidden" && style.textOverflow === "ellipsis");
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
