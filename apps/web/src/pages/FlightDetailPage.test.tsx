import { renderToStaticMarkup } from "react-dom/server";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { beforeAll, describe, expect, it } from "vitest";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import zhCN from "../locales/zh-CN.json";
import { FlightDetailPage } from "./FlightDetailPage";

const i18n = createInstance();
const flight: KeeprawFlight = {
  id: "zh9911", flightNumber: "ZH9911", serviceDate: "2026-09-21", airline: { iata: "ZH" },
  origin: { iata: "SZX", terminal: "T3", gate: "338" }, destination: { iata: "TAO", terminal: "T1", gate: "A7" },
  scheduledDeparture: "2026-09-21T20:45:00+08:00", actualDeparture: "2026-09-21T20:56:00+08:00",
  scheduledArrival: "2026-09-22T00:05:00+08:00", actualArrival: "2026-09-21T23:30:00+08:00", baggageCarousel: "4",
  extensions: { "keepraw-fly.aircraft": { type: "737-8 AL", registration: "B5379" } },
};
beforeAll(async () => { await i18n.init({ resources: { "zh-CN": { translation: zhCN } }, lng: "zh-CN", interpolation: { escapeValue: false } }); });
function markup(record = flight) {
  return renderToStaticMarkup(<I18nextProvider i18n={i18n}><FlightDetailPage flight={record} memberships={[]} locale="zh-CN" distanceUnit="kilometers" timeFormat="24-hour" /></I18nextProvider>);
}
function stop(record: KeeprawFlight, kind: "departure" | "arrival") {
  return markup(record).match(new RegExp(`<section class="detail-stop detail-stop--${kind}"[\\s\\S]*?<\\/section>`))?.[0] ?? "";
}
describe("Flight Detail timing and facts", () => {
  it("summarizes both departure delay and arrival early with the shared actual duration", () => {
    const summary = markup().match(/class="detail-heading-summary"[\s\S]*?<\/header>/)?.[0];
    expect(summary).toContain("出发晚点 11 分");
    expect(summary).toContain("到达提前 35 分");
    expect(summary).toContain("2小时 34分");
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
    expect(stop({ ...flight, origin: { iata: "SZX" } }, "departure")).not.toContain("detail-stop-facts");
  });
  it("preserves operational statuses and separates type from registration", () => {
    expect(markup({ ...flight, cancelled: true })).toContain("已取消");
    expect(markup({ ...flight, cancelled: true })).not.toContain("出发晚点");
    expect(markup({ ...flight, divertedTo: { iata: "PEK" } })).toContain("备降");
    expect(markup()).toContain("737-8 AL");
    expect(markup()).toContain("注册号 B5379");
  });
});
