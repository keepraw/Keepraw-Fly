import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlight, KeeprawFlyDocument } from "@keepraw-fly/schema";
import {
  FLIGHT_SORT_ORDERS,
  airlineDisplayName,
  airportTargetMatches,
  arrivalIdentity,
  buildRouteSegments,
  calculatePassportStatistics,
  calculateYearStatistics,
  formatDistance,
  formatDuration,
  flightRouteIdentityKey,
  groupFlightsByYear,
  rankAircraftTypes,
  rankAirlines,
  localizedText,
  localizedAirportName,
  originIdentity,
  type FlightEndpointIdentity,
  type DistanceUnit,
  type FlightSortOrder,
  type SupportedLocale,
  type TimeFormat,
} from "@keepraw-fly/core";
import { FlightRow } from "../components/FlightRow";
import { PageShell } from "../components/PageShell";
import { StatisticValue } from "../typography/StatisticValue";
import { PassportMap } from "../components/PassportMap";
import { StatsInsights } from "../components/StatsInsights";
import { cabinTranslationKey } from "../data/cabin-labels";
import { resolveMapTheme, type MapThemeId } from "../map2d/theme-registry";
import type { PrimaryView } from "../routing";
import {
  matchesSelection,
  passportVisibleFlights,
  sameSelection,
  type PassportSelection,
  type PassportViewState,
} from "../data/passport-exploration";

interface PassportPageProps {
  /** Primary view to compose from the shared regions; defaults to Map. */
  mode?: PrimaryView;
  document: KeeprawFlyDocument;
  locale: SupportedLocale;
  distanceUnit: DistanceUnit;
  timeFormat: TimeFormat;
  mapTheme: MapThemeId;
  onAddFlight: () => void;
  onOpenImport: () => void;
  /** Opens the Flight Passport share overlay; optional so embedded uses can omit it. */
  onOpenShare?: () => void;
  onOpenFlight: (flightId: string) => void;
  view: PassportViewState;
  onViewChange: (view: PassportViewState) => void;
}

