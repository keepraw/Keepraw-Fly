import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openSettingsCategory } from "./helpers/settings";
import { globeMode } from "./helpers/globe-capability";
import { expectReachable } from "./helpers/responsive";
import {
  supportedLanguages,
  localeRegistry,
} from "../apps/web/src/locales/registry";

const newLanguages = [
  "ja-JP",
  "fr-FR",
  "de-DE",
  "es",
  "pt-BR",
  "ko-KR",
] as const;
const resources = Object.fromEntries(
  supportedLanguages.map((language) => [
    language,
    JSON.parse(
      readFileSync(
        new URL(`../apps/web/src/locales/${language}.json`, import.meta.url),
        "utf8",
      ),
    ),
  ]),
);
const archive = JSON.parse(
  readFileSync(
    new URL("../examples/basic.keepraw-fly.json", import.meta.url),
    "utf8",
  ),
);

async function seed(page: Page) {
  await page.goto("/");
  await expect(page.locator('input[type="file"]')).toBeAttached();
  await page.evaluate(async (archive) => {
    const path = "/src/storage/browser.ts";
    const { browserStorage } = await import(path);
    await browserStorage.saveDocument(archive, "personal");
    await browserStorage.saveSettings({
      language: "en-US",
      appearance: "light",
      distanceUnit: "miles",
      timeFormat: "12-hour",
      powerUserMode: false,
      solarMode: "fixed",
    });
  }, archive);
  await page.goto("/#settings");
  await page.reload();
  await expect(page.locator("#settings-language")).toHaveValue("en-US");
}

async function healthy(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await expect(page.locator("body")).not.toContainText(
    /(?:flightDetail|passport|settings|globe|csvImport)\.[a-zA-Z]/,
  );
}

async function reviewScreenshot(
  page: Page,
  language: string,
  view: string,
  width: number,
) {
  if (process.env.KEEPRAW_LOCALE_REVIEW)
    await page.screenshot({
      path: `test-results/locale-review/${language}-${view}-${width}.png`,
      fullPage: true,
    });
}

