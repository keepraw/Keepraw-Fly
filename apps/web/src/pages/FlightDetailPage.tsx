import { lazy, Suspense, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  aircraftFacts, airlineNames, airportByIata, arrivalDelayMinutes, baggageFacts,
  departureDelayMinutes, distanceForFlight, flightDuration, flightOperationalStatus,
  formatDistance, formatServiceDate, formatTicketNumber,
  formatTimeAtAirport, frequentFlyerSnapshot, localizedText, resolveAirline, seatFacts, ticketFacts,
  type DistanceUnit, type SupportedLocale, type TimeFormat,
} from "@keepraw-fly/core";
import { PageShell } from "../components/PageShell";

const FlightRouteMap = lazy(() => import("../components/FlightRouteMap")
  .then((module) => ({ default: module.FlightRouteMap })));

interface FlightDetailPageProps {
  flight: KeeprawFlight;
  locale: SupportedLocale;
  distanceUnit: DistanceUnit;
  timeFormat: TimeFormat;
}

type IconKind = "arrival" | "baggage" | "departure" | "flight" | "gate" | "star";

function DetailIcon({ kind }: { kind: IconKind }) {
  if (kind === "gate") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 16 17 7m-7 0h7v7" /></svg>;
  }
  if (kind === "baggage") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7m-9 0h10a2 2 0 0 1 2 2v10H5V9a2 2 0 0 1 2-2Zm3 4v4m4-4v4M8 21v-2m8 2v-2" /></svg>;
  }
  if (kind === "star") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1Z" /></svg>;
  }
  if (kind === "flight") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 16-8-2.5V19l2 1.5V22l-3.5-1L8 22v-1.5l2-1.5v-5.5L2 16v-2l8-5V3.5a1.5 1.5 0 0 1 3 0V9l8 5Z" /></svg>;
  }
  if (kind === "departure") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 19h19M21 9l-6.1 1.7L8 4.3l-1.4.5 3.9 7.3-4.6 1.3-2.4-1-1.2.5 3.2 2.7c.8.6 1.8.8 2.8.5L21 11.7c.8-.3 1.3-1.1 1.1-1.8A1.5 1.5 0 0 0 21 9Z" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 19h19m-2.2-7.9-3.4-2.6L9 10.4 4.5 7.8l-1.3.7 3.2 5.5L2 15.2v1.5l16.1-4.3c.7-.2 1.1-.9.9-1.6-.1-.5-.7-1-1.2-1Z" /></svg>;
}

function OperationBadge({ icon, value, meta }: { icon: "baggage" | "gate"; value: string; meta?: string }) {
  return (
    <div className="operation-badge-group">
      <div className="operation-badge">
        <DetailIcon kind={icon} />
        <strong>{value}</strong>
      </div>
      {meta ? <span>{meta}</span> : null}
    </div>
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
  actualTime,
  scheduledTime,
  delay,
  timestamp,
}: {
  kind: "departure" | "arrival";
  iata: string;
  city: string;
  airport?: string;
  terminal?: string;
  gate?: string;
  baggageCarousel?: string;
  actualTime: string;
  scheduledTime?: string;
  delay: number | null;
  timestamp: string;
}) {
  const { t } = useTranslation();
  const operationValue = kind === "departure" ? gate : baggageCarousel ?? gate;
  const operationIcon = kind === "arrival" && baggageCarousel ? "baggage" : "gate";
  const operationMeta = terminal ? `${t("flightDetail.terminal")} ${terminal}` : undefined;
  const delayLabel = delay === null
    ? undefined
    : delay === 0
      ? t("status.onTime")
      : t(delay < 0 ? "flightDetail.earlyShort" : "flightDetail.lateShort", { count: Math.abs(delay) });

  return (
    <section className={`detail-stop detail-stop--${kind}`} aria-label={t(`flightDetail.${kind}`)}>
      <div className="detail-stop-heading">
        <div className="detail-stop-place">
          <div>
            <DetailIcon kind={kind} />
            <strong>{iata}</strong>
            <i aria-hidden="true">·</i>
            <span className={kind === "departure" ? "route-origin-city" : "route-arrival-city"}>{city}</span>
          </div>
          {airport ? <p className={kind === "departure" ? "route-origin-airport" : "route-arrival-airport"}>{airport}</p> : null}
        </div>
        {operationValue ? <OperationBadge icon={operationIcon} value={operationValue} meta={operationMeta} /> : null}
      </div>

      <div className="detail-stop-times">
        <time className="detail-airport-time" dateTime={timestamp}>{actualTime}</time>
        {scheduledTime ? <time className="detail-scheduled-time" dateTime={timestamp}>{scheduledTime}</time> : null}
      </div>
      <div className="detail-stop-meta">
        {delayLabel ? <strong className={delay === 0 ? "is-on-time" : delay! < 0 ? "is-early" : "is-delayed"}>{delayLabel}</strong> : null}
        {!operationValue && terminal ? <span>{operationMeta}</span> : null}
        {kind === "arrival" && baggageCarousel && gate ? <span>{t("flightDetail.gate")} {gate}</span> : null}
      </div>
    </section>
  );
}

