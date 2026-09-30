import { renderToStaticMarkup } from "react-dom/server";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
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
async function render(locale: "en" | "zh-CN" | "zh-TW", view = initialPassportView, record = flight) {
  const i18n = createInstance();
  await i18n.init({ lng: locale, resources: { en: { translation: en }, "zh-CN": { translation: zhCN }, "zh-TW": { translation: zhTW } }, interpolation: { escapeValue: false } });
  const document: KeeprawFlyDocument = { format: "keepraw-fly", formatVersion: "0.1.0", profile: { name: { native: "Test" } }, flights: [record] };
  const markup = renderToStaticMarkup(<I18nextProvider i18n={i18n}><PassportPage document={document} locale={locale} distanceUnit="kilometers" timeFormat="24-hour" view={view}
    onViewChange={() => {}} onAddFlight={() => {}} onOpenImport={() => {}} onOpenFlight={() => {}} /></I18nextProvider>);
  return { markup, i18n };
}

describe("Passport statistics and archive", () => {
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
    expect(markup).not.toContain('passport-highlights');
    expect(markup).not.toContain(i18n.t("passport.highlights"));
    expect(markup).toContain(`title="${i18n.t("passport.delayBasedOnArrivals")}"`);
    expect(markup.replace(/<[^>]+>/g, "")).not.toContain(i18n.t("passport.delayBasedOnArrivals"));
  });

  it.each([
    { kind: "airport", code: "TAO" },
    { kind: "airline", code: "CX" },
    { kind: "route", origin: "HKG", destination: "TAO" },
  ] satisfies PassportViewState["selection"][])("keeps a restored $kind filter visible and clearable without highlights", async selection => {
    const { markup, i18n } = await render("en", { ...initialPassportView, selection });
    const chip = markup.match(/<section class="passport-exploration"[\s\S]*?<\/section>/)?.[0] ?? "";
    expect(chip).toContain(selection.kind === "airport" ? "TAO" : selection.kind === "airline" ? "Cathay Pacific" : "HKG → TAO");
    expect(chip).toContain(i18n.t("passport.closeExploration"));
    expect(markup).not.toContain("passport-highlight");
  });

  it("keeps cancelled records in the archive without an empty highlights block", async () => {
    const { markup, i18n } = await render("en", initialPassportView, { ...flight, cancelled: true });
    expect(markup).toContain('data-flight-id="tao"');
    expect(markup).toContain(i18n.t("status.cancelled"));
    expect(markup).not.toContain("passport-highlight");
  });

  it("describes a restored diverted-route filter with its recorded destination", async () => {
    const { markup } = await render("en", { ...initialPassportView, selection: { kind: "route", origin: "HKG", destination: "TAO" } },
      { ...flight, destination: { iata: "PEK" }, divertedTo: { iata: "TAO" } });
    const chip = markup.match(/<section class="passport-exploration"[\s\S]*?<\/section>/)?.[0] ?? "";
    expect(chip).toContain("HKG → TAO");
    expect(chip).not.toContain("HKG → PEK");
  });
});
