import { renderToStaticMarkup } from "react-dom/server";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { KeeprawFlight, KeeprawFlyDocument } from "@keepraw-fly/schema";
import { initialPassportView, type PassportViewState } from "../data/passport-exploration";
import { PassportPage } from "./PassportPage";
import en from "../locales/en.json";
import zhCN from "../locales/zh-CN.json";
import zhTW from "../locales/zh-TW.json";

const flight: KeeprawFlight = {
  id: "tao", flightNumber: "CX123", serviceDate: "2026-09-22", airline: { iata: "CX" },
  origin: { iata: "HKG" }, destination: { iata: "TAO" },
  scheduledDeparture: "2026-09-22T10:00:00+08:00", scheduledArrival: "2026-09-22T12:00:00+08:00",
};
afterEach(() => vi.unstubAllGlobals());

async function render(locale: "en" | "zh-CN" | "zh-TW", view = initialPassportView, record = flight, desktop = true) {
  const i18n = createInstance();
  await i18n.init({ lng: locale, resources: { en: { translation: en }, "zh-CN": { translation: zhCN }, "zh-TW": { translation: zhTW } }, interpolation: { escapeValue: false } });
  const document: KeeprawFlyDocument = { format: "keepraw-fly", formatVersion: "0.1.0", profile: { name: { native: "Test" } }, flights: [record] };
  vi.stubGlobal("window", { matchMedia: () => ({ matches: desktop }) });
  const markup = renderToStaticMarkup(<I18nextProvider i18n={i18n}><PassportPage document={document} locale={locale} distanceUnit="kilometers" timeFormat="24-hour" view={view}
    onViewChange={() => {}} onAddFlight={() => {}} onOpenImport={() => {}} onOpenFlight={() => {}} /></I18nextProvider>);
  return { markup, i18n };
}

describe("Passport narrative and spotlights", () => {
  it.each(["en", "zh-CN", "zh-TW"] as const)("removes highlights on mobile while preserving %s statistics", async locale => {
    const { markup, i18n } = await render(locale, initialPassportView, flight, false);
    expect(markup).not.toContain("passport-highlights");
    expect(markup).not.toContain("passport-spotlight");
    expect(markup).not.toContain(i18n.t("passport.highlights"));
    expect(markup).toContain("passport-mobile-summary");
    expect(markup).toContain("passport-delay-panel");
    expect(markup).toContain("passport-network-panel");
    expect(markup).toContain('data-flight-id="tao"');
  });

  it.each(["en", "zh-CN", "zh-TW"] as const)("keeps %s summaries complete and the delay hint out of visible copy", async locale => {
    const { markup, i18n } = await render(locale);
    expect(markup).toContain('class="passport-legend-hero"');
    expect(markup).toContain('class="passport-legend-support"');
    expect(markup).toContain(i18n.t("passport.arrivalDelayTotal", { duration: "—" }));
    expect(markup).toContain('class="passport-network-line"');
    expect(markup).toContain(i18n.t("passport.networkCountries", { count: 2 }));
    expect(markup).toContain('class="passport-mobile-summary"');
    expect(markup).toContain('passport-delay-panel');
    expect(markup).not.toContain('class="primary-stats"');
    expect(markup).not.toContain('class="passport-counts"');
    expect(markup).not.toContain('class="highlight-list"');
    expect(markup).toContain(`title="${i18n.t("passport.delayBasedOnArrivals")}"`);
    expect(markup.replace(/<[^>]+>/g, "")).not.toContain(i18n.t("passport.delayBasedOnArrivals"));
  });

  it.each([
    { kind: "airport", code: "TAO" },
    { kind: "airline", code: "CX" },
    { kind: "route", origin: "HKG", destination: "TAO" },
  ] satisfies PassportViewState["selection"][])("keeps the active $kind spotlight pressed, including tied airports", async selection => {
    const { markup } = await render("en", { ...initialPassportView, selection });
    const buttons = markup.match(/<button[^>]*class="passport-highlight[^>]*>[\s\S]*?<\/button>/g) ?? [];
    const selected = buttons.filter(button => button.includes('aria-pressed="true"'));
    expect(selected.length).toBeGreaterThan(0);
    expect(selected[0]).toContain(selection.kind === "airport" ? "TAO" : selection.kind === "airline" ? "Cathay Pacific" : "HKG to TAO");
    expect(buttons.every(button => /aria-label="[^"]*[Ff]ilter flights/.test(button))).toBe(true);
  });

  it("uses plain unavailable rows when no flown highlights exist", async () => {
    const { markup } = await render("en", initialPassportView, { ...flight, cancelled: true });
    expect(markup.match(/class="passport-highlight passport-spotlight-item is-unavailable"/g)).toHaveLength(4);
    expect(markup).not.toMatch(/<button[^>]*class="passport-highlight/);
  });

  it("filters a diverted highlight by its recorded destination", async () => {
    const { markup } = await render("en", { ...initialPassportView, selection: { kind: "route", origin: "HKG", destination: "TAO" } },
      { ...flight, destination: { iata: "PEK" }, divertedTo: { iata: "TAO" } });
    const routes = markup.match(/<div class="passport-spotlight-routes"[\s\S]*?<\/section>/)?.[0] ?? "";
    expect(routes).toContain('aria-pressed="true"');
    expect(routes).toContain("filter flights from HKG to TAO");
    expect(routes).not.toContain("HKG to PEK");
  });
});
