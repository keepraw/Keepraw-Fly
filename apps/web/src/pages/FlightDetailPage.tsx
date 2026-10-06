import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  aircraftFacts,
  airlineNames,
  airportByIata,
  baggageFacts,
  distanceForFlight,
  flightDuration,
  flightTimeDisplay,
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
import { PageShell } from "../components/PageShell";

const FlightRouteMap = lazy(() =>
  import("../components/FlightRouteMap").then((module) => ({
    default: module.FlightRouteMap,
  })),
);

interface FlightDetailPageProps {
  flight: KeeprawFlight;
  memberships: readonly FrequentFlyerMembership[];
  locale: SupportedLocale;
  distanceUnit: DistanceUnit;
  timeFormat: TimeFormat;
}

type IconKind =
  "arrival" | "baggage" | "departure" | "flight" | "gate" | "star";

function DetailIcon({ kind }: { kind: IconKind }) {
  if (kind === "gate") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 16 17 7m-7 0h7v7" />
      </svg>
    );
  }
  if (kind === "baggage") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7m-9 0h10a2 2 0 0 1 2 2v10H5V9a2 2 0 0 1 2-2Zm3 4v4m4-4v4M8 21v-2m8 2v-2" />
      </svg>
    );
  }
  if (kind === "star") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1Z" />
      </svg>
    );
  }
  if (kind === "flight") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m21 16-8-2.5V19l2 1.5V22l-3.5-1L8 22v-1.5l2-1.5v-5.5L2 16v-2l8-5V3.5a1.5 1.5 0 0 1 3 0V9l8 5Z" />
      </svg>
    );
  }
  if (kind === "departure") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2.5 19h19M21 9l-6.1 1.7L8 4.3l-1.4.5 3.9 7.3-4.6 1.3-2.4-1-1.2.5 3.2 2.7c.8.6 1.8.8 2.8.5L21 11.7c.8-.3 1.3-1.1 1.1-1.8A1.5 1.5 0 0 0 21 9Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 19h19m-2.2-7.9-3.4-2.6L9 10.4 4.5 7.8l-1.3.7 3.2 5.5L2 15.2v1.5l16.1-4.3c.7-.2 1.1-.9.9-1.6-.1-.5-.7-1-1.2-1Z" />
    </svg>
  );
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
}: {
  kind: "departure" | "arrival";
  iata: string;
  city: string;
  airport?: string;
  terminal?: string;
  gate?: string;
  baggageCarousel?: string;
  times: FlightStopTimes;
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
        </div>
      </div>
      <div className="detail-stop-timing">
        <div className="detail-stop-times">
          <FlightTime
            className="detail-airport-time"
            value={times.primary}
            showSource
          />
          {times.scheduled ? (
            <FlightTime
              className="detail-scheduled-time"
              value={times.scheduled}
              showSource
            />
          ) : null}
        </div>
        <div className="detail-stop-meta">
          <FlightDeviation kind={kind} minutes={times.delayMinutes} />
        </div>
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
    </section>
  );
}

function MetadataColumn({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="detail-metadata-column">
      <div>
        <h2>{title}</h2>
        {children}
      </div>
      {footer ? <div className="detail-metadata-footer">{footer}</div> : null}
    </section>
  );
}

