import { renderToStaticMarkup } from "react-dom/server";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import en from "../../locales/en-US.json";
import zhCN from "../../locales/zh-CN.json";
import { SKIN_IDS, type SkinId } from "../registry";
import { FlightExtensionSlot, flightInsights } from "./index";

function flight(overrides: Partial<KeeprawFlight> = {}): KeeprawFlight {
  return {
    id: "flight-1",
    flightNumber: "QF12",
    serviceDate: "2024-11-27",
    airline: { iata: "QF" },
    origin: { iata: "LAX" },
    destination: { iata: "SYD" },
    scheduledDeparture: "2024-11-27T20:20:00-08:00",
    scheduledArrival: "2024-11-29T06:15:00+11:00",
    actualDeparture: "2024-11-27T20:41:00-08:00",
    actualArrival: "2024-11-29T06:08:00+11:00",
    ...overrides,
  };
}

async function render(
  skin: SkinId,
  record: KeeprawFlight,
  language: "en" | "zh-CN" = "en",
) {
  const i18n = createInstance();
  await i18n.init({
    lng: language,
    resources: { en: { translation: en }, "zh-CN": { translation: zhCN } },
    interpolation: { escapeValue: false },
  });
  return renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <FlightExtensionSlot
        skin={skin}
        flight={record}
        locale={language === "en" ? "en-US" : "zh-CN"}
        timeFormat="24-hour"
      />
    </I18nextProvider>,
  );
}

const text = (markup: string) =>
  markup
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

describe("flight.extension slot", () => {
  it("is filled by aviation only", async () => {
    for (const skin of SKIN_IDS) {
      const markup = await render(skin, flight());
      if (skin === "aviation")
        expect(markup).toContain('data-slot="flight.extension"');
      else expect(markup).toBe("");
    }
  });

  it("hands the extension frozen, derived insights and nothing else", () => {
    const insights = flightInsights(flight());
    expect(Object.isFrozen(insights)).toBe(true);
    expect(Object.keys(insights)).toEqual(["comparison", "timeline"]);
  });

  it("renders nothing when the flight has neither comparison nor timeline", async () => {
    // Scheduled only, and both airports keep the same clock.
    const markup = await render(
      "aviation",
      flight({
        origin: { iata: "SFO" },
        destination: { iata: "LAX" },
        scheduledDeparture: "2026-08-19T10:20:00-07:00",
        scheduledArrival: "2026-08-19T11:52:00-07:00",
        actualDeparture: undefined,
        actualArrival: undefined,
      }),
    );
    expect(markup).toBe("");
    expect(await render("aviation", flight({ cancelled: true }))).toBe("");
  });
});

