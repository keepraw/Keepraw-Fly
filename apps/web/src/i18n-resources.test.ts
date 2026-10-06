import { describe, expect, it } from "vitest";
import en from "./locales/en.json";
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