function MetadataColumn({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
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

function airportNameLabel(airport: ReturnType<typeof airportByIata.get>, iata: string, locale: SupportedLocale): string | undefined {
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

export function FlightDetailPage({ flight, locale, distanceUnit, timeFormat }: FlightDetailPageProps) {
  const { t } = useTranslation();
  const origin = airportByIata.get(flight.origin.iata);
  const destination = airportByIata.get(flight.destination.iata);
  const airline = resolveAirline(flight.airline);
  const airlineNamePair = airline ? airlineNames(airline, locale) : null;
  const airlineName = airlineNamePair?.[0] ?? flight.airline.iata ?? flight.airline.icao;
  const aircraft = aircraftFacts(flight);
  const seat = seatFacts(flight);
  const baggage = baggageFacts(flight);
  const ticket = ticketFacts(flight);
  const frequentFlyer = frequentFlyerSnapshot(flight);
  const duration = flightDuration(flight);
  const distance = distanceForFlight(flight);
  const operationalStatus = flightOperationalStatus(flight);
  const departureDelay = departureDelayMinutes(flight);
  const arrivalDelay = arrivalDelayMinutes(flight);
  const departureTimestamp = flight.actualDeparture ?? flight.scheduledDeparture;
  const arrivalTimestamp = flight.actualArrival ?? flight.scheduledArrival;
  const departureTime = formatTimeAtAirport(departureTimestamp, flight.origin.iata, locale, timeFormat);
  const arrivalTime = formatTimeAtAirport(arrivalTimestamp, flight.destination.iata, locale, timeFormat);
  const scheduledDepartureTime = flight.actualDeparture
    ? formatTimeAtAirport(flight.scheduledDeparture, flight.origin.iata, locale, timeFormat) : undefined;
  const scheduledArrivalTime = flight.actualArrival
    ? formatTimeAtAirport(flight.scheduledArrival, flight.destination.iata, locale, timeFormat) : undefined;
  const activeDelay = arrivalDelay ?? departureDelay;
  const performance = activeDelay === null
    ? t("status.scheduled")
    : activeDelay === 0
      ? t("status.onTime")
      : t(activeDelay < 0 ? "flightDetail.earlyShort" : "flightDetail.lateShort", { count: Math.abs(activeDelay) });
  const phase = flight.actualArrival
    ? t("flightDetail.arrived")
    : flight.actualDeparture
      ? t("flightDetail.departed")
      : t("status.scheduled");
  const distanceLabel = distance === null
    ? undefined
    : t(distanceUnit === "miles" ? "flightDetail.distanceMiles" : "flightDetail.distanceKilometers", {
        value: formatDistance(distance, locale, distanceUnit),
      });
  const durationLabel = t("flightDetail.durationHoursMinutes", {
    hours: Math.floor(duration.minutes / 60),
    minutes: Math.abs(duration.minutes % 60),
  });
  const routeSummary = [durationLabel, distanceLabel].filter(Boolean).join(" · ");
  const cabinKey = seat?.cabin ? cabinTranslationKey(seat.cabin) : undefined;
  const cabinLabel = cabinKey ? t(cabinKey) : seat?.cabin;
  const experienceLine = [seat?.seat, cabinLabel, seat?.bookingClass].filter(Boolean).join(" · ");
  const baggageLabel = baggage?.checkedBaggage === undefined
    ? undefined
    : t(baggage.checkedBaggage ? "flightDetail.hasCheckedBaggage" : "flightDetail.noCheckedBaggage");
  const hasExperience = Boolean(aircraft?.type || seat || baggageLabel);
  const hasTripRecord = Boolean(ticket || aircraft?.registration);

  return (
    <PageShell className="detail-page">
      <article className="detail-flight-card" aria-labelledby="flight-detail-title">
        <header className="detail-heading">
          <div className="detail-heading-eyebrow">
            <span className="detail-flight-icon"><DetailIcon kind="flight" /></span>
            <strong>{flight.flightNumber}</strong>
            {airlineName ? <span className="detail-airline-name">{airlineName}</span> : null}
            <i aria-hidden="true">·</i>
            <time dateTime={flight.serviceDate}>{formatServiceDate(flight.serviceDate, locale, { weekday: "short", year: "numeric", month: "short", day: "2-digit" })}</time>
          </div>
          <h1 id="flight-detail-title">{origin ? localizedText(origin.city, locale) : flight.origin.iata} <span>{t("flightDetail.to")}</span> {destination ? localizedText(destination.city, locale) : flight.destination.iata}</h1>
          <div className="detail-heading-summary">
            <strong>{phase}</strong>
            {activeDelay !== null ? <span className={`detail-operational-status is-${operationalStatus}`}>{performance}</span> : null}
            <i aria-hidden="true">·</i>
            <span>{t("flightDetail.total")} {routeSummary}</span>
          </div>
        </header>

        <div className="detail-operational-grid">
          <div className="detail-stops">
            <AirportStop
              kind="departure"
              iata={flight.origin.iata}
              city={origin ? localizedText(origin.city, locale) : flight.origin.iata}
              airport={airportNameLabel(origin, flight.origin.iata, locale)}
              terminal={flight.origin.terminal}
              gate={flight.origin.gate}
              actualTime={departureTime}
              scheduledTime={scheduledDepartureTime}
              delay={departureDelay}
              timestamp={departureTimestamp}
            />
            <div className="detail-journey-summary">
              <DetailIcon kind="flight" />
              <span>{routeSummary}</span>
            </div>
            <AirportStop
              kind="arrival"
              iata={flight.destination.iata}
              city={destination ? localizedText(destination.city, locale) : flight.destination.iata}
              airport={airportNameLabel(destination, flight.destination.iata, locale)}
              terminal={flight.destination.terminal}
              gate={flight.destination.gate}
              baggageCarousel={baggage?.carousel}
              actualTime={arrivalTime}
              scheduledTime={scheduledArrivalTime}
              delay={arrivalDelay}
              timestamp={arrivalTimestamp}
            />
          </div>

          <Suspense fallback={<section className="detail-route-map detail-route-map-loading" aria-busy="true"><span>{t("app.loading")}</span></section>}>
            <FlightRouteMap flight={flight} />
          </Suspense>
        </div>

        {hasExperience || hasTripRecord || frequentFlyer ? <div className="detail-metadata-shelf">
          {hasExperience ? <MetadataColumn
            title={t("flightDetail.flightExperience")}
            footer={<>
              {aircraft?.registration ? <span>{t("flightDetail.registration")} {aircraft.registration}</span> : null}
              {baggageLabel ? <span>{t("flightDetail.checkedBaggage")} · {baggageLabel}</span> : null}
            </>}
          >
            {aircraft?.type ? <strong className="detail-metadata-primary">{aircraft.type}</strong> : null}
            {experienceLine ? <p>{experienceLine}</p> : null}
          </MetadataColumn> : null}

          {hasTripRecord ? <MetadataColumn title={t("flightDetail.tripRecord")}>
            {ticket ? <div className="detail-record-item"><span>{t("flightDetail.ticketNumber")}</span><strong>{formatTicketNumber(ticket.number)}</strong></div> : null}
            {aircraft?.registration ? <div className="detail-record-item"><span>{t("flightDetail.registration")}</span><strong>{aircraft.registration}</strong></div> : null}
          </MetadataColumn> : null}

          {frequentFlyer ? <section className="frequent-flyer-card">
            <div className="frequent-flyer-card-heading">
              <span><DetailIcon kind="star" />{t("flightDetail.frequentFlyer")}</span>
              {frequentFlyer.tier ? <strong>{frequentFlyer.tier}</strong> : null}
            </div>
            <div className="frequent-flyer-card-main">
              <strong>{frequentFlyer.programName}{frequentFlyer.tier ? <em>{frequentFlyer.tier}</em> : null}</strong>
            </div>
            <div className="frequent-flyer-card-footer">
              <span>{t("flightDetail.memberNumber")}</span>
              <strong>{frequentFlyer.memberNumber}</strong>
            </div>
          </section> : null}
        </div> : null}
      </article>
    </PageShell>
  );
}
