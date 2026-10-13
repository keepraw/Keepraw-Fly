import { describe, expect, it } from "vitest";
import {
  airportByIata,
  airlineByIata,
  airlineNames,
  localizedText,
  formatCityDisplayName,
  formatDuration,
  formatServiceDate,
  formatDistance,
  formatTimeAtAirport,
  frequentFlyerProgramName,
  searchAirports,
} from "../src";

describe("locale-neutral reference data and localized presentation", () => {
  it.each(["en-US", "en-GB", "ja-JP", "fr-FR"])(
    "falls back to English names in %s",
    (locale) => {
      const airport = airportByIata.get("TAO")!;
      expect(localizedText(airport.city, locale)).toBe(airport.city.en);
      expect(airlineNames(airlineByIata.get("CA")!, locale)[0]).toBe(
        "Air China",
      );
      expect(
        frequentFlyerProgramName(
          {
            id: "ff",
            programId: "phoenixmiles",
            memberNumber: "",
            associatedAirlines: [],
          },
          locale,
        ),
      ).toBe("PhoenixMiles");
      expect(
        searchAirports("青岛", locale).some(
          (airport) => airport.iata === "TAO",
        ),
      ).toBe(true);
    },
  );
  it("supports partial future names and preserves Chinese suffix rules", () => {
    expect(localizedText({ en: "Tokyo", "ja-JP": "東京" }, "ja-JP")).toBe(
      "東京",
    );
    expect(localizedText({ en: "Tokyo", ja: "東京" }, "ja-JP")).toBe("東京");
    expect(localizedText({ en: "Tokyo", "zh-CN": "东京" }, "zh-TW")).toBe(
      "Tokyo",
    );
    expect(formatCityDisplayName("青岛市", "CN", "zh-CN")).toBe("青岛");
    expect(formatCityDisplayName("青島市", "CN", "zh-TW")).toBe("青島");
    expect(formatCityDisplayName("青島市", "JP", "ja-JP")).toBe("青島市");
  });
  it("uses US/GB service dates, localized numbers and independent units/time formats", () => {
    expect(formatServiceDate("2026-10-13", "en-US")).toBe("Oct 13");
    expect(formatServiceDate("2026-10-13", "en-GB")).toBe("13 Oct");
    expect(formatDistance(12345, "en-US", "kilometers")).toBe("12,345");
    expect(formatDistance(12345, "en-GB", "miles")).toBe("7,671");
    expect(formatDistance(12345, "de-DE", "kilometers")).toBe("12.345");
    for (const locale of ["en-US", "en-GB", "zh-CN"]) {
      expect(
        formatTimeAtAirport("2026-10-13T12:15:00Z", "HKG", locale, "24-hour"),
      ).toBe("20:15");
      expect(
        formatTimeAtAirport("2026-10-13T12:15:00Z", "HKG", locale, "12-hour"),
      ).toMatch(/08:15/);
    }
  });
  it("preserves airport DST conversions and UTC fallback", () => {
    expect(
      formatTimeAtAirport("2026-01-15T20:00:00Z", "SFO", "en-GB", "24-hour"),
    ).toBe("12:00");
    expect(
      formatTimeAtAirport("2026-07-15T20:00:00Z", "SFO", "en-GB", "24-hour"),
    ).toBe("13:00");
    expect(
      formatTimeAtAirport("2026-07-15T20:00:00Z", "ZZZ", "en-US", "24-hour"),
    ).toBe("20:00");
  });
  it("formats duration with portable labels and Intl numbers", () => {
    expect(formatDuration(64, "en-US")).toBe("1h 04m");
    expect(formatDuration(64, "en-GB")).toBe("1h 04m");
    expect(formatDuration(64, "zh-CN")).toBe("1小时 4分");
    expect(formatDuration(64, "zh-TW")).toBe("1小時 4分");
    expect(formatDuration(64, "fr-FR", { hour: " h", minute: " min" })).toBe(
      "1 h 4 min",
    );
    expect(formatDuration(64, "ar-u-nu-arab", { hour: "h", minute: "m" })).toBe(
      "١h ٤m",
    );
  });
});
