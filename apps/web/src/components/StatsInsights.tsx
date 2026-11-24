import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  airlineDisplayName,
  arrivalIdentity,
  cabinDistribution,
  calculatePassportHighlights,
  calculateYearStatistics,
  distanceForFlight,
  flightDuration,
  flightRouteTarget,
  flightsPerMonth,
  formatDistance,
  formatDuration,
  longestArrivalDelay,
  mostFlownRoute,
  originIdentity,
  rankAircraftTypes,
  rankAirlines,
  rankAirports,
  type DistanceUnit,
  type FlightEndpointIdentity,
  type PassportStatistics,
  type SupportedLocale,
} from "@keepraw-fly/core";
import {
  sameSelection,
  type PassportSelection,
  type PassportViewState,
} from "../data/passport-exploration";

/** Entries shown before a ranking is expanded. */
const RANKING_PREVIEW = 6;

interface RankingEntry {
  key: string;
  name: string;
  code?: string;
  count: number;
  pressed: boolean;
  action: string;
  onToggle: () => void;
}

interface StatsInsightsProps {
  /** The flights of the current scope, selection and filters. */
  flights: KeeprawFlight[];
  /** The same flights without the airline filter, so every airline stays pickable. */
  airlineFlights: KeeprawFlight[];
  /** The same flights without the aircraft-type filter. */
  aircraftFlights: KeeprawFlight[];
  stats: PassportStatistics;
  view: PassportViewState;
  locale: SupportedLocale;
  distanceUnit: DistanceUnit;
  airportLabel: (identity: FlightEndpointIdentity) => string;
  cabinLabel: (cabin: string) => string;
  onToggleSelection: (target: PassportSelection) => void;
  onToggleAirline: (code: string) => void;
  onToggleAircraft: (type: string) => void;
  onOpenFlight: (flightId: string) => void;
}

