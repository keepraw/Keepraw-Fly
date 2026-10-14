import { expect, test, type Page } from "@playwright/test";
import { disablePassportWebGL } from "./helpers/passport-svg";
import { openSettingsCategory } from "./helpers/settings";
import { readFileSync } from "node:fs";
const archive = JSON.parse(
  readFileSync(
    new URL("../examples/basic.keepraw-fly.json", import.meta.url),
    "utf8",
  ),
);
archive.frequentFlyerMemberships = [
  {
    id: "locale-audit-membership",
    programId: "audit-loyalty",
    programName: "Audit loyalty",
    memberNumber: "KF-123",
    tier: "Gold",
    associatedAirlines: ["UA"],
    defaultAirline: "UA",
  },
];
archive.flights[0].frequentFlyer = {
  membershipId: "locale-audit-membership",
  tierAtFlight: "Silver",
};
archive.extensions = { "audit.future": { nested: [1, "preserved"] } };
const translations = Object.fromEntries(
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
import { supportedLanguages } from "../apps/web/src/locales/registry";

test.beforeEach(async ({ page }) => {
  await disablePassportWebGL(page);
  await page.route(
    "https://cdn.jsdelivr.net/npm/misans-webfont@*/**",
    (route) => route.abort(),
  );
});

async function seed(page: Page, language: string) {
  await page.goto("/");
  await expect(page.locator('input[type="file"]')).toBeAttached();
  await page.evaluate(
    async ({ archive, language }) => {
      const modulePath = "/src/storage/browser.ts";
      const { browserStorage } = await import(modulePath);
      await browserStorage.saveDocument(archive, "personal");
      await browserStorage.saveSettings({
        language,
        appearance: "dark",
        distanceUnit: "kilometers",
        timeFormat: "12-hour",
        powerUserMode: true,
        solarMode: "realtime",
        lastBackupAt: "2026-10-10T00:00:00Z",
        futurePreference: "preserved",
      });
    },
    { archive, language },
  );
  await page.goto("/#settings");
  await page.reload();
  await expect(page.locator(".settings-page")).toBeVisible();
}

async function stored(page: Page) {
  return page.evaluate(async () => {
    const modulePath = "/src/storage/browser.ts";
    const { browserStorage } = await import(modulePath);
    return {
      archive: await browserStorage.loadDocument(),
      settings: await browserStorage.loadSettings(),
    };
  });
}

test("browser language priority and Chinese script resolution @cross-browser", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "languages", {
      get: () => ["it-IT", "zh-Hant-HK", "en-GB"],
    });
    Object.defineProperty(navigator, "language", { get: () => "en-US" });
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-TW");
  await expect(
    page.getByText(translations["zh-TW"].actions.createArchive, {
      exact: true,
    }),
  ).toBeVisible();
});

test("legacy en migrates; locale changes preserve archive facts, loyalty and other preferences @cross-browser", async ({
  page,
}, testInfo) => {
  await seed(page, "en");
  await expect(page.locator("#settings-language")).toHaveValue("en-US");
  const before = await stored(page);
  const localeSelect = page.locator("#settings-language");
  expect(
    await localeSelect
      .locator("option")
      .evaluateAll((options) => options.map((option) => option.value)),
  ).toEqual(supportedLanguages);
  // Extend Chromium's business coverage; keep the existing bounded four-locale
  // native storage smoke in the other engines rather than repeating the matrix.
  const languages =
    testInfo.project.name === "chromium"
      ? supportedLanguages
      : ["en-GB", "zh-CN", "zh-TW", "en-US"];
  for (const language of languages) {
    await localeSelect.selectOption(language);
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    const expected =
      language === "en-GB"
        ? "Kilometres"
        : translations[language].settings.kilometers;
    await expect(
      page.locator('#settings-distance option[value="kilometers"]'),
    ).toHaveText(expected);
    await expect
      .poll(async () => (await stored(page)).settings.language)
      .toBe(language);
    await page.reload();
    await expect(localeSelect).toHaveValue(language);
    await expect(page.locator("#settings-distance")).toHaveValue("kilometers");
    await expect(page.locator("#settings-time-format")).toHaveValue("12-hour");
    const after = await stored(page);
    expect(after.archive).toEqual(before.archive);
    expect(after.settings).toEqual({ ...before.settings, language });
  }
});

