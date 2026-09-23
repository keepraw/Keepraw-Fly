import { lazy, Suspense, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlight, KeeprawFlyDocument } from "@keepraw-fly/schema";
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
  groupFlightsByYear,
  localizedText,
  searchFlights,
  type DistanceUnit,
  type SupportedLocale,
  type TimeFormat,
} from "@keepraw-fly/core";
import { FlightRow } from "../components/FlightRow";
import { PageShell } from "../components/PageShell";
import { explorePassportFlights, type PassportSelection } from "../data/passport-exploration";

const PassportRouteMap = lazy(() => import("../components/PassportRouteMap")
  .then((module) => ({ default: module.PassportRouteMap })));

interface PassportPageProps {
  document: KeeprawFlyDocument;
  locale: SupportedLocale;
  distanceUnit: DistanceUnit;
  timeFormat: TimeFormat;
  onAddFlight: () => void;
  onOpenFlight: (flightId: string) => void;
}

export function PassportPage({ document, locale, distanceUnit, timeFormat, onAddFlight, onOpenFlight }: PassportPageProps) {
  const { t } = useTranslation();
  const [selectedYear, setSelectedYear] = useState<number | "lifetime">("lifetime");
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<PassportSelection | null>(null);
  const [hoveredFlight, setHoveredFlight] = useState<KeeprawFlight | null>(null);
  const years = useMemo(() => calculateYearStatistics(document.flights), [document.flights]);
  const flights = useMemo(
    () => selectedYear === "lifetime"
      ? document.flights
      : document.flights.filter((flight) => flight.serviceDate.startsWith(String(selectedYear))),
    [document.flights, selectedYear],
  );
  const groups = useMemo(() => groupFlightsByYear(searchFlights(flights, query)), [flights, query]);
  const stats = useMemo(() => calculatePassportStatistics(flights), [flights]);
  const routes = useMemo(() => buildRouteSegments(flights), [flights]);
  const exploration = useMemo(
    () => selection ? explorePassportFlights(flights, selection) : undefined,
    [flights, selection],
  );
  const longest = flights.find((flight) => flight.id === stats.longestFlight?.flightId);
  const shortest = flights.find((flight) => flight.id === stats.shortestFlight?.flightId);
  const distanceKey = distanceUnit === "miles" ? "passport.distanceMiles" : "passport.distanceKilometers";
  const highlightedRoute = hoveredFlight
    ? { origin: hoveredFlight.origin.iata, destination: hoveredFlight.destination.iata }
    : undefined;

  function routeLabel(flight: typeof longest): string {
    return flight ? `${flight.origin.iata} → ${flight.destination.iata}` : "—";
  }

  function selectYear(year: number | "lifetime") {
    setSelectedYear(year);
    setSelection(null);
    setHoveredFlight(null);
  }

  function explorationTitle(current: PassportSelection): string {
    if (current.kind === "airport") {
      const airport = airportByIata.get(current.code);
      return airport ? `${current.code} · ${localizedText(airport.name, locale)}` : current.code;
    }
    if (current.kind === "airline") return `${airlineDisplayName(current.code, locale)} · ${current.code}`;
    return `${current.origin} → ${current.destination}`;
  }

  if (!document.flights.length) {
    return (
      <PageShell className="passport-page passport-empty-page">
        <section className="passport-empty" aria-labelledby="passport-empty-title">
          <div>
            <p className="eyebrow">{t("passport.emptyEyebrow")}</p>
            <h2 id="passport-empty-title">{t("passport.emptyTitle")}</h2>
            <p>{t("passport.emptyDescription")}</p>
            <button className="button-primary" type="button" onClick={onAddFlight}>{t("actions.addFirstFlight")}</button>
          </div>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell className="passport-page passport-archive-page">
      <div className="passport-layout">
        <aside className="passport-visual" aria-label={t("passport.primaryStats")}>
          <div className="passport-visual-sticky">
            <Suspense fallback={<section className="route-map route-map-loading" aria-busy="true"><span>{t("app.loading")}</span></section>}>
              <PassportRouteMap
                key={`map-${selectedYear}`}
                routes={routes}
                flights={flights}
                selectedAirport={selection?.kind === "airport" ? selection.code : undefined}
                selectedRoute={selection?.kind === "route" ? selection : undefined}
                highlightedRoute={highlightedRoute}
                onSelectAirport={(code) => setSelection({ kind: "airport", code })}
                onSelectRoute={(origin, destination) => setSelection({ kind: "route", origin, destination })}
              />
            </Suspense>

            <section className="primary-stats" key={`primary-${selectedYear}`} aria-label={t("passport.primaryStats")}>
              <div><span>{t("passport.flights")}</span><strong>{stats.flights.toLocaleString(locale)}</strong></div>
              <div><span>{t("passport.distance")}</span><strong>{t(distanceKey, { value: formatDistance(stats.distanceKilometers, locale, distanceUnit) })}</strong></div>
              <div><span>{t("passport.timeInAir")}</span><strong>{formatDuration(stats.durationMinutes, locale)}</strong></div>
              <div><span>{t("passport.totalDelay")}</span><strong>{stats.totalDelayMinutes === null ? "—" : formatDuration(stats.totalDelayMinutes, locale)}</strong></div>
            </section>

            <section className="passport-counts" key={`counts-${selectedYear}`} aria-label={t("passport.collectionStats")}>
              <div><span>{t("passport.countries")}</span><strong>{stats.countries}</strong></div>
              <div><span>{t("passport.airports")}</span><strong>{stats.airports}</strong></div>
              <div><span>{t("passport.airlines")}</span><strong>{stats.airlines}</strong></div>
              <div><span>{t("passport.aircraftTypes")}</span><strong>{stats.aircraftTypes}</strong></div>
            </section>

            <div className="passport-highlights" key={`highlights-${selectedYear}`}>
              <div className="highlight-list">
                {stats.mostFlownAirline ? <button className="passport-highlight" type="button" onClick={() => setSelection({ kind: "airline", code: stats.mostFlownAirline!.code })}>
                  <span>{t("passport.mostFlownAirline")}</span>
                  <strong>{airlineDisplayName(stats.mostFlownAirline.code, locale)}</strong>
                  <small>{t("passport.flightFrequency", { count: stats.mostFlownAirline.count })}</small>
                </button> : <div className="passport-highlight"><span>{t("passport.mostFlownAirline")}</span><strong>—</strong><small aria-hidden="true">&nbsp;</small></div>}
                {stats.mostVisitedAirport ? <button className="passport-highlight" type="button" onClick={() => setSelection({ kind: "airport", code: stats.mostVisitedAirport!.code })}>
                  <span>{t("passport.mostVisitedAirport")}</span>
                  <strong>{airportByIata.get(stats.mostVisitedAirport.code) ? localizedText(airportByIata.get(stats.mostVisitedAirport.code)!.name, locale) : stats.mostVisitedAirport.code}</strong>
                  <small>{t("passport.visitFrequency", { count: stats.mostVisitedAirport.count })}</small>
                </button> : <div className="passport-highlight"><span>{t("passport.mostVisitedAirport")}</span><strong>—</strong><small aria-hidden="true">&nbsp;</small></div>}
                {longest ? <button className="passport-highlight" type="button" onClick={() => setSelection({ kind: "route", origin: longest.origin.iata, destination: longest.destination.iata })}>
                  <span>{t("passport.longestFlight")}</span>
                  <strong className="highlight-route">{routeLabel(longest)}</strong>
                  <small>{distanceForFlight(longest) ? t(distanceKey, { value: formatDistance(distanceForFlight(longest)!, locale, distanceUnit) }) : ""}</small>
                </button> : <div className="passport-highlight"><span>{t("passport.longestFlight")}</span><strong>—</strong><small aria-hidden="true">&nbsp;</small></div>}
                {shortest ? <button className="passport-highlight" type="button" onClick={() => setSelection({ kind: "route", origin: shortest.origin.iata, destination: shortest.destination.iata })}>
                  <span>{t("passport.shortestFlight")}</span>
                  <strong className="highlight-route">{routeLabel(shortest)}</strong>
                  <small>{distanceForFlight(shortest) ? t(distanceKey, { value: formatDistance(distanceForFlight(shortest)!, locale, distanceUnit) }) : ""}</small>
                </button> : <div className="passport-highlight"><span>{t("passport.shortestFlight")}</span><strong>—</strong><small aria-hidden="true">&nbsp;</small></div>}
              </div>
            </div>
          </div>
        </aside>

        <section className="passport-archive">
          <header className="archive-heading">
            <div className="archive-controls">
              <div className="view-switcher" role="group" aria-label={t("passport.periodLabel")}>
                <button type="button" aria-pressed={selectedYear === "lifetime"} onClick={() => selectYear("lifetime")}>{t("passport.lifetime")}</button>
                {years.map((year) => (
                  <button key={year.year} type="button" aria-pressed={selectedYear === year.year} onClick={() => selectYear(year.year)}>{year.year}</button>
                ))}
              </div>
              <button className="add-flight-button" type="button" onClick={onAddFlight}><span aria-hidden="true">＋</span>{t("actions.addFlight")}</button>
            </div>
            <div className="search-field passport-search-field">
              <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
              <label className="sr-only" htmlFor="passport-flight-search">{t("flights.searchLabel")}</label>
              <input id="passport-flight-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("flights.searchPlaceholder")} autoComplete="off" />
              {query ? <button className="clear-search" type="button" onClick={() => setQuery("")} aria-label={t("actions.clearSearch")}>×</button> : null}
            </div>
          </header>

          <div className="passport-archive-scroll">
            {selection && exploration ? (
              <section className="passport-exploration" aria-labelledby="passport-exploration-title" aria-live="polite">
                <header className="passport-exploration-heading">
                  <div><p className="eyebrow">{t(`passport.explore.${selection.kind}`)}</p><h2 id="passport-exploration-title">{explorationTitle(selection)}</h2></div>
                  <button className="passport-exploration-close" type="button" onClick={() => setSelection(null)}>{t("passport.closeExploration")}</button>
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
                      <span>{flight.flightNumber}</span><span aria-hidden="true">→</span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {groups.length ? (
              <div className="flight-groups" aria-live="polite">
              {groups.map((group, groupIndex) => (
                <section className="flight-year" key={group.year}>
                  <div className="year-heading">
                    {groupIndex === 0 ? <h1>{group.year}</h1> : <h2>{group.year}</h2>}
                    <span>{t("flights.count", { count: group.flights.length })}</span>
                  </div>
                  <div className="flight-list">
                    {group.flights.map((flight, index) => (
                      <FlightRow key={flight.id} flight={flight} locale={locale} timeFormat={timeFormat} onOpen={() => onOpenFlight(flight.id)} onHoverChange={setHoveredFlight} revealIndex={index} />
                    ))}
                  </div>
                </section>
              ))}
              </div>
            ) : (
              <div className="no-results" role="status"><h2>{t("flights.noResultsTitle")}</h2><p>{t("flights.noResultsDescription", { query })}</p></div>
            )}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
