import { readFileSync } from "node:fs";
import { createInstance } from "i18next";
import { checkResource, flattenResource } from "./locales/check-resources";
import { i18nOptions, translations } from "./locales/resources";
import { supportedLanguages } from "./locales/registry";
import { describe, expect, it } from "vitest";
import en from "./locales/en-US.json";
import zhCN from "./locales/zh-CN.json";
import zhTW from "./locales/zh-TW.json";

const auditedSections = [
  "app",
  "nav",
  "actions",
  "status",
  "flightDetail",
  "flightTiming",
  "recovery",
] as const;
const normalizedKeys = (section: Record<string, unknown>) =>
  [
    ...new Set(
      Object.keys(section).map((key) => key.replace(/_(one|other)$/, "")),
    ),
  ].sort();

describe("i18n resources", () => {
  it.each([
    {
      locale: en,
      manualClear: /cannot prevent manual clearing/,
      installation: /not required/,
      guarantee: /does not guarantee/,
      usable: /still works normally/,
    },
    {
      locale: zhCN,
      manualClear: /不能防止手动清除/,
      installation: /无需安装/,
      guarantee: /不保证/,
      usable: /仍可正常使用/,
    },
    {
      locale: zhTW,
      manualClear: /無法防止手動清除/,
      installation: /無需安裝/,
      guarantee: /不保證/,
      usable: /仍可正常使用/,
    },
  ])(
    "describes optional persistent storage separately from installation and backups: $locale.settings.storageProtectionTitle",
    ({ locale, manualClear, installation, guarantee, usable }) => {
      const settings = locale.settings;
      const persistent = /persistent storage|持久存储|持久儲存/i;
      expect(settings.storageProtectionTitle).toMatch(persistent);
      expect(settings.storageProtectionDescription).toContain("JSON");
      expect(settings.storageProtectionDescription).toMatch(manualClear);
      expect(settings.storageProtectionDescription).toMatch(installation);
      expect(settings.storageProtectionDescription).toMatch(guarantee);
      expect(Object.keys(settings.storageProtection).sort()).toEqual([
        "available",
        "checking",
        "failed",
        "granted",
        "unsupported",
      ]);
      for (const state of [
        "available",
        "granted",
        "failed",
        "unsupported",
      ] as const) {
        expect(settings.storageProtection[state]).toMatch(persistent);
        expect(settings.storageProtection[state]).not.toMatch(
          /protected|已保护|未保护|已保護|未保護/i,
        );
        expect(settings.storageProtectionRequest[state]).toContain("JSON");
      }
      expect(settings.storageProtectionRequest.available).toMatch(usable);
    },
  );

  it.each([
    [
      en,
      "Changes are not saved on this device.",
      "Settings are not saved on this device.",
    ],
    [zhCN, "更改尚未保存到此设备。", "设置尚未保存到此设备。"],
    [zhTW, "變更尚未儲存到此裝置。", "設定尚未儲存到此裝置。"],
  ])(
    "states explicitly that changes and settings are not saved in every locale",
    (locale, changes, settings) => {
      expect(locale.app.changesNotSaved).toBe(changes);
      expect(locale.app.settingsNotSaved).toBe(settings);
      expect(locale.actions.saving).toBeTruthy();
      expect(locale.actions.retry).toBeTruthy();
    },
  );

  it.each(auditedSections)(
    "keeps %s keys aligned across all supported locales",
    (section) => {
      const expected = Object.keys(en[section]).sort();
      expect(Object.keys(zhCN[section]).sort()).toEqual(expected);
      expect(Object.keys(zhTW[section]).sort()).toEqual(expected);
    },
  );

  it("localizes the controlled cabin values in all supported locales", () => {
    const expected = Object.keys(en.flightEditor.cabins).sort();
    expect(Object.keys(zhCN.flightEditor.cabins).sort()).toEqual(expected);
    expect(Object.keys(zhTW.flightEditor.cabins).sort()).toEqual(expected);
    expect(zhCN.flightEditor.cabins.business).toBe("商务舱");
    expect(zhTW.flightEditor.cabins.business).toBe("商務艙");
  });

  it.each(["flights", "passport"] as const)(
    "keeps normalized %s keys aligned across all supported locales",
    (section) => {
      const expected = normalizedKeys(en[section]);
      expect(normalizedKeys(zhCN[section])).toEqual(expected);
      expect(normalizedKeys(zhTW[section])).toEqual(expected);
    },
  );

  it("keeps distance values interpolated in every locale", () => {
    for (const locale of [en, zhCN, zhTW]) {
      expect(locale.passport.distanceMiles).toContain("{{value}}");
      expect(locale.passport.distanceKilometers).toContain("{{value}}");
    }
  });

  it("uses interpolation for delay, duration and distance labels", () => {
    for (const locale of [en, zhCN, zhTW]) {
      expect(locale.flightDetail.earlyShort).toContain("{{count}}");
      expect(locale.flightDetail.lateShort).toContain("{{count}}");
      expect(locale.flightDetail.durationHoursMinutes).toContain("{{hours}}");
      expect(locale.flightDetail.durationHoursMinutes).toContain("{{minutes}}");
      expect(locale.flightDetail.distanceMiles).toContain("{{value}}");
    }
  });
});