describe("aviation flight extension", () => {
  it("compares the scheduled and the actual operation", async () => {
    const markup = await render("aviation", flight());
    const content = text(markup);
    expect(content).toContain("Scheduled and actual");
    expect(content).toContain("Sched. 14h 55m");
    expect(content).toContain("Actual 14h 27m");
    expect(content).toContain("28 min shorter than scheduled");
    // The actual bar starts 21 of 895 minutes in and ends 7 minutes early.
    const bars = [
      ...markup.matchAll(/--bar-start:([\d.]+)%;--bar-end:([\d.]+)%/g),
    ];
    expect(bars).toHaveLength(2);
    expect(Number(bars[0]![1])).toBe(0);
    expect(Number(bars[0]![2])).toBe(0);
    expect(Number(bars[1]![1])).toBeCloseTo((21 / 895) * 100, 6);
    expect(Number(bars[1]![2])).toBeCloseTo((7 / 895) * 100, 6);
  });

  it("says when the flight took longer or exactly as scheduled", async () => {
    expect(
      text(
        await render(
          "aviation",
          flight({ actualArrival: "2024-11-29T06:45:00+11:00" }),
        ),
      ),
    ).toContain("9 min longer than scheduled");
    expect(
      text(
        await render(
          "aviation",
          flight({
            actualDeparture: "2024-11-27T20:30:00-08:00",
            actualArrival: "2024-11-29T06:25:00+11:00",
          }),
        ),
      ),
    ).toContain("Same time in the air as scheduled");
  });

  it("shows both clocks with day offsets, midnights and the date line", async () => {
    const markup = await render("aviation", flight());
    const content = text(markup);
    expect(content).toContain("Local time at both airports");
    expect(markup).toContain('role="group" aria-label="LAX UTC-8"');
    expect(markup).toContain('role="group" aria-label="SYD UTC+11"');
    expect(content).toContain("Departure 20:41");
    expect(content).toContain("Arrival 11:08 +1");
    expect(content).toContain("Departure 15:41 +1");
    expect(content).toContain("Arrival 06:08 +2");
    expect(markup).toContain('aria-label="2 days later"');
    expect(markup.match(/class="aviation-midnight"/g)).toHaveLength(2);
    expect(markup).toContain('class="aviation-date-line"');
    expect(content).toContain("A tick marks local midnight.");
    // The ticks and the date line are drawn; their places are also said.
    expect(content).toContain(
      "Departure 20:41 Local midnight 3h 19m after departure. Arrival 11:08 +1",
    );
    expect(content).toContain(
      "Departure 15:41 +1 Local midnight 8h 19m after departure. Arrival 06:08 +2",
    );
    expect(content).toMatch(/Date line at about \d+% of the route\./);
    expect(content).toContain("it is not a recorded time");
  });

  it("leaves out the date line and its note when the route does not cross it", async () => {
    const markup = await render(
      "aviation",
      flight({
        origin: { iata: "LHR" },
        destination: { iata: "FRA" },
        scheduledDeparture: "2025-09-25T09:30:00+01:00",
        scheduledArrival: "2025-09-25T12:05:00+02:00",
        actualDeparture: "2025-09-25T09:42:00+01:00",
        actualArrival: "2025-09-25T12:09:00+02:00",
      }),
    );
    expect(markup).toContain('aria-label="LHR UTC+1"');
    expect(markup).toContain('aria-label="FRA UTC+2"');
    expect(markup).not.toContain("aviation-date-line");
    expect(markup).not.toContain("aviation-midnight");
    expect(markup).not.toContain("aviation-clocks-note");
  });

  it("names both offsets of an airport that changes its clock in flight", async () => {
    // Los Angeles moves to daylight time at 10:00 UTC, during the flight.
    const markup = await render(
      "aviation",
      flight({
        origin: { iata: "LAX" },
        destination: { iata: "JFK" },
        scheduledDeparture: "2026-03-08T00:30:00-08:00",
        scheduledArrival: "2026-03-08T09:40:00-04:00",
        actualDeparture: undefined,
        actualArrival: undefined,
      }),
    );
    expect(markup).toContain('role="group" aria-label="LAX UTC-8 → UTC-7"');
    expect(markup).toContain('role="group" aria-label="JFK UTC-4"');
    expect(text(markup)).toContain("LAX UTC-8 → UTC-7 Departure 00:30");
    expect(text(markup)).toContain("Arrival 06:40");
  });

  it("shows only the clocks for a flight without actual times", async () => {
    const markup = await render(
      "aviation",
      flight({ actualDeparture: undefined, actualArrival: undefined }),
    );
    expect(markup).not.toContain("aviation-comparison");
    expect(markup).toContain("aviation-clocks");
  });

  it("shows only the comparison when both airports keep the same clock", async () => {
    const markup = await render(
      "aviation",
      flight({
        origin: { iata: "SFO" },
        destination: { iata: "LAX" },
        scheduledDeparture: "2026-08-19T10:20:00-07:00",
        scheduledArrival: "2026-08-19T11:52:00-07:00",
        actualDeparture: "2026-08-19T10:57:00-07:00",
        actualArrival: "2026-08-19T12:21:00-07:00",
      }),
    );
    expect(markup).toContain("aviation-comparison");
    expect(markup).not.toContain("aviation-clocks");
  });

  it("is translated", async () => {
    const content = text(await render("aviation", flight(), "zh-CN"));
    expect(content).toContain("计划与实际");
    expect(content).toContain("比计划少 28 分钟");
    expect(content).toContain("两地时间");
    expect(content).toContain("日界线");
  });
});
