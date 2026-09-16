import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  airlineByIata,
  airportByIata,
  arrivalDelayMinutes,
  departureDelayMinutes,
  flightOperationalStatus,
  formatServiceDate,
  formatTimeAtAirport,
  type SupportedLocale,
  type TimeFormat,
} from "@keepraw-fly/core";
import { AirportCode, FlightStatusBadge } from "./AviationPrimitives";

interface FlightRowProps {
  flight: KeeprawFlight;
  locale: SupportedLocale;
  timeFormat: TimeFormat;
  onOpen: () => void;
  revealIndex?: number;
}

export function FlightRow({ flight, locale, timeFormat, onOpen, revealIndex = 0 }: FlightRowProps) {
  const { t } = useTranslation();
  const delay = arrivalDelayMinutes(flight) ?? departureDelayMinutes(flight);
  const operationalStatus = flightOperationalStatus(flight);
  const airlineCode = flight.airline.iata ?? flight.airline.icao ?? "";
  const airlineName = flight.airline.iata
    ? airlineByIata.get(flight.airline.iata)?.name[locale]
    : undefined;
  const origin = airportByIata.get(flight.origin.iata);
  const destination = airportByIata.get(flight.destination.iata);
  const departureTimestamp = flight.actualDeparture ?? flight.scheduledDeparture;
  const arrivalTimestamp = flight.actualArrival ?? flight.scheduledArrival;
  const departureTime = formatTimeAtAirport(departureTimestamp, flight.origin.iata, locale, timeFormat);
  const arrivalTime = formatTimeAtAirport(arrivalTimestamp, flight.destination.iata, locale, timeFormat);

  let delayLabel = t("status.scheduled");
  if (delay !== null) {
    if (delay > 0) {
      delayLabel = `+${delay}m`;
    } else if (delay < 0) {
      delayLabel = `−${Math.abs(delay)}m`;
    } else {
      delayLabel = t("status.onTime");
    }
  }

  return (
    <button
      className="flight-row"
      type="button"
      onClick={onOpen}
      style={{ "--flight-row-index": revealIndex } as CSSProperties}
      aria-label={t("flights.openFlight", {
        flightNumber: flight.flightNumber,
        origin: flight.origin.iata,
        destination: flight.destination.iata,
      })}
    >
      <div className="flight-route" aria-label={t("flights.routeLabel", { origin: flight.origin.iata, destination: flight.destination.iata })}>
        <span className="flight-airport">
          <AirportCode code={flight.origin.iata} />
          <time dateTime={departureTimestamp}>{departureTime}</time>
          <small>{origin?.city[locale]}</small>
        </span>
        <span className="route-direction" aria-hidden="true">→</span>
        <span className="flight-airport flight-airport-arrival">
          <AirportCode code={flight.destination.iata} />
          <time dateTime={arrivalTimestamp}>{arrivalTime}</time>
          <small>{destination?.city[locale]}</small>
        </span>
      </div>
      <div className="flight-record-meta">
        <div className="flight-number">
          <strong>{flight.flightNumber}</strong>
          <span>{airlineName ?? airlineCode}</span>
        </div>
        <time className="flight-date" dateTime={flight.serviceDate}>
          {formatServiceDate(flight.serviceDate, locale)}
        </time>
        <FlightStatusBadge className="flight-status" status={operationalStatus}>{delayLabel}</FlightStatusBadge>
      </div>
    </button>
  );
}
