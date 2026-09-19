import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  aircraftFacts, airlineNames, airportByIata, arrivalDelayMinutes, baggageFacts,
  departureDelayMinutes, flightDuration, flightOperationalStatus, formatDuration,
  formatServiceDate, formatTicketNumber, formatTimeAtAirport, frequentFlyerSnapshot,
  resolveAirline, seatFacts, ticketFacts, type SupportedLocale, type TimeFormat,
} from "@keepraw-fly/core";
import { AirportCode } from "../components/AviationPrimitives";
import { PageShell } from "../components/PageShell";

const FlightRouteMap = lazy(() => import("../components/FlightRouteMap")
  .then((module) => ({ default: module.FlightRouteMap })));

interface FlightDetailPageProps {
  flight: KeeprawFlight;
  locale: SupportedLocale;
  timeFormat: TimeFormat;
  onBack: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
}

function DetailItem({ label, value }: { label: string; value?: string }) {
  return value ? <div className="detail-item"><dt>{label}</dt><dd>{value}</dd></div> : null;
}

interface DetailFact {
  label: string;
  value?: string;
}

function FactGroup({ id, label, facts }: { id: string; label: string; facts: DetailFact[] }) {
  const visibleFacts = facts.filter((fact) => fact.value);
  if (visibleFacts.length === 0) return null;

  return (
    <section className="fact-group" aria-labelledby={id}>
      <h3 id={id}>{label}</h3>
      <dl className="facts-grid">
        {visibleFacts.map((fact) => <DetailItem key={fact.label} label={fact.label} value={fact.value} />)}
      </dl>
    </section>
  );
}

function OperationalStatus({ status, children }: { status: string; children: string }) {
  return (
    <span className={`detail-operational-status is-${status}`}>
      <i aria-hidden="true" />
      {children}
    </span>
  );
}

function RouteConnector({ duration, source }: { duration: string; source: string }) {
  return (
    <div className="route-track route-connector">
      <span className="route-track-line" aria-hidden="true" />
      <span className="detail-duration">{duration}<small>{source}</small></span>
    </div>
  );
}

function airportNameLabel(airport: ReturnType<typeof airportByIata.get>, iata: string, locale: SupportedLocale): string | undefined {
  if (!airport) return undefined;
  return airport.name[locale] || airport.name.en || iata;
}

