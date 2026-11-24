import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { disablePassportWebGL } from "./helpers/passport-svg";

test.beforeEach(async ({ page }) => disablePassportWebGL(page));

// The skin mechanism and the `minimal` skin (docs/views-and-skins.md, phase 3).

const views = ["log", "map", "stats", "passport"];

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
  if (appearance) {
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
  result.detail = await text("main");
  return result;
}

test.describe("skins", () => {
  test("the skin is chosen in Settings, applies at once and survives reload @cross-browser", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDemo(page);
    const root = page.locator("html");
    await expect(root).toHaveAttribute("data-skin", "classic");
    await expect(page.locator(".site-navigation a").first()).toHaveAttribute(
      "href",
      "#/map",
    );

    await page.goto("/#/settings");
    const skin = page.getByRole("combobox", { name: "Skin", exact: true });
    await expect(skin).toHaveValue("classic");
    await expect(skin.locator("option")).toHaveText(["Classic", "Minimal"]);
    await expect(
      page.getByRole("combobox", { name: "Map theme", exact: true }),
    ).toBeVisible();

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

    await chooseSkin(page, "classic");
    await page.goto("/");
    await expect(page).toHaveURL(/#\/map$/);
    expect((await savedSettings(page))?.skin).toBe("classic");
  });

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
    // The stored theme of the previous look is left alone.
    expect((await savedSettings(page))?.mapTheme).toBe("neon-aviation");

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
      const classic = await inventory(page);
      await chooseSkin(page, "minimal");
      expect(await inventory(page)).toEqual(classic);
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
    test(`minimal fits ${name} (${width}×${height})`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await openDemo(page);
      await chooseSkin(page, "minimal");
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
      if (width >= 1920) {
        // Ultrawide spends the room on content rather than on margins.
        const row = await rows.first().boundingBox();
        expect(row!.width).toBeGreaterThan(width * 0.9);
        expect(
          await page
            .locator(".app-shell")
            .evaluate((shell) =>
              getComputedStyle(shell).getPropertyValue("--passport-px").trim(),
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
              .filter((box) => box.width && (box.height < 44 || box.width < 44))
              .map((box) => `${box.width}x${box.height}`),
          );
        expect(small).toEqual([]);
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
    test(`minimal keeps its layout at a device scale of ${scale}`, async ({
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
      await chooseSkin(page, "minimal");
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
    test(`minimal fits a 320 px screen in ${language}`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await openDemo(page);
      await chooseSkin(page, "minimal");
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
      }
    });
  }

  for (const appearance of ["light", "dark"]) {
    test(`minimal passes the accessibility checks in ${appearance}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await openDemo(page);
      await chooseSkin(page, "minimal", appearance);
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