test("unsupported saved language uses English without downloading Chinese fonts", async ({
  page,
}) => {
  await seed(page, "it-IT");
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(page.locator("#settings-language")).toHaveValue("en-US");
  await expect(page.locator("link[data-chinese-webfont]")).toHaveCount(0);
  await expect(page.locator("#settings-distance")).toHaveValue("kilometers");
});

for (const language of supportedLanguages) {
  test(`JSON semantic errors are localized in ${language}`, async ({
    page,
  }) => {
    await seed(page, language);
    await openSettingsCategory(page, "Data and backup");
    const broken = structuredClone(archive) as typeof archive & {
      frequentFlyerMemberships: unknown[];
    };
    broken.frequentFlyerMemberships = [
      {
        id: "repeat",
        programId: "phoenixmiles",
        memberNumber: "1",
        associatedAirlines: ["CA"],
        defaultAirline: "UA",
      },
      {
        id: "repeat",
        programId: "phoenixmiles",
        memberNumber: "2",
        associatedAirlines: ["CA"],
      },
    ];
    Object.assign(broken.flights[0]!, {
      cancelled: true,
      divertedTo: { iata: "HKG" },
      frequentFlyer: { membershipId: "missing" },
    });
    await page.locator('#settings-import input[type="file"]').setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(broken)),
    });
    const errors = page.locator(".import-blocking-issues");
    const instanceMessages =
      language === "en-GB"
        ? {
            ...translations["en-US"].import.issueMessages,
            ...translations[language].import.issueMessages,
          }
        : translations[language].import.issueMessages;
    for (const code of [
      "uniqueMembershipId",
      "membershipDefaultAirline",
      "membershipReference",
      "cancelledDivertedConflict",
    ] as const)
      await expect(errors).toContainText(instanceMessages[code]);
    await expect(errors).not.toContainText("Expected value");
    expect((await stored(page)).archive.document).toEqual(archive);
  });
}

for (const language of supportedLanguages) {
  test(`unreadable JSON, CSV and Flighty files use safe localized errors in ${language}`, async ({
    page,
  }) => {
    await seed(page, language);
    await openSettingsCategory(page, "Data and backup");
    const before = await stored(page);
    await page.evaluate(() => {
      File.prototype.text = async () => {
        throw new Error("INTERNAL SECRET DETAIL");
      };
    });
    const base = translations[language === "en-GB" ? "en-US" : language];
    const messages =
      language === "en-GB"
        ? {
            ...base,
            flightyImport: {
              ...base.flightyImport,
              ...translations["en-GB"].flightyImport,
            },
          }
        : base;
    for (const [selector, message] of [
      ['#settings-import input[type="file"]', messages.import.operationFailed],
      [
        '.csv-import-control input[type="file"]',
        messages.csvImport.invalidFile,
      ],
      [
        '.csv-import-control input[type="file"]',
        messages.flightyImport.invalidFile,
      ],
    ] as const) {
      const input = selector.startsWith("#")
        ? page.locator(selector)
        : page
            .locator(selector)
            .nth(message === messages.csvImport.invalidFile ? 0 : 1);
      await input.setInputFiles({
        name: "unreadable.csv",
        mimeType: "text/csv",
        buffer: Buffer.from("invalid"),
      });
      await expect(
        page.getByRole("alert").filter({ hasText: message }),
      ).toBeVisible();
    }
    await expect(page.locator(".settings-page")).not.toContainText(
      "INTERNAL SECRET DETAIL",
    );
    expect((await stored(page)).archive).toEqual(before.archive);
  });
}
