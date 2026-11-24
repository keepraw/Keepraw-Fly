import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { disablePassportWebGL } from "./helpers/passport-svg";

test.beforeEach(async ({ page }) => disablePassportWebGL(page));

// The skin mechanism and the `minimal` skin (docs/views-and-skins.md, phase 3).

const views = ["log", "map", "stats"];

async function openDemo(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await expect(page.locator(".passport-layout")).toBeVisible();
}

async function chooseSkin(page: Page, skin: string, appearance?: string) {
  await page.goto("/#/settings");
  await page.locator("#settings-skin").selectOption(skin);
  await expect(page.locator("html")).toHaveAttribute("data-skin", skin);
  if (appearance && skin !== "aviation") {
    await page.locator("#settings-appearance").selectOption(appearance);
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      appearance,
    );
  }
}

async function savedSettings(page: Page) {
  return page.evaluate(async () => {
    const path = "/src/storage/browser.ts";
    const { browserStorage } = await import(/* @vite-ignore */ path);
    return browserStorage.loadSettings();
  });
}

const fitsWidth = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );

/** What a view tells the reader, independent of where the skin puts it. */
async function inventory(page: Page) {
  const text = (selector: string) =>
    page
      .locator(selector)
      .evaluateAll((nodes) =>
        nodes.map((node) => node.textContent?.replace(/\s+/g, " ").trim()),
      );
  const result: Record<string, unknown> = {};
  await page.goto("/#/log");
  await expect(page.locator(".flight-record").first()).toBeVisible();
  result.rows = await text(".flight-record");
  result.totals = await text(".passport-core-stats, .passport-mobile-summary");
  await page.goto("/#/stats");
  await expect(page.locator(".stats-panel").first()).toBeVisible();
  result.stats = await text(".stats-panel");
  await page.goto("/#/log");
  await page.locator(".flight-record .flight-row").first().click();
  await expect(page.locator(".detail-heading")).toBeVisible();
  // The skin's extension is the one place where skins may differ in content.
  result.detail = await page.locator("main").evaluate((main) => {
    const copy = main.cloneNode(true) as HTMLElement;
    for (const extension of copy.querySelectorAll(".detail-extension"))
      extension.remove();
    return copy.textContent?.replace(/\s+/g, " ").trim();
  });
  return result;
}

