import { lazy, Suspense, useMemo, useState } from "react";
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
  formatServiceDate,
  localizedText,
  type SupportedLocale,
  type DistanceUnit,
} from "@keepraw-fly/core";
import { PageShell } from "../components/PageShell";
import {
  explorePassportFlights,
  type PassportSelection,
} from "../data/passport-exploration";

const PassportRouteMap = lazy(() => import("../components/PassportRouteMap")
  .then((module) => ({ default: module.PassportRouteMap })));

interface PassportPageProps {
  document: KeeprawFlyDocument;
  locale: SupportedLocale;
  distanceUnit: DistanceUnit;
  onAddFlight: () => void;
  onOpenFlight: (flightId: string) => void;
}

function profileNames(document: KeeprawFlyDocument, locale: SupportedLocale, fallbackName: string) {
  const name = document.profile.name;
  if (!name) return { primary: fallbackName, secondary: undefined };
  const preferred = name.primary ?? (locale.startsWith("zh") ? "native" : "romanized");
  const alternate = preferred === "native" ? "romanized" : "native";
  return {
    primary: name[preferred] ?? name[alternate] ?? fallbackName,
    secondary: name[alternate],
  };
}

export function PassportPage({ document, locale, distanceUnit, onAddFlight, onOpenFlight }: PassportPageProps) {
  const { t } = useTranslation();
  const [selectedYear, setSelectedYear] = useState<number | "lifetime">("lifetime");
  const [selection, setSelection] = useState<PassportSelection | null>(null);
  const years = useMemo(() => calculateYearStatistics(document.flights), [document.flights]);
  const selectedYearSummary = selectedYear === "lifetime"
    ? undefined
    : years.find((year) => year.year === selectedYear);
  const flights = useMemo(
    () => selectedYear === "lifetime"
      ? document.flights
      : document.flights.filter((flight) => flight.serviceDate.startsWith(String(selectedYear))),
    [document.flights, selectedYear],
  );
  const stats = useMemo(() => calculatePassportStatistics(flights), [flights]);
  const routes = useMemo(() => buildRouteSegments(flights), [flights]);
  const exploration = useMemo(
    () => selection ? explorePassportFlights(flights, selection) : undefined,
    [flights, selection],
  );
  const names = profileNames(document, locale, t("passport.anonymousFlyer"));
  const longest = flights.find((flight) => flight.id === stats.longestFlight?.flightId);
  const shortest = flights.find((flight) => flight.id === stats.shortestFlight?.flightId);
  const distanceSuffix = distanceUnit === "miles" ? "mi" : "km";

  function routeLabel(flight: typeof longest): string {
    return flight ? `${flight.origin.iata} → ${flight.destination.iata}` : "—";
  }

  function selectYear(year: number | "lifetime") {
    setSelectedYear(year);
    setSelection(null);
  }

  function explorationTitle(current: PassportSelection): string {
    if (current.kind === "airport") {
      const airport = airportByIata.get(current.code);
      return airport ? `${current.code} · ${localizedText(airport.name, locale)}` : current.code;
    }
    if (current.kind === "airline") {
      return `${airlineDisplayName(current.code, locale)} · ${current.code}`;
    }
    return `${current.origin} → ${current.destination}`;
  }

  if (!document.flights.length) {
    return (
      <PageShell className="passport-page">
        <header className="passport-heading">
          <div>
            <p className="eyebrow">{t("passport.flightHistory")}</p>
            <h1>{t("nav.passport")}</h1>
            <p className="passport-holder-name">
              {names.primary}
              {names.secondary && names.secondary !== names.primary ? <span> / {names.secondary}</span> : null}
            </p>
          </div>
        </header>
        <section className="passport-empty" aria-labelledby="passport-empty-title">
          <div>
            <p className="eyebrow">{t("passport.emptyEyebrow")}</p>
            <h2 id="passport-empty-title">{t("passport.emptyTitle")}</h2>
            <p>{t("passport.emptyDescription")}</p>
            <button className="button-primary" type="button" onClick={onAddFlight}>
              {t("actions.addFirstFlight")}
            </button>
          </div>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell className="passport-page">
      <header className="passport-heading">
        <div>
          <p className="eyebrow">
            {selectedYear === "lifetime"
              ? t("passport.flightHistory")
              : t("passport.yearPassport", { year: selectedYear })}
          </p>
          <h1>{t("nav.passport")}</h1>
          <p className="passport-holder-name">
            {names.primary}
            {names.secondary && names.secondary !== names.primary ? <span> / {names.secondary}</span> : null}
          </p>
        </div>
        <div className="view-switcher" aria-label={t("passport.periodLabel")}>
          <button
            type="button"
            aria-pressed={selectedYear === "lifetime"}
            onClick={() => selectYear("lifetime")}
          >
            {t("passport.lifetime")}
          </button>
          {years.map((year) => (
            <button
              key={year.year}
              type="button"
              aria-pressed={selectedYear === year.year}
              onClick={() => selectYear(year.year)}
            >
              {year.year}
            </button>
          ))}
        </div>
      </header>

      <section className="primary-stats" key={`primary-${selectedYear}`} aria-label={t("passport.primaryStats")}>
        <div><strong>{stats.flights}</strong><span>{t("passport.flights")}</span></div>
        <div>
          <strong>{formatDistance(stats.distanceKilometers, locale, distanceUnit)}</strong>
          <span>{t(distanceUnit === "miles" ? "passport.distanceMiles" : "passport.distanceKilometers")}</span>
        </div>
        <div><strong>{formatDuration(stats.durationMinutes, locale)}</strong><span>{t("passport.timeInAir")}</span></div>
      </section>

      <section className="passport-counts" key={`counts-${selectedYear}`} aria-label={t("passport.collectionStats")}>
        {selectedYearSummary ? <>
          <div><span>{t("passport.airlines")}</span><strong>{selectedYearSummary.airlines}</strong></div>
          <div><span>{t("passport.airports")}</span><strong>{selectedYearSummary.airports}</strong></div>
          <div><span>{t("passport.routes")}</span><strong>{selectedYearSummary.routes}</strong></div>
          <div><span>{t("passport.aircraftTypes")}</span><strong>{stats.aircraftTypes}</strong></div>
        </> : <>
          <div><span>{t("passport.countries")}</span><strong>{stats.countries}</strong></div>
          <div><span>{t("passport.airports")}</span><strong>{stats.airports}</strong></div>
          <div><span>{t("passport.airlines")}</span><strong>{stats.airlines}</strong></div>
          <div><span>{t("passport.aircraftTypes")}</span><strong>{stats.aircraftTypes}</strong></div>
        </>}
      </section>

      <Suspense fallback={<section className="route-map route-map-loading" aria-busy="true"><span>{t("app.loading")}</span></section>}>
        <PassportRouteMap
          key={`map-${selectedYear}`}
          routes={routes}
          flights={flights}
          selectedAirport={selection?.kind === "airport" ? selection.code : undefined}
          selectedRoute={selection?.kind === "route" ? selection : undefined}
          onSelectAirport={(code) => setSelection({ kind: "airport", code })}
          onSelectRoute={(origin, destination) => setSelection({ kind: "route", origin, destination })}
        />
      </Suspense>

      <section className="passport-highlights" key={`highlights-${selectedYear}`} aria-labelledby="highlights-title">
        <div className="section-heading">
          <p className="eyebrow">{t("passport.patterns")}</p>
          <h2 id="highlights-title">{t("passport.highlights")}</h2>
        </div>
        <dl className="highlight-list">
          <div><dt>{t("passport.mostFlownAirline")}</dt><dd>{stats.mostFlownAirline ? <button type="button" onClick={() => setSelection({ kind: "airline", code: stats.mostFlownAirline!.code })}><span>{airlineDisplayName(stats.mostFlownAirline.code, locale)}</span><small>{t("passport.flightFrequency", { count: stats.mostFlownAirline.count })}</small><span aria-hidden="true">→</span></button> : "—"}</dd></div>
          <div><dt>{t("passport.mostVisitedAirport")}</dt><dd>{stats.mostVisitedAirport ? <button type="button" onClick={() => setSelection({ kind: "airport", code: stats.mostVisitedAirport!.code })}><span>{airportByIata.get(stats.mostVisitedAirport.code) ? localizedText(airportByIata.get(stats.mostVisitedAirport.code)!.name, locale) : stats.mostVisitedAirport.code}</span><small>{stats.mostVisitedAirport.code} · {t("passport.visitFrequency", { count: stats.mostVisitedAirport.count })}</small><span aria-hidden="true">→</span></button> : "—"}</dd></div>
          <div><dt>{t("passport.longestFlight")}</dt><dd>{longest ? <button type="button" onClick={() => setSelection({ kind: "route", origin: longest.origin.iata, destination: longest.destination.iata })}><span>{routeLabel(longest)}</span><small>{distanceForFlight(longest) ? `${formatDistance(distanceForFlight(longest)!, locale, distanceUnit)} ${distanceSuffix}` : ""}</small><span aria-hidden="true">→</span></button> : "—"}</dd></div>
          <div><dt>{t("passport.shortestFlight")}</dt><dd>{shortest ? <button type="button" onClick={() => setSelection({ kind: "route", origin: shortest.origin.iata, destination: shortest.destination.iata })}><span>{routeLabel(shortest)}</span><small>{distanceForFlight(shortest) ? `${formatDistance(distanceForFlight(shortest)!, locale, distanceUnit)} ${distanceSuffix}` : ""}</small><span aria-hidden="true">→</span></button> : "—"}</dd></div>
        </dl>
      </section>

      <section className="year-history" aria-labelledby="year-history-title">
        <div className="section-heading">
          <p className="eyebrow">{t("passport.byYear")}</p>
          <h2 id="year-history-title">{t("passport.yearlyHistory")}</h2>
        </div>
        <div className="year-list">
          {years.map((year) => (
            <button
              type="button"
              key={year.year}
              aria-pressed={selectedYear === year.year}
              onClick={() => selectYear(year.year)}
            >
              <strong>{year.year}</strong>
              <span>{t("flights.count", { count: year.flights })}</span>
              <span>{formatDistance(year.distanceKilometers, locale, distanceUnit)} {distanceSuffix}</span>
              <span aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      </section>

      {selection && exploration ? (
        <section className="passport-exploration" aria-labelledby="passport-exploration-title" aria-live="polite">
          <header className="passport-exploration-heading">
            <div>
              <p className="eyebrow">{t(`passport.explore.${selection.kind}`)}</p>
              <h2 id="passport-exploration-title">{explorationTitle(selection)}</h2>
            </div>
            <button className="passport-exploration-close" type="button" onClick={() => setSelection(null)}>
              {t("passport.closeExploration")}
            </button>
          </header>
          <dl className="passport-exploration-summary">
            <div><dt>{t("passport.relatedFlights")}</dt><dd>{t("flights.count", { count: exploration.flights.length })}</dd></div>
            <div><dt>{t(selection.kind === "airport" ? "passport.firstVisited" : "passport.firstFlown")}</dt><dd>{exploration.firstServiceDate.slice(0, 4)}</dd></div>
            <div><dt>{t(selection.kind === "airport" ? "passport.lastVisited" : "passport.lastFlown")}</dt><dd>{exploration.lastServiceDate.slice(0, 4)}</dd></div>
          </dl>
          <div className="passport-related-flights" aria-label={t("passport.relatedFlightRecords")}>
            {exploration.flights.map((flight) => (
              <button type="button" key={flight.id} onClick={() => onOpenFlight(flight.id)}>
                <time dateTime={flight.serviceDate}>{formatServiceDate(flight.serviceDate, locale, { year: "numeric", month: "short", day: "numeric" })}</time>
                <strong>{flight.origin.iata}<span aria-hidden="true"> → </span>{flight.destination.iata}</strong>
                <span>{flight.flightNumber}</span>
                <span aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}
