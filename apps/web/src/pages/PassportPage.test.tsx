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
import type { PrimaryView } from "../routing";
import en from "../locales/en-US.json";
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
  mode: PrimaryView = "stats",
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
        mode={mode}
        document={document}
        locale={locale}
        distanceUnit={distanceUnit}
        timeFormat="24-hour"
        mapTheme="neon-aviation"
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

const text = (markup: string) => markup.replace(/<[^>]*>/g, "");
const regions = (markup: string) =>
  [...markup.matchAll(/class="stats-panel" data-region="(\w+)"/g)].map(
    (match) => match[1],
  );
const STATS_REGIONS = [
  "totals",
  "byYear",
  "months",
  "airports",
  "airlines",
  "aircraft",
  "cabins",
  "records",
];

describe("Stats regions", () => {
  it("keeps the yearly table and airport bars in the same Lifetime, Year and Search scope", async () => {
    const records = [2023, 2024, 2025, 2026].map((year, index) => ({
      ...flight,
      id: String(year),
      serviceDate: `${year}-01-01`,
      flightNumber: `CX${year}`,
      actualArrival: `2026-09-22T12:${String(index * 10).padStart(2, "0")}:00+08:00`,
    }));
    const { markup } = await render("en", initialPassportView, records);
    expect(
      [...markup.matchAll(/<tr data-year="(\d+)"/g)].map((match) => match[1]),
    ).toEqual(["2026", "2025", "2024", "2023"]);
    expect(markup).toMatch(
      new RegExp(`class="stats-figure"[^>]*>${formatDuration(60, "en")}</p>`),
    );
    expect(markup).toContain('data-month="1" data-count="4"');
    for (const view of [
      { ...initialPassportView, year: 2025 },
      { ...initialPassportView, query: "CX2025" },
    ] as PassportViewState[]) {
      const { markup } = await render("en", view, records);
      expect(
        [...markup.matchAll(/<tr data-year="(\d+)"/g)].map((match) => match[1]),
      ).toEqual(["2025"]);
      expect(markup).toContain('data-minutes="20"');
      expect(markup).toContain('data-key="HKG" data-count="1"');
      expect(markup).toContain('data-key="TAO" data-count="1"');
      expect(markup).toContain('data-month="1" data-count="1"');
      expect(markup).toMatch(
        new RegExp(`class="stats-figure"[^>]*>${formatDuration(20, "en")}</p>`),
      );
    }
  });

  it("keeps the existing first-flight actions for an empty archive", async () => {
    const { markup, i18n } = await render("en", initialPassportView, null);
    expect(markup).toContain(i18n.t("passport.emptyTitle"));
    expect(markup).toContain(i18n.t("actions.addFirstFlight"));
    expect(markup).not.toContain("stats-insights");
  });

  it("uses actual flight duration when both actual times are recorded", async () => {
    const { markup } = await render("en", initialPassportView, {
      ...flight,
      actualDeparture: "2026-09-22T10:10:00+08:00",
      actualArrival: "2026-09-22T12:30:00+08:00",
    });
    expect(markup).toMatch(
      new RegExp(
        `data-record="longest"[\\s\\S]*?<span>${formatDuration(140, "en")}</span>`,
      ),
    );
  });

  it("handles a partially populated reference without inventing distance or a longest route", async () => {
    const { markup } = await render("en", initialPassportView, {
      ...flight,
      origin: { iata: "ZZZ" },
    });
    expect(markup).toContain("<strong>0 km</strong>");
    expect(markup).toContain(
      'class="stats-record is-unavailable" data-record="longest"',
    );
    expect(markup).toContain(
      'class="stats-record is-unavailable" data-record="shortest"',
    );
    expect(markup).toContain(formatDuration(120, "en"));
  });

  it.each(["en", "zh-CN", "zh-TW"] as const)(
    "shows localized record cities, duration and selected-unit distance in %s",
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
        const insights = markup.match(
          /class="stats-insights"[\s\S]*?<\/aside>/,
        )![0];
        const city = (code: string) =>
          localizedText(airportByIata.get(code)!.city, locale);
        expect(insights).toContain("HKG → TAO");
        expect(insights).toContain(`${city("HKG")} → ${city("TAO")}`);
        expect(insights).not.toMatch(/<svg|<canvas|<img/);
        const distance = i18n.t(
          unit === "miles"
            ? "passport.distanceMiles"
            : "passport.distanceKilometers",
          { value: formatDistance(stats.distanceKilometers, locale, unit) },
        );
        expect(text(insights)).toContain(formatDuration(120, locale));
        expect(text(insights)).toContain(distance);
        expect(insights).toContain(
          i18n.t("passport.visitFrequency", { count: 1 }),
        );
        const values = [
          ...markup.matchAll(
            /class="passport-core-stat"><strong>(.*?)<\/strong>/g,
          ),
        ].map((match) => text(match[1] ?? ""));
        expect(values).toEqual([
          distance,
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
      const { markup, i18n } = await render("en", initialPassportView, {
        ...flight,
        actualArrival,
      });
      expect(markup).toMatch(
        new RegExp(`class="stats-figure"[^>]*>${expected}</p>`),
      );
      // The note is visible copy: early arrivals do not offset delays.
      expect(text(markup)).toContain(
        i18n.t(
          actualArrival
            ? "passport.delayBasedOnArrivals"
            : "passport.delayUnavailable",
        ),
      );
      expect(markup.includes('class="stats-record" data-record="delay"')).toBe(
        expected === formatDuration(30, "en"),
      );
    }
  });

  it("recalculates an empty year or search while retaining six metrics and unavailable records", async () => {
    for (const view of [
      { ...initialPassportView, year: 2025 },
      { ...initialPassportView, query: "no matching flight" },
    ] as PassportViewState[]) {
      const { markup } = await render("en", view);
      expect(markup.match(/class="passport-core-stat"/g)).toHaveLength(6);
      expect(markup).toContain("<strong>0</strong>");
      expect(markup.match(/class="stats-record is-unavailable"/g)).toHaveLength(
        4,
      );
      expect(regions(markup)).toEqual(STATS_REGIONS);
    }
  });

  it.each(["en", "zh-CN", "zh-TW"] as const)(
    "renders the same %s regions on Compact and on desktop",
    async (locale) => {
      const records = [
        flight,
        {
          ...flight,
          id: "back",
          origin: { iata: "TAO" },
          destination: { iata: "HKG" },
          actualArrival: "2026-09-22T12:30:00+08:00",
          extensions: {
            "keepraw-fly.aircraft": { type: "A333" },
            "keepraw-fly.seat": { cabin: "business" },
          },
        },
      ];
      const desktop = await render(locale, initialPassportView, records);
      const compact = await render(locale, initialPassportView, records, false);
      const insights = (markup: string) =>
        markup.match(/<div class="stats-insights"[\s\S]*?<\/aside>/)![0];
      expect(regions(desktop.markup)).toEqual(STATS_REGIONS);
      // One inventory: the Stats regions do not depend on the screen class.
      expect(insights(compact.markup)).toBe(insights(desktop.markup));
      expect(compact.markup).toContain("passport-mobile-summary");
      expect(compact.markup).not.toContain('data-flight-id="tao"');
      const copy = text(insights(compact.markup));
      for (const key of [
        "passport.totalDelay",
        "passport.byYear",
        "insights.stats.months",
        "insights.stats.airports",
        "insights.stats.airlines",
        "insights.stats.aircraft",
        "insights.stats.cabins",
        "insights.stats.cabinNotRecorded",
        "flightEditor.cabins.business",
        "passport.longestFlight",
        "passport.shortestFlight",
        "insights.stats.longestArrivalDelay",
        "insights.stats.mostFlownRoute",
      ])
        expect(copy).toContain(compact.i18n.t(key));
      expect(copy).toContain("A333");
    },
  );

  it.each([true, false])(
    "composes each view from the shared regions (desktop: %s)",
    async (desktop) => {
      const compose = async (mode: PrimaryView) =>
        (
          await render(
            "en",
            initialPassportView,
            flight,
            desktop,
            "kilometers",
            mode,
          )
        ).markup;
      const [log, map, stats, passport] = await Promise.all(
        (["log", "map", "stats", "passport"] as const).map(compose),
      );
      for (const [mode, markup] of [
        ["log", log],
        ["map", map],
        ["stats", stats],
        ["passport", passport],
      ] as const) {
        expect(markup).toContain(`data-view="${mode}"`);
        // Add flight lives in the persistent navigation, not in a view.
        expect(markup).not.toContain("add-flight-button");
        expect(markup).toContain(
          desktop ? "passport-core-stats" : "passport-mobile-summary",
        );
        expect(markup?.includes("stats-insights")).toBe(mode === "stats");
        expect(markup?.includes('class="log-filters"')).toBe(mode === "log");
      }
      for (const markup of [log, map]) {
        expect(markup).toContain('data-flight-id="tao"');
        expect(markup).toContain('id="passport-flight-search"');
      }
      for (const markup of [stats, passport]) {
        expect(markup).not.toContain('data-flight-id="tao"');
        expect(markup).not.toContain('id="passport-flight-search"');
      }
      expect(log).toContain("passport-import-button");
      expect(map).not.toContain("passport-import-button");
      expect(log).not.toContain('class="route-map"');
      expect(stats).not.toContain('class="route-map"');
      expect(map).toContain('class="route-map"');
      expect(passport).toContain('class="route-map"');
    },
  );

  it("names an active search where the search field is not shown", async () => {
    const searching = { ...initialPassportView, query: "TAO" };
    for (const mode of ["stats", "passport"] as const) {
      const { markup } = await render(
        "en",
        searching,
        flight,
        true,
        "kilometers",
        mode,
      );
      expect(markup).toContain("passport-active-search");
      expect(markup).toContain("Search flights · TAO");
      expect(markup).toContain("Clear search");
    }
    for (const mode of ["log", "map"] as const) {
      const { markup } = await render(
        "en",
        searching,
        flight,
        true,
        "kilometers",
        mode,
      );
      expect(markup).not.toContain("passport-active-search");
    }
    expect((await render("en")).markup).not.toContain("passport-active-search");
  });

  it.each(["en", "zh-CN", "zh-TW"] as const)(
    "keeps %s summaries complete",
    async (locale) => {
      const { markup, i18n } = await render(locale);
      expect(markup).toContain('class="passport-legend passport-core-stats"');
      expect(markup.match(/class="passport-core-stat"/g)).toHaveLength(6);
      expect(markup).toContain(
        `<strong>2</strong><span>${i18n.t("passport.countries")}</span>`,
      );
      expect(markup).not.toContain('class="passport-mobile-summary"');
      expect(markup).not.toContain('class="primary-stats"');
      expect(markup).not.toContain('class="passport-counts"');
      expect(markup).not.toContain('class="highlight-list"');
    },
  );

  it.each([
    { selection: { kind: "airport", code: "TAO" } },
    { selection: { kind: "route", origin: "HKG", destination: "TAO" } },
    { airline: "CX" },
    { aircraft: "A359" },
  ] satisfies Partial<PassportViewState>[])(
    "keeps the active entry pressed and names the filter: %j",
    async (filter) => {
      const { markup } = await render(
        "en",
        { ...initialPassportView, ...filter },
        {
          ...flight,
          extensions: { "keepraw-fly.aircraft": { type: "A359" } },
        },
      );
      const buttons =
        markup.match(
          /<button[^>]*class="stats-(?:rank|record)"[^>]*>[\s\S]*?<\/button>/g,
        ) ?? [];
      const pressed = buttons.filter((button) =>
        button.includes('aria-pressed="true"'),
      );
      const chips = markup.match(/class="passport-exploration"/g) ?? [];
      expect(chips).toHaveLength(1);
      if ("airline" in filter) {
        expect(pressed).toHaveLength(1);
        expect(pressed[0]).toContain('data-key="CX"');
        expect(markup).toContain('data-filter="airline"');
        expect(text(markup)).toContain("Airline · Cathay Pacific · CX");
      } else if ("aircraft" in filter) {
        expect(pressed).toHaveLength(1);
        expect(pressed[0]).toContain('data-key="A359"');
        expect(text(markup)).toContain("Aircraft type · A359");
      } else if (filter.selection.kind === "airport") {
        expect(pressed).toHaveLength(1);
        expect(pressed[0]).toContain('data-key="TAO"');
      } else {
        // Longest, shortest and most flown are all this one route.
        expect(
          pressed.map((button) => /data-record="(\w+)"/.exec(button)?.[1]),
        ).toEqual(["longest", "shortest", "route"]);
        expect(pressed[0]).toContain("filter flights from HKG to TAO");
      }
      expect(
        buttons.every((button) => /[Ff]ilter flights|Open CX123/.test(button)),
      ).toBe(true);
    },
  );

  it("uses plain unavailable rows when no flown flights exist", async () => {
    const { markup, i18n } = await render("en", initialPassportView, {
      ...flight,
      cancelled: true,
    });
    expect(markup.match(/class="stats-record is-unavailable"/g)).toHaveLength(
      4,
    );
    expect(markup).not.toMatch(/<button[^>]*class="stats-(rank|record)"/);
    expect(text(markup)).toContain(i18n.t("insights.stats.noData"));
  });

  it("filters a diverted record by the airport actually arrived at", async () => {
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
        .match(/<button[^>]*class="stats-record"[\s\S]*?<\/button>/g)
        ?.join("") ?? "";
    expect(routes).toContain('aria-pressed="true"');
    expect(routes).toContain("filter flights from HKG to TAO");
    expect(routes).not.toContain("HKG to PEK");
  });

  it("collapses a long ranking behind a control that names its size", async () => {
    const codes = ["PEK", "PVG", "CAN", "SZX", "CTU", "XIY", "HGH", "NKG"];
    const records = codes.map((code, index) => ({
      ...flight,
      id: code,
      destination: { iata: code },
      airline: { iata: index % 2 ? "CX" : "CA" },
    }));
    const { markup } = await render("en", initialPassportView, records);
    const airports = markup.match(
      /data-region="airports"[\s\S]*?<\/section>/,
    )![0];
    expect(airports.match(/class="stats-rank"/g)).toHaveLength(6);
    expect(airports).toContain('data-key="HKG" data-count="8"');
    expect(airports).toContain('aria-expanded="false"');
    expect(text(airports)).toContain("Show all 9");
    const airlines = markup.match(
      /data-region="airlines"[\s\S]*?<\/section>/,
    )![0];
    expect(airlines.match(/class="stats-rank"/g)).toHaveLength(2);
    expect(airlines).not.toContain("stats-more");
  });
});

