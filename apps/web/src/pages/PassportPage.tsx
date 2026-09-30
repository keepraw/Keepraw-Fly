import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlight, KeeprawFlyDocument } from "@keepraw-fly/schema";
import {
  airlineDisplayName,
  arrivalDelayMinutes,
  airportByIata,
  buildRouteSegments,
  calculatePassportStatistics,
  calculateYearStatistics,
  distanceForFlight,
  formatDistance,
  formatDuration,
  groupFlightsByYear,
  localizedText,
  type DistanceUnit,
  type SupportedLocale,
  type TimeFormat,
} from "@keepraw-fly/core";
import { FlightRow } from "../components/FlightRow";
import { PageShell } from "../components/PageShell";
import { passportVisibleFlights, type PassportSelection, type PassportViewState } from "../data/passport-exploration";

const PassportRouteMap = lazy(() => import("../components/PassportRouteMap")
  .then((module) => ({ default: module.PassportRouteMap })));

interface PassportPageProps {
  document: KeeprawFlyDocument;
  locale: SupportedLocale;
  distanceUnit: DistanceUnit;
  timeFormat: TimeFormat;
  onAddFlight: () => void;
  onOpenImport: () => void;
  onOpenFlight: (flightId: string) => void;
  view: PassportViewState;
  onViewChange: (view: PassportViewState) => void;
}

