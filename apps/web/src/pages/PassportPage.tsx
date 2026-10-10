import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlight, KeeprawFlyDocument } from "@keepraw-fly/schema";
import {
  airlineDisplayName,
  arrivalDelayMinutes,
  airportByIata,
  buildRouteSegments,
  calculatePassportHighlights,
  calculatePassportStatistics,
  calculateYearStatistics,
  distanceForFlight,
  formatDistance,
  formatDuration,
  flightDuration,
  groupFlightsByYear,
  localizedText,
  type DistanceUnit,
  type SupportedLocale,
  type TimeFormat,
} from "@keepraw-fly/core";
import { FlightRow } from "../components/FlightRow";
import { PageShell } from "../components/PageShell";
import { StatisticValue } from "../typography/StatisticValue";
import type { Appearance } from "../storage/types";
import type { SolarMode } from "../globe/globe-solar";
import {
  passportVisibleFlights,
  type PassportSelection,
  type PassportViewState,
} from "../data/passport-exploration";

const PassportGlobe = lazy(() =>
  import("../globe/PassportGlobe").then((module) => ({
    default: module.PassportGlobe,
  })),
);

interface PassportPageProps {
  document: KeeprawFlyDocument;
  locale: SupportedLocale;
  distanceUnit: DistanceUnit;
  timeFormat: TimeFormat;
  appearance: Appearance;
  solarMode: SolarMode;
  onAddFlight: () => void;
  onOpenImport: () => void;
  onOpenFlight: (flightId: string) => void;
  view: PassportViewState;
  onViewChange: (view: PassportViewState) => void;
}

