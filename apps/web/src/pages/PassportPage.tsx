import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import {
  airlineDisplayName,
  airportByIata,
  buildRouteSegments,
  calculatePassportStatistics,
  calculateYearStatistics,
  distanceForFlight,
  formatDistance,
  formatDuration,
  type SupportedLocale,
  type DistanceUnit,
} from "@keepraw-fly/core";
import { PassportMapPlaceholder } from "../components/PassportMapPlaceholder";

interface PassportPageProps {
  document: KeeprawFlyDocument;
  locale: SupportedLocale;
  distanceUnit: DistanceUnit;
}

function profileNames(document: KeeprawFlyDocument, locale: SupportedLocale) {
  const name = document.profile.name;
  if (!name) return { primary: "Keepraw Flyer", secondary: undefined };
  const preferred = name.primary ?? (locale === "zh-CN" ? "native" : "romanized");
  const alternate = preferred === "native" ? "romanized" : "native";
  return {
    primary: name[preferred] ?? name[alternate] ?? "Keepraw Flyer",
    secondary: name[alternate],
  };
}

export function PassportPage({ document, locale, distanceUnit }: PassportPageProps) {
  const { t } = useTranslation();
  const [selectedYear, setSelectedYear] = useState<number | "lifetime">("lifetime");
  const years = useMemo(() => calculateYearStatistics(document.flights), [document.flights]);
  const flights = useMemo(
    () => selectedYear === "lifetime"
      ? document.flights
      : document.flights.filter((flight) => flight.serviceDate.startsWith(String(selectedYear))),
    [document.flights, selectedYear],
  );
  const stats = useMemo(() => calculatePassportStatistics(flights), [flights]);
  const routes = useMemo(() => buildRouteSegments(flights), [flights]);
  const names = profileNames(document, locale);
  const longest = flights.find((flight) => flight.id === stats.longestFlight?.flightId);
  const shortest = flights.find((flight) => flight.id === stats.shortestFlight?.flightId);
  const distanceSuffix = distanceUnit === "miles" ? "mi" : "km";

  function routeLabel(flight: typeof longest): string {
    return flight ? `${flight.origin.iata} → ${flight.destination.iata}` : "—";
  }

  return (
    <main className="passport-page" id="main-content">
      <header className="passport-heading">
        <div>
          <p className="eyebrow">{t("passport.flightHistory")}</p>
          <h1>{names.primary}</h1>
          {names.secondary && names.secondary !== names.primary ? <p>{names.secondary}</p> : null}
        </div>
        <div className="view-switcher" aria-label={t("passport.periodLabel")}>
          <button
            type="button"
            aria-pressed={selectedYear === "lifetime"}
            onClick={() => setSelectedYear("lifetime")}
          >
            {t("passport.lifetime")}
          </button>
          {years.map((year) => (
            <button
              key={year.year}
              type="button"
              aria-pressed={selectedYear === year.year}
              onClick={() => setSelectedYear(year.year)}
            >
              {year.year}
            </button>
          ))}
        </div>
      </header>

      <section className="primary-stats" aria-label={t("passport.primaryStats")}>
        <div><strong>{stats.flights}</strong><span>{t("passport.flights")}</span></div>
        <div>
          <strong>{formatDistance(stats.distanceKilometers, locale, distanceUnit)}</strong>
          <span>{t(distanceUnit === "miles" ? "passport.distanceMiles" : "passport.distanceKilometers")}</span>
        </div>
        <div><strong>{formatDuration(stats.durationMinutes)}</strong><span>{t("passport.timeInAir")}</span></div>
      </section>

      <section className="passport-counts" aria-label={t("passport.collectionStats")}>
        <div><span>{t("passport.countries")}</span><strong>{stats.countries}</strong></div>
        <div><span>{t("passport.airports")}</span><strong>{stats.airports}</strong></div>
        <div><span>{t("passport.airlines")}</span><strong>{stats.airlines}</strong></div>
        <div><span>{t("passport.aircraftTypes")}</span><strong>{stats.aircraftTypes}</strong></div>
      </section>

      <PassportMapPlaceholder routes={routes} />

      <section className="passport-highlights" aria-labelledby="highlights-title">
        <div className="section-heading">
          <p className="eyebrow">{t("passport.patterns")}</p>
          <h2 id="highlights-title">{t("passport.highlights")}</h2>
        </div>
        <dl className="highlight-list">
          <div><dt>{t("passport.mostFlownAirline")}</dt><dd>{stats.mostFlownAirline ? airlineDisplayName(stats.mostFlownAirline.code, locale) : "—"}</dd></div>
          <div><dt>{t("passport.mostVisitedAirport")}</dt><dd>{stats.mostVisitedAirport ? (airportByIata.get(stats.mostVisitedAirport.code)?.name[locale] ?? stats.mostVisitedAirport.code) : "—"}</dd></div>
          <div><dt>{t("passport.longestFlight")}</dt><dd>{routeLabel(longest)}<small>{longest && distanceForFlight(longest) ? `${formatDistance(distanceForFlight(longest)!, locale, distanceUnit)} ${distanceSuffix}` : ""}</small></dd></div>
          <div><dt>{t("passport.shortestFlight")}</dt><dd>{routeLabel(shortest)}<small>{shortest && distanceForFlight(shortest) ? `${formatDistance(distanceForFlight(shortest)!, locale, distanceUnit)} ${distanceSuffix}` : ""}</small></dd></div>
        </dl>
      </section>

      <section className="year-history" aria-labelledby="year-history-title">
        <div className="section-heading">
          <p className="eyebrow">{t("passport.byYear")}</p>
          <h2 id="year-history-title">{t("passport.yearlyHistory")}</h2>
        </div>
        <div className="year-list">
          {years.map((year) => (
            <button type="button" key={year.year} onClick={() => setSelectedYear(year.year)}>
              <strong>{year.year}</strong>
              <span>{t("flights.count", { count: year.flights })}</span>
              <span>{formatDistance(year.distanceKilometers, locale, distanceUnit)} {distanceSuffix}</span>
              <span aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