test.describe("skins", () => {
  test("the skin is chosen in Settings, applies at once and survives reload @cross-browser", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDemo(page);
    const root = page.locator("html");
    await expect(root).toHaveAttribute("data-skin", "aviation");
    await expect(page).toHaveURL(/#\/map$/);
    await expect(page.locator(".site-navigation a").first()).toHaveAttribute(
      "href",
      "#/map",
    );

    await page.goto("/#/settings");
    const skin = page.getByRole("combobox", { name: "Skin", exact: true });
    await expect(skin).toHaveValue("aviation");
    await expect(skin.locator("option")).toHaveText(["Minimal", "Aviation"]);

    await skin.selectOption("minimal");
    await expect(root).toHaveAttribute("data-skin", "minimal");
    await expect
      .poll(async () => (await savedSettings(page))?.skin)
      .toBe("minimal");
    // An explicit address is kept; only the order of the views changes.
    await expect(page).toHaveURL(/#\/settings$/);
    await expect(page.locator(".site-navigation a").first()).toHaveAttribute(
      "href",
      "#/log",
    );
    // The skin owns the map theme and the Passport layout.
    await expect(
      page.getByRole("combobox", { name: "Map theme", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("combobox", { name: "Passport layout", exact: true }),
    ).toHaveCount(0);
    const appearance = page.locator("#settings-appearance");
    await expect(appearance).toBeEnabled();
    await appearance.selectOption("light");
    await expect(root).toHaveAttribute("data-theme", "light");

    await page.goto("/");
    await page.reload();
    await expect(root).toHaveAttribute("data-skin", "minimal");
    await expect(page).toHaveURL(/#\/log$/);
    await expect(page.locator(".passport-layout")).toHaveAttribute(
      "data-view",
      "log",
    );
    // Addresses saved before the views existed open the skin's landing view.
    await page.goto("/#passport");
    await expect(page.locator(".passport-layout")).toHaveAttribute(
      "data-view",
      "log",
    );
    await page.goto("/#/stats");
    await page.reload();
    await expect(page.locator(".passport-layout")).toHaveAttribute(
      "data-view",
      "stats",
    );

    // Back to the dark-only skin: the stored appearance is kept, not applied.
    await chooseSkin(page, "aviation");
    await expect(root).toHaveAttribute("data-theme", "dark");
    await expect(appearance).toBeDisabled();
    await expect(appearance).toHaveValue("dark");
    await expect(page.locator("#settings-appearance-hint")).toHaveText(
      "Aviation is only available in dark.",
    );
    await expect(appearance).toHaveAttribute(
      "aria-describedby",
      "settings-appearance-hint",
    );
    await page.goto("/");
    await expect(page).toHaveURL(/#\/map$/);
    expect(await savedSettings(page)).toMatchObject({
      skin: "aviation",
      appearance: "light",
    });
  });

  test("aviation is the default, dark on a light device, and replaces the retired look", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const root = page.locator("html");
    // Before any archive exists, and before the application has started.
    await expect(root).toHaveAttribute("data-skin", "aviation");
    await expect(root).toHaveAttribute("data-theme", "dark");
    await expect(root).toHaveCSS("color-scheme", "dark");
    await page.getByRole("button", { name: "Try demo", exact: true }).click();
    await expect(page.locator(".passport-layout")).toHaveAttribute(
      "data-view",
      "map",
    );
    await expect(page.locator(".route-map")).toHaveAttribute(
      "data-map-theme",
      "neon-aviation",
    );
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      "rgb(12, 10, 36)",
    );

    // A record written while the v0.3.0 look was still a skin.
    await page.evaluate(async () => {
      const path = "/src/storage/browser.ts";
      const { browserStorage } = await import(/* @vite-ignore */ path);
      const settings = await browserStorage.loadSettings();
      await browserStorage.saveSettings({
        ...settings,
        skin: "classic",
        appearance: "light",
        timeFormat: "12-hour",
      });
    });
    await page.goto("/");
    await page.reload();
    await expect(root).toHaveAttribute("data-skin", "aviation");
    await expect(root).toHaveAttribute("data-theme", "dark");
    await expect(page).toHaveURL(/#\/map$/);
    await page.goto("/#/settings");
    await expect(page.locator("#settings-skin")).toHaveValue("aviation");
    await expect(page.locator("#settings-time-format")).toHaveValue("12-hour");
    await expect(
      page.getByRole("combobox", { name: "Map theme", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("combobox", { name: "Passport layout", exact: true }),
    ).toHaveCount(0);
  });

  test("aviation adds its Flight extension, and only where the flight has the data", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDemo(page);
    const extension = page.locator(".detail-extension");
    // Tokyo to Dallas crosses the date line and lands on the day it left.
    await page.goto("/#/log");
    await page.getByRole("button", { name: /Open AA178/ }).click();
    await expect(page.locator(".detail-heading")).toBeVisible();
    const address = page.url();
    await expect(extension).toBeVisible();
    for (const name of ["Scheduled and actual", "Local time at both airports"])
      await expect(
        extension.getByRole("heading", { name, exact: true }),
      ).toBeVisible();
    await expect(extension.locator(".aviation-comparison-row")).toHaveCount(2);
    await expect(extension.locator(".aviation-clock-row")).toHaveCount(2);
    await expect(extension.locator(".aviation-date-line")).toHaveCount(1);
    await expect(extension.locator(".aviation-clocks-note")).toContainText(
      "date line",
    );
    // The shelf every skin shows is still there, after the extension.
    await expect(
      page.locator(".detail-metadata-shelf, .detail-context").first(),
    ).toBeVisible();
    expect(await fitsWidth(page)).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .include(".detail-extension")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(extension).toBeVisible();
      expect(await fitsWidth(page), `${width}`).toBe(true);
    }

    // A flight inside one time zone gets the comparison alone, and a
    // cancelled one gets nothing at all.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/#/log");
    await page.getByRole("button", { name: /Open UA123/ }).click();
    await expect(page.locator(".detail-heading")).toBeVisible();
    await expect(extension.locator(".aviation-comparison")).toHaveCount(1);
    await expect(extension.locator(".aviation-clocks")).toHaveCount(0);
    await page.goto("/#/log");
    await page.getByRole("button", { name: /Open AC566/ }).click();
    await expect(page.locator(".detail-heading")).toBeVisible();
    await expect(extension).toHaveCount(0);

    // Another skin fills the slot with nothing.
    await page.setViewportSize({ width: 1440, height: 900 });
    await chooseSkin(page, "minimal");
    await page.goto(address);
    await expect(page.locator(".detail-heading")).toBeVisible();
    await expect(extension).toHaveCount(0);
  });

  // The header must not move when the view changes: the wordmark, the
  // navigation and Add flight keep their boxes in every view of a skin.
  for (const skin of ["aviation", "minimal"]) {
    test(`${skin} keeps one header geometry in every view and screen class @cross-browser`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 1440, height: 900 });
      await openDemo(page);
      await chooseSkin(page, skin);
      const box = (selector: string) =>
        page.evaluate((query) => {
          const element = [...document.querySelectorAll(query)].find(
            (candidate) => candidate.getClientRects().length > 0,
          );
          if (!element) return null;
          const { x, y, width, height } = element.getBoundingClientRect();
          return [x, y, width, height].map(
            (value) => Math.round(value * 2) / 2,
          );
        }, selector);
      for (const [width, height] of [
        [390, 844],
        [1024, 900],
        [1366, 650],
        [1440, 900],
        [1920, 1080],
        [2560, 1440],
        [3840, 2160],
      ]) {
        await page.setViewportSize({ width, height });
        const desktop = width > 760;
        const parts = desktop
          ? [
              ".site-header",
              ".site-header-inner",
              ".wordmark",
              ".site-navigation",
              '.site-navigation a[href="#/settings"]',
              ".site-header-add",
            ]
          : [".site-header", ".site-header-inner", ".mobile-page-heading h1"];
        // On a phone Settings and Import are sub-pages: a Back button and a
        // compact title replace the tab bar, so they share their own geometry.
        const references = new Map<boolean, unknown>();
        for (const view of [...views, "settings", "import"]) {
          const group = desktop || views.includes(view);
          await page.goto(`/#/${view}`);
          await expect(page.locator("main#main-content")).toBeVisible();
          // The title's width follows its text; its position must not.
          const measured = await Promise.all(
            parts.map(async (part) => {
              const rect = await box(part);
              expect(rect, `${part} in ${view} at ${width}px`).not.toBeNull();
              return part.endsWith("h1") ? rect!.slice(1, 2) : rect;
            }),
          );
          if (!references.has(group)) references.set(group, measured);
          expect(measured, `${view} at ${width}×${height}`).toEqual(
            references.get(group),
          );
          expect(await fitsWidth(page)).toBe(true);
        }
      }
    });
  }

  test("minimal draws its own map theme for each appearance", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDemo(page);
    await chooseSkin(page, "minimal", "light");
    await page.goto("/#/map");
    const map = page.locator(".route-map");
    await expect(map).toHaveAttribute("data-map-theme", "daylight-chart");
    await chooseSkin(page, "minimal", "dark");
    await page.goto("/#/map");
    await expect(map).toHaveAttribute("data-map-theme", "graphite-chart");
    await page.locator(".flight-record .flight-row").first().click();
    await expect(page.locator(".detail-flight-map")).toHaveAttribute(
      "data-map-theme",
      "graphite-chart",
    );

    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await chooseSkin(page, "minimal");
    await page.locator("#settings-appearance").selectOption("system");
    await page.goto("/#/map");
    await expect(map).toHaveAttribute("data-map-theme", "graphite-chart");
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await expect(map).toHaveAttribute("data-map-theme", "daylight-chart");
  });

  for (const [name, width, height] of [
    ["Wide", 1440, 900],
    ["Compact", 390, 844],
  ] as const) {
    test(`both skins show the same information on ${name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await openDemo(page);
      const aviation = await inventory(page);
      await chooseSkin(page, "minimal");
      expect(await inventory(page)).toEqual(aviation);
    });
  }

  for (const [name, width, height] of [
    ["Compact", 390, 844],
    ["Compact 320", 320, 640],
    ["Medium", 1024, 768],
    ["Short", 1366, 650],
    ["Wide", 1536, 864],
    ["Ultrawide", 1920, 1080],
    ["Ultrawide 2K", 2560, 1440],
    ["Ultrawide 4K", 3840, 2160],
  ] as const) {
    for (const skin of ["minimal", "aviation"])
      test(`${skin} fits ${name} (${width}×${height})`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await openDemo(page);
        await chooseSkin(page, skin);
        for (const view of [...views, "settings"]) {
          await page.goto(`/#/${view}`);
          await expect(
            page.locator(
              view === "settings" ? ".settings-page" : ".passport-layout",
            ),
          ).toBeVisible();
          expect(await fitsWidth(page), `${view} fits`).toBe(true);
        }
        await page.goto("/#/log");
        const rows = page.locator(".flight-record .flight-row");
        // 320×640 keeps the summary above the list, as in every skin.
        if (height > 640) await expect(rows.first()).toBeInViewport();
        else await expect(rows.first()).toBeVisible();
        if (width >= 1920 && skin === "aviation") {
          // Ultrawide gives the room to the workspace, and so to the map.
          await page.goto("/#/map");
          const layout = await page.locator(".passport-layout").boundingBox();
          expect(layout!.width).toBeGreaterThan(width * 0.9);
          const map = await page.locator(".route-map").boundingBox();
          expect(map!.width).toBeGreaterThan(width * 0.5);
        }
        if (width >= 1920 && skin === "minimal") {
          // Ultrawide spends the room on content rather than on margins.
          const row = await rows.first().boundingBox();
          expect(row!.width).toBeGreaterThan(width * 0.9);
          expect(
            await page
              .locator(".app-shell")
              .evaluate((shell) =>
                getComputedStyle(shell)
                  .getPropertyValue("--passport-px")
                  .trim(),
              ),
          ).toBe("1px");
        }
        if (width < 760) {
          const small = await page
            .locator(
              ".primary-tab-bar a, .primary-tab-bar button, .flight-row, .year-tab, .log-filters-toggle",
            )
            .evaluateAll((controls) =>
              controls
                .map((control) => control.getBoundingClientRect())
                .filter(
                  (box) => box.width && (box.height < 44 || box.width < 44),
                )
                .map((box) => `${box.width}x${box.height}`),
            );
          expect(small).toEqual([]);
          await page.goto("/#/log");
          await page.locator(".primary-tab-add").click();
          await expect(page.locator(".flight-editor")).toBeVisible();
          const editorControls = await page
            .locator(".editor-close, .editor-actions button")
            .evaluateAll((controls) =>
              controls
                .map((control) => control.getBoundingClientRect())
                .filter((box) => box.height < 44 || box.width < 44)
                .map((box) => `${box.width}x${box.height}`),
            );
          expect(editorControls).toEqual([]);
        }
      });
  }

  for (const scale of [1.25, 1.5, 2]) {
    for (const skin of ["minimal", "aviation"])
      test(`${skin} keeps its layout at a device scale of ${scale}`, async ({
        browser,
      }) => {
        // 4K at this scale: the layout is decided by CSS pixels alone.
        const context = await browser.newContext({
          viewport: {
            width: Math.round(3840 / scale),
            height: Math.round(2160 / scale),
          },
          deviceScaleFactor: scale,
        });
        const page = await context.newPage();
        await disablePassportWebGL(page);
        await openDemo(page);
        await chooseSkin(page, skin);
        for (const view of views) {
          await page.goto(`/#/${view}`);
          await expect(page.locator(".passport-layout")).toBeVisible();
          expect(await fitsWidth(page), `${view} fits`).toBe(true);
        }
        await context.close();
      });
  }

  for (const [language, width] of [
    ["en-US", 1200],
    ["ja-JP", 1200],
    ["de-DE", 1440],
  ] as const) {
    test(`minimal keeps Log cells apart at ${width} px in ${language} with 12-hour times`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await openDemo(page);
      await chooseSkin(page, "minimal");
      await page.locator("#settings-time-format").selectOption("12-hour");
      await page.locator("#settings-language").selectOption(language);
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      await page.goto("/#/log");
      await expect(
        page.locator(".flight-row-detail .flight-deviation").first(),
      ).toBeVisible();
      const collisions = await page.evaluate(() => {
        const inked = (node: Element) => {
          const range = document.createRange();
          range.selectNodeContents(node);
          return range.getBoundingClientRect();
        };
        let count = 0;
        for (const row of document.querySelectorAll(".flight-row")) {
          const cells = [
            ...row.querySelectorAll(
              ".flight-date, .flight-number, .flight-route-cities, .flight-route-codes, .flight-row-detail > *, .flight-times",
            ),
          ]
            .map(inked)
            .filter((box) => box.width > 0);
          for (let a = 0; a < cells.length; a += 1)
            for (let b = a + 1; b < cells.length; b += 1) {
              const across =
                Math.min(cells[a].right, cells[b].right) -
                Math.max(cells[a].left, cells[b].left);
              const down =
                Math.min(cells[a].bottom, cells[b].bottom) -
                Math.max(cells[a].top, cells[b].top);
              if (Math.min(across, down) > 1) count += 1;
            }
        }
        return count;
      });
      expect(collisions).toBe(0);
      expect(await fitsWidth(page)).toBe(true);
    });
  }

  for (const language of ["zh-CN", "de-DE", "ja-JP"]) {
    for (const skin of ["minimal", "aviation"])
      test(`${skin} fits a 320 px screen in ${language}`, async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 640 });
        await openDemo(page);
        await chooseSkin(page, skin);
        await page.locator("#settings-language").selectOption(language);
        await expect(page.locator("html")).toHaveAttribute("lang", language);
        for (const view of [...views, "settings"]) {
          await page.goto(`/#/${view}`);
          await expect(
            page.locator(
              view === "settings" ? ".settings-page" : ".passport-layout",
            ),
          ).toBeVisible();
          expect(await fitsWidth(page), `${view} fits`).toBe(true);
          if (view !== "map") continue;
          // The map clips its overflow, so a too-wide stage hides the controls
          // without widening the page.
          const controls = await page.locator(".route-map").evaluate((map) => {
            const frame = map.getBoundingClientRect();
            return [...map.querySelectorAll(".map-zoom-controls button")].map(
              (control) => {
                const box = control.getBoundingClientRect();
                return (
                  box.left >= frame.left - 1 && box.right <= frame.right + 1
                );
              },
            );
          });
          expect(controls, `${view} map controls`).toEqual([true, true, true]);
        }
      });
  }

  for (const [skin, appearance] of [
    ["minimal", "light"],
    ["minimal", "dark"],
    ["aviation", "dark"],
  ] as const) {
    test(`${skin} passes the accessibility checks in ${appearance}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await openDemo(page);
      await chooseSkin(page, skin, appearance);
      for (const view of [...views, "settings"]) {
        await page.goto(`/#/${view}`);
        await expect(
          page.locator(
            view === "settings" ? ".settings-page" : ".passport-layout",
          ),
        ).toBeVisible();
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
          ).violations,
          view,
        ).toEqual([]);
      }
      await page.goto("/#/log");
      await page.locator(".flight-record .flight-row").first().click();
      await expect(page.locator(".detail-heading")).toBeVisible();
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/#/log");
      await expect(page.locator(".passport-layout")).toBeVisible();
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    });
  }
});
