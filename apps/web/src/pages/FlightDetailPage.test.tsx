import { renderToStaticMarkup } from "react-dom/server";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { beforeAll, describe, expect, it } from "vitest";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import demoDocument from "@keepraw-fly/core/demo";
import zhCN from "../locales/zh-CN.json";
import { FlightDetailPage } from "./FlightDetailPage";

const i18n = createInstance();
const baseFlight = demoDocument.flights[0] as KeeprawFlight;

beforeAll(async () => {
  await i18n.init({
    resources: { "zh-CN": { translation: zhCN } },
    lng: "zh-CN",
    fallbackLng: "zh-CN",
    interpolation: { escapeValue: false },
  });
});

function stopMarkup(flight: KeeprawFlight, kind: "departure" | "arrival") {
  const markup = renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <FlightDetailPage flight={flight} memberships={[]} locale="zh-CN" distanceUnit="kilometers" timeFormat="24-hour" />
    </I18nextProvider>,
  );
  return markup.match(new RegExp(`<section class="detail-stop detail-stop--${kind}"[\\s\\S]*?<\\/section>`))?.[0] ?? "";
}

describe("Flight Detail operational signage", () => {
  it("uses the same gate and terminal sign at departure and arrival, even with an arrival baggage carousel", () => {
    const flight: KeeprawFlight = {
      ...baseFlight,
      destination: { ...baseFlight.destination, gate: "A7" },
      baggageCarousel: "4",
    };
    const departure = stopMarkup(flight, "departure");
    const arrival = stopMarkup(flight, "arrival");

    expect(departure).toMatch(/class="mobile-gate-sign"[\s\S]*?F12/);
    expect(departure).toContain("航站楼 3");
    expect(arrival).toMatch(/class="mobile-gate-sign"[\s\S]*?A7/);
    expect(arrival).toContain("航站楼 7");
    expect(arrival).toContain("行李转盘 4");
    expect(arrival).toMatch(/class="operation-badge-group"[\s\S]*?4/);
    expect(arrival).toContain('class="detail-desktop-only">登机口 A7');
  });

  it("omits a missing gate sign and shows a terminal alone as plain text", () => {
    const flight: KeeprawFlight = {
      ...baseFlight,
      origin: { iata: baseFlight.origin.iata },
      destination: { iata: baseFlight.destination.iata, terminal: "7" },
    };
    const departure = stopMarkup(flight, "departure");
    const arrival = stopMarkup(flight, "arrival");

    expect(departure).not.toContain('class="mobile-gate-signage"');
    expect(arrival).toContain('class="mobile-gate-signage"');
    expect(arrival).not.toContain('class="mobile-gate-sign"');
    expect(arrival).toContain("航站楼 7");
  });
});