function Panel({
  region,
  title,
  children,
}: {
  region: string;
  title: string;
  children: ReactNode;
}) {
  const id = `stats-${region}`;
  return (
    <section className="stats-panel" data-region={region} aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

function Bar({ share }: { share: number }) {
  return (
    <span className="stats-bar" aria-hidden="true">
      <span
        className="stats-bar-fill"
        style={{ "--stats-share": `${share * 100}%` } as CSSProperties}
      />
    </span>
  );
}

function Ranking({
  region,
  title,
  entries,
  locale,
}: {
  region: string;
  title: string;
  entries: RankingEntry[];
  locale: SupportedLocale;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? entries : entries.slice(0, RANKING_PREVIEW);
  const maximum = entries[0]?.count ?? 0;
  return (
    <Panel region={region} title={title}>
      {entries.length ? (
        <ol className="stats-ranking">
          {shown.map((entry) => (
            <li key={entry.key}>
              <button
                type="button"
                className="stats-rank"
                data-key={entry.code ?? entry.name}
                data-count={entry.count}
                aria-pressed={entry.pressed}
                onClick={entry.onToggle}
              >
                <span className="stats-rank-name">
                  {entry.name}
                  {entry.code ? (
                    <span className="stats-code"> · {entry.code}</span>
                  ) : null}
                </span>
                <Bar share={maximum ? entry.count / maximum : 0} />
                <span className="stats-rank-count">
                  {entry.count.toLocaleString(locale)}
                </span>
                <span className="sr-only">{entry.action}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="stats-empty">{t("insights.stats.noData")}</p>
      )}
      {entries.length > RANKING_PREVIEW ? (
        <button
          type="button"
          className="stats-more"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded
            ? t("insights.stats.showFewer")
            : t("insights.stats.showAll", { count: entries.length })}
        </button>
      ) : null}
    </Panel>
  );
}

/**
 * The Stats regions of docs/views-and-skins.md. One component renders the
 * same inventory on every screen class; only the CSS arrangement differs.
 */
export function StatsInsights({
  flights,
  airlineFlights,
  aircraftFlights,
  stats,
  view,
  locale,
  distanceUnit,
  airportLabel,
  cabinLabel,
  onToggleSelection,
  onToggleAirline,
  onToggleAircraft,
  onOpenFlight,
}: StatsInsightsProps) {
  const { t } = useTranslation();
  const derived = useMemo(() => {
    const delays = new Map(
      calculatePassportHighlights(flights).annualArrivalDelays.map((year) => [
        year.year,
        year.minutes,
      ]),
    );
    return {
      years: calculateYearStatistics(flights)
        .filter((year) => year.flights > 0)
        .sort((a, b) => b.year - a.year)
        .map((year) => ({ ...year, delay: delays.get(year.year) ?? null })),
      months: flightsPerMonth(flights),
      airports: rankAirports(flights),
      cabins: cabinDistribution(flights),
      longestDelay: longestArrivalDelay(flights),
      route: mostFlownRoute(flights),
    };
  }, [flights]);
  const airlines = useMemo(
    () => rankAirlines(airlineFlights),
    [airlineFlights],
  );
  const aircraft = useMemo(
    () => rankAircraftTypes(aircraftFlights),
    [aircraftFlights],
  );
  const distance = (kilometers: number) =>
    t(
      distanceUnit === "miles"
        ? "passport.distanceMiles"
        : "passport.distanceKilometers",
      { value: formatDistance(kilometers, locale, distanceUnit) },
    );
  const byId = (id: string | undefined) =>
    id ? flights.find((flight) => flight.id === id) : undefined;
  const monthName = (month: number, width: "narrow" | "long") =>
    new Intl.DateTimeFormat(locale, { month: width, timeZone: "UTC" }).format(
      Date.UTC(2024, month, 1),
    );
  const maximumYear = Math.max(0, ...derived.years.map((year) => year.flights));
  const maximumMonth = Math.max(0, ...derived.months);
  const maximumCabin = Math.max(0, ...derived.cabins.map((item) => item.count));

  function record(
    kind: string,
    label: string,
    flight: KeeprawFlight | undefined,
    facts: string[],
    target?: PassportSelection,
  ) {
    const endpoints = flight
      ? { origin: originIdentity(flight), arrival: arrivalIdentity(flight) }
      : undefined;
    const route = target?.kind === "route" ? target : undefined;
    const origin = route?.origin ?? endpoints?.origin.iata;
    const destination = route?.destination ?? endpoints?.arrival.iata;
    const content = (
      <>
        <span className="stats-record-label">{label}</span>
        <strong className="stats-record-route">
          {origin && destination ? `${origin} → ${destination}` : "—"}
        </strong>
        {endpoints ? (
          <span className="stats-record-places">
            {airportLabel(endpoints.origin)} → {airportLabel(endpoints.arrival)}
          </span>
        ) : null}
        <span className="stats-record-facts">
          {facts.map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
        </span>
      </>
    );
    if (!origin || !destination)
      return (
        <li key={kind}>
          <div className="stats-record is-unavailable" data-record={kind}>
            {content}
          </div>
        </li>
      );
    return (
      <li key={kind}>
        <button
          type="button"
          className="stats-record"
          data-record={kind}
          aria-pressed={
            route ? sameSelection(view.selection, route) : undefined
          }
          onClick={() =>
            route ? onToggleSelection(route) : flight && onOpenFlight(flight.id)
          }
        >
          {content}
          <span className="sr-only">
            {route
              ? t("passport.filterRoute", {
                  context: label,
                  origin,
                  destination,
                })
              : t("flights.openFlight", {
                  flightNumber: flight?.flightNumber,
                  origin,
                  destination,
                })}
          </span>
        </button>
      </li>
    );
  }

  function distanceRecord(
    kind: string,
    label: string,
    flight: KeeprawFlight | undefined,
  ) {
    const kilometers = flight ? distanceForFlight(flight) : null;
    return record(
      kind,
      label,
      flight,
      flight
        ? [
            formatDuration(flightDuration(flight).minutes, locale),
            ...(kilometers === null ? [] : [distance(kilometers)]),
          ]
        : [],
      flight ? flightRouteTarget(flight) : undefined,
    );
  }

  const delayed = byId(derived.longestDelay?.flightId);
  const routeFlight = derived.route
    ? flights.find(
        (flight) =>
          !flight.cancelled &&
          sameSelection(flightRouteTarget(flight), derived.route!.target),
      )
    : undefined;

  return (
    <div className="stats-insights" data-region="stats">
      <Panel region="totals" title={t("passport.totalDelay")}>
        <p
          className="stats-figure"
          data-delayed={Boolean(
            stats.totalDelayMinutes && stats.totalDelayMinutes > 0,
          )}
        >
          {stats.totalDelayMinutes === null
            ? "—"
            : formatDuration(stats.totalDelayMinutes, locale)}
        </p>
        <p className="stats-note">
          {stats.totalDelayMinutes === null
            ? t("passport.delayUnavailable")
            : t("passport.delayBasedOnArrivals")}
        </p>
        {stats.unresolvedAirports ? (
          <p
            className="stats-note"
            data-unresolved-airports={stats.unresolvedAirports}
          >
            {t("passport.unresolvedHistoricalAirports", {
              airports: stats.unresolvedAirports.toLocaleString(locale),
            })}
          </p>
        ) : null}
      </Panel>

      <Panel region="byYear" title={t("passport.byYear")}>
        <table className="stats-years">
          <thead>
            <tr>
              <th scope="col">{t("insights.stats.year")}</th>
              <th scope="col">{t("passport.flights")}</th>
              <th scope="col">{t("passport.distance")}</th>
              <th scope="col">{t("insights.stats.arrivalDelay")}</th>
            </tr>
          </thead>
          <tbody>
            {derived.years.map((year) => (
              <tr key={year.year} data-year={year.year}>
                <th scope="row">{year.year}</th>
                <td>
                  <span className="stats-years-count">
                    {year.flights.toLocaleString(locale)}
                    <Bar share={maximumYear ? year.flights / maximumYear : 0} />
                  </span>
                </td>
                <td>{distance(year.distanceKilometers)}</td>
                <td data-minutes={year.delay ?? "unknown"}>
                  {year.delay === null
                    ? "—"
                    : formatDuration(year.delay, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel region="months" title={t("insights.stats.months")}>
        <ol className="stats-months">
          {derived.months.map((count, month) => (
            <li key={month} data-month={month + 1} data-count={count}>
              <span aria-hidden="true">{count ? count : ""}</span>
              <span className="stats-month-column" aria-hidden="true">
                <span
                  className="stats-month-bar"
                  style={
                    {
                      "--stats-share": `${maximumMonth ? (count / maximumMonth) * 100 : 0}%`,
                    } as CSSProperties
                  }
                />
              </span>
              <span aria-hidden="true">{monthName(month, "narrow")}</span>
              <span className="sr-only">
                {monthName(month, "long")}:{" "}
                {t("passport.flightFrequency", { count })}
              </span>
            </li>
          ))}
        </ol>
      </Panel>

      <Ranking
        region="airports"
        title={t("insights.stats.airports")}
        locale={locale}
        entries={derived.airports.map(
          ({ code, count, identity, identityKey }) => {
            const target: PassportSelection = {
              kind: "airport",
              code,
              identityKey,
            };
            const name = airportLabel(identity);
            return {
              key: identityKey,
              name,
              code,
              count,
              pressed: sameSelection(view.selection, target),
              action: `${t("passport.visitFrequency", { count })}. ${t("passport.filterAirport", { airport: name, code })}`,
              onToggle: () => onToggleSelection(target),
            };
          },
        )}
      />
      <Ranking
        region="airlines"
        title={t("insights.stats.airlines")}
        locale={locale}
        entries={airlines.map(({ code, count }) => {
          const name = airlineDisplayName(code, locale);
          return {
            key: code,
            name,
            code,
            count,
            pressed: view.airline === code,
            action: `${t("passport.flightFrequency", { count })}. ${t("passport.filterAirline", { airline: name })}`,
            onToggle: () => onToggleAirline(code),
          };
        })}
      />
      <Ranking
        region="aircraft"
        title={t("insights.stats.aircraft")}
        locale={locale}
        entries={aircraft.map(({ code, count }) => ({
          key: code,
          name: code,
          count,
          pressed: view.aircraft === code,
          action: `${t("passport.flightFrequency", { count })}. ${t("insights.stats.filterAircraft", { aircraft: code })}`,
          onToggle: () => onToggleAircraft(code),
        }))}
      />

      <Panel region="cabins" title={t("insights.stats.cabins")}>
        {derived.cabins.length ? (
          <ol className="stats-ranking">
            {derived.cabins.map(({ cabin, count }) => (
              <li
                key={cabin ?? ""}
                className="stats-rank"
                data-key={cabin ?? "not-recorded"}
                data-count={count}
              >
                <span className="stats-rank-name">
                  {cabin === null
                    ? t("insights.stats.cabinNotRecorded")
                    : cabinLabel(cabin)}
                </span>
                <Bar share={maximumCabin ? count / maximumCabin : 0} />
                <span className="stats-rank-count" aria-hidden="true">
                  {count.toLocaleString(locale)}
                </span>
                <span className="sr-only">
                  {t("passport.flightFrequency", { count })}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="stats-empty">{t("insights.stats.noData")}</p>
        )}
      </Panel>

      <Panel region="records" title={t("insights.stats.records")}>
        <ul className="stats-records">
          {distanceRecord(
            "longest",
            t("passport.longestFlight"),
            byId(stats.longestFlight?.flightId),
          )}
          {distanceRecord(
            "shortest",
            t("passport.shortestFlight"),
            byId(stats.shortestFlight?.flightId),
          )}
          {record(
            "delay",
            t("insights.stats.longestArrivalDelay"),
            delayed,
            delayed && derived.longestDelay
              ? [
                  delayed.flightNumber,
                  formatDuration(derived.longestDelay.minutes, locale),
                ]
              : [],
          )}
          {record(
            "route",
            t("insights.stats.mostFlownRoute"),
            routeFlight,
            derived.route
              ? [t("passport.flightFrequency", { count: derived.route.count })]
              : [],
            derived.route?.target,
          )}
        </ul>
      </Panel>
    </div>
  );
}
