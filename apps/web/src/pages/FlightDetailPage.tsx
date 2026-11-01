import {
  Children,
  lazy,
  Suspense,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  aircraftFacts,
  airlineNames,
  airportByIata,
  arrivalIdentity,
  originIdentity,
  plannedDestinationIdentity,
  type AssignmentEvidence,
  type FlightEndpointIdentity,
  airportCityGroupForAirport,
  airportCityGroupName,
  baggageFacts,
  distanceForFlight,
  flightDuration,
  flightTimeDisplay,
  formatCityDisplayName,
  formatDistance,
  formatDuration,
  formatServiceDate,
  formatTicketNumber,
  frequentFlyerSnapshot,
  localizedText,
  resolveAirline,
  seatFacts,
  ticketFacts,
  type DistanceUnit,
  type SupportedLocale,
  type TimeFormat,
  type FrequentFlyerMembership,
  type FlightStopTimes,
} from "@keepraw-fly/core";
import { FlightDeviation, FlightTime } from "../components/FlightTime";
import { useAirportHistoryVersion } from "../data/airport-history";
import { PageShell } from "../components/PageShell";
import type { Appearance } from "../storage/types";
import type { SolarMode } from "../globe/globe-solar";

const DetailGlobe = lazy(() =>
  import("../globe/DetailGlobe").then((module) => ({
    default: module.DetailGlobe,
  })),
);

// The Globe is part of the two-column Hero, so narrow details never mount it.
const DETAIL_DESKTOP_QUERY = "(min-width: 1200px)";

interface FlightDetailPageProps {
  flight: KeeprawFlight;
  memberships: readonly FrequentFlyerMembership[];
  locale: SupportedLocale;
  distanceUnit: DistanceUnit;
  timeFormat: TimeFormat;
  appearance: Appearance;
  solarMode: SolarMode;
}

