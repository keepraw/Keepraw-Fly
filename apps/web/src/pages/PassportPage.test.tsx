import { renderToStaticMarkup } from "react-dom/server";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { KeeprawFlight, KeeprawFlyDocument } from "@keepraw-fly/schema";
import {
  calculatePassportStatistics,
  formatDistance,
  formatDuration,
  localizedText,
  airportByIata,
  type DistanceUnit,
} from "@keepraw-fly/core";
import {
  initialPassportView,
  type PassportViewState,
} from "../data/passport-exploration";
import { PassportPage } from "./PassportPage";
import en from "../locales/en.json";
import zhCN from "../locales/zh-CN.json";
import zhTW from "../locales/zh-TW.json";

const flight: KeeprawFlight = {
  id: "tao",
  flightNumber: "CX123",
  serviceDate: "2026-09-22",
  airline: { iata: "CX" },
  origin: { iata: "HKG" },
  destination: { iata: "TAO" },
  scheduledDeparture: "2026-09-22T10:00:00+08:00",
  scheduledArrival: "2026-09-22T12:00:00+08:00",
};
afterEach(() => vi.unstubAllGlobals());

async function render(
  locale: "en" | "zh-CN" | "zh-TW",
  view = initialPassportView,
  record: KeeprawFlight | KeeprawFlight[] | null = flight,
  desktop = true,
  distanceUnit: DistanceUnit = "kilometers",
) {
  const i18n = createInstance();
  await i18n.init({
    lng: locale,
    resources: {
      en: { translation: en },
      "zh-CN": { translation: zhCN },
      "zh-TW": { translation: zhTW },
    },
    interpolation: { escapeValue: false },
  });
  const document: KeeprawFlyDocument = {
    format: "keepraw-fly",
    formatVersion: "0.1.0",
    profile: { name: { native: "Test" } },
    flights: record ? (Array.isArray(record) ? record : [record]) : [],
  };
  vi.stubGlobal("window", { matchMedia: () => ({ matches: desktop }) });
  const markup = renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <PassportPage
        document={document}
        locale={locale}
        distanceUnit={distanceUnit}
        timeFormat="24-hour"
        view={view}
        onViewChange={() => {}}
        onAddFlight={() => {}}
        onOpenImport={() => {}}
        onOpenFlight={() => {}}
      />
    </I18nextProvider>,
  );
  return { markup, i18n };
}