function MobileFact({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`detail-mobile-fact${wide ? " detail-mobile-fact--wide" : ""}`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function airportNameLabel(
  airport: ReturnType<typeof airportByIata.get>,
  iata: string,
  locale: SupportedLocale,
): string | undefined {
  if (!airport) return undefined;
  return localizedText(airport.name, locale) || iata;
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
}: FlightDetailPageProps) {
  const { t } = useTranslation();
  const [showDesktopMap, setShowDesktopMap] = useState(
    () =>
      typeof window !== "undefined" &&
      Boolean(window.matchMedia?.("(min-width: 761px)").matches),
  );
  useEffect(() => {
    const media = window.matchMedia?.("(min-width: 761px)");
    if (!media) return;
    const update = () => setShowDesktopMap(media.matches);
    media.addEventListener("change", update);
    update();
    return () => media.removeEventListener("change", update);
  }, []);
  const origin = airportByIata.get(flight.origin.iata);
  const destination = airportByIata.get(flight.destination.iata);
  const actualDestination = airportByIata.get(
    flight.divertedTo?.iata ?? flight.destination.iata,
  );
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
  const experienceLine = [seat?.seat, cabinLabel, seat?.bookingClass]
    .filter(Boolean)
    .join(" · ");
  const hasExperience = Boolean(
    aircraft?.type || aircraft?.registration || seat,
  );
  const hasTripRecord = Boolean(ticket || flight.bookingReference);

  return (
    <PageShell className="detail-page">
      <article
        className="detail-flight-card"
        aria-labelledby="flight-detail-title"
      >
        <header className="detail-heading">
          <div className="detail-heading-eyebrow">
            <strong>{flight.flightNumber}</strong>
            {airlineName ? (
              <span className="detail-airline-name">{airlineName}</span>
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
          </div>
          <h1 id="flight-detail-title">
            {origin ? localizedText(origin.city, locale) : flight.origin.iata}{" "}
            <span>{t("flightDetail.to")}</span>{" "}
            {destination
              ? localizedText(destination.city, locale)
              : flight.destination.iata}
          </h1>
          {flight.divertedTo ? (
            <p className="detail-diversion-note">
              {t("flightDetail.divertedTo", {
                airport: flight.divertedTo.iata,
              })}
            </p>
          ) : null}
          <div className="detail-heading-summary">
            <strong>{phase}</strong>
            {!flight.cancelled && !flight.divertedTo ? (
              <>
                <FlightDeviation
                  kind="departure"
                  minutes={times.departure.delayMinutes}
                />
                <FlightDeviation
                  kind="arrival"
                  minutes={times.arrival.delayMinutes}
                />
              </>
            ) : null}
            <i aria-hidden="true">·</i>
            <span className="detail-heading-route-summary">
              {t("flightDetail.total")} {durationLabel}
              {distanceLabel ? ` · ${distanceLabel}` : ""}
            </span>
          </div>
        </header>

        <div className="detail-operational-grid">
          <div className="detail-stops">
            <AirportStop
              kind="departure"
              iata={flight.origin.iata}
              city={
                origin ? localizedText(origin.city, locale) : flight.origin.iata
              }
              airport={airportNameLabel(origin, flight.origin.iata, locale)}
              terminal={flight.origin.terminal}
              gate={flight.origin.gate}
              times={times.departure}
            />
            <div className="detail-segment-meta">
              <span>
                {t("flightDetail.total")} {durationLabel}
              </span>
              {distanceLabel ? <span>{distanceLabel}</span> : null}
              {times.overnight ? (
                <span>{t("flightTiming.overnight")}</span>
              ) : null}
            </div>
            <AirportStop
              kind="arrival"
              iata={flight.divertedTo?.iata ?? flight.destination.iata}
              city={
                actualDestination
                  ? localizedText(actualDestination.city, locale)
                  : (flight.divertedTo?.iata ?? flight.destination.iata)
              }
              airport={airportNameLabel(
                actualDestination,
                flight.divertedTo?.iata ?? flight.destination.iata,
                locale,
              )}
              terminal={flight.destination.terminal}
              gate={flight.destination.gate}
              baggageCarousel={baggage?.carousel}
              times={times.arrival}
            />
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
              <FlightRouteMap flight={flight} />
            </Suspense>
          ) : null}
        </div>

        {hasExperience || hasTripRecord || frequentFlyer ? (
          <div className="detail-metadata-shelf">
            {hasExperience ? (
              <MetadataColumn
                title={t("flightDetail.flightExperience")}
                footer={
                  aircraft?.registration ? (
                    <span>
                      {t("flightDetail.registration")} {aircraft.registration}
                    </span>
                  ) : undefined
                }
              >
                <div className="detail-metadata-desktop">
                  {aircraft?.type ? (
                    <strong className="detail-metadata-primary">
                      {aircraft.type}
                    </strong>
                  ) : null}
                  {experienceLine ? <p>{experienceLine}</p> : null}
                </div>
                <div className="detail-mobile-facts">
                  {aircraft?.type ? (
                    <MobileFact
                      label={t("flightDetail.aircraft")}
                      value={aircraft.type}
                    />
                  ) : null}
                  {seat?.seat ? (
                    <MobileFact
                      label={t("flightDetail.seat")}
                      value={seat.seat}
                    />
                  ) : null}
                  {cabinLabel ? (
                    <MobileFact
                      label={t("flightDetail.cabinClass")}
                      value={cabinLabel}
                    />
                  ) : null}
                  {seat?.bookingClass ? (
                    <MobileFact
                      label={t("flightDetail.bookingClass")}
                      value={seat.bookingClass}
                    />
                  ) : null}
                </div>
              </MetadataColumn>
            ) : null}

            {hasTripRecord ? (
              <MetadataColumn title={t("flightDetail.tripRecord")}>
                <div className="detail-record-facts">
                  {ticket ? (
                    <div className="detail-record-item detail-record-item--wide">
                      <span>{t("flightDetail.ticketNumber")}</span>
                      <strong>{formatTicketNumber(ticket.number)}</strong>
                    </div>
                  ) : null}
                  {flight.bookingReference ? (
                    <div
                      className={`detail-record-item${flight.bookingReference.length > 12 ? " detail-record-item--wide" : ""}`}
                    >
                      <span>{t("flightDetail.bookingReference")}</span>
                      <strong>{flight.bookingReference}</strong>
                    </div>
                  ) : null}
                </div>
              </MetadataColumn>
            ) : null}

            {frequentFlyer ? (
              <section className="frequent-flyer-card">
                <h2 className="detail-mobile-section-title">
                  {t("flightDetail.frequentFlyer")}
                </h2>
                <div className="frequent-flyer-card-heading">
                  <span>
                    <DetailIcon kind="star" />
                    {t("flightDetail.frequentFlyer")}
                  </span>
                  {frequentFlyer.tierAtFlight ? (
                    <strong>{frequentFlyer.tierAtFlight}</strong>
                  ) : null}
                </div>
                <div className="frequent-flyer-card-main">
                  <strong>{frequentFlyer.programName}</strong>
                </div>
                <div className="frequent-flyer-card-footer">
                  <span>{t("flightDetail.memberNumber")}</span>
                  <strong>{frequentFlyer.memberNumber}</strong>
                </div>
                <div className="detail-mobile-facts">
                  <MobileFact
                    label={t("flightDetail.frequentFlyerProgram")}
                    value={frequentFlyer.programName}
                    wide={frequentFlyer.programName.length > 12}
                  />
                  {frequentFlyer.tierAtFlight ? (
                    <MobileFact
                      label={t("flightDetail.tier")}
                      value={frequentFlyer.tierAtFlight}
                    />
                  ) : null}
                  <MobileFact
                    label={t("flightDetail.memberNumber")}
                    value={frequentFlyer.memberNumber}
                    wide
                  />
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </article>
    </PageShell>
  );
}