export function FlightDetailPage({ flight, locale, timeFormat, onBack, onEdit, onDuplicate }: FlightDetailPageProps) {
  const { t } = useTranslation();
  const origin = airportByIata.get(flight.origin.iata);
  const destination = airportByIata.get(flight.destination.iata);
  const airline = resolveAirline(flight.airline);
  const airlineNamePair = airline ? airlineNames(airline, locale) : null;
  const aircraft = aircraftFacts(flight);
  const seat = seatFacts(flight);
  const baggage = baggageFacts(flight);
  const ticket = ticketFacts(flight);
  const frequentFlyer = frequentFlyerSnapshot(flight);
  const duration = flightDuration(flight);
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
  const performance = arrivalDelay !== null
    ? arrivalDelay === 0 ? t("status.onTime") : t(arrivalDelay < 0 ? "flightDetail.arrivedEarly" : "flightDetail.arrivedLate", { count: Math.abs(arrivalDelay) })
    : departureDelay !== null
      ? departureDelay === 0 ? t("status.onTime") : t(departureDelay < 0 ? "flightDetail.departedEarly" : "flightDetail.departedLate", { count: Math.abs(departureDelay) })
      : t("status.scheduled");
  const passengerFacts: DetailFact[] = [
    { label: t("flightDetail.seat"), value: seat?.seat },
    { label: t("flightDetail.cabinClass"), value: seat?.cabin },
    { label: t("flightDetail.bookingClass"), value: seat?.bookingClass },
    { label: t("flightDetail.ticketNumber"), value: ticket ? formatTicketNumber(ticket.number) : undefined },
    { label: t("flightDetail.frequentFlyerProgram"), value: frequentFlyer?.programName },
    { label: t("flightDetail.memberNumber"), value: frequentFlyer?.memberNumber },
    { label: t("flightDetail.tier"), value: frequentFlyer?.tier },
  ];
  const flightFacts: DetailFact[] = [
    { label: t("flightDetail.aircraft"), value: aircraft?.type },
    { label: t("flightDetail.registration"), value: aircraft?.registration },
    { label: t("flightDetail.departureTerminal"), value: flight.origin.terminal },
    { label: t("flightDetail.arrivalTerminal"), value: flight.destination.terminal },
    { label: t("flightDetail.departureGate"), value: flight.origin.gate },
    { label: t("flightDetail.arrivalGate"), value: flight.destination.gate },
    {
      label: t("flightDetail.checkedBaggage"),
      value: baggage?.checkedBaggage === undefined
        ? undefined
        : t(baggage.checkedBaggage ? "flightDetail.hasCheckedBaggage" : "flightDetail.noCheckedBaggage"),
    },
    { label: t("flightDetail.baggageCarousel"), value: baggage?.carousel },
  ];
  const hasFacts = [...passengerFacts, ...flightFacts].some((fact) => fact.value);

  return (
    <PageShell className="detail-page">
      <div className="detail-toolbar">
        <button className="back-button" type="button" onClick={onBack}><span aria-hidden="true">←</span> {t("actions.backToFlights")}</button>
        <div>
          <button className="detail-action detail-action-secondary" type="button" onClick={onDuplicate}>{t("actions.duplicateFlight")}</button>
          <button className="detail-action detail-action-primary edit-flight-button" type="button" onClick={onEdit}>{t("actions.editFlight")}</button>
        </div>
      </div>

      <article className="detail-flight-card" aria-labelledby="flight-detail-title">
        <header className="detail-heading">
          <div className="detail-heading-identity">
            <h1 id="flight-detail-title">{flight.flightNumber}</h1>
            <p className="detail-airline-line">
              <span>{airlineNamePair?.[0] ?? flight.airline.iata ?? flight.airline.icao}</span>
              {airlineNamePair ? <small>{airlineNamePair[1]}</small> : null}
            </p>
          </div>
          <div className="detail-heading-meta">
            <time dateTime={flight.serviceDate}>{formatServiceDate(flight.serviceDate, locale, { year: "numeric", month: "2-digit", day: "2-digit" })}</time>
            <OperationalStatus status={operationalStatus}>{performance}</OperationalStatus>
          </div>
        </header>

        <div className="route-hero" role="group" aria-label={t("flightDetail.routeLabel")}>
          <span className="airport-role route-origin-role">{t("flightDetail.departure")}</span>
          <span className="airport-role route-arrival-role">{t("flightDetail.arrival")}</span>

          <AirportCode className="airport-code route-origin-code" code={flight.origin.iata} size="display" />
          <AirportCode className="airport-code route-arrival-code" code={flight.destination.iata} size="display" />

          <strong className="detail-airport-city route-origin-city">{origin?.city[locale] ?? flight.origin.iata}</strong>
          <strong className="detail-airport-city route-arrival-city">{destination?.city[locale] ?? flight.destination.iata}</strong>

          <div className="route-time route-origin-time">
            <time className="detail-airport-time" dateTime={departureTimestamp}>{departureTime}</time>
            {scheduledDepartureTime ? <small>{t("flightDetail.scheduled")} {scheduledDepartureTime}</small> : null}
          </div>
          <RouteConnector
            duration={formatDuration(duration.minutes, locale)}
            source={t(`flightDetail.durationSource.${duration.source}`)}
          />
          <div className="route-time route-arrival-time">
            <time className="detail-airport-time" dateTime={arrivalTimestamp}>{arrivalTime}</time>
            {scheduledArrivalTime ? <small>{t("flightDetail.scheduled")} {scheduledArrivalTime}</small> : null}
          </div>
          <small className="route-airport-name route-origin-airport">{airportNameLabel(origin, flight.origin.iata, locale)}</small>
          <small className="route-airport-name route-arrival-airport">{airportNameLabel(destination, flight.destination.iata, locale)}</small>
        </div>

        {hasFacts ? <section className="flight-facts" aria-labelledby="facts-title">
          <h2 id="facts-title">{t("flightDetail.travelInformation")}</h2>
          <div className="fact-groups">
            <FactGroup id="passenger-facts-title" label={t("flightDetail.passengerInformation")} facts={passengerFacts} />
            <FactGroup id="flight-facts-title" label={t("flightDetail.flightInformation")} facts={flightFacts} />
          </div>
        </section> : null}

        <Suspense fallback={<section className="detail-route-map detail-route-map-loading" aria-busy="true"><span>{t("app.loading")}</span></section>}>
          <FlightRouteMap flight={flight} />
        </Suspense>
      </article>
    </PageShell>
  );
}