describe("Passport narrative and spotlights", () => {
  it("keeps annual charts and airport bars in the same Lifetime, Year and Search scope", async () => {
    const records = [2023, 2024, 2025, 2026].map((year, index) => ({
      ...flight,
      id: String(year),
      serviceDate: `${year}-01-01`,
      flightNumber: `CX${year}`,
      actualArrival: `2026-09-22T12:${String(index * 10).padStart(2, "0")}:00+08:00`,
    }));
    const { markup, i18n } = await render("en", initialPassportView, records);
    expect(markup).toContain(i18n.t("passport.recentDelayYears"));
    expect(
      [...markup.matchAll(/data-year="(\d+)"/g)].map((match) => match[1]),
    ).toEqual(["2024", "2025", "2026"]);
    expect(markup).toContain(`<strong>${formatDuration(60, "en")}</strong>`);
    for (const view of [
      { ...initialPassportView, year: 2025 },
      { ...initialPassportView, query: "CX2025" },
    ] as PassportViewState[]) {
      const { markup } = await render("en", view, records);
      expect(
        [...markup.matchAll(/data-year="(\d+)"/g)].map((match) => match[1]),
      ).toEqual(["2025"]);
      expect(markup).toContain('data-minutes="20"');
      expect(markup.match(/data-visits="1"/g)).toHaveLength(2);
      expect(markup).toContain(`<strong>${formatDuration(20, "en")}</strong>`);
    }
  });
  it("keeps the existing first-flight actions for an empty archive", async () => {
    const { markup, i18n } = await render("en", initialPassportView, null);
    expect(markup).toContain(i18n.t("passport.emptyTitle"));
    expect(markup).toContain(i18n.t("actions.addFirstFlight"));
    expect(markup).not.toContain("passport-highlights");
  });

  it("uses actual flight duration when both actual times are recorded", async () => {
    const { markup } = await render("en", initialPassportView, {
      ...flight,
      actualDeparture: "2026-09-22T10:10:00+08:00",
      actualArrival: "2026-09-22T12:30:00+08:00",
    });
    expect(markup).toMatch(
      new RegExp(
        `passport-longest-facts[\\s\\S]*?<strong>${formatDuration(140, "en")}</strong>`,
      ),
    );
  });

  it("handles a partially populated reference without inventing distance or a longest route", async () => {
    const { markup } = await render("en", initialPassportView, {
      ...flight,
      origin: { iata: "ZZZ" },
    });
    expect(markup).toContain("<strong>0 km</strong>");
    expect(markup).toContain("passport-longest-flight is-unavailable");
    expect(markup).toContain(formatDuration(120, "en"));
  });
  it.each(["en", "zh-CN", "zh-TW"] as const)(
    "shows localized longest-flight cities, duration and selected-unit distance in %s",
    async (locale) => {
      for (const unit of ["kilometers", "miles"] as const) {
        const { markup, i18n } = await render(
          locale,
          initialPassportView,
          flight,
          true,
          unit,
        );
        const stats = calculatePassportStatistics([flight]);
        const highlights = markup.match(
          /class="passport-highlights"[\s\S]*?<\/aside>/,
        )![0];
        for (const code of ["HKG", "TAO"]) {
          expect(highlights).toContain(
            `<strong>${code}</strong><span>${localizedText(airportByIata.get(code)!.city, locale)}</span>`,
          );
        }
        expect(highlights).not.toMatch(/<svg|<canvas|<img/);
        expect(highlights.replace(/<[^>]*>/g, "")).toContain(
          formatDuration(120, locale),
        );
        expect(highlights.replace(/<[^>]*>/g, "")).toContain(
          i18n.t(
            unit === "miles"
              ? "passport.distanceMiles"
              : "passport.distanceKilometers",
            { value: formatDistance(stats.distanceKilometers, locale, unit) },
          ),
        );
        expect(highlights).toContain(
          i18n.t("passport.visitFrequency", { count: 1 }),
        );
        const values = [
          ...markup.matchAll(
            /class="passport-core-stat"><strong>(.*?)<\/strong>/g,
          ),
        ].map((match) => (match[1] ?? "").replace(/<[^>]*>/g, ""));
        expect(values).toEqual([
          i18n.t(
            unit === "miles"
              ? "passport.distanceMiles"
              : "passport.distanceKilometers",
            { value: formatDistance(stats.distanceKilometers, locale, unit) },
          ),
          "1",
          formatDuration(120, locale),
          "2",
          "1",
          "2",
        ]);
      }
    },
  );

  it("distinguishes unavailable arrival delay from recorded zero and positive delay", async () => {
    for (const [actualArrival, expected] of [
      [undefined, "—"],
      [flight.scheduledArrival, formatDuration(0, "en")],
      ["2026-09-22T12:30:00+08:00", formatDuration(30, "en")],
    ] as const) {
      const { markup } = await render("en", initialPassportView, {
        ...flight,
        actualArrival,
      });
      expect(markup).toMatch(
        new RegExp(
          `class="passport-delay-highlight"[^>]*>[\\s\\S]*?<strong>${expected}</strong>`,
        ),
      );
    }
  });

  it("recalculates an empty year or search while retaining six metrics and unavailable highlights", async () => {
    for (const view of [
      { ...initialPassportView, year: 2025 },
      { ...initialPassportView, query: "no matching flight" },
    ] as PassportViewState[]) {
      const { markup } = await render("en", view);
      expect(markup.match(/class="passport-core-stat"/g)).toHaveLength(6);
      expect(markup).toContain("<strong>0</strong>");
      expect(
        markup.match(/passport-spotlight-item[^"<>]*is-unavailable/g),
      ).toHaveLength(2);
    }
  });
  it.each(["en", "zh-CN", "zh-TW"] as const)(
    "removes highlights on mobile while preserving %s statistics",
    async (locale) => {
      const { markup, i18n } = await render(
        locale,
        initialPassportView,
        flight,
        false,
      );
      expect(markup).not.toContain("passport-highlights");
      expect(markup).not.toContain("passport-spotlight");
      expect(markup).not.toContain(i18n.t("passport.highlights"));
      expect(markup).toContain("passport-mobile-summary");
      expect(markup).toContain("passport-delay-panel");
      expect(markup).toContain("passport-network-panel");
      expect(markup).toContain('data-flight-id="tao"');
    },
  );

  it.each(["en", "zh-CN", "zh-TW"] as const)(
    "keeps %s summaries complete and the delay hint out of visible copy",
    async (locale) => {
      const { markup, i18n } = await render(locale);
      expect(markup).toContain('class="passport-legend passport-core-stats"');
      expect(markup.match(/class="passport-core-stat"/g)).toHaveLength(6);
      expect(markup).toContain(
        `<strong>2</strong><span>${i18n.t("passport.countries")}</span>`,
      );
      expect(markup).toContain('class="passport-delay-highlight"');
      expect(markup).not.toContain("passport-spotlight-routes");
      expect(markup).not.toContain('class="passport-mobile-summary"');
      expect(markup).not.toContain("passport-delay-panel");
      expect(markup).not.toContain('class="primary-stats"');
      expect(markup).not.toContain('class="passport-counts"');
      expect(markup).not.toContain('class="highlight-list"');
      expect(markup).toContain(
        `title="${i18n.t("passport.delayBasedOnArrivals")}"`,
      );
      expect(markup.replace(/<[^>]+>/g, "")).not.toContain(
        i18n.t("passport.delayBasedOnArrivals"),
      );
    },
  );

  it.each([
    { kind: "airport", code: "TAO" },
    { kind: "airline", code: "CX" },
    { kind: "route", origin: "HKG", destination: "TAO" },
  ] satisfies PassportViewState["selection"][])(
    "keeps the active $kind spotlight pressed, including tied airports",
    async (selection) => {
      const { markup } = await render("en", {
        ...initialPassportView,
        selection,
      });
      const buttons =
        markup.match(
          /<button[^>]*class="passport-highlight[^>]*>[\s\S]*?<\/button>/g,
        ) ?? [];
      const selected = buttons.filter((button) =>
        button.includes('aria-pressed="true"'),
      );
      if (selection.kind === "airline") {
        expect(selected).toHaveLength(0);
        expect(markup).toContain("passport-exploration");
        expect(markup).toContain("Cathay Pacific");
      } else {
        expect(selected.length).toBeGreaterThan(0);
        expect(selected[0]).toContain(
          selection.kind === "airport" ? "TAO" : "HKG to TAO",
        );
      }
      expect(
        buttons.every((button) =>
          /aria-label="[^"]*[Ff]ilter flights/.test(button),
        ),
      ).toBe(true);
    },
  );

  it("uses plain unavailable rows when no flown highlights exist", async () => {
    const { markup } = await render("en", initialPassportView, {
      ...flight,
      cancelled: true,
    });
    expect(
      markup.match(
        /class="passport-highlight passport-spotlight-item[^"<>]*is-unavailable"/g,
      ),
    ).toHaveLength(2);
    expect(markup).not.toMatch(/<button[^>]*class="passport-highlight/);
  });

  it("filters a diverted highlight by its recorded destination", async () => {
    const { markup } = await render(
      "en",
      {
        ...initialPassportView,
        selection: { kind: "route", origin: "HKG", destination: "TAO" },
      },
      { ...flight, destination: { iata: "PEK" }, divertedTo: { iata: "TAO" } },
    );
    const routes =
      markup
        .match(/<button[^>]*class="passport-highlight[\s\S]*?<\/button>/g)
        ?.join("") ?? "";
    expect(routes).toContain('aria-pressed="true"');
    expect(routes).toContain("filter flights from HKG to TAO");
    expect(routes).not.toContain("HKG to PEK");
  });
});
