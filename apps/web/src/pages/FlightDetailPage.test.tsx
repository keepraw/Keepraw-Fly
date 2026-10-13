import { renderToStaticMarkup } from "react-dom/server";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { beforeAll, describe, expect, it } from "vitest";
import {
  installAirportDirectory,
  type CompactAirportRow,
  type SupportedLocale,
} from "@keepraw-fly/core";
import airportRows from "@keepraw-fly/core/airport-directory";
import en from "../locales/en-US.json";
import zhTW from "../locales/zh-TW.json";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import zhCN from "../locales/zh-CN.json";
import { FlightDetailPage } from "./FlightDetailPage";

installAirportDirectory(airportRows as CompactAirportRow[]);

const i18n = createInstance();
const flight: KeeprawFlight = {
  id: "zh9911",
  flightNumber: "ZH9911",
  serviceDate: "2026-09-21",
  airline: { iata: "ZH" },
  origin: { iata: "SZX", terminal: "T3", gate: "338" },
  destination: { iata: "TAO", terminal: "T1", gate: "A7" },
  scheduledDeparture: "2026-09-21T20:45:00+08:00",
  actualDeparture: "2026-09-21T20:56:00+08:00",
  scheduledArrival: "2026-09-22T00:05:00+08:00",
  actualArrival: "2026-09-21T23:30:00+08:00",
  baggageCarousel: "4",
  extensions: {
    "keepraw-fly.aircraft": { type: "737-8 AL", registration: "B5379" },
  },
};
beforeAll(async () => {
  await i18n.init({
    resources: {
      en: { translation: en },
      "zh-CN": { translation: zhCN },
      "zh-TW": { translation: zhTW },
    },
    lng: "zh-CN",
    interpolation: { escapeValue: false },
  });
});
function markup(
  record = flight,
  locale: SupportedLocale = "zh-CN",
  timeFormat: "12-hour" | "24-hour" = "24-hour",
) {
  return renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <FlightDetailPage
        flight={record}
        memberships={[]}
        locale={locale}
        distanceUnit="kilometers"
        timeFormat={timeFormat}
        appearance="light"
        solarMode="fixed"
      />
    </I18nextProvider>,
  );
}
function stop(record: KeeprawFlight, kind: "departure" | "arrival") {
  return (
    markup(record).match(
      new RegExp(
        `<section class="detail-stop detail-stop--${kind}"[\\s\\S]*?<\\/section>`,
      ),
    )?.[0] ?? ""
  );
}
describe("Flight Detail timing and facts", () => {
  it("keeps deviations next to each stop and displays the actual duration once", () => {
    const summary = markup().match(
      /class="detail-heading-summary"[\s\S]*?<\/header>/,
    )?.[0];
    expect(summary).not.toContain("出发晚点");
    expect(summary).not.toContain("到达提前");
    expect(stop(flight, "departure")).toContain("出发晚点 11 分");
    expect(stop(flight, "arrival")).toContain("到达提前 35 分");
    expect(markup().match(/2小时 34分/g)).toHaveLength(1);
  });
  it("labels actual and scheduled, retaining next-day schedule and its own datetime", () => {
    const arrival = stop(flight, "arrival");
    expect(arrival).toContain("实际");
    expect(arrival).toContain("23:30");
    expect(arrival).toContain("计划");
    expect(arrival).toContain('dateTime="2026-09-22T00:05:00+08:00"');
    expect(arrival).toContain("00:05");
    expect(arrival).toContain("+1");
  });
  it("keeps labelled terminal, gate and baggage facts inside each airport once", () => {
    const departure = stop(flight, "departure");
    const arrival = stop(flight, "arrival");
    expect(departure).toContain("<dt>航站楼</dt><dd>T3</dd>");
    expect(departure).toContain("<dt>登机口</dt><dd>338</dd>");
    expect(arrival).toContain("<dt>登机口</dt><dd>A7</dd>");
    expect(arrival).toContain("<dt>行李转盘</dt><dd>4</dd>");
    expect(departure.match(/338/g)).toHaveLength(1);
    expect(arrival.match(/A7/g)).toHaveLength(1);
    expect(
      stop({ ...flight, origin: { iata: "SZX" } }, "departure"),
    ).not.toContain("detail-stop-facts");
  });
  it("preserves operational statuses and separates type from registration", () => {
    expect(markup({ ...flight, cancelled: true })).toContain("已取消");
    expect(markup({ ...flight, cancelled: true })).not.toContain("出发晚点");
    expect(markup({ ...flight, divertedTo: { iata: "PEK" } })).toContain(
      "备降",
    );
    expect(markup()).toContain("737-8 AL");
    expect(markup()).toContain("<dt>注册号</dt><dd>B5379</dd>");
  });
  it("shows both sources on time without a redundant deviation row", () => {
    const record = {
      ...flight,
      actualDeparture: flight.scheduledDeparture,
      actualArrival: flight.scheduledArrival,
    };
    expect(stop(record, "departure")).toContain("实际");
    expect(stop(record, "departure")).toContain("计划");
    expect(stop(record, "departure")).not.toContain("detail-stop-meta");
    expect(stop(record, "arrival")).not.toContain("detail-stop-meta");
    expect(stop(record, "departure").match(/>20:45<\/time>/g)).toHaveLength(2);
  });
  it("uses the airport zone for UTC-stored timestamps and preserves the 12-hour preference", () => {
    const html = markup(
      { ...flight, actualDeparture: "2026-09-21T12:56:00Z" },
      "en",
      "12-hour",
    );
    expect(html).toContain("08:56 PM");
    expect(html).toContain("UTC+8");
    expect(html).not.toContain('class="time-zone">UTC</span>');
  });
  it("keeps planned and diverted airport facilities and zones separate", () => {
    const record = {
      ...flight,
      destination: { iata: "LAX", terminal: "7", gate: "71" },
      divertedTo: { iata: "JFK", terminal: "4", gate: "B22" },
      scheduledArrival: "2026-09-21T13:00:00-07:00",
      actualArrival: "2026-09-21T16:00:00-04:00",
    };
    const arrival = stop(record, "arrival");
    expect(arrival).toContain("<strong>JFK</strong>");
    expect(arrival).toContain("计划到达：LAX");
    expect(arrival).toContain("UTC-4");
    expect(arrival).toContain("UTC-7");
    expect(arrival).toContain("<dt>登机口</dt><dd>71</dd>");
    expect(arrival).toContain("<dt>登机口</dt><dd>B22</dd>");
    // The instants match; the planned airport still needs its own local time.
    expect(arrival).toContain("16:00");
    expect(arrival).toContain("13:00");
  });
  it("naturally omits empty supplementary groups and uses scheduled times when actuals are missing", () => {
    const record = {
      ...flight,
      actualDeparture: undefined,
      actualArrival: undefined,
      extensions: undefined,
    };
    const html = markup(record);
    expect(html).not.toContain("detail-metadata-shelf");
    expect(html).not.toContain('class="flight-deviation');
    expect(html).not.toContain('class="detail-scheduled-time"');
    expect(html).toContain("计划飞行时间");
    expect(html).toContain('class="detail-flight-phase">计划</strong>');
    expect(
      markup({ ...record, actualDeparture: flight.actualDeparture }),
    ).toContain("已出发");
  });
});

