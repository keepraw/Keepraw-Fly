import { openSettingsCategory } from "./helpers/settings";
import { expect, test, type Page, type Locator } from "@playwright/test";
import { disablePassportWebGL } from "./helpers/passport-svg";
import { collectBrowserErrors, expectHealthyPage } from "./helpers/responsive";

test.describe.configure({ mode: "parallel" });

const colors = {
  light: {
    canvas: "rgb(243, 246, 250)",
    text: "rgb(30, 43, 62)",
    muted: "rgb(87, 103, 123)",
    faint: "rgb(86, 105, 130)",
    surface: "rgb(247, 249, 252)",
    accent: "rgb(37, 77, 132)",
    line: "rgb(217, 225, 236)",
    focus: "rgb(101, 88, 199)",
    danger: "rgb(189, 68, 58)",
    mobileDanger: "rgb(180, 64, 54)",
  },
  dark: {
    canvas: "rgb(18, 25, 35)",
    text: "rgb(229, 234, 242)",
    muted: "rgb(165, 177, 194)",
    faint: "rgb(148, 163, 183)",
    surface: "rgb(21, 30, 42)",
    accent: "rgb(164, 187, 223)",
    line: "rgb(42, 54, 71)",
    focus: "rgb(183, 167, 245)",
    danger: "rgb(237, 139, 124)",
    mobileDanger: "rgb(237, 139, 124)",
  },
};
type Theme = keyof typeof colors;

async function expectSurface(target: Locator, theme: Theme) {
  await expect(target).toHaveCSS("background-color", colors[theme].canvas);
  await expect(target).toHaveCSS("color", colors[theme].text);
}

async function expectPrimary(target: Locator, theme: Theme) {
  await expect(target).toHaveCSS("background-color", colors[theme].accent);
  await expect(target).toHaveCSS("border-top-color", colors[theme].accent);
  await expect(target).toHaveCSS("color", colors[theme].canvas);
}

async function headerColors(page: Page) {
  return page.locator(".site-header").evaluate((header) => {
    return [
      header,
      ...header.querySelectorAll("a, button, .wordmark-mark"),
    ].map((el) => {
      const css = getComputedStyle(el);
      return [css.color, css.backgroundColor, css.borderBottomColor];
    });
  });
}

test.beforeEach(async ({ page }) => {
  await disablePassportWebGL(page);
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
});

