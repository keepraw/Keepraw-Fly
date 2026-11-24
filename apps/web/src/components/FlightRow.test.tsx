import { renderToStaticMarkup } from "react-dom/server";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  installAirportDirectory,
  type CompactAirportRow,
} from "@keepraw-fly/core";
import airportRows from "@keepraw-fly/core/airport-directory";
import { FlightRow } from "./FlightRow";
import en from "../locales/en-US.json";
import zhCN from "../locales/zh-CN.json";
import zhTW from "../locales/zh-TW.json";

installAirportDirectory(airportRows as CompactAirportRow[]);

const flight: KeeprawFlight = {
  id: "overnight",
  flightNumber: "CX696",
  serviceDate: "2026-09-21",
  airline: { iata: "CX" },
  origin: { iata: "DEL" },
  destination: { iata: "HKG" },
  scheduledDeparture: "2026-09-21T23:28:00+05:30",
  actualDeparture: "2026-09-21T23:39:00+05:30",
  scheduledArrival: "2026-09-22T06:50:00+08:00",
  actualArrival: "2026-09-22T06:15:00+08:00",
};
describe("FlightRow", () => {
  async function archiveMarkup(
    locale: "en" | "zh-CN" | "zh-TW",
    changes: Partial<KeeprawFlight> = {},
    presentation: "passport" | "standard" = "passport",
  ) {
    const i18n = createInstance();
    await i18n.init({
      resources: {
        en: { translation: en },
        "zh-CN": { translation: zhCN },
        "zh-TW": { translation: zhTW },
      },
      lng: locale,
    });
    return renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <FlightRow
          flight={{
            ...flight,
            origin: { iata: "SZX" },
            destination: { iata: "TAO" },
            ...changes,
          }}
          locale={locale}
          timeFormat="24-hour"
          presentation={presentation}
          onOpen={() => {}}
        />
      </I18nextProvider>,
    );
  }

  it.each([
    ["en", "Shenzhen", "Qingdao"],
    ["zh-CN", "深圳", "青岛"],
    ["zh-TW", "深圳", "青島"],
  ] as const)(
    "shows localized cities, airport codes and one time pair in %s",
    async (locale, origin, destination) => {
      const markup = await archiveMarkup(locale);
      expect(markup).toContain(`<span>${origin}</span>`);
      expect(markup).toContain(`<span>${destination}</span>`);
      expect(markup).toContain("flight-route-codes");
      expect(markup).toContain("flight-time-column");
      expect(markup.match(/<time dateTime=/g)).toHaveLength(2);
      expect(markup).not.toMatch(
        /flight-scheduled-times|flight-status|flight-deviation|flight-ledger/,
      );
      expect(markup).toContain("SZX");
      expect(markup).toContain("TAO");
    },
  );

  it("uses actual city data for Shanghai's airports and an IATA fallback for missing data", async () => {
    expect(await archiveMarkup("zh-CN", { origin: { iata: "SHA" } })).toContain(
      "<span>上海</span>",
    );
    expect(await archiveMarkup("en", { origin: { iata: "ZZZ" } })).toContain(
      "<span>ZZZ</span>",
    );
  });

  it.each([
    ["KHN", "TAO", "南昌", "青岛"],
    ["DAD", "SGN", "岘港", "胡志明市"],
    ["KWJ", "USN", "光州", "蔚山"],
    ["EWR", "JFK", "纽约", "纽约"],
    ["TPE", "TSA", "台北", "台北"],
    ["NRT", "HND", "东京", "东京"],
  ] as const)(
    "shows consistent %s -> %s city labels across desktop and mobile",
    async (from, to, expectedFrom, expectedTo) => {
      for (const presentation of ["passport", "standard"] as const) {
        const markup = await archiveMarkup(
          "zh-CN",
          { origin: { iata: from }, destination: { iata: to } },
          presentation,
        );
        expect(markup).toContain(`<span>${expectedFrom}</span>`);
        expect(markup).toContain(`<span>${expectedTo}</span>`);
      }
    },
  );

  it("localizes Taipei in traditional Chinese instead of falling back to English", async () => {
    for (const presentation of ["passport", "standard"] as const) {
      const markup = await archiveMarkup(
        "zh-TW",
        { origin: { iata: "TPE" }, destination: { iata: "TSA" } },
        presentation,
      );
      expect(markup).toContain("<span>臺北</span>");
      expect(markup).not.toContain("<span>Taipei</span>");
    }
  });

  it("shows a late arrival in the detail line and badges only cancellation or diversion", async () => {
    for (const presentation of ["passport", "standard"] as const) {
      const delayed = await archiveMarkup(
        "en",
        { actualArrival: "2026-09-22T09:20:00+08:00" },
        presentation,
      );
      expect(delayed).toContain(
        '<span class="flight-deviation is-late">Arrival delayed 150 min</span>',
      );
      expect(delayed).not.toMatch(/Delayed|Early|On Time|flight-status/);
      // Early and on-time arrivals, and cancelled flights, show no deviation.
      for (const changes of [
        {},
        { actualArrival: "2026-09-22T06:50:00+08:00" },
        { actualArrival: "2026-09-22T09:20:00+08:00", cancelled: true },
      ])
        expect(await archiveMarkup("en", changes, presentation)).not.toContain(
          "flight-deviation",
        );
      expect(
        await archiveMarkup("en", { cancelled: true }, presentation),
      ).toContain("Canceled");
      const diverted = await archiveMarkup(
        "en",
        { divertedTo: { iata: "PEK" } },
        presentation,
      );
      expect(diverted).toContain("Diverted PEK");
      expect(diverted).not.toContain("Diverted to");
    }
  });

  it("adds duration, distance, aircraft type and seat, and only what is recorded", async () => {
    const facts = (markup: string) =>
      [
        ...markup.matchAll(
          /<span data-fact="(\w+)"><span class="sr-only">([^<]*)<\/span>([^<]*)<\/span>/g,
        ),
      ].map((match) => [match[1], match[2]!.trim(), match[3]]);
    for (const presentation of ["passport", "standard"] as const) {
      const full = await archiveMarkup(
        "en",
        {
          extensions: {
            "keepraw-fly.aircraft": { type: "A321", registration: "B-1234" },
            "keepraw-fly.seat": { seat: "31A", cabin: "economy" },
          },
        },
        presentation,
      );
      expect(facts(full)).toEqual([
        ["duration", "Duration", "4h 06m"],
        ["distance", "Distance", "1,642 km"],
        ["aircraft", "Aircraft", "A321"],
        ["seat", "Seat", "31A"],
      ]);
      expect(full).not.toContain("B-1234");
      expect(facts(await archiveMarkup("en", {}, presentation))).toEqual([
        ["duration", "Duration", "4h 06m"],
        ["distance", "Distance", "1,642 km"],
      ]);
      // A cancelled flight was not flown: no duration or distance.
      const cancelled = await archiveMarkup(
        "en",
        { cancelled: true },
        presentation,
      );
      expect(facts(cancelled)).toEqual([]);
      expect(cancelled).not.toContain("flight-row-detail");
    }
    expect(facts(await archiveMarkup("zh-CN")).map((fact) => fact[1])).toEqual([
      "时长",
      "距离",
    ]);
  });

  it.each([
    [{}, "23:39", "06:15", "23:28", "06:50"],
    [
      { actualDeparture: undefined, actualArrival: undefined },
      "23:28",
      "06:50",
      "23:39",
      "06:15",
    ],
    [{ actualArrival: undefined }, "23:39", "06:50", "23:28", "06:15"],
    [{ actualDeparture: undefined }, "23:28", "06:15", "23:39", "06:50"],
  ] as const)(
    "chooses actual or scheduled time independently for each endpoint: %j",
    async (changes, departure, arrival, hiddenDeparture, hiddenArrival) => {
      for (const presentation of ["passport", "standard"] as const) {
        const markup = await archiveMarkup(
          "en",
          {
            origin: flight.origin,
            destination: flight.destination,
            ...changes,
          },
          presentation,
        );
        expect(markup).toContain(`>${departure}</time>`);
        expect(markup).toContain(`>${arrival}<`);
        expect(markup).not.toContain(`>${hiddenDeparture}</time>`);
        expect(markup).not.toContain(`>${hiddenArrival}<`);
        expect(markup.match(/<time dateTime=/g)).toHaveLength(2);
      }
    },
  );
  it.each(["en", "zh-CN", "zh-TW"] as const)(
    "retains selection, accessible activation and overnight day offset in %s",
    async (locale) => {
      const i18n = createInstance();
      await i18n.init({
        resources: {
          en: { translation: en },
          "zh-CN": { translation: zhCN },
          "zh-TW": { translation: zhTW },
        },
        lng: locale,
      });
      const markup = renderToStaticMarkup(
        <I18nextProvider i18n={i18n}>
          <FlightRow
            flight={flight}
            locale={locale}
            timeFormat="24-hour"
            selected
            onOpen={() => {}}
          />
        </I18nextProvider>,
      );
      expect(markup).toContain('aria-current="true"');
      expect(markup.match(/<button/g)).toHaveLength(1);
      expect(markup).not.toMatch(/<button[^>]*aria-label=/);
      expect(markup).not.toContain("flight-row-open");
      expect(markup).not.toContain(i18n.t("flights.details"));
      expect(markup).toContain(
        i18n.t("flights.openFlight", {
          flightNumber: flight.flightNumber,
          origin: flight.origin.iata,
          destination: flight.destination.iata,
        }),
      );
      expect(markup).toContain('data-flight-id="overnight"');
      expect(markup).toContain("+1");
      expect(markup).toContain(">23:39</time>");
      expect(markup).toContain(">06:15<");
      expect(markup).not.toContain(i18n.t("flightTiming.scheduled"));
      expect(markup).not.toContain(i18n.t("flightTiming.overnight"));
      expect(markup).not.toContain(
        i18n.t("flightTiming.departure.late", { count: 11 }),
      );
      expect(markup).not.toContain(
        i18n.t("flightTiming.arrival.early", { count: 35 }),
      );
    },
  );
});
