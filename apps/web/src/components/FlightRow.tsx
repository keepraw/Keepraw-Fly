import { useTranslation } from "react-i18next";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  airlineByIata,
  arrivalDelayMinutes,
  departureDelayMinutes,
  formatServiceDate,
  formatTimeAtAirport,
  type SupportedLocale,
} from "@keepraw-fly/core";

interface FlightRowProps {
  flight: KeeprawFlight;
  locale: SupportedLocale;
  onOpen: () => void;
}

export function FlightRow({ flight, locale, onOpen }: FlightRowProps) {
  const { t } = useTranslation();
  const delay = arrivalDelayMinutes(flight) ?? departureDelayMinutes(flight);
  const airlineCode = flight.airline.iata ?? flight.airline.icao ?? "";
  const airlineName = flight.airline.iata
    ? airlineByIata.get(flight.airline.iata)?.name[locale]
    : undefined;

  let delayLabel = t("status.scheduled");
  let delayClass = "status-scheduled";
  if (delay !== null) {
    if (delay > 0) {
      delayLabel = `+${delay}m`;
      delayClass = "status-delayed";
    } else if (delay < 0) {
      delayLabel = `−${Math.abs(delay)}m`;
      delayClass = "status-early";
    } else {
      delayLabel = t("status.onTime");
      delayClass = "status-on-time";
    }
  }

  return (
    <button
      className="flight-row"
      type="button"
      onClick={onOpen}
      aria-label={t("flights.openFlight", {
        flightNumber: flight.flightNumber,
        origin: flight.origin.iata,
        destination: flight.destination.iata,
      })}
    >
      <time className="flight-date" dateTime={flight.serviceDate}>
        {formatServiceDate(flight.serviceDate, locale)}
      </time>
      <div className="flight-number">
        <strong>{flight.flightNumber}</strong>
        <span>{airlineName ?? airlineCode}</span>
      </div>
      <div className="flight-route" aria-label={`${flight.origin.iata} to ${flight.destination.iata}`}>
        <strong>{flight.origin.iata}</strong>
        <span className="route-line" aria-hidden="true"><i /></span>
        <strong>{flight.destination.iata}</strong>
      </div>
      <div className="flight-times">
        <time dateTime={flight.actualDeparture ?? flight.scheduledDeparture}>
          {formatTimeAtAirport(
            flight.actualDeparture ?? flight.scheduledDeparture,
            flight.origin.iata,
            locale,
            "24-hour",
          )}
        </time>
        <span aria-hidden="true">→</span>
        <time dateTime={flight.actualArrival ?? flight.scheduledArrival}>
          {formatTimeAtAirport(
            flight.actualArrival ?? flight.scheduledArrival,
            flight.destination.iata,
            locale,
            "24-hour",
          )}
        </time>
      </div>
      <span className={`flight-status ${delayClass}`}>{delayLabel}</span>
    </button>
  );
}
