import { useTranslation } from "react-i18next";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  aircraftFacts,
  airlineByIata,
  airportByIata,
  arrivalDelayMinutes,
  departureDelayMinutes,
  flightDuration,
  flightOperationalStatus,
  formatDuration,
  formatServiceDate,
  formatTimeAtAirport,
  seatFacts,
  type SupportedLocale,
  type TimeFormat,
} from "@keepraw-fly/core";

interface FlightDetailPageProps {
  flight: KeeprawFlight;
  locale: SupportedLocale;
  timeFormat: TimeFormat;
  onBack: () => void;
  onEdit: () => void;
}

function DetailItem({ label, value }: { label: string; value?: string }) {
  return value ? (
    <div className="detail-item">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  ) : null;
}

function delayText(delay: number | null, onTimeLabel: string, minuteLabel: string): string {
  if (delay === null) return "—";
  if (delay === 0) return onTimeLabel;
  return `${delay > 0 ? "+" : "−"}${Math.abs(delay)} ${minuteLabel}`;
}

export function FlightDetailPage({ flight, locale, timeFormat, onBack, onEdit }: FlightDetailPageProps) {
  const { t } = useTranslation();
  const origin = airportByIata.get(flight.origin.iata);
  const destination = airportByIata.get(flight.destination.iata);
  const airline = flight.airline.iata
    ? airlineByIata.get(flight.airline.iata)
    : undefined;
  const aircraft = aircraftFacts(flight);
  const seat = seatFacts(flight);
  const departureDelay = departureDelayMinutes(flight);
  const arrivalDelay = arrivalDelayMinutes(flight);
  const duration = flightDuration(flight);
  const operationalStatus = flightOperationalStatus(flight);
  const hasFacts = Boolean(
    flight.origin.terminal
    || flight.origin.gate
    || flight.destination.terminal
    || flight.destination.gate
    || aircraft?.type
    || aircraft?.registration
    || seat?.seat
    || seat?.cabin,
  );
  const dateLabel = formatServiceDate(flight.serviceDate, locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="detail-page" id="main-content" tabIndex={-1}>
      <div className="detail-toolbar">
        <button className="back-button" type="button" onClick={onBack}>
          <span aria-hidden="true">←</span> {t("actions.backToFlights")}
        </button>
        <button className="edit-flight-button" type="button" onClick={onEdit}>{t("actions.editFlight")}</button>
      </div>

      <header className="detail-heading">
        <div>
          <p className="eyebrow">{dateLabel}</p>
          <h1>{flight.flightNumber}</h1>
          <p className="detail-airline-line">
            <span>{airline?.name[locale] ?? flight.airline.iata ?? flight.airline.icao}</span>
            <span className={`detail-status status-${operationalStatus}`}>
              {t(`status.${operationalStatus}`)}
            </span>
          </p>
        </div>
        <span className="detail-duration">
          {formatDuration(duration.minutes, locale)}
          <small>{t(`flightDetail.durationSource.${duration.source}`)}</small>
        </span>
      </header>

      <section className="route-hero" aria-label={t("flightDetail.routeLabel")}>
        <div className="airport-block">
          <span className="airport-code">{flight.origin.iata}</span>
          <strong>{origin?.city[locale] ?? flight.origin.iata}</strong>
          <small>{origin?.name[locale]}</small>
        </div>
        <div className="route-track" aria-hidden="true">
          <span className="route-track-line" />
          <span className="route-track-mark">
            <svg viewBox="0 0 40 40"><path d="M7 20h26M25 12l8 8-8 8" /></svg>
          </span>
          <span className="route-track-line" />
        </div>
        <div className="airport-block airport-block-arrival">
          <span className="airport-code">{flight.destination.iata}</span>
          <strong>{destination?.city[locale] ?? flight.destination.iata}</strong>
          <small>{destination?.name[locale]}</small>
        </div>
      </section>

      <section className="timeline" aria-labelledby="timeline-title">
        <div className="section-heading">
          <p className="eyebrow">{t("flightDetail.journey")}</p>
          <h2 id="timeline-title">{t("flightDetail.timeline")}</h2>
        </div>
        <div className="timeline-grid">
          <div className="timeline-event">
            <div>
              <p>{t("flightDetail.departure")}</p>
              <strong>{formatTimeAtAirport(
                flight.actualDeparture ?? flight.scheduledDeparture,
                flight.origin.iata,
                locale,
                timeFormat,
              )}</strong>
              {flight.actualDeparture ? (
                <small>{t("flightDetail.scheduled")} {formatTimeAtAirport(
                  flight.scheduledDeparture,
                  flight.origin.iata,
                  locale,
                  timeFormat,
                )}</small>
              ) : null}
            </div>
            <span className="timeline-dot" aria-hidden="true" />
            <div className="timeline-place">
              <strong>{flight.origin.iata}</strong>
              <small>{origin?.timezone}</small>
            </div>
          </div>
          <div className="timeline-stem" aria-hidden="true"><i /></div>
          <div className="timeline-event">
            <div>
              <p>{t("flightDetail.arrival")}</p>
              <strong>{formatTimeAtAirport(
                flight.actualArrival ?? flight.scheduledArrival,
                flight.destination.iata,
                locale,
                timeFormat,
              )}</strong>
              {flight.actualArrival ? (
                <small>{t("flightDetail.scheduled")} {formatTimeAtAirport(
                  flight.scheduledArrival,
                  flight.destination.iata,
                  locale,
                  timeFormat,
                )}</small>
              ) : null}
            </div>
            <span className="timeline-dot" aria-hidden="true" />
            <div className="timeline-place">
              <strong>{flight.destination.iata}</strong>
              <small>{destination?.timezone}</small>
            </div>
          </div>
        </div>
      </section>

      <section className="delay-summary" aria-label={t("flightDetail.delaySummary")}>
        <div>
          <span>{t("flightDetail.departureDelay")}</span>
          <strong className={departureDelay && departureDelay > 0 ? "delay-positive" : ""}>
            {delayText(departureDelay, t("status.onTime"), t("units.minuteShort"))}
          </strong>
        </div>
        <div>
          <span>{t("flightDetail.arrivalDelay")}</span>
          <strong className={arrivalDelay && arrivalDelay > 0 ? "delay-positive" : ""}>
            {delayText(arrivalDelay, t("status.onTime"), t("units.minuteShort"))}
          </strong>
        </div>
      </section>

      {hasFacts ? <section className="flight-facts" aria-labelledby="facts-title">
        <div className="section-heading">
          <p className="eyebrow">{t("flightDetail.facts")}</p>
          <h2 id="facts-title">{t("flightDetail.details")}</h2>
        </div>
        <dl className="facts-grid">
          <DetailItem label={t("flightDetail.departureTerminal")} value={flight.origin.terminal} />
          <DetailItem label={t("flightDetail.departureGate")} value={flight.origin.gate} />
          <DetailItem label={t("flightDetail.arrivalTerminal")} value={flight.destination.terminal} />
          <DetailItem label={t("flightDetail.arrivalGate")} value={flight.destination.gate} />
          <DetailItem label={t("flightDetail.aircraft")} value={aircraft?.type} />
          <DetailItem label={t("flightDetail.registration")} value={aircraft?.registration} />
          <DetailItem label={t("flightDetail.seat")} value={seat?.seat} />
          <DetailItem label={t("flightDetail.cabin")} value={seat?.cabin} />
        </dl>
      </section> : null}
    </main>
  );
}