export function PassportPage({ document, locale, distanceUnit, timeFormat, onAddFlight, onOpenImport, onOpenFlight, view, onViewChange }: PassportPageProps) {
  const { t } = useTranslation();
  const { year: selectedYear, query, selection } = view;
  const setSelection = (selection: PassportSelection | null) => onViewChange({ ...view, selection, flightId: null });
  const setQuery = (query: string) => onViewChange({ ...view, query, flightId: null });
  const [hoveredFlight, setHoveredFlight] = useState<KeeprawFlight | null>(null);
  const [showDesktopMap, setShowDesktopMap] = useState(() =>
    typeof window !== "undefined" && Boolean(window.matchMedia?.("(min-width: 761px)").matches));
  useEffect(() => {
    const media = window.matchMedia?.("(min-width: 761px)");
    if (!media) return;
    const update = () => setShowDesktopMap(media.matches);
    media.addEventListener("change", update);
    update();
    return () => media.removeEventListener("change", update);
  }, []);
  const years = useMemo(() => calculateYearStatistics(document.flights), [document.flights]);
  const flights = useMemo(() => passportVisibleFlights(document.flights, view), [document.flights, view]);
  const groups = useMemo(() => groupFlightsByYear(flights), [flights]);
  const stats = useMemo(() => calculatePassportStatistics(flights), [flights]);
  const delays = useMemo(() => flights.flatMap((flight) => {
    if (flight.cancelled) return [];
    const minutes = arrivalDelayMinutes(flight);
    return minutes !== null && minutes > 0 ? [{ flight, minutes }] : [];
  }), [flights]);
  const worstDelay = delays.reduce<(typeof delays)[number] | null>((worst, item) => !worst || item.minutes > worst.minutes ? item : worst, null);
  const routes = useMemo(() => buildRouteSegments(flights), [flights]);
  const longest = flights.find((flight) => flight.id === stats.longestFlight?.flightId);
  const shortest = flights.find((flight) => flight.id === stats.shortestFlight?.flightId);
  const distanceKey = distanceUnit === "miles" ? "passport.distanceMiles" : "passport.distanceKilometers";
  const selectedFlight = flights.find((flight) => flight.id === view.flightId);
  const highlightedFlight = selectedFlight ?? hoveredFlight;
  const highlightedRoute = highlightedFlight
    ? { origin: highlightedFlight.origin.iata, destination: (highlightedFlight.divertedTo ?? highlightedFlight.destination).iata }
    : undefined;

  function selectFlight(flight: KeeprawFlight, scroll = false) {
    onViewChange({ ...view, flightId: flight.id });
    if (scroll) window.requestAnimationFrame(() => {
      const row = [...window.document.querySelectorAll<HTMLElement>(".flight-record")].find((row) => row.dataset.flightId === flight.id);
      row?.scrollIntoView({ block: "nearest", inline: "nearest" });
      row?.querySelector<HTMLButtonElement>(".flight-row")?.focus({ preventScroll: true });
    });
  }

  useEffect(() => {
    if (!view.flightId) return;
    const row = [...window.document.querySelectorAll<HTMLElement>(".flight-record")].find((row) => row.dataset.flightId === view.flightId);
    row?.scrollIntoView({ block: "nearest" });
  }, []);

  function routeLabel(flight: typeof longest): string {
    return flight ? `${flight.origin.iata} → ${flight.destination.iata}` : "—";
  }

  function selectYear(year: number | "lifetime") {
    onViewChange({ year, query: "", selection: null, flightId: null });
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
        <div className="passport-period view-switcher" role="group" aria-label={t("passport.periodLabel")}>
          <button type="button" aria-pressed={selectedYear === "lifetime"} onClick={() => selectYear("lifetime")}>{t("passport.lifetime")}</button>
          {years.map((year) => <button key={year.year} type="button" aria-pressed={selectedYear === year.year} onClick={() => selectYear(year.year)}>{year.year}</button>)}
        </div>
        <aside className="passport-visual" aria-label={t("passport.primaryStats")}>
          <div className="passport-visual-sticky">
            <p className="passport-scope" aria-live="polite">{t(selectedYear === "lifetime" ? "passport.scopeAll" : "passport.scopeYear", { year: selectedYear, count: flights.length })}</p>
            {showDesktopMap ? <Suspense fallback={<section className="route-map route-map-loading" aria-busy="true"><span>{t("app.loading")}</span></section>}>
              <PassportRouteMap
                key={`map-${selectedYear}`}
                routes={routes}
                flights={flights}
                selectedAirport={selection?.kind === "airport" ? selection.code : undefined}
                selectedRoute={selection?.kind === "route" ? selection : undefined}
                highlightedRoute={highlightedRoute}
                onSelectAirport={(code) => {
                  const flight = flights.find((flight) => flight.origin.iata === code || (flight.divertedTo ?? flight.destination).iata === code);
                  if (flight) selectFlight(flight, true);
                }}
                onSelectRoute={(origin, destination) => {
                  const flight = flights.find((flight) => flight.origin.iata === origin && (flight.divertedTo ?? flight.destination).iata === destination);
                  if (flight) selectFlight(flight, true);
                }}
              />
            </Suspense> : null}

            <section className="primary-stats" key={`primary-${selectedYear}`} aria-label={t("passport.primaryStats")}>
              <div><span>{t("passport.flights")}</span><strong>{stats.flights.toLocaleString(locale)}</strong></div>
              <div><span>{t("passport.distance")}</span><strong>{t(distanceKey, { value: formatDistance(stats.distanceKilometers, locale, distanceUnit) })}</strong></div>
              <div><span>{t("passport.timeInAir")}</span><strong>{formatDuration(stats.durationMinutes, locale)}</strong></div>
              <div><span>{t("passport.totalDelay")}</span><strong>{stats.totalDelayMinutes === null ? "—" : formatDuration(stats.totalDelayMinutes, locale)}</strong><small>{t("passport.delayBasedOnArrivals")}</small></div>
            </section>

            <section className="passport-counts" key={`counts-${selectedYear}`} aria-label={t("passport.collectionStats")}>
              <div><span>{t("passport.countries")}</span><strong>{stats.countries}</strong></div>
              <div><span>{t("passport.airports")}</span><strong>{stats.airports}</strong></div>
              <div><span>{t("passport.airlines")}</span><strong>{stats.airlines}</strong></div>
              <div><span>{t("passport.aircraftTypes")}</span><strong>{stats.aircraftTypes}</strong></div>
            </section>

            <section className="passport-mobile-summary" id="passport-summary" key={`mobile-summary-${selectedYear}`} aria-label={t("passport.primaryStats")}>
              <p className="passport-panel-kicker">KEEPRAW FLY <span> / </span> {t("passport.panelTitle")}</p>
              <div className="passport-mobile-hero"><strong>{stats.flights.toLocaleString(locale)}</strong><span>{t("passport.flights")}</span></div>
              <div className="passport-mobile-journey">
                <div><span>{t("passport.distance")}</span><strong>{t(distanceKey, { value: formatDistance(stats.distanceKilometers, locale, distanceUnit) })}</strong></div>
                <div><span>{t("passport.timeInAir")}</span><strong>{formatDuration(stats.durationMinutes, locale)}</strong></div>
              </div>
              <div className="passport-mobile-support" aria-label={t("passport.collectionStats")}>
                <span>{t("passport.countries")}: {stats.countries.toLocaleString(locale)}</span>
                <span>{t("passport.airports")}: {stats.airports.toLocaleString(locale)}</span>
                <span>{t("passport.airlines")}: {stats.airlines.toLocaleString(locale)}</span>
                <span>{t("passport.aircraftTypes")}: {stats.aircraftTypes.toLocaleString(locale)}</span>
              </div>
            </section>

            <section className="passport-mobile-panel passport-delay-panel" aria-labelledby="passport-delay-title">
              <h2 id="passport-delay-title">{t("passport.totalDelay")}</h2>
              <div className="passport-delay-main"><strong>{stats.totalDelayMinutes === null ? "—" : formatDuration(stats.totalDelayMinutes, locale)}</strong></div>
              <p>{t("passport.delayBasedOnArrivals")}</p>
              {stats.totalDelayMinutes === null ? <p>{t("passport.delayUnavailable")}</p> : <>
                {worstDelay ? <p className="passport-delay-longest"><span>{t("passport.longestDelay")}</span><strong>{worstDelay.flight.flightNumber} · {formatDuration(worstDelay.minutes, locale)}</strong></p> : null}
              </>}
            </section>

            <section className="passport-mobile-panel passport-network-panel" aria-labelledby="passport-network-title">
              <h2 id="passport-network-title">{t("passport.networkPanelTitle")}</h2>
              <div className="passport-network-facts"><div><strong>{stats.countries.toLocaleString(locale)}</strong><span>{t("passport.countries")}</span></div><div><strong>{stats.airports.toLocaleString(locale)}</strong><span>{t("passport.airports")}</span></div></div>
              {stats.mostVisitedAirport ? <p><span>{t("passport.mostVisitedAirport")}</span><strong>{airportByIata.get(stats.mostVisitedAirport.code) ? localizedText(airportByIata.get(stats.mostVisitedAirport.code)!.name, locale) : stats.mostVisitedAirport.code}</strong></p> : null}
            </section>

            <div className="passport-highlights" key={`highlights-${selectedYear}`}>
              <h2 className="passport-mobile-section-title">{t("passport.highlights")}</h2>
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
          <header className="archive-heading" id="flight-archive">
            <h2 className="passport-mobile-section-title">{t("passport.pastFlights")}</h2>
            <div className="archive-controls">
              <button className="add-flight-button" type="button" onClick={onAddFlight}><span aria-hidden="true">＋</span>{t("actions.addFlight")}</button>
              <button className="passport-import-button" type="button" onClick={onOpenImport}>{t("actions.importFlights")}</button>
            </div>
            <div className="search-field passport-search-field">
              <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
              <label className="sr-only" htmlFor="passport-flight-search">{t("flights.searchLabel")}</label>
              <input id="passport-flight-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("flights.searchPlaceholder")} autoComplete="off" />
              {query ? <button className="clear-search" type="button" onClick={() => setQuery("")} aria-label={t("actions.clearSearch")}>×</button> : null}
            </div>
          </header>

          <div className="passport-archive-scroll">
            {selection ? (
              <section className="passport-exploration" aria-labelledby="passport-exploration-title" aria-live="polite">
                <span id="passport-exploration-title">{t(`passport.explore.${selection.kind}`)} · {explorationTitle(selection)}</span>
                <button className="passport-exploration-close" type="button" onClick={() => setSelection(null)}>{t("passport.closeExploration")} ×</button>
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
                      <FlightRow key={flight.id} flight={flight} locale={locale} timeFormat={timeFormat}
                        onOpen={() => { onViewChange({ ...view, flightId: flight.id }); onOpenFlight(flight.id); }}
                        onSelect={showDesktopMap ? () => selectFlight(flight) : undefined}
                        selected={view.flightId === flight.id} onHoverChange={setHoveredFlight} revealIndex={index} />
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
