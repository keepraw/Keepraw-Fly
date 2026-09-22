import { describe, expect, it } from "vitest";
import en from "./locales/en.json";
import zhCN from "./locales/zh-CN.json";
import zhTW from "./locales/zh-TW.json";

const auditedSections = ["nav", "actions", "status", "flightDetail"] as const;
const normalizedKeys = (section: Record<string, unknown>) => [...new Set(
  Object.keys(section).map((key) => key.replace(/_(one|other)$/, "")),
)].sort();

describe("i18n resources", () => {
  it.each(auditedSections)("keeps %s keys aligned across all supported locales", (section) => {
    const expected = Object.keys(en[section]).sort();
    expect(Object.keys(zhCN[section]).sort()).toEqual(expected);
    expect(Object.keys(zhTW[section]).sort()).toEqual(expected);
  });

  it("localizes the controlled cabin values in all supported locales", () => {
    const expected = Object.keys(en.flightEditor.cabins).sort();
    expect(Object.keys(zhCN.flightEditor.cabins).sort()).toEqual(expected);
    expect(Object.keys(zhTW.flightEditor.cabins).sort()).toEqual(expected);
    expect(zhCN.flightEditor.cabins.business).toBe("商务舱");
    expect(zhTW.flightEditor.cabins.business).toBe("商務艙");
  });

  it.each(["flights", "passport"] as const)("keeps normalized %s keys aligned across all supported locales", (section) => {
    const expected = normalizedKeys(en[section]);
    expect(normalizedKeys(zhCN[section])).toEqual(expected);
    expect(normalizedKeys(zhTW[section])).toEqual(expected);
  });

  it("keeps the archive count and distance values interpolated in every locale", () => {
    expect(en.flights.archiveTitle_one).toContain("{{count}}");
    expect(en.flights.archiveTitle_other).toContain("{{count}}");
    for (const locale of [zhCN, zhTW]) expect(locale.flights.archiveTitle).toContain("{{count}}");
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