describe("Log filters and order", () => {
  const records: KeeprawFlight[] = [
    {
      ...flight,
      extensions: { "keepraw-fly.aircraft": { type: "A359" } },
    },
    {
      ...flight,
      id: "sfo",
      flightNumber: "UA862",
      airline: { iata: "UA" },
      serviceDate: "2025-03-01",
      destination: { iata: "SFO" },
      scheduledDeparture: "2025-03-01T10:00:00+08:00",
      scheduledArrival: "2025-03-01T22:00:00+08:00",
      extensions: { "keepraw-fly.aircraft": { type: "B789" } },
    },
    {
      ...flight,
      id: "pek",
      flightNumber: "CX330",
      serviceDate: "2024-05-01",
      destination: { iata: "PEK" },
      scheduledDeparture: "2024-05-01T10:00:00+08:00",
      scheduledArrival: "2024-05-01T13:00:00+08:00",
      extensions: { "keepraw-fly.aircraft": { type: "A333" } },
    },
  ];
  const log = async (view: Partial<PassportViewState> = {}, desktop = true) =>
    (
      await render(
        "en",
        { ...initialPassportView, ...view },
        records,
        desktop,
        "kilometers",
        "log",
      )
    ).markup;
  const options = (markup: string, name: string) =>
    [
      ...markup
        .match(new RegExp(`<select name="${name}"[\\s\\S]*?</select>`))![0]
        .matchAll(/<option value="([^"]*)"( selected="")?>([^<]*)</g),
    ].map((match) => [match[1], match[3], Boolean(match[2])]);
  const order = (markup: string) =>
    [...markup.matchAll(/data-flight-id="(\w+)"/g)].map((match) => match[1]);

  it.each([true, false])(
    "offers every airline, aircraft type and order (desktop: %s)",
    async (desktop) => {
      const markup = await log({}, desktop);
      expect(options(markup, "airline")).toEqual([
        ["", "All airlines", true],
        ["CX", "Cathay Pacific · CX (2)", false],
        ["UA", "United Airlines · UA (1)", false],
      ]);
      expect(options(markup, "aircraft")).toEqual([
        ["", "All aircraft types", true],
        ["A333", "A333 (1)", false],
        ["A359", "A359 (1)", false],
        ["B789", "B789 (1)", false],
      ]);
      expect(options(markup, "sort")).toEqual([
        ["newest", "Newest first", true],
        ["oldest", "Oldest first", false],
        ["longest", "Longest distance first", false],
        ["shortest", "Shortest distance first", false],
      ]);
      expect(order(markup)).toEqual(["tao", "sfo", "pek"]);
      expect(markup).not.toContain('class="passport-exploration"');
    },
  );

  it("narrows the list and the other filter's choices, and names the filter", async () => {
    const markup = await log({ airline: "CX" });
    expect(order(markup)).toEqual(["tao", "pek"]);
    // The airline list is unchanged; aircraft types are those Cathay flew.
    expect(options(markup, "airline").map((option) => option[0])).toEqual([
      "",
      "CX",
      "UA",
    ]);
    expect(options(markup, "airline")[1]![2]).toBe(true);
    expect(options(markup, "aircraft").map((option) => option[0])).toEqual([
      "",
      "A333",
      "A359",
    ]);
    expect(text(markup)).toContain("Airline · Cathay Pacific · CX");
    expect(markup).toContain('aria-label="Remove filter: Cathay Pacific · CX"');
    expect(order(await log({ airline: "CX", aircraft: "A333" }))).toEqual([
      "pek",
    ]);
  });

  it("offers and counts a cancelled flight's airline and aircraft type", async () => {
    const cancelled: KeeprawFlight = {
      ...flight,
      id: "off",
      flightNumber: "QF128",
      airline: { iata: "QF" },
      cancelled: true,
      extensions: { "keepraw-fly.aircraft": { type: "A359" } },
    };
    const { markup } = await render(
      "en",
      initialPassportView,
      [...records, cancelled],
      true,
      "kilometers",
      "log",
    );
    expect(options(markup, "airline")).toContainEqual([
      "QF",
      "Qantas · QF (1)",
      false,
    ]);
    expect(options(markup, "aircraft")).toContainEqual([
      "A359",
      "A359 (2)",
      false,
    ]);
  });

  it("keeps a filter that matches nothing selectable and explains the empty list", async () => {
    const markup = await log({ airline: "UA", aircraft: "A359" });
    expect(order(markup)).toEqual([]);
    expect(text(markup)).toContain("No flights match the current filters.");
    expect(options(markup, "aircraft")).toContainEqual(["A359", "A359", true]);
    expect(markup.match(/class="passport-exploration"/g)).toHaveLength(2);
  });

  it("groups by year in date order and lists distance orders in one group", async () => {
    const years = (markup: string) =>
      [...markup.matchAll(/class="year-heading"><h[12]>([^<]*)</g)].map(
        (match) => match[1],
      );
    expect(years(await log())).toEqual(["2026", "2025", "2024"]);
    const oldest = await log({ sort: "oldest" });
    expect(years(oldest)).toEqual(["2024", "2025", "2026"]);
    expect(order(oldest)).toEqual(["pek", "sfo", "tao"]);
    const longest = await log({ sort: "longest" });
    expect(years(longest)).toEqual(["Longest distance first"]);
    expect(order(longest)).toEqual(["sfo", "pek", "tao"]);
    expect(order(await log({ sort: "shortest" }))).toEqual([
      "tao",
      "pek",
      "sfo",
    ]);
  });
});
