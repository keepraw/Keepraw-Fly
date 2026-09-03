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
import { AirportCode, AviationIcon, FlightStatusBadge } from "./AviationPrimitives";

interface FlightRowProps {
  flight: KeeprawFlight;
  locale: SupportedLocale;
  timeFormat: TimeFormat;
  onOpen: () => void;
}

export function FlightRow({ flight, locale, timeFormat, onOpen }: FlightRowProps) {
  const { t } = useTranslation();
  const delay = arrivalDelayMinutes(flight) ?? departureDelayMinutes(flight);
  const operationalStatus = flightOperationalStatus(flight);
  const airlineCode = flight.airline.iata ?? flight.airline.icao ?? "";
  const airlineName = flight.airline.iata
    ? airlineByIata.get(flight.airline.iata)?.name[locale]
    : undefined;
  const origin = airportByIata.get(flight.origin.iata);
  const destination = airportByIata.get(flight.destination.iata);

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
      <div className="flight-route" aria-label={t("flights.routeLabel", { origin: flight.origin.iata, destination: flight.destination.iata })}>
        <span className="flight-airport">
          <AirportCode code={flight.origin.iata} />
          <small>{origin?.city[locale]}</small>
        </span>
        <span className="route-line" aria-hidden="true"><i /><AviationIcon name="flight" /></span>
        <span className="flight-airport flight-airport-arrival">
          <AirportCode code={flight.destination.iata} />
          <small>{destination?.city[locale]}</small>
        </span>
      </div>
      <div className="flight-times">
        <time dateTime={flight.actualDeparture ?? flight.scheduledDeparture}>
          {formatTimeAtAirport(
            flight.actualDeparture ?? flight.scheduledDeparture,
            flight.origin.iata,
            locale,
            timeFormat,
          )}
        </time>
        <span aria-hidden="true">→</span>
        <time dateTime={flight.actualArrival ?? flight.scheduledArrival}>
          {formatTimeAtAirport(
            flight.actualArrival ?? flight.scheduledArrival,
            flight.destination.iata,
            locale,
            timeFormat,
          )}
        </time>
      </div>
      <FlightStatusBadge className="flight-status" status={operationalStatus}>{delayLabel}</FlightStatusBadge>
      <span className="flight-open-cue" aria-hidden="true">›</span>
      <div className="flight-mobile-summary" aria-hidden="true">
        <div className="flight-mobile-heading">
          <strong>{flight.flightNumber}</strong>
          <FlightStatusBadge className="flight-status" status={operationalStatus}>{delayLabel}</FlightStatusBadge>
        </div>
        <div className="flight-mobile-route">
          <span>
            <AirportCode code={flight.origin.iata} />
            <time dateTime={flight.actualDeparture ?? flight.scheduledDeparture}>
              {formatTimeAtAirport(
                flight.actualDeparture ?? flight.scheduledDeparture,
                flight.origin.iata,
                locale,
                timeFormat,
              )}
            </time>
          </span>
          <i />
          <span>
            <AirportCode code={flight.destination.iata} />
            <time dateTime={flight.actualArrival ?? flight.scheduledArrival}>
              {formatTimeAtAirport(
                flight.actualArrival ?? flight.scheduledArrival,
                flight.destination.iata,
                locale,
                timeFormat,
              )}
            </time>
          </span>
        </div>
      </div>
    </button>
  );
}