export function PassportPage({
  document,
  locale,
  distanceUnit,
  timeFormat,
  appearance,
  solarMode,
  onAddFlight,
  onOpenImport,
  onOpenFlight,
  view,
  onViewChange,
}: PassportPageProps) {
  const { t } = useTranslation();
  const { year: selectedYear, query, selection } = view;
  const setSelection = (selection: PassportSelection | null) =>
    onViewChange({ ...view, selection, flightId: null, scrollFlightId: null });
  const setQuery = (query: string) =>
    onViewChange({ ...view, query, flightId: null, scrollFlightId: null });
  const [hoveredFlight, setHoveredFlight] = useState<KeeprawFlight | null>(
    null,
  );
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window !== "undefined" &&
      Boolean(window.matchMedia?.("(min-width: 761px)").matches),
  );
  useEffect(() => {
    const media = window.matchMedia?.("(min-width: 761px)");
    if (!media) return;
    const update = () => setIsDesktop(media.matches);
    media.addEventListener("change", update);
    update();
    return () => media.removeEventListener("change", update);
  }, []);
  const years = useMemo(
    () => calculateYearStatistics(document.flights),
    [document.flights],
  );
  const flights = useMemo(
    () => passportVisibleFlights(document.flights, view),
    [document.flights, view],
  );
  const groups = useMemo(() => groupFlightsByYear(flights), [flights]);
  const stats = useMemo(() => calculatePassportStatistics(flights), [flights]);
  const highlights = useMemo(
    () => calculatePassportHighlights(flights),
    [flights],
  );
  const delayYears = highlights.annualArrivalDelays.slice(-3);
  const maximumDelay = Math.max(
    0,
    ...delayYears.map((year) => year.minutes ?? 0),
  );
  const delays = useMemo(
    () =>
      flights.flatMap((flight) => {
        if (flight.cancelled) return [];
        const minutes = arrivalDelayMinutes(flight);
        return minutes !== null && minutes > 0 ? [{ flight, minutes }] : [];
      }),
    [flights],
  );
  const worstDelay = delays.reduce<(typeof delays)[number] | null>(
    (worst, item) => (!worst || item.minutes > worst.minutes ? item : worst),
    null,
  );
  const routes = useMemo(() => buildRouteSegments(flights), [flights]);
  const longest = flights.find(
    (flight) => flight.id === stats.longestFlight?.flightId,
  );
  const duration = formatDuration(stats.durationMinutes, locale);
  const arrivalDelay =
    stats.totalDelayMinutes === null
      ? "—"
      : formatDuration(stats.totalDelayMinutes, locale);
  const distanceKey =
    distanceUnit === "miles"
      ? "passport.distanceMiles"
      : "passport.distanceKilometers";
  const selectedFlight = flights.find((flight) => flight.id === view.flightId);
  const highlightedFlight = selectedFlight ?? hoveredFlight;
  const highlightedRoute = highlightedFlight
    ? {
        origin: highlightedFlight.origin.iata,
        destination: (
          highlightedFlight.divertedTo ?? highlightedFlight.destination
        ).iata,
      }
    : undefined;

  function selectFlight(flight: KeeprawFlight, scroll = false) {
    onViewChange({ ...view, flightId: flight.id, scrollFlightId: flight.id });
    if (scroll)
      window.requestAnimationFrame(() => {
        const row = [
          ...window.document.querySelectorAll<HTMLElement>(".flight-record"),
        ].find((row) => row.dataset.flightId === flight.id);
        row?.scrollIntoView({ block: "nearest", inline: "nearest" });
        row
          ?.querySelector<HTMLButtonElement>(".flight-row")
          ?.focus({ preventScroll: true });
      });
  }

  useEffect(() => {
    if (!view.scrollFlightId) return;
    // Run after App's navigation scroll reset, including the mobile document scroll.
    const frame = window.requestAnimationFrame(() => {
      const row = [
        ...window.document.querySelectorAll<HTMLElement>(".flight-record"),
      ].find((row) => row.dataset.flightId === view.scrollFlightId);
      row?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function cityName(code: string): string {
    const airport = airportByIata.get(code);
    return airport ? localizedText(airport.city, locale) : code;
  }

  function isSelected(target: PassportSelection): boolean {
    if (!selection || selection.kind !== target.kind) return false;
    if (target.kind === "route")
      return (
        selection.kind === "route" &&
        selection.origin === target.origin &&
        selection.destination === target.destination
      );
    return selection.kind !== "route" && selection.code === target.code;
  }

  function toggleHighlight(target: PassportSelection) {
    setSelection(isSelected(target) ? null : target);
  }

  function routeHighlight(flight: typeof longest, context: string) {
    const target: PassportSelection | undefined = flight
      ? {
          kind: "route",
          origin: flight.origin.iata,
          destination: (flight.divertedTo ?? flight.destination).iata,
        }
      : undefined;
    const distance = flight ? distanceForFlight(flight) : null;
    const content = (
      <>
        <span className="passport-spotlight-label">{context}</span>
        <span className="passport-longest-route">
          <span className="passport-longest-endpoint">
            <strong>{target?.origin ?? "—"}</strong>
            <span>{target ? cityName(target.origin) : "—"}</span>
          </span>
          <span className="passport-longest-arrow" aria-hidden="true">
            →
          </span>
          <span className="passport-longest-endpoint">
            <strong>{target?.destination ?? "—"}</strong>
            <span>{target ? cityName(target.destination) : "—"}</span>
          </span>
        </span>
        <span className="passport-longest-facts">
          <span>
            <span className="passport-spotlight-label">
              {t("passport.timeInAir")}
            </span>
            <StatisticValue
              value={
                flight
                  ? formatDuration(flightDuration(flight).minutes, locale)
                  : "—"
              }
            />
          </span>
          <span>
            <span className="passport-spotlight-label">
              {t("passport.distance")}
            </span>
            <StatisticValue
              value={
                distance === null
                  ? "—"
                  : t(distanceKey, {
                      value: formatDistance(distance, locale, distanceUnit),
                    })
              }
            />
          </span>
        </span>
      </>
    );
    return target ? (
      <button
        type="button"
        className="passport-highlight passport-spotlight-item passport-longest-flight"
        aria-label={t("passport.filterRoute", {
          context,
          origin: target.origin,
          destination: target.destination,
        })}
        aria-pressed={isSelected(target)}
        onClick={() => toggleHighlight(target)}
      >
        {content}
      </button>
    ) : (
      <div className="passport-highlight passport-spotlight-item passport-longest-flight is-unavailable">
        {content}
      </div>
    );
  }

  function selectYear(year: number | "lifetime") {
    onViewChange({
      year,
      query: "",
      selection: null,
      flightId: null,
      scrollFlightId: null,
    });
    setHoveredFlight(null);
  }

  function explorationTitle(current: PassportSelection): string {
    if (current.kind === "airport") {
      const airport = airportByIata.get(current.code);
      return airport
        ? `${current.code} · ${localizedText(airport.name, locale)}`
        : current.code;
    }
    if (current.kind === "airline")
      return `${airlineDisplayName(current.code, locale)} · ${current.code}`;
    return `${current.origin} → ${current.destination}`;
  }

  if (!document.flights.length) {
    return (
      <PageShell className="passport-page passport-empty-page">
        <section
          className="passport-empty"
          aria-labelledby="passport-empty-title"
        >
          <div>
            <p className="eyebrow">{t("passport.emptyEyebrow")}</p>
            <h2 id="passport-empty-title">{t("passport.emptyTitle")}</h2>
            <p>{t("passport.emptyDescription")}</p>
            <button
              className="button-primary"
              type="button"
              onClick={onAddFlight}
            >
              {t("actions.addFirstFlight")}
            </button>
          </div>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell className="passport-page passport-archive-page">
      <div className="passport-layout">
        <div
          className="passport-period view-switcher"
          role="group"
          aria-label={t("passport.periodLabel")}
        >
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
        <aside
          className="passport-visual"
          aria-label={t("passport.primaryStats")}
        >
          <div className="passport-visual-sticky">
            <p className="passport-scope" aria-live="polite">
              {isDesktop ? (
                <span className="passport-map-title">
                  {t("passport.worldTitle")}
                </span>
              ) : null}
              <span>
                {t(
                  selectedYear === "lifetime"
                    ? "passport.scopeAll"
                    : "passport.scopeYear",
                  { year: selectedYear, count: flights.length },
                )}
              </span>
            </p>
            {isDesktop ? (
              <Suspense
                fallback={
                  <section
                    className="route-map route-map-loading"
                    aria-busy="true"
                  >
                    <span>{t("app.loading")}</span>
                  </section>
                }
              >
                <PassportGlobe
                  routes={routes}
                  flights={flights}
                  appearance={appearance}
                  solarMode={solarMode}
                  selection={
                    selection?.kind === "route" || selection?.kind === "airport"
                      ? selection
                      : null
                  }
                  highlightedRoute={
                    highlightedRoute
                      ? `${highlightedRoute.origin}-${highlightedRoute.destination}`
                      : undefined
                  }
                  onClear={() => setSelection(null)}
                  onSelect={(target) => {
                    // Globe uses the same scoped exploration as Archive/Highlights.
                    const matching = flights.find(
                      (flight) =>
                        target.kind === "airport"
                          ? flight.origin.iata === target.code ||
                            (flight.divertedTo ?? flight.destination).iata ===
                              target.code
                          : flight.origin.iata === target.origin &&
                            (flight.divertedTo ?? flight.destination).iata ===
                              target.destination,
                    );
                    if (matching) {
                      onViewChange({
                        ...view,
                        selection: target,
                        flightId: matching.id,
                        scrollFlightId: matching.id,
                      });
                      window.requestAnimationFrame(() => {
                        const row = [
                          ...window.document.querySelectorAll<HTMLElement>(
                            ".flight-record",
                          ),
                        ].find(
                          (item) => item.dataset.flightId === matching.id,
                        );
                        row?.scrollIntoView({
                          block: "nearest",
                          inline: "nearest",
                        });
                        row
                          ?.querySelector<HTMLButtonElement>(".flight-row")
                          ?.focus({ preventScroll: true });
                      });
                    } else setSelection(target);
                  }}
                />
              </Suspense>
            ) : null}

            {isDesktop ? (
              <section
                className="passport-legend passport-core-stats"
                aria-label={t("passport.primaryStats")}
              >
                {[
                  [
                    "distance",
                    t(distanceKey, {
                      value: formatDistance(
                        stats.distanceKilometers,
                        locale,
                        distanceUnit,
                      ),
                    }),
                  ],
                  ["flights", stats.flights.toLocaleString(locale)],
                  ["timeInAir", duration],
                  ["airports", stats.airports.toLocaleString(locale)],
                  ["airlines", stats.airlines.toLocaleString(locale)],
                  ["countries", stats.countries.toLocaleString(locale)],
                ].map(([label, value]) => (
                  <p className="passport-core-stat" key={label}>
                    <StatisticValue value={value ?? ""} />
                    <span>{t(`passport.${label}`)}</span>
                  </p>
                ))}
              </section>
            ) : (
              <>
                <section
                  className="passport-legend"
                  key={`primary-${selectedYear}`}
                  aria-label={t("passport.primaryStats")}
                >
                  <p className="passport-legend-hero">
                    <span
                      className={
                        isDesktop ? "passport-report-label" : "sr-only"
                      }
                    >
                      {t("passport.distance")}{" "}
                    </span>
                    <strong>
                      {t(distanceKey, {
                        value: formatDistance(
                          stats.distanceKilometers,
                          locale,
                          distanceUnit,
                        ),
                      })}
                    </strong>
                  </p>
                  <p className="passport-legend-support">
                    {isDesktop ? (
                      <>
                        <span>
                          <strong>
                            {stats.flights.toLocaleString(locale)}
                          </strong>{" "}
                          {t("passport.flights")}
                        </span>
                        <span>
                          <strong>{duration}</strong> {t("passport.timeInAir")}
                        </span>
                      </>
                    ) : (
                      t("passport.heroSupport", {
                        count: stats.flights,
                        flights: stats.flights.toLocaleString(locale),
                        duration,
                      })
                    )}
                  </p>
                  <p
                    className="passport-legend-delay"
                    data-delayed={Boolean(
                      stats.totalDelayMinutes && stats.totalDelayMinutes > 0,
                    )}
                    title={t("passport.delayBasedOnArrivals")}
                    aria-description={t("passport.delayBasedOnArrivals")}
                  >
                    {t("passport.arrivalDelayTotal", {
                      duration: arrivalDelay,
                    })}
                  </p>
                </section>

                <p
                  className="passport-network-line"
                  aria-label={t("passport.collectionStats")}
                >
                  {isDesktop ? (
                    <>
                      {(
                        [
                          ["countries", stats.countries],
                          ["airports", stats.airports],
                          ["airlines", stats.airlines],
                          ["aircraftTypes", stats.aircraftTypes],
                        ] as const
                      ).map(([label, count]) => (
                        <span key={label}>
                          <strong>{count.toLocaleString(locale)}</strong>{" "}
                          {t(`passport.${label}`)}
                        </span>
                      ))}
                    </>
                  ) : (
                    t("passport.networkSentence", {
                      countries: t("passport.networkCountries", {
                        count: stats.countries,
                      }),
                      airports: t("passport.networkAirports", {
                        count: stats.airports,
                      }),
                      airlines: t("passport.networkAirlines", {
                        count: stats.airlines,
                      }),
                      types: t("passport.networkTypes", {
                        count: stats.aircraftTypes,
                      }),
                    })
                  )}
                </p>
              </>
            )}

            {!isDesktop ? (
              <>
                <section
                  className="passport-mobile-summary"
                  id="passport-summary"
                  key={`mobile-summary-${selectedYear}`}
                  aria-label={t("passport.primaryStats")}
                >
                  <p className="passport-panel-kicker">
                    KEEPRAW FLY <span> / </span> {t("passport.panelTitle")}
                  </p>
                  <div className="passport-mobile-hero">
                    <strong>{stats.flights.toLocaleString(locale)}</strong>
                    <span>{t("passport.flights")}</span>
                  </div>
                  <div className="passport-mobile-journey">
                    <div>
                      <span>{t("passport.distance")}</span>
                      <strong>
                        {t(distanceKey, {
                          value: formatDistance(
                            stats.distanceKilometers,
                            locale,
                            distanceUnit,
                          ),
                        })}
                      </strong>
                    </div>
                    <div>
                      <span>{t("passport.timeInAir")}</span>
                      <strong>
                        {formatDuration(stats.durationMinutes, locale)}
                      </strong>
                    </div>
                  </div>
                  <div
                    className="passport-mobile-support"
                    aria-label={t("passport.collectionStats")}
                  >
                    <span>
                      {t("passport.countries")}:{" "}
                      {stats.countries.toLocaleString(locale)}
                    </span>
                    <span>
                      {t("passport.airports")}:{" "}
                      {stats.airports.toLocaleString(locale)}
                    </span>
                    <span>
                      {t("passport.airlines")}:{" "}
                      {stats.airlines.toLocaleString(locale)}
                    </span>
                    <span>
                      {t("passport.aircraftTypes")}:{" "}
                      {stats.aircraftTypes.toLocaleString(locale)}
                    </span>
                  </div>
                </section>

                <section
                  className="passport-mobile-panel passport-delay-panel"
                  aria-labelledby="passport-delay-title"
                >
                  <h2 id="passport-delay-title">{t("passport.totalDelay")}</h2>
                  <div
                    className="passport-delay-main"
                    title={t("passport.delayBasedOnArrivals")}
                    aria-description={t("passport.delayBasedOnArrivals")}
                  >
                    <StatisticValue value={arrivalDelay} />
                  </div>
                  {stats.totalDelayMinutes === null ? (
                    <p>{t("passport.delayUnavailable")}</p>
                  ) : (
                    <>
                      {worstDelay ? (
                        <p className="passport-delay-longest">
                          <span>{t("passport.longestDelay")}</span>
                          <strong>
                            {worstDelay.flight.flightNumber} ·{" "}
                            {formatDuration(worstDelay.minutes, locale)}
                          </strong>
                        </p>
                      ) : null}
                    </>
                  )}
                </section>

                <section
                  className="passport-mobile-panel passport-network-panel"
                  aria-labelledby="passport-network-title"
                >
                  <h2 id="passport-network-title">
                    {t("passport.networkPanelTitle")}
                  </h2>
                  <div className="passport-network-facts">
                    <div>
                      <strong>{stats.countries.toLocaleString(locale)}</strong>
                      <span>{t("passport.countries")}</span>
                    </div>
                    <div>
                      <strong>{stats.airports.toLocaleString(locale)}</strong>
                      <span>{t("passport.airports")}</span>
                    </div>
                  </div>
                  {stats.mostVisitedAirport ? (
                    <p>
                      <span>{t("passport.mostVisitedAirport")}</span>
                      <strong>
                        {airportByIata.get(stats.mostVisitedAirport.code)
                          ? localizedText(
                              airportByIata.get(stats.mostVisitedAirport.code)!
                                .name,
                              locale,
                            )
                          : stats.mostVisitedAirport.code}
                      </strong>
                    </p>
                  ) : null}
                </section>
              </>
            ) : null}
            {isDesktop ? (
              <div
                className="passport-highlights"
                key={`highlights-${selectedYear}`}
              >
                <h2 className="passport-mobile-section-title">
                  {t("passport.highlights")}
                </h2>
                <div className="passport-spotlight">
                  <div
                    className="passport-delay-highlight"
                    data-delayed={Boolean(
                      stats.totalDelayMinutes && stats.totalDelayMinutes > 0,
                    )}
                    title={t("passport.delayBasedOnArrivals")}
                    aria-description={t("passport.delayBasedOnArrivals")}
                  >
                    <span className="passport-spotlight-label">
                      {t("passport.totalDelay")}
                    </span>
                    <strong>{arrivalDelay}</strong>
                    {delayYears.length ? (
                      <ol
                        className="passport-delay-chart"
                        aria-label={t("passport.annualArrivalDelay")}
                      >
                        {delayYears.map(
                          ({ year, minutes, recordedArrivals }) => (
                            <li
                              key={year}
                              data-year={year}
                              data-minutes={minutes ?? "unknown"}
                              data-recorded-arrivals={recordedArrivals}
                              data-emphasized={
                                minutes !== null &&
                                minutes > 0 &&
                                minutes === maximumDelay
                              }
                              title={`${year} · ${minutes === null ? "—" : formatDuration(minutes, locale)}`}
                            >
                              <span
                                className="passport-delay-column"
                                aria-hidden="true"
                              >
                                {minutes === null ? (
                                  <span>—</span>
                                ) : (
                                  <span
                                    className="passport-delay-bar"
                                    style={
                                      {
                                        "--delay-height": `${maximumDelay ? (minutes / maximumDelay) * 100 : 0}%`,
                                      } as CSSProperties
                                    }
                                  />
                                )}
                              </span>
                              <span>{year}</span>
                              <span className="sr-only">
                                {minutes === null
                                  ? "—"
                                  : formatDuration(minutes, locale)}
                              </span>
                            </li>
                          ),
                        )}
                      </ol>
                    ) : (
                      <span className="passport-highlight-empty">—</span>
                    )}
                    {highlights.annualArrivalDelays.length > 3 ? (
                      <span className="passport-chart-scope">
                        {t("passport.recentDelayYears")}
                      </span>
                    ) : null}
                  </div>
                  <div className="passport-airport-ranking">
                    <span className="passport-spotlight-label">
                      {t("passport.highlightBeen")}
                    </span>
                    {highlights.mostVisitedAirports.length ? (
                      <ol>
                        {highlights.mostVisitedAirports.map(
                          ({ code, count }) => {
                            const name = cityName(code);
                            const target: PassportSelection = {
                              kind: "airport",
                              code,
                            };
                            return (
                              <li key={code}>
                                <button
                                  type="button"
                                  className="passport-highlight passport-spotlight-item passport-airport-rank"
                                  data-airport={code}
                                  data-visits={count}
                                  aria-label={`${t("passport.filterAirport", { airport: name, code })} · ${t("passport.visitFrequency", { count })}`}
                                  aria-pressed={isSelected(target)}
                                  onClick={() => toggleHighlight(target)}
                                >
                                  <span className="passport-airport-name">
                                    {name}{" "}
                                    <span className="passport-spotlight-code">
                                      · {code}
                                    </span>
                                  </span>
                                  <span
                                    className="passport-airport-track"
                                    aria-hidden="true"
                                  >
                                    <span
                                      style={{
                                        width: `${(count / highlights.mostVisitedAirports[0]!.count) * 100}%`,
                                      }}
                                    />
                                  </span>
                                  <span
                                    className="passport-airport-count"
                                    aria-hidden="true"
                                  >
                                    {count.toLocaleString(locale)}
                                  </span>
                                  <span className="sr-only">
                                    {t("passport.visitFrequency", { count })}
                                  </span>
                                </button>
                              </li>
                            );
                          },
                        )}
                      </ol>
                    ) : (
                      <div className="passport-highlight passport-spotlight-item is-unavailable">
                        —
                      </div>
                    )}
                  </div>
                  {routeHighlight(longest, t("passport.longestFlight"))}
                </div>
              </div>
            ) : null}
          </div>
        </aside>

        <section className="passport-archive">
          <header className="archive-heading" id="flight-archive">
            <h2 className="passport-mobile-section-title">
              {t("passport.pastFlights")}
            </h2>
            <div className="archive-controls">
              <button
                className="add-flight-button"
                type="button"
                onClick={onAddFlight}
              >
                <span aria-hidden="true">＋</span>
                {t("actions.addFlight")}
              </button>
              <button
                className="passport-import-button"
                type="button"
                onClick={onOpenImport}
              >
                {t("actions.importFlights")}
              </button>
            </div>
            <div className="search-field passport-search-field">
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4 4" />
              </svg>
              <label className="sr-only" htmlFor="passport-flight-search">
                {t("flights.searchLabel")}
              </label>
              <input
                id="passport-flight-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("flights.searchPlaceholder")}
                autoComplete="off"
              />
              {query ? (
                <button
                  className="clear-search"
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label={t("actions.clearSearch")}
                >
                  ×
                </button>
              ) : null}
            </div>
          </header>

          <div className="passport-archive-scroll">
            {selection ? (
              <section
                className="passport-exploration"
                aria-labelledby="passport-exploration-title"
                aria-live="polite"
              >
                <span id="passport-exploration-title">
                  {t(`passport.explore.${selection.kind}`)} ·{" "}
                  {explorationTitle(selection)}
                </span>
                <button
                  className="passport-exploration-close"
                  type="button"
                  onClick={() => setSelection(null)}
                >
                  {t("passport.closeExploration")} ×
                </button>
              </section>
            ) : null}

            {groups.length ? (
              <div className="flight-groups" aria-live="polite">
                {groups.map((group, groupIndex) => (
                  <section className="flight-year" key={group.year}>
                    <div className="year-heading">
                      {groupIndex === 0 ? (
                        <h1>{group.year}</h1>
                      ) : (
                        <h2>{group.year}</h2>
                      )}
                      <span>
                        {t("flights.count", { count: group.flights.length })}
                      </span>
                    </div>
                    <div className="flight-list">
                      {group.flights.map((flight, index) => (
                        <FlightRow
                          key={flight.id}
                          flight={flight}
                          locale={locale}
                          timeFormat={timeFormat}
                          onOpen={() => onOpenFlight(flight.id)}
                          selected={view.flightId === flight.id}
                          onHoverChange={setHoveredFlight}
                          revealIndex={index}
                          presentation={isDesktop ? "passport" : "standard"}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="no-results" role="status">
                <h2>{t("flights.noResultsTitle")}</h2>
                <p>{t("flights.noResultsDescription", { query })}</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