describe("Flight Detail city display matches the archive", () => {
  const cities = [
    ["KHN", "Nanchang", "南昌", "南昌"],
    ["TAO", "Qingdao", "青岛", "青島"],
    ["CAN", "Guangzhou", "广州", "廣州"],
    ["TPE", "Taipei", "台北", "臺北"],
    ["TSA", "Taipei", "台北", "臺北"],
    ["EWR", "New York", "纽约", "紐約"],
    ["JFK", "New York", "纽约", "紐約"],
    ["NRT", "Tokyo", "东京", "東京"],
    ["HND", "Tokyo", "东京", "東京"],
    ["SGN", "Ho Chi Minh City", "胡志明市", "胡志明市"],
    ["ZZZ", "ZZZ", "ZZZ", "ZZZ"],
  ] as const;
  for (const [index, locale] of (["en", "zh-CN", "zh-TW"] as const).entries()) {
    it.each(cities)(
      `${locale}: uses the same %s label in title and both stops`,
      async (iata, ...names) => {
        await i18n.changeLanguage(locale);
        const record = { ...flight, origin: { iata }, destination: { iata } };
        const html = markup(record, locale);
        const name = names[index]!;
        expect(html).toContain(`<h1 id="flight-detail-title">${name} <span>`);
        expect(html).toContain(`</span> ${name}</h1>`);
        expect(html).toContain(`class="route-origin-city">${name}</span>`);
        expect(html).toContain(`class="route-arrival-city">${name}</span>`);
        expect(html).toContain(`<strong>${iata}</strong>`);
        if (iata === "ZZZ") expect(html).not.toContain("route-origin-airport");
      },
    );
    it(`${locale}: retains the planned destination in the title and the actual diversion at arrival`, async () => {
      await i18n.changeLanguage(locale);
      const html = markup(
        {
          ...flight,
          origin: { iata: "KHN" },
          destination: { iata: "TPE" },
          divertedTo: { iata: "CAN" },
        },
        locale,
      );
      expect(html).toContain(`</span> ${cities[3]![index + 1]}</h1>`);
      expect(html).toContain(
        `class="route-arrival-city">${cities[2]![index + 1]}</span>`,
      );
      expect(html).toContain("<strong>CAN</strong>");
      expect(html).toContain('class="detail-diversion-note"');
      expect(html).toContain('class="route-arrival-airport"');
    });
  }
});
