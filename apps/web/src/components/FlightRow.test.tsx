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
  id: "overnight", flightNumber: "CX696", serviceDate: "2026-09-21", airline: { iata: "CX" },
  origin: { iata: "DEL" }, destination: { iata: "HKG" },
  scheduledDeparture: "2026-09-21T23:28:00+05:30", actualDeparture: "2026-09-21T23:39:00+05:30",
  scheduledArrival: "2026-09-22T06:50:00+08:00", actualArrival: "2026-09-22T06:15:00+08:00",
};
describe("FlightRow", () => {
  it.each(["en", "zh-CN", "zh-TW"] as const)("renders selection, labelled schedule and overnight text in %s", async locale => {
    const i18n = createInstance();
    await i18n.init({ resources: { en: { translation: en }, "zh-CN": { translation: zhCN }, "zh-TW": { translation: zhTW } }, lng: locale });
    const markup = renderToStaticMarkup(<I18nextProvider i18n={i18n}><FlightRow flight={flight} locale={locale} timeFormat="24-hour" selected onOpen={() => {}} /></I18nextProvider>);
    expect(markup).toContain('aria-current="true"');
    expect(markup.match(/<button/g)).toHaveLength(1);
    expect(markup).not.toContain("flight-row-open");
    expect(markup).not.toContain(i18n.t("flights.details"));
    expect(markup).toContain(i18n.t("flights.openFlight", { flightNumber: flight.flightNumber, origin: flight.origin.iata, destination: flight.destination.iata }));
    expect(markup).toContain('data-flight-id="overnight"');
    expect(markup).toContain("+1");
    expect(markup).toContain(i18n.t("flightTiming.scheduled"));
    expect(markup).toContain(i18n.t("flightTiming.overnight"));
    expect(markup).toContain(i18n.t("flightTiming.departure.late", { count: 11 }));
    expect(markup).toContain(i18n.t("flightTiming.arrival.early", { count: 35 }));
  });
});