for (const language of newLanguages) {
  test(`${language}: desktop/mobile Settings, Detail, Passport and editor; desktop Globe`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const text = resources[language];
    await seed(page);
    await page.locator("#settings-language").selectOption(language);
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    await expect(page.locator("#settings-language option")).toHaveText(
      supportedLanguages.map((l) => localeRegistry[l].label),
    );
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      if (width === 1440)
        await page.locator('.site-navigation a[href="#settings"]').click();
      else
        await page
          .getByRole("button", { name: text.nav.settings, exact: true })
          .click();
      await openSettingsCategory(page, "General");
      await expect(page.locator("#settings-distance")).toHaveValue("miles");
      await expect(page.locator("#settings-time-format")).toHaveValue(
        "12-hour",
      );
      await expect(
        page.locator('#settings-distance option[value="miles"]'),
      ).toHaveText(text.settings.miles);
      await healthy(page);
      await reviewScreenshot(page, language, "settings", width);
      if (width === 1440)
        await page.locator('.site-navigation a[href="#passport"]').click();
      else
        await page
          .getByRole("button", { name: text.nav.backToPassport, exact: true })
          .click();
      await expect(page.locator(".passport-page")).toBeVisible();
      await expect(page.locator(".passport-page")).toContainText(
        text.passport.totalDelay,
      );
      if (width === 390) {
        await expect(page.locator(".passport-mobile-hero > span")).toHaveText(
          text.passport.flights_one ?? text.passport.flights,
        );
        await expect(
          page.locator(".passport-network-facts > div").first().locator("span"),
        ).toHaveText(text.passport.countries_one ?? text.passport.countries);
      }
      if (width === 1440) await globeMode(page);
      await healthy(page);
      await reviewScreenshot(page, language, "passport", width);
      await page.locator(".flight-row").first().click();
      await expect(page.locator(".detail-page")).toBeVisible();
      await expect(page.locator(".detail-stop--departure")).toContainText(
        text.flightDetail.departure,
      );
      await expect(page.locator(".detail-stop--departure")).toContainText(
        text.flightDetail.terminal,
      );
      await expect(page.locator(".detail-stop--departure")).toContainText(
        text.flightDetail.gate,
      );
      await expect(page.locator(".detail-page")).toContainText("San Francisco");
      await expect(page.locator(".detail-page")).toContainText(
        text.flightDetail.durationSource.actual,
      );
      const gate = page
        .locator(".detail-stop--departure dd")
        .filter({ hasText: /^F12$/ });
      expect(
        await gate.evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return range.getClientRects().length;
        }),
      ).toBe(1);
      if (width === 1440) await globeMode(page);
      else await expect(page.locator(".detail-globe-frame")).toHaveCount(0);
      await healthy(page);
      await reviewScreenshot(page, language, "detail", width);
      await page
        .getByRole("button", { name: text.actions.editFlight, exact: true })
        .click();
      await expect(
        page.getByText(text.flightEditor.localTimeNote, { exact: true }),
      ).toBeVisible();
      await expect(page.locator(".editor-close")).toHaveAccessibleName(
        text.actions.cancel,
      );
      await page.locator(".editor-close").click();
      await page.locator(".detail-header-back").click();
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/globe-lab");
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    await expect(page.locator(".globe-lab-header")).toContainText(
      text.globe.lab,
    );
    await expect(
      page.getByRole("textbox", { name: text.globe.search }),
    ).toBeVisible();
    await globeMode(page);
    await healthy(page);
    await page.goto("/#settings");
    await expect(page.locator("#settings-language")).toHaveValue(language);
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    expect(errors).toEqual([]);
    await testInfo.attach("locale-review", {
      body: `${language}: desktop/mobile Settings, Detail, Passport, editor; Globe Lab; reload; unchanged miles/12-hour.`,
      contentType: "text/plain",
    });
  });
}

test("locale loading failure preserves the UI, retries, and latest selection wins", async ({
  page,
}) => {
  await seed(page);
  await page.route("**/fr-FR.json*", (route) => route.abort());
  await page.locator("#settings-language").selectOption("fr-FR");
  await expect(page.getByRole("alert")).toContainText(
    resources["en-US"].app.languageLoadFailed,
  );
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await page.unroute("**/fr-FR.json*");
  await page
    .getByRole("button", {
      name: resources["en-US"].actions.retry,
      exact: true,
    })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr-FR");
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/ja-JP.json*", async (route) => {
    await delayed;
    await route.continue();
  });
  const requested = page.waitForRequest("**/ja-JP.json*");
  await page.locator("#settings-language").selectOption("ja-JP");
  await requested;
  await page.locator("#settings-language").selectOption("de-DE");
  await expect(page.locator("html")).toHaveAttribute("lang", "de-DE");
  release();
  await page.waitForResponse("**/ja-JP.json*");
  await expect(page.locator("html")).toHaveAttribute("lang", "de-DE");
});

test("only selected resources load at startup; warmed languages switch offline from persistent cache", async ({
  page,
  context,
}) => {
  const requested: string[] = [];
  page.on("request", (request) => {
    if (
      request.resourceType() === "fetch" &&
      /\/locales\/.+\.json/.test(request.url())
    )
      requested.push(request.url());
  });
  await seed(page);
  expect(requested).toEqual([]);
  await page.locator("#settings-language").selectOption("ja-JP");
  await expect(page.locator("html")).toHaveAttribute("lang", "ja-JP");
  expect(requested).toHaveLength(1);
  await page.evaluate(async () => {
    const path = "/src/locales/resources.ts";
    const { warmLocaleCache } = await import(path);
    await warmLocaleCache();
  });
  // Reload before going offline: discard the loader's in-memory promises.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "ja-JP");
  await context.setOffline(true);
  for (const language of supportedLanguages) {
    await page.locator("#settings-language").selectOption(language);
    await expect(page.locator("html")).toHaveAttribute("lang", language);
  }
  await context.setOffline(false);
});

