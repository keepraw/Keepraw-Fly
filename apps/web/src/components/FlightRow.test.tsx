import { renderToStaticMarkup } from "react-dom/server";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import { FlightRow } from "./FlightRow";
import en from "../locales/en.json";
import zhCN from "../locales/zh-CN.json";
import zhTW from "../locales/zh-TW.json";

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
          presentation="passport"
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
    "uses one localized city route without timing/code repetition in %s",
    async (locale, origin, destination) => {
      const markup = await archiveMarkup(locale);
      expect(markup).toContain(`<span>${origin}</span>`);
      expect(markup).toContain(`<span>${destination}</span>`);
      expect(markup).not.toMatch(
        /flight-route-codes|flight-time-column|flight-scheduled-times|flight-status|flight-deviation/,
      );
      expect(markup).not.toContain("flight-ledger-exception");
      expect(markup).toContain("flight-ledger-duration");
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

  it("flags only substantial arrival delays, cancellations and diversions", async () => {
    expect(
      await archiveMarkup("en", { actualArrival: "2026-09-22T07:19:00+08:00" }),
    ).not.toContain("flight-ledger-exception");
    expect(
      await archiveMarkup("en", { actualArrival: "2026-09-22T07:20:00+08:00" }),
    ).toContain("Delayed · 0h 30m");
    expect(await archiveMarkup("en", { cancelled: true })).toContain(
      "Cancelled",
    );
    expect(
      await archiveMarkup("en", { divertedTo: { iata: "PEK" } }),
    ).toContain("Diverted");
  });
  it.each(["en", "zh-CN", "zh-TW"] as const)(
    "renders selection, labelled schedule and overnight text in %s",
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
      expect(markup).toContain(i18n.t("flightTiming.scheduled"));
      expect(markup).toContain(i18n.t("flightTiming.overnight"));
      expect(markup).toContain(
        i18n.t("flightTiming.departure.late", { count: 11 }),
      );
      expect(markup).toContain(
        i18n.t("flightTiming.arrival.early", { count: 35 }),
      );
    },
  );
});