export function PassportPage({
  mode = "map",
  document,
  locale,
  distanceUnit,
  timeFormat,
  mapTheme,
  onAddFlight,
  onOpenImport,
  onOpenShare,
  onOpenFlight,
  view,
  onViewChange,
}: PassportPageProps) {
  const { t } = useTranslation();
  const {
    year: selectedYear,
    query,
    selection,
    airline,
    aircraft,
    sort,
  } = view;
  const showMap = mode === "map";
  const showList = mode !== "stats";
  const showInsights = mode === "stats";
  const setSelection = (selection: PassportSelection | null) =>
    onViewChange({ ...view, selection, flightId: null, scrollFlightId: null });
  const setQuery = (query: string) =>
    onViewChange({ ...view, query, flightId: null, scrollFlightId: null });
  const setFilters = (
    filters: Partial<Pick<PassportViewState, "airline" | "aircraft" | "sort">>,
  ) =>
    onViewChange({
      ...view,
      ...filters,
      flightId: null,
      scrollFlightId: null,
    });
  const [hoveredFlight, setHoveredFlight] = useState<KeeprawFlight | null>(
    null,
  );
  // Compact keeps the Log filters behind one control, so the first flights stay
  // on the first screen whatever the length of a language's choices.
  const [filtersOpen, setFiltersOpen] = useState(false);
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
    [document.flights, selectedYear, query, selection, airline, aircraft, sort],
  );
  // Distance orders cut across years, so they list the flights in one group.
  const groups = useMemo(
    () =>
      sort === "newest" || sort === "oldest"
        ? groupFlightsByYear(flights, sort)
        : flights.length
          ? [{ year: null, flights }]
          : [],
    [flights, sort],
  );
  const stats = useMemo(() => calculatePassportStatistics(flights), [flights]);
  // Each filter lists its choices from the flights the other filters leave, so
  // an active airline or aircraft type never hides its own alternatives.
  const airlineFlights = useMemo(
    () => passportVisibleFlights(document.flights, { ...view, airline: null }),
    [document.flights, selectedYear, query, selection, aircraft],
  );
  const aircraftFlights = useMemo(
    () => passportVisibleFlights(document.flights, { ...view, aircraft: null }),
    [document.flights, selectedYear, query, selection, airline],
  );
  // The Log lists cancelled flights, so its filters count and offer them too.
  const airlineChoices = useMemo(
    () => rankAirlines(airlineFlights, { includeCancelled: true }),
    [airlineFlights],
  );
  const aircraftChoices = useMemo(
    () => rankAircraftTypes(aircraftFlights, { includeCancelled: true }),
    [aircraftFlights],
  );
  // Keep the period/search network stable while selecting or focusing Archive rows.
  // Selection filters the report and Archive; the map retains the surrounding
  // network so another airport/route can be selected without clearing first.
  const mapFlights = useMemo(
    () =>
      passportVisibleFlights(document.flights, { ...view, selection: null }),
    [document.flights, selectedYear, query, airline, aircraft, sort],
  );
  const routes = useMemo(() => buildRouteSegments(mapFlights), [mapFlights]);
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
  // The hovered/focused flight's physical route, never its code pair.
  const highlightedRoute = highlightedFlight
    ? flightRouteIdentityKey(highlightedFlight)
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

  /** A flight-date identity of the selected airport, from the visible network. */
  function selectedAirportIdentity(target: {
    code: string;
    identityKey?: string;
  }): FlightEndpointIdentity | undefined {
    for (const flight of mapFlights)
      for (const identity of [originIdentity(flight), arrivalIdentity(flight)])
        if (airportTargetMatches(target, identity)) return identity;
    return undefined;
  }

  /** Flight-date physical airport label: a historical site keeps its own name. */
  function identityLabel(identity: FlightEndpointIdentity): string {
    const name = localizedAirportName(
      identity.airportId,
      locale,
      identity.localDate,
    );
    if (identity.differsFromCurrentDirectory && name) return name;
    if (identity.city)
      return localizedText(identity.city, locale) || name || identity.iata;
    return name ?? identity.iata;
  }

  function isSelected(target: PassportSelection): boolean {
    return sameSelection(selection, target);
  }

  function toggleHighlight(target: PassportSelection) {
    setSelection(isSelected(target) ? null : target);
  }

  function selectYear(year: number | "lifetime") {
    // Airline, aircraft type and order are explicit choices and survive.
    onViewChange({
      ...view,
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
      // The selected physical site's flight-date name, not today's directory row.
      const identity = selectedAirportIdentity(current);
      const name = localizedAirportName(
        identity?.airportId,
        locale,
        identity?.localDate,
      );
      return name ? `${current.code} · ${name}` : current.code;
    }
    return `${current.origin} → ${current.destination}`;
  }

  const airlineName = (code: string) =>
    `${airlineDisplayName(code, locale)} · ${code}`;
  const filterChip = (
    kind: "airline" | "aircraft",
    label: string,
    value: string,
  ) => (
    <section
      className="passport-exploration"
      data-filter={kind}
      aria-live="polite"
    >
      <span>
        {label} · {value}
      </span>
      <button
        className="passport-exploration-close"
        type="button"
        aria-label={t("insights.filters.remove", { filter: value })}
        onClick={() => setFilters({ [kind]: null })}
      >
        {t("passport.closeExploration")} ×
      </button>
    </section>
  );
  // Shown wherever the flights are narrowed, so a filter is never invisible.
  const activeFilters = (
    <>
      {selection ? (
        <section
          className="passport-exploration"
          data-filter={selection.kind}
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
      {airline
        ? filterChip(
            "airline",
            t("insights.filters.airline"),
            airlineName(airline),
          )
        : null}
      {aircraft
        ? filterChip("aircraft", t("insights.filters.aircraft"), aircraft)
        : null}
    </>
  );

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
      <div className="passport-layout" data-view={mode}>
        {isDesktop && !showList ? (
          <h1 className="sr-only">{t(`nav.${mode}`)}</h1>
        ) : null}
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
              {showMap && onOpenShare ? (
                <button
                  className="passport-share-button"
                  type="button"
                  aria-haspopup="dialog"
                  title={t("share.entryHint")}
                  onClick={onOpenShare}
                >
                  {t("share.entry")}
                </button>
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
            {showMap ? (
              <PassportMap
                routes={routes}
                flights={mapFlights}
                theme={resolveMapTheme(mapTheme)}
                selection={
                  selection?.kind === "route" || selection?.kind === "airport"
                    ? selection
                    : null
                }
                highlightedRoute={highlightedRoute}
                onClear={() => setSelection(null)}
                onSelect={(target) => {
                  // The map uses the same scoped exploration as Archive/Highlights.
                  const matching = mapFlights.find((flight) =>
                    matchesSelection(flight, target),
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
                      ].find((item) => item.dataset.flightId === matching.id);
                      row?.scrollIntoView({
                        block: "nearest",
                        inline: "nearest",
                      });
                      row
                        ?.querySelector<HTMLButtonElement>(".flight-row")
                        ?.focus({ preventScroll: true });
                    });
                  } else {
                    setSelection(target);
                  }
                }}
              />
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
                ].map(([label, value]) => {
                  // Airports counts confirmed physical airports only; codes not
                  // confirmed at their flight dates are reported beside it.
                  const coverage =
                    label === "airports" && stats.unresolvedAirports
                      ? t("passport.unresolvedHistoricalAirports", {
                          airports:
                            stats.unresolvedAirports.toLocaleString(locale),
                        })
                      : undefined;
                  return (
                    <p
                      className={
                        coverage
                          ? "passport-core-stat passport-history-coverage"
                          : "passport-core-stat"
                      }
                      key={label}
                      data-unresolved-airports={
                        coverage ? stats.unresolvedAirports : undefined
                      }
                      title={coverage}
                      aria-description={coverage}
                    >
                      <StatisticValue value={value ?? ""} />
                      <span>{t(`passport.${label}`)}</span>
                    </p>
                  );
                })}
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
                          {t("passport.flights", { count: stats.flights })}
                        </span>
                        <span>
                          <strong>{duration}</strong> {t("passport.timeInAir")}
                        </span>
                      </>
                    ) : (
                      t("passport.heroSupport", {
                        count: stats.flights,
                        flights: stats.flights,
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
                {stats.unresolvedAirports ? (
                  <p
                    className="passport-network-line passport-history-coverage"
                    data-unresolved-airports={stats.unresolvedAirports}
                  >
                    {t("passport.unresolvedHistoricalAirports", {
                      airports: stats.unresolvedAirports.toLocaleString(locale),
                    })}
                  </p>
                ) : null}
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
                    <span>
                      {t("passport.flights", { count: stats.flights })}
                    </span>
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
              </>
            ) : null}
            {showInsights ? (
              <>
                {activeFilters}
                <StatsInsights
                  flights={flights}
                  airlineFlights={airlineFlights}
                  aircraftFlights={aircraftFlights}
                  stats={stats}
                  view={view}
                  locale={locale}
                  distanceUnit={distanceUnit}
                  airportLabel={identityLabel}
                  cabinLabel={(cabin) => {
                    const key = cabinTranslationKey(cabin);
                    return key ? t(key) : cabin;
                  }}
                  onToggleSelection={toggleHighlight}
                  onToggleAirline={(code) =>
                    setFilters({ airline: airline === code ? null : code })
                  }
                  onToggleAircraft={(type) =>
                    setFilters({ aircraft: aircraft === type ? null : type })
                  }
                  onOpenFlight={onOpenFlight}
                />
              </>
            ) : null}
          </div>
        </aside>

        <section className="passport-archive">
          {mode !== "stats" ? (
            <header className="archive-heading" id="flight-archive">
              {showList ? (
                <h2 className="passport-mobile-section-title">
                  {t("passport.pastFlights")}
                </h2>
              ) : null}
              {showList ? (
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
              ) : null}
              {mode === "log" ? (
                <button
                  className="log-filters-toggle"
                  type="button"
                  aria-expanded={filtersOpen}
                  aria-controls="log-filters"
                  onClick={() => setFiltersOpen((open) => !open)}
                >
                  {t("insights.filters.label")}
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              ) : null}
              {mode === "log" ? (
                <div
                  className="log-filters"
                  id="log-filters"
                  role="group"
                  aria-label={t("insights.filters.label")}
                  data-open={filtersOpen || undefined}
                >
                  <label>
                    <span className="log-filter-label">
                      {t("insights.filters.airline")}
                    </span>
                    <select
                      name="airline"
                      value={airline ?? ""}
                      onChange={(event) =>
                        setFilters({ airline: event.target.value || null })
                      }
                    >
                      <option value="">
                        {t("insights.filters.allAirlines")}
                      </option>
                      {airline &&
                      !airlineChoices.some(({ code }) => code === airline) ? (
                        <option value={airline}>{airlineName(airline)}</option>
                      ) : null}
                      {airlineChoices.map(({ code, count }) => (
                        <option key={code} value={code}>
                          {airlineName(code)} ({count.toLocaleString(locale)})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="log-filter-label">
                      {t("insights.filters.aircraft")}
                    </span>
                    <select
                      name="aircraft"
                      value={aircraft ?? ""}
                      onChange={(event) =>
                        setFilters({ aircraft: event.target.value || null })
                      }
                    >
                      <option value="">
                        {t("insights.filters.allAircraft")}
                      </option>
                      {aircraft &&
                      !aircraftChoices.some(({ code }) => code === aircraft) ? (
                        <option value={aircraft}>{aircraft}</option>
                      ) : null}
                      {aircraftChoices.map(({ code, count }) => (
                        <option key={code} value={code}>
                          {code} ({count.toLocaleString(locale)})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="log-filter-label">
                      {t("insights.filters.sort")}
                    </span>
                    <select
                      name="sort"
                      value={sort}
                      onChange={(event) =>
                        setFilters({
                          sort: event.target.value as FlightSortOrder,
                        })
                      }
                    >
                      {FLIGHT_SORT_ORDERS.map((order) => (
                        <option key={order} value={order}>
                          {t(`insights.filters.sortOrders.${order}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
              {mode === "log" ? (
                <div className="archive-controls">
                  <button
                    className="passport-import-button"
                    type="button"
                    onClick={onOpenImport}
                  >
                    {t("actions.importFlights")}
                  </button>
                </div>
              ) : null}
            </header>
          ) : null}

          <div className="passport-archive-scroll">
            {/* Without the search field, an active search stays visible. */}
            {!showList && query ? (
              <section
                className="passport-exploration passport-active-search"
                aria-live="polite"
              >
                <span>
                  {t("flights.searchLabel")} · {query}
                </span>
                <button
                  className="passport-exploration-close"
                  type="button"
                  onClick={() => setQuery("")}
                >
                  {t("actions.clearSearch")} ×
                </button>
              </section>
            ) : null}
            {showInsights ? null : activeFilters}

            {!showList ? null : groups.length ? (
              <div className="flight-groups" aria-live="polite">
                {groups.map((group, groupIndex) => (
                  <section
                    className="flight-year"
                    key={group.year ?? sort}
                    data-order={sort}
                  >
                    <div className="year-heading">
                      {groupIndex === 0 ? (
                        <h1>
                          {group.year ??
                            t(`insights.filters.sortOrders.${sort}`)}
                        </h1>
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
                          distanceUnit={distanceUnit}
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
                <p>
                  {query
                    ? t("flights.noResultsDescription", { query })
                    : t("insights.filters.noMatches")}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