function AirportStop({
  kind,
  iata,
  city,
  airport,
  terminal,
  gate,
  baggageCarousel,
  times,
  scheduled,
  plannedAirport,
  plannedCity,
  plannedName,
  plannedTerminal,
  plannedGate,
  history,
  zone,
  plannedZone,
}: {
  history?: {
    note?: string;
    coordinates?: string;
    status: string;
    evidence: AssignmentEvidence;
    evidenceText: string;
  };
  /** Flight-date historical zone; null when the airport is undetermined. */
  zone?: string | null;
  plannedZone?: string | null;
  kind: "departure" | "arrival";
  iata: string;
  city: string;
  airport?: string;
  terminal?: string;
  gate?: string;
  baggageCarousel?: string;
  times: FlightStopTimes;
  scheduled?: FlightStopTimes["primary"];
  plannedAirport?: string;
  plannedCity?: string;
  plannedName?: string;
  plannedTerminal?: string;
  plannedGate?: string;
}) {
  const { t } = useTranslation();
  return (
    <section
      className={`detail-stop detail-stop--${kind}`}
      aria-label={t(`flightDetail.${kind}`)}
    >
      <div className="detail-stop-heading">
        <div className="detail-stop-place">
          <span className="detail-stop-kind">{t(`flightDetail.${kind}`)}</span>
          <div>
            <strong>{iata}</strong>
            <i aria-hidden="true">·</i>
            <span
              className={
                kind === "departure"
                  ? "route-origin-city"
                  : "route-arrival-city"
              }
            >
              {city}
            </span>
          </div>
          {airport ? (
            <p
              className={
                kind === "departure"
                  ? "route-origin-airport"
                  : "route-arrival-airport"
              }
            >
              {airport}
            </p>
          ) : null}
          {history ? (
            <p
              className="detail-airport-evidence"
              data-assignment-evidence={history.evidence}
            >
              {history.evidenceText}
            </p>
          ) : null}
          {history?.note ? (
            <p
              className="detail-airport-history"
              data-airport-history={history.status}
            >
              {history.note}
              {history.coordinates ? (
                <span className="detail-airport-coordinates">
                  {" · "}
                  {history.coordinates}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
        {terminal || gate || baggageCarousel ? (
          <dl className="detail-stop-facts">
            {terminal ? (
              <div>
                <dt>{t("flightDetail.terminal")}</dt>
                <dd>{terminal}</dd>
              </div>
            ) : null}
            {gate ? (
              <div>
                <dt>{t("flightDetail.gate")}</dt>
                <dd>{gate}</dd>
              </div>
            ) : null}
            {baggageCarousel ? (
              <div>
                <dt>{t("flightDetail.baggageCarousel")}</dt>
                <dd>{baggageCarousel}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </div>
      <div className="detail-stop-timing">
        <div className="detail-stop-times">
          <FlightTime
            className="detail-airport-time"
            value={times.primary}
            showSource
            sourceLabel={
              times.primary.source === "scheduled" && plannedAirport
                ? t("flightDetail.plannedArrival", { airport: plannedAirport })
                : t(`flightDetail.${times.primary.source}`)
            }
            showZone
            timeZone={
              (times.primary.source === "scheduled" && plannedAirport
                ? plannedZone
                : zone) ?? undefined
            }
          />
          {scheduled ? (
            <FlightTime
              className="detail-scheduled-time"
              value={scheduled}
              showSource
              sourceLabel={
                plannedAirport
                  ? t("flightDetail.plannedArrival", {
                      airport: plannedAirport,
                    })
                  : t("flightDetail.scheduled")
              }
              showZone
              timeZone={(plannedAirport ? plannedZone : zone) ?? undefined}
            />
          ) : null}
        </div>
        {times.delayMinutes !== null && times.delayMinutes !== 0 ? (
          <div className="detail-stop-meta">
            <FlightDeviation kind={kind} minutes={times.delayMinutes} />
          </div>
        ) : null}
      </div>
      {plannedAirport ? (
        <div className="detail-planned-arrival">
          <p className="detail-planned-airport">
            {t("flightDetail.plannedArrival", { airport: plannedAirport })}
            {" · "}
            {plannedCity}
            {plannedName ? (
              <span className="detail-planned-name">{plannedName}</span>
            ) : null}
          </p>
          {plannedTerminal || plannedGate ? (
            <dl className="detail-stop-facts detail-planned-facts">
              {plannedTerminal ? (
                <div>
                  <dt>{t("flightDetail.terminal")}</dt>
                  <dd>{plannedTerminal}</dd>
                </div>
              ) : null}
              {plannedGate ? (
                <div>
                  <dt>{t("flightDetail.gate")}</dt>
                  <dd>{plannedGate}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function MetadataColumn({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="detail-metadata-column" aria-label={title}>
      <h2>{title}</h2>
      <div className="detail-record-groups">{children}</div>
    </section>
  );
}

function DetailFactGroup({ children }: { children: ReactNode }) {
  const facts = Children.toArray(children);
  if (!facts.length) return null;
  return (
    <dl className="detail-record-facts" data-count={facts.length}>
      {facts}
    </dl>
  );
}

function DetailFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-record-item">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** The flight-date physical airport's name; a historical site keeps its own. */
function airportNameLabel(
  identity: FlightEndpointIdentity,
  iata: string,
  locale: SupportedLocale,
): string | undefined {
  if (identity.name) return localizedText(identity.name, locale) || iata;
  const airport = airportByIata.get(iata);
  if (!airport || !identity.confirmed) return undefined;
  return localizedText(airport.name, locale) || iata;
}

function formatCoordinates(point: { latitude: number; longitude: number }) {
  const lat = `${Math.abs(point.latitude).toFixed(4)}°${point.latitude >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(point.longitude).toFixed(4)}°${point.longitude >= 0 ? "E" : "W"}`;
  return `${lat}, ${lon}`;
}

function airportHistory(
  identity: FlightEndpointIdentity,
  t: (key: string, options?: Record<string, unknown>) => string,
): {
  note?: string;
  coordinates?: string;
  status: string;
  evidence: AssignmentEvidence;
  evidenceText: string;
} {
  // What the code assignment rests on is always stated: a usable position
  // from today's directory is never presented as a verified historical fact.
  return {
    ...airportHistoryNote(identity, t),
    evidence: identity.assignmentEvidence,
    evidenceText: t(
      `flightDetail.airportHistory.evidence.${identity.assignmentEvidence}`,
    ),
  };
}

function airportHistoryNote(
  identity: FlightEndpointIdentity,
  t: (key: string, options?: Record<string, unknown>) => string,
): { note?: string; coordinates?: string; status: string } {
  if (identity.basis === "formal" && identity.differsFromCurrentDirectory)
    return {
      status: "historical",
      note: t("flightDetail.airportHistory.historicalSite"),
      coordinates: identity.point
        ? formatCoordinates(identity.point)
        : undefined,
    };
  if (identity.basis === "formal_open_horizon_current_directory")
    return {
      status: "uncertain-horizon",
      note: t("flightDetail.airportHistory.openHorizon"),
    };
  if (!identity.confirmed) {
    const key =
      identity.status === "historical_candidate"
        ? "candidate"
        : identity.status === "uncertain"
          ? "uncertain"
          : identity.status === "ambiguous"
            ? "ambiguous"
            : identity.status === "candidate_index_unavailable"
              ? "pending"
              : "unknown";
    return {
      status: identity.status,
      note: t(`flightDetail.airportHistory.${key}`, {
        sites: identity.possiblePositions.length,
      }),
    };
  }
  return { status: identity.status };
}

// Match FlightRow's display rules without changing airport data or route semantics.
function airportCityLabel(iata: string, locale: SupportedLocale): string {
  const airport = airportByIata.get(iata);
  const cityGroup = airportCityGroupForAirport(iata);
  const name = cityGroup
    ? airportCityGroupName(cityGroup, locale)
    : airport && localizedText(airport.city, locale);
  return name
    ? formatCityDisplayName(
        name,
        cityGroup?.country ?? airport?.country ?? "",
        locale,
      )
    : iata;
}

function cabinTranslationKey(cabin: string): string | undefined {
  if (cabin === "economy") return "flightEditor.cabins.economy";
  if (cabin === "premium economy") return "flightEditor.cabins.premiumEconomy";
  if (cabin === "business") return "flightEditor.cabins.business";
  if (cabin === "first") return "flightEditor.cabins.first";
  return undefined;
}

export function FlightDetailPage({
  flight,
  memberships,
  locale,
  distanceUnit,
  timeFormat,
  appearance,
  solarMode,
}: FlightDetailPageProps) {
  const { t } = useTranslation();
  const [showDesktopMap, setShowDesktopMap] = useState(
    () =>
      typeof window !== "undefined" &&
      Boolean(window.matchMedia?.(DETAIL_DESKTOP_QUERY).matches),
  );
  useEffect(() => {
    const media = window.matchMedia?.(DETAIL_DESKTOP_QUERY);
    if (!media) return;
    const update = () => setShowDesktopMap(media.matches);
    media.addEventListener("change", update);
    update();
    return () => media.removeEventListener("change", update);
  }, []);

  // Flight-date physical airports: names, coordinates and zones by history.
  useAirportHistoryVersion();
  const origin = originIdentity(flight);
  const actualDestination = arrivalIdentity(flight);
  const plannedDestination = plannedDestinationIdentity(flight);
  const airline = resolveAirline(flight.airline);
  const airlineNamePair = airline ? airlineNames(airline, locale) : null;
  const airlineName =
    airlineNamePair?.[0] ?? flight.airline.iata ?? flight.airline.icao;
  const aircraft = aircraftFacts(flight);
  const seat = seatFacts(flight);
  const baggage = baggageFacts(flight);
  const ticket = ticketFacts(flight);
  const frequentFlyer = frequentFlyerSnapshot(flight, memberships, locale);
  const duration = flightDuration(flight);
  const distance = distanceForFlight(flight);
  const times = flightTimeDisplay(flight, locale, timeFormat);
  const phase = flight.cancelled
    ? t("status.cancelled")
    : flight.divertedTo
      ? t("status.diverted")
      : flight.actualArrival
        ? t("flightDetail.arrived")
        : flight.actualDeparture
          ? t("flightDetail.departed")
          : t("status.scheduled");
  const distanceLabel =
    distance === null
      ? undefined
      : t(
          distanceUnit === "miles"
            ? "flightDetail.distanceMiles"
            : "flightDetail.distanceKilometers",
          {
            value: formatDistance(distance, locale, distanceUnit),
          },
        );
  const durationLabel = formatDuration(duration.minutes, locale);
  const cabinKey = seat?.cabin ? cabinTranslationKey(seat.cabin) : undefined;
  const cabinLabel = cabinKey ? t(cabinKey) : seat?.cabin;
  const hasExperience = Boolean(
    aircraft?.type ||
    aircraft?.registration ||
    seat?.seat ||
    cabinLabel ||
    seat?.bookingClass,
  );
  const hasTripRecord = Boolean(ticket || flight.bookingReference);
  const arrivalEndpoint = flight.divertedTo ?? flight.destination;

  return (
    <PageShell className="detail-page">
      <article
        className="detail-flight-card"
        aria-labelledby="flight-detail-title"
      >
        <div className="detail-hero-grid">
          <div className="detail-hero-information">
            <header className="detail-heading">
              <div className="detail-heading-identity">
                <h1 id="flight-detail-title">
                  {airportCityLabel(flight.origin.iata, locale)}{" "}
                  <span>{t("flightDetail.to")}</span>{" "}
                  {airportCityLabel(flight.destination.iata, locale)}
                </h1>
                <div className="detail-heading-eyebrow">
                  <strong>{flight.flightNumber}</strong>
                  {airlineName ? (
                    <>
                      <i aria-hidden="true">·</i>
                      <span className="detail-airline-name">{airlineName}</span>
                    </>
                  ) : null}
                  <i aria-hidden="true">·</i>
                  <time dateTime={flight.serviceDate}>
                    {formatServiceDate(flight.serviceDate, locale, {
                      weekday: "short",
                      year: "numeric",
                      month: "short",
                      day: "2-digit",
                    })}
                  </time>
                  <i aria-hidden="true">·</i>
                  <span className="detail-heading-summary">
                    <strong
                      className={`detail-flight-phase${flight.cancelled ? " is-cancelled" : flight.divertedTo ? " is-diverted" : ""}`}
                    >
                      {phase}
                    </strong>
                    {flight.divertedTo ? (
                      <span className="detail-diversion-note">
                        {t("flightDetail.divertedTo", {
                          airport: flight.divertedTo.iata,
                        })}
                      </span>
                    ) : null}
                  </span>
                </div>
              </div>
            </header>

            <div
              className="detail-stops"
              role="group"
              aria-label={t("flightDetail.timeline")}
            >
              <AirportStop
                kind="departure"
                iata={flight.origin.iata}
                city={airportCityLabel(flight.origin.iata, locale)}
                airport={airportNameLabel(origin, flight.origin.iata, locale)}
                history={airportHistory(origin, t)}
                zone={origin.timezone}
                terminal={flight.origin.terminal}
                gate={flight.origin.gate}
                times={times.departure}
                scheduled={
                  times.departure.primary.source === "actual"
                    ? times.scheduled.departure
                    : undefined
                }
              />
              <div
                className="detail-segment-meta"
                aria-label={t("flightDetail.journey")}
              >
                <span>
                  {t(`flightDetail.durationSource.${duration.source}`)}{" "}
                  {durationLabel}
                </span>
                {distanceLabel ? <span>{distanceLabel}</span> : null}
                {times.overnight ? (
                  <span>{t("flightTiming.overnight")}</span>
                ) : null}
              </div>
              <AirportStop
                kind="arrival"
                iata={flight.divertedTo?.iata ?? flight.destination.iata}
                city={airportCityLabel(
                  flight.divertedTo?.iata ?? flight.destination.iata,
                  locale,
                )}
                airport={airportNameLabel(
                  actualDestination,
                  flight.divertedTo?.iata ?? flight.destination.iata,
                  locale,
                )}
                history={airportHistory(actualDestination, t)}
                zone={actualDestination.timezone}
                plannedZone={plannedDestination.timezone}
                terminal={arrivalEndpoint.terminal}
                gate={arrivalEndpoint.gate}
                baggageCarousel={baggage?.carousel}
                times={times.arrival}
                scheduled={
                  times.arrival.primary.source === "actual"
                    ? times.scheduled.arrival
                    : undefined
                }
                plannedAirport={
                  flight.divertedTo ? flight.destination.iata : undefined
                }
                plannedCity={
                  flight.divertedTo
                    ? airportCityLabel(flight.destination.iata, locale)
                    : undefined
                }
                plannedName={
                  flight.divertedTo
                    ? airportNameLabel(
                        plannedDestination,
                        flight.destination.iata,
                        locale,
                      )
                    : undefined
                }
                plannedTerminal={
                  flight.divertedTo ? flight.destination.terminal : undefined
                }
                plannedGate={
                  flight.divertedTo ? flight.destination.gate : undefined
                }
              />
            </div>
          </div>

          {showDesktopMap ? (
            <Suspense
              fallback={
                <section
                  className="detail-route-map detail-route-map-loading"
                  aria-busy="true"
                >
                  <span>{t("app.loading")}</span>
                </section>
              }
            >
              <DetailGlobe
                key={flight.id}
                flight={flight}
                appearance={appearance}
                solarMode={solarMode}
              />
            </Suspense>
          ) : null}
        </div>

        {hasExperience || hasTripRecord || frequentFlyer ? (
          <div
            className="detail-metadata-shelf"
            data-count={
              Number(hasExperience) +
              Number(hasTripRecord) +
              Number(Boolean(frequentFlyer))
            }
          >
            {hasExperience ? (
              <MetadataColumn title={t("flightDetail.flightExperience")}>
                <DetailFactGroup>
                  {aircraft?.type ? (
                    <DetailFact
                      label={t("flightDetail.aircraft")}
                      value={aircraft.type}
                    />
                  ) : null}
                  {aircraft?.registration ? (
                    <DetailFact
                      label={t("flightDetail.registration")}
                      value={aircraft.registration}
                    />
                  ) : null}
                </DetailFactGroup>
                <DetailFactGroup>
                  {seat?.seat ? (
                    <DetailFact
                      label={t("flightDetail.seat")}
                      value={seat.seat}
                    />
                  ) : null}
                  {cabinLabel ? (
                    <DetailFact
                      label={t("flightDetail.cabinClass")}
                      value={cabinLabel}
                    />
                  ) : null}
                  {seat?.bookingClass ? (
                    <DetailFact
                      label={t("flightDetail.bookingClass")}
                      value={seat.bookingClass}
                    />
                  ) : null}
                </DetailFactGroup>
              </MetadataColumn>
            ) : null}
            {hasTripRecord ? (
              <MetadataColumn title={t("flightDetail.tripRecord")}>
                <DetailFactGroup>
                  {ticket ? (
                    <DetailFact
                      label={t("flightDetail.ticketNumber")}
                      value={formatTicketNumber(ticket.number)}
                    />
                  ) : null}
                </DetailFactGroup>
                <DetailFactGroup>
                  {flight.bookingReference ? (
                    <DetailFact
                      label={t("flightDetail.bookingReference")}
                      value={flight.bookingReference}
                    />
                  ) : null}
                </DetailFactGroup>
              </MetadataColumn>
            ) : null}
            {frequentFlyer ? (
              <MetadataColumn title={t("flightDetail.frequentFlyer")}>
                <DetailFactGroup>
                  <DetailFact
                    label={t("flightDetail.frequentFlyerProgram")}
                    value={frequentFlyer.programName}
                  />
                </DetailFactGroup>
                <DetailFactGroup>
                  {frequentFlyer.tierAtFlight ? (
                    <DetailFact
                      label={t("flightDetail.tier")}
                      value={frequentFlyer.tierAtFlight}
                    />
                  ) : null}
                  <DetailFact
                    label={t("flightDetail.memberNumber")}
                    value={frequentFlyer.memberNumber}
                  />
                </DetailFactGroup>
              </MetadataColumn>
            ) : null}
          </div>
        ) : null}
      </article>
    </PageShell>
  );
}