test("background locales do not compete with a stalled airport startup", async ({
  page,
}) => {
  await page.clock.install();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/airports.iata.json*", async (route) => {
    if (route.request().resourceType() === "fetch") await held;
    await route.continue();
  });
  const locales: string[] = [];
  page.on("request", (request) => {
    if (
      request.resourceType() === "fetch" &&
      /\/locales\/.+\.json/.test(request.url())
    )
      locales.push(request.url());
  });
  await page.goto("/");
  await expect(page.locator(".bootstrap-screen")).toBeVisible();
  await page.clock.runFor(16_000);
  expect(locales).toEqual([]);
  release();
  await expect(page.locator('input[type="file"]')).toBeAttached();
});

test("German editor labels fit their fields at narrow widths @cross-browser", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seed(page);
  await page.locator("#settings-language").selectOption("de-DE");
  await expect(page.locator("html")).toHaveAttribute("lang", "de-DE");
  await page.goto("/#passport");
  await page.locator(".flight-row").first().click();
  await page
    .getByRole("button", {
      name: resources["de-DE"].actions.editFlight,
      exact: true,
    })
    .click();
  const editor = page.getByRole("dialog");
  await editor.locator(".editor-optional > summary").click();
  const label = editor.getByText(
    resources["de-DE"].flightEditor.aircraftRegistration,
    { exact: true },
  );
  await expect(label).toBeVisible();
  for (const width of [320, 360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await label.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        label.evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const field = element.parentElement!.getBoundingClientRect();
          return [...range.getClientRects()].every(
            (rect) =>
              rect.left >= field.left - 1 && rect.right <= field.right + 1,
          );
        }),
      )
      .toBe(true);
    await expectReachable(editor.locator(".editor-actions .button-primary"));
    await healthy(page);
  }
  await expectReachable(editor.locator(".editor-close"));
  await editor.locator(".editor-close").click();
});

test("malformed locale cache can recover online after offline retries without changing the archive @cross-browser", async ({
  page,
  context,
}) => {
  await seed(page);
  await page.clock.install();
  const before = await page.evaluate(async () => {
    const path = "/src/storage/browser.ts";
    const { browserStorage } = await import(path);
    return {
      archive: await browserStorage.loadDocument(),
      settings: await browserStorage.loadSettings(),
    };
  });
  await page.evaluate(async () => {
    const path = "/src/locales/resources.ts";
    const { resourceUrls } = await import(path);
    const cache = await caches.open("keepraw-fly-locales-v1");
    await cache.put(
      resourceUrls["./fr-FR.json"],
      new Response("{broken", {
        headers: { "content-type": "application/json" },
      }),
    );
  });
  await context.setOffline(true);
  await page.locator("#settings-language").selectOption("fr-FR");
  const failure = page.getByRole("alert");
  await expect(failure).toContainText(
    resources["en-US"].app.languageLoadFailed,
  );
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await page
    .getByRole("button", {
      name: resources["en-US"].actions.retry,
      exact: true,
    })
    .click();
  await expect(failure).toContainText(
    resources["en-US"].app.languageLoadFailed,
  );
  await healthy(page);
  await context.setOffline(false);
  await page
    .getByRole("button", {
      name: resources["en-US"].actions.retry,
      exact: true,
    })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr-FR");
  await expect(failure).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const path = "/src/storage/browser.ts";
        const { browserStorage } = await import(path);
        return {
          archive: await browserStorage.loadDocument(),
          settings: await browserStorage.loadSettings(),
        };
      }),
    )
    .toEqual({
      archive: before.archive,
      settings: { ...before.settings, language: "fr-FR" },
    });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr-FR");
  await context.setOffline(true);
  await page.locator("#settings-language").selectOption("en-US");
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await page.locator("#settings-language").selectOption("fr-FR");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr-FR");
  await context.setOffline(false);
});