for (const language of ["en", "zh-CN", "zh-TW"] as const) {
  test.describe(language, () => {
    test.use({ locale: language === "en" ? "en-US" : language });
    for (const width of [390, 760, 761, 1440]) {
      test(`fresh welcome, create, demo, import and reload at ${width}px`, async ({
        page,
      }) => {
        test.setTimeout(120_000);
        const errors = collectBrowserErrors(page);
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/");
        await expect(page.locator(".welcome")).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("lang", language);
        await expectSurface(page.locator(".app-shell"), "light");

        for (const [mode, os, theme] of [
          ["light", "dark", "light"],
          ["dark", "light", "dark"],
          ["system", "light", "light"],
          ["system", "dark", "dark"],
        ] as const) {
          await page.goto("/#settings");
          await page
            .locator(".settings-display-fields select")
            .nth(1)
            .selectOption(mode);
          await page.emulateMedia({ colorScheme: os });
          await expect(page.locator(".persistence-status")).toHaveText("");
          await page.goto("/#passport");
          await expect(page.locator(".welcome")).toBeVisible();
          await expectSurface(page.locator(".app-shell"), theme);
          const palette = colors[theme];
          await expect(page.locator(".welcome > p").nth(1)).toHaveCSS(
            "color",
            palette.muted,
          );
          await expect(page.locator(".privacy-note")).toHaveCSS(
            "color",
            palette.faint,
          );
          const create = page.locator(".welcome-actions > .button-primary");
          await expectPrimary(create, theme);
          await expect(page.locator(".welcome .button-secondary")).toHaveCSS(
            "border-top-color",
            palette.line,
          );
          await create.focus();
          await page.keyboard.press("Tab");
          await expect(page.locator(".welcome .button-secondary")).toHaveCSS(
            "outline-color",
            palette.focus,
          );
          await page.keyboard.press("Tab");
          await expect(page.locator(".welcome .import-primary")).toHaveCSS(
            "outline-color",
            palette.focus,
          );
          if (mode === "system") {
            const other = theme === "light" ? "dark" : "light";
            await page.emulateMedia({ colorScheme: other });
            await expectSurface(page.locator(".app-shell"), other);
            await expectPrimary(create, other);
            await page.emulateMedia({ colorScheme: os });
            await expectSurface(page.locator(".app-shell"), theme);
          }
          const welcomeHeader = await headerColors(page);
          await create.click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await page.locator(".editor-close").click();
          await expect(page.locator(".passport-empty-page")).toBeVisible();
          await expectSurface(page.locator(".app-shell"), theme);
          await expectPrimary(
            page.locator(".passport-empty .button-primary"),
            theme,
          );
          expect(await headerColors(page)).toEqual(welcomeHeader);
          await expect(page.locator(".persistence-status")).toHaveText("");
          await page.reload();
          await expect(page.locator(".passport-empty-page")).toBeVisible();
          await expectSurface(page.locator(".app-shell"), theme);
          await page.goto("/#settings");
          await openSettingsCategory(page, "Danger zone");
          await page.locator(".danger-action").click();
          await page.locator(".confirmation-danger").click();
          await expect(page.locator(".welcome")).toBeVisible();
          await expect(page.locator(".persistence-status")).toHaveText("");
        }

        // Demo uses the approved Passport scope and the same navigation colors.
        const welcomeHeader = await headerColors(page);
        await page.locator(".welcome .button-secondary").click();
        await expect(page.locator(".passport-archive-page")).toBeVisible();
        expect(await headerColors(page)).toEqual(welcomeHeader);
        await expectSurface(page.locator(".app-shell"), "dark");
        await expect(page.locator(".persistence-status")).toHaveText("");
        await page.reload();
        await expect(page.locator(".demo-banner")).toBeVisible();
        await expectSurface(page.locator(".app-shell"), "dark");
        await page.goto("/#settings");
        await openSettingsCategory(page, "Danger zone");
        await page.locator(".danger-action").click();
        await page.locator(".confirmation-danger").click();
        await expect(page.locator(".welcome")).toBeVisible();
        const file = page.locator('.welcome input[type="file"]');
        await file.setInputFiles({
          name: "invalid.json",
          mimeType: "application/json",
          buffer: Buffer.from("{}"),
        });
        await expect(page.locator(".validation-errors > strong")).toHaveCSS(
          "color",
          colors.dark.danger,
        );
        await expect(page.locator(".import-preview")).toHaveCSS(
          "background-color",
          colors.dark.surface,
        );
        await page.emulateMedia({ colorScheme: "light" });
        await expect(page.locator(".validation-errors > strong")).toHaveCSS(
          "color",
          width <= 760 ? colors.light.mobileDanger : colors.light.danger,
        );
        await file.setInputFiles("examples/basic.keepraw-fly.json");
        await page.locator(".import-preview .button-primary").click();
        await expect(page.locator(".passport-archive-page")).toBeVisible();
        await expectSurface(page.locator(".app-shell"), "light");
        await expect(page.locator(".persistence-status")).toHaveText("");
        await page.reload();
        await expect(page.locator(".passport-archive-page")).toBeVisible();
        await expectHealthyPage(page, errors);
      });
    }

    for (const width of [390, 1440]) {
      for (const mode of ["light", "dark", "system"] as const) {
        test(`first paint, loading failure and retry at ${width}px in ${mode}${language === "en" && mode === "system" ? " @cross-browser" : ""}`, async ({
          page,
        }) => {
          await page.setViewportSize({ width, height: 900 });
          await page.emulateMedia({
            colorScheme: mode === "light" ? "dark" : "light",
          });
          await page.addInitScript((appearance) => {
            if (appearance !== "system")
              localStorage.setItem("keepraw-fly-appearance", appearance);
          }, mode);
          const theme: Theme = mode === "dark" ? "dark" : "light";
          let releaseEntry!: () => void;
          const entryGate = new Promise<void>((resolve) => {
            releaseEntry = resolve;
          });
          await page.route("**/src/main.tsx", async (route) => {
            await entryGate;
            await route.continue();
          });
          let releaseDirectory!: () => void;
          let directoryGate = new Promise<void>((resolve) => {
            releaseDirectory = resolve;
          });
          let fail = true;
          await page.route("**/airports.iata.json", async (route) => {
            await directoryGate;
            if (fail) await route.fulfill({ status: 503, body: "unavailable" });
            else await route.continue();
          });
          await page.goto("/", { waitUntil: "commit" });
          await expectSurface(page.locator("html"), theme);
          await expectSurface(page.locator("body"), theme);
          releaseEntry();
          await expect(page.locator(".bootstrap-screen")).toBeVisible();
          await expectSurface(page.locator(".bootstrap-screen"), theme);
          await expect(page.locator(".bootstrap-screen p")).not.toHaveText("");
          if (mode === "system") {
            await page.emulateMedia({ colorScheme: "dark" });
            await expectSurface(page.locator(".bootstrap-screen"), "dark");
            await page.emulateMedia({ colorScheme: "light" });
          }
          releaseDirectory();
          await expect(page.locator(".bootstrap-screen--failed")).toBeVisible();
          await expect(
            page.locator(".bootstrap-screen [role=alert]"),
          ).toHaveCSS(
            "color",
            width <= 760 ? colors[theme].mobileDanger : colors[theme].danger,
          );
          const retry = page.locator(".bootstrap-screen .button-primary");
          await expectPrimary(retry, theme);
          await retry.focus();
          await expect(retry).toHaveCSS("outline-color", colors[theme].focus);
          fail = false;
          directoryGate = new Promise<void>((resolve) => {
            releaseDirectory = resolve;
          });
          await retry.click();
          await expect(page.locator(".bootstrap-screen--failed")).toHaveCount(
            0,
          );
          await expect(retry).toHaveCount(0);
          // Hold the existing storage adapter read to inspect App's loading page.
          await page.evaluate(async () => {
            const modulePath = "/src/storage/browser.ts";
            const { browserStorage } = await import(
              /* @vite-ignore */ modulePath
            );
            const load = browserStorage.loadDocument.bind(browserStorage);
            let resume!: () => void;
            const gate = new Promise<void>((resolve) => {
              resume = resolve;
            });
            (
              window as unknown as { resumeArchiveRead: () => void }
            ).resumeArchiveRead = resume;
            browserStorage.loadDocument = async () => {
              await gate;
              return load();
            };
          });
          releaseDirectory();
          await expect(page.locator(".loading-screen")).toBeVisible();
          await expectSurface(page.locator(".loading-screen"), theme);
          await expect(page.locator(".loading-screen span")).toHaveCSS(
            "background-color",
            colors[theme].text,
          );
          if (mode === "system") {
            await page.emulateMedia({ colorScheme: "dark" });
            await expectSurface(page.locator(".loading-screen"), "dark");
            await page.emulateMedia({ colorScheme: "light" });
          }
          await page.evaluate(() =>
            (
              window as unknown as { resumeArchiveRead: () => void }
            ).resumeArchiveRead(),
          );
          await expect(page.locator(".welcome")).toBeVisible();
          await expectSurface(page.locator(".app-shell"), theme);
        });
      }
    }
  });
}

test("blocked cosmetic cache and storage read failure keep System welcome usable", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("blocked");
      },
    });
    IDBObjectStore.prototype.get = function () {
      throw new Error("read unavailable");
    };
  });
  await page.goto("/");
  await expect(page.locator(".welcome")).toBeVisible();
  await expectSurface(page.locator(".app-shell"), "dark");
  await expect(page.locator(".storage-warning")).toHaveCSS(
    "color",
    colors.dark.danger,
  );
  await page.emulateMedia({ colorScheme: "light" });
  await expectSurface(page.locator(".app-shell"), "light");
  await page.locator(".welcome .button-primary").click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