describe("complete released resources", () => {
  it.each(supportedLanguages)(
    "checks every recursive logical key and interpolation in %s",
    (language) => {
      expect(
        checkResource(
          translations["en-US"],
          translations[language],
          language,
          language === "en-GB",
        ),
      ).toEqual([]);
    },
  );

  it("detects missing nested keys, wrong parameters and language-specific plural forms", () => {
    const base = {
      page: {
        count_one: "{{count}} flight",
        count_other: "{{count}} flights",
        name: "{{value}}",
      },
    };
    expect(
      checkResource(
        base,
        { page: { count: "{{count}} 个航班", name: "{{value}}" } },
        "zh-CN",
      ),
    ).toEqual([]);
    expect(
      checkResource(
        base,
        { page: { count_one: "{{count}} flight", name: "{{wrong}}" } },
        "en-GB",
      ),
    ).toEqual(
      expect.arrayContaining([
        "Missing plural: page.count_other",
        "Interpolation mismatch: page.name",
      ]),
    );
    expect(
      checkResource(base, { page: { name: "{{value}}" } }, "zh-TW"),
    ).toContain("Missing key: page.count");
    expect(
      checkResource(
        base,
        {
          page: {
            count_one: "{{count}}",
            count_other: "{{count}}",
            name: "{{value}}",
          },
        },
        "ar",
      ),
    ).toContain("Missing plural: page.count_few");
  });

  it.each([
    null,
    [],
    { nested: null },
    { nested: 5 },
    { nested: "" },
    { nested: "  " },
    { nested: "{{value}" },
    { nested: {} },
  ])("rejects malformed or empty resources: %j", (value) => {
    expect(() => flattenResource(value)).toThrow();
  });

  it.each(supportedLanguages)(
    "resolves every base key and plural through i18next in %s",
    async (language) => {
      const instance = createInstance();
      await instance.init({ ...i18nOptions, lng: language });
      for (const key of flattenResource(translations["en-US"]).keys()) {
        const logical = key.replace(/_(zero|one|two|few|many|other)$/, "");
        for (const count of [0, 1, 2, 5, 21]) {
          expect(instance.exists(logical, { count }), logical).toBe(true);
          const text = instance.t(logical, {
            count,
            value: 12,
            hours: 1,
            minutes: 2,
          });
          expect(text, logical).not.toBe(logical);
          expect(text.trim(), logical).not.toBe("");
        }
      }
      expect(instance.t("settings.kilometers")).toBe(
        language === "en-GB"
          ? "Kilometres"
          : translations[language].settings.kilometers,
      );
    },
  );

  it("falls back to en-US for missing British strings and unsupported languages", async () => {
    const instance = createInstance();
    await instance.init({ ...i18nOptions, lng: "en-GB" });
    expect(instance.t("app.loading")).toBe(en.app.loading);
    await instance.changeLanguage("ja-JP");
    expect(instance.t("app.loading")).toBe(en.app.loading);
  });

  it("covers actual validator/schema/CSV/Flighty diagnostics without exposing raw messages", () => {
    const validator = readFileSync(
      new URL("../../../packages/validator/src/index.ts", import.meta.url),
      "utf8",
    );
    const keywords = new Set(
      [...validator.matchAll(/keyword:\s*"([^"]+)"/g)].map(
        (match) => match[1]!,
      ),
    );
    const schema = JSON.parse(
      readFileSync(
        new URL(
          "../../../packages/schema/keepraw-fly.schema.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    function collect(node: Record<string, unknown>) {
      for (const [key, value] of Object.entries(node)) {
        if (["properties", "$defs"].includes(key)) {
          for (const child of Object.values(value as object)) collect(child);
        } else if (["anyOf", "oneOf", "allOf"].includes(key)) {
          keywords.add(key);
          for (const child of value as Record<string, unknown>[])
            collect(child);
        } else if (
          ["items", "propertyNames"].includes(key) &&
          typeof value === "object"
        ) {
          if (key === "propertyNames") keywords.add(key);
          collect(value as Record<string, unknown>);
        } else if (
          !["$schema", "$id", "$ref", "title", "description"].includes(key)
        ) {
          keywords.add(key);
        }
      }
    }
    collect(schema);
    for (const code of keywords)
      expect(en.import.issueMessages, code).toHaveProperty(code);
    for (const [file, name, resources] of [
      ["csv-import", "CsvImportIssueCode", en.csvImport.issues],
      [
        "flighty-import",
        "FlightyDiagnosticCode",
        { ...en.csvImport.issues, ...en.flightyImport.issues },
      ],
    ] as const) {
      const source = readFileSync(
        new URL(`./data/${file}.ts`, import.meta.url),
        "utf8",
      );
      const union = source.split(`export type ${name} =`)[1]!.split(";")[0]!;
      for (const match of union.matchAll(/"([^"]+)"/g))
        expect(resources, match[1]).toHaveProperty(match[1]!);
    }
  });
});
