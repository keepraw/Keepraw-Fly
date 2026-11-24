import { chooseAppearance, openSettingsCategory } from "./helpers/settings";
import { expect, test, type Page, type Locator } from "@playwright/test";
import { disablePassportWebGL } from "./helpers/passport-svg";
import { collectBrowserErrors, expectHealthyPage } from "./helpers/responsive";

test.describe.configure({ mode: "parallel" });

// Each palette is one skin in one appearance. `aviation`, the default skin, is
// drawn in dark only; `light` and `dark` are the `minimal` skin.
const colors = {
  aviation: {
    canvas: "rgb(12, 10, 36)",
    text: "rgb(241, 238, 255)",
    muted: "rgb(188, 181, 234)",
    faint: "rgb(165, 157, 220)",
    surface: "rgb(19, 16, 52)",
    accent: "rgb(125, 227, 244)",
    line: "rgb(43, 37, 104)",
    focus: "rgb(165, 240, 251)",
    danger: "rgb(255, 154, 160)",
  },
  light: {
    canvas: "rgb(251, 251, 250)",
    text: "rgb(22, 24, 29)",
    muted: "rgb(86, 93, 105)",
    faint: "rgb(102, 110, 123)",
    surface: "rgb(255, 255, 255)",
    accent: "rgb(29, 63, 148)",
    line: "rgb(227, 229, 233)",
    focus: "rgb(47, 95, 214)",
    danger: "rgb(179, 56, 44)",
  },
  dark: {
    canvas: "rgb(14, 15, 18)",
    text: "rgb(236, 238, 241)",
    muted: "rgb(163, 169, 179)",
    faint: "rgb(143, 151, 163)",
    surface: "rgb(20, 22, 26)",
    accent: "rgb(143, 176, 255)",
    line: "rgb(39, 43, 50)",
    focus: "rgb(169, 193, 255)",
    danger: "rgb(240, 138, 124)",
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
    // Primary destinations and Add Flight only exist once there is an
    // archive; the wordmark and Settings are in the header on every screen.
    return [
      header,
      ...header.querySelectorAll(
        '.wordmark, .wordmark-mark, .site-navigation a[href="#/settings"]',
      ),
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

for (const language of ["en-US", "zh-CN", "zh-TW"] as const) {
  test.describe(language, () => {
    test.use({ locale: language === "en-US" ? "en-US" : language });
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
        await expectSurface(page.locator(".app-shell"), "aviation");

        // The default skin first, then `minimal` in each appearance.
        for (const [mode, os, theme] of [
          [null, "light", "aviation"],
          ["light", "dark", "light"],
          ["dark", "light", "dark"],
          ["system", "light", "light"],
          ["system", "dark", "dark"],
        ] as const) {
          if (mode) {
            await page.goto("/#/settings");
            await chooseAppearance(page, mode);
            await expect(page.locator(".persistence-status")).toHaveText("");
          }
          await page.emulateMedia({ colorScheme: os });
          await page.goto("/#passport");
          await expect(page.locator(".welcome")).toBeVisible();
          // The resting colours are compared, so the pointer must not be left
          // over a button by the Settings step above.
          await page.mouse.move(0, 0);
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
          await page.goto("/#/settings");
          await openSettingsCategory(page, "Danger zone");
          await page.locator(".danger-action").click();
          await page.locator(".confirmation-danger").click();
          await expect(page.locator(".welcome")).toBeVisible();
          await expect(page.locator(".persistence-status")).toHaveText("");
        }

        // Demo keeps the skin's palette and the same navigation colors.
        const welcomeHeader = await headerColors(page);
        await page.locator(".welcome .button-secondary").click();
        await expect(page.locator(".passport-archive-page")).toBeVisible();
        expect(await headerColors(page)).toEqual(welcomeHeader);
        await expectSurface(page.locator(".app-shell"), "dark");
        await expect(page.locator(".persistence-status")).toHaveText("");
        await page.reload();
        await expect(page.locator(".demo-banner")).toBeVisible();
        await expectSurface(page.locator(".app-shell"), "dark");
        await page.goto("/#/settings");
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
          colors.light.danger,
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
      for (const mode of ["aviation", "light", "dark", "system"] as const) {
        test(`first paint, loading failure and retry at ${width}px in ${mode}${language === "en-US" && mode === "system" ? " @cross-browser" : ""}`, async ({
          page,
        }) => {
          await page.setViewportSize({ width, height: 900 });
          await page.emulateMedia({
            colorScheme: mode === "light" ? "dark" : "light",
          });
          // Without a cached skin the page opens in `aviation`, which stays
          // dark on a light device; the other modes cache `minimal`.
          await page.addInitScript((appearance) => {
            if (appearance === "aviation") return;
            localStorage.setItem("keepraw-fly-skin", "minimal");
            if (appearance !== "system")
              localStorage.setItem("keepraw-fly-appearance", appearance);
          }, mode);
          const theme: Theme =
            mode === "aviation" || mode === "dark" ? mode : "light";
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
          ).toHaveCSS("color", colors[theme].danger);
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

test("blocked cosmetic cache and storage read failure keep recovery usable", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("blocked");
      },
    });
    const get = IDBObjectStore.prototype.get;
    (
      window as unknown as { restoreArchiveRead: () => void }
    ).restoreArchiveRead = () => {
      IDBObjectStore.prototype.get = get;
    };
    IDBObjectStore.prototype.get = function () {
      throw new Error("read unavailable");
    };
  });
  await page.goto("/");
  const failure = page.getByRole("heading", {
    name: "Your local archive could not be read",
    exact: true,
  });
  await expect(failure).toBeVisible();
  await expect(page.locator(".welcome, input[type=file]")).toHaveCount(0);
  // With the cache blocked the page opens in the default skin, which is dark
  // on either device scheme; Recovery takes the same palette from the root.
  for (const os of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: os });
    await expectSurface(page.locator("body"), "aviation");
    await expect(page.locator(".storage-warning")).toHaveCSS(
      "color",
      colors.aviation.danger,
    );
  }
  const retry = page.getByRole("button", { name: "Try again", exact: true });
  await retry.click();
  await expect(retry).toBeEnabled();
  await expect(failure).toBeVisible();
  await expect(page.locator(".welcome")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.evaluate(() =>
    (
      window as unknown as { restoreArchiveRead: () => void }
    ).restoreArchiveRead(),
  );
  await retry.click();
  await expect(page.locator(".welcome")).toBeVisible();
  await expect(failure).toHaveCount(0);
  for (const os of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: os });
    await expectSurface(page.locator(".app-shell"), "aviation");
    await expect(page.locator(".storage-warning")).toHaveCSS(
      "color",
      colors.aviation.danger,
    );
  }
  await page.locator(".welcome .button-primary").click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("a failed application module load recovers through Retry", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/src/application.ts", (route) =>
    fail ? route.abort() : route.continue(),
  );
  await page.goto("/");
  await expect(page.locator(".bootstrap-screen--failed")).toBeVisible();
  fail = false;
  await page.locator(".bootstrap-screen .button-primary").click();
  await expect(page.locator(".welcome")).toBeVisible();
});
