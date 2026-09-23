import { useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  airlineNames,
  airportByIata,
  arrivalDelayMinutes,
  departureDelayMinutes,
  flightOperationalStatus,
  formatServiceDate,
  formatTimeAtAirport,
  localizedText,
  resolveAirline,
  type SupportedLocale,
  type TimeFormat,
} from "@keepraw-fly/core";
import { AirportCode } from "./AviationPrimitives";
import { airlineLogoByCode, type AirlineLogoAsset } from "../generated/airline-icons";

interface FlightRowProps {
  flight: KeeprawFlight;
  locale: SupportedLocale;
  timeFormat: TimeFormat;
  onOpen: () => void;
  onHoverChange?: (flight: KeeprawFlight | null) => void;
  revealIndex?: number;
}

interface AirlineLogoProps {
  code: string;
  fallback: string;
  asset?: AirlineLogoAsset;
}

function AirlineLogo({ code, fallback, asset }: AirlineLogoProps) {
  const [failed, setFailed] = useState(false);

  if (!asset || failed) {
    return <span className="airline-logo airline-logo--fallback" aria-hidden="true">{fallback}</span>;
  }

  return (
    <span className="airline-logo airline-logo--image" aria-hidden="true">
      <img src={asset.src} alt="" onError={() => setFailed(true)} data-airline-code={code} />
    </span>
  );
}

export function FlightRow({ flight, locale, timeFormat, onOpen, onHoverChange, revealIndex = 0 }: FlightRowProps) {
  const { t } = useTranslation();
  const delay = arrivalDelayMinutes(flight) ?? departureDelayMinutes(flight);
  const operationalStatus = flightOperationalStatus(flight);
  const airlineCode = flight.airline.iata ?? flight.airline.icao ?? "";
  const airlineMark = airlineCode.slice(0, 2).toUpperCase() || "--";
  const airlineLogo = airlineLogoByCode[flight.airline.iata?.toUpperCase() ?? ""];
  const airline = resolveAirline(flight.airline);
  const airlineName = airline ? airlineNames(airline, locale)[0] : undefined;
  const origin = airportByIata.get(flight.origin.iata);
  const destination = airportByIata.get(flight.destination.iata);
  const departureTimestamp = flight.actualDeparture ?? flight.scheduledDeparture;
  const arrivalTimestamp = flight.actualArrival ?? flight.scheduledArrival;
  const departureTime = formatTimeAtAirport(departureTimestamp, flight.origin.iata, locale, timeFormat);
  const arrivalTime = formatTimeAtAirport(arrivalTimestamp, flight.destination.iata, locale, timeFormat);

  let delayLabel = t("status.scheduled");
  if (delay !== null) {
    if (delay > 0) {
      delayLabel = t("flightDetail.lateShort", { count: delay });
    } else if (delay < 0) {
      delayLabel = t("flightDetail.earlyShort", { count: Math.abs(delay) });
    } else {
      delayLabel = t("status.onTime");
    }
  }

  return (
    <button
      className="flight-row"
      type="button"
      onClick={onOpen}
      onPointerEnter={() => onHoverChange?.(flight)}
      onPointerLeave={() => onHoverChange?.(null)}
      onFocus={() => onHoverChange?.(flight)}
      onBlur={() => onHoverChange?.(null)}
      style={{ "--flight-row-index": revealIndex } as CSSProperties}
      aria-label={t("flights.openFlight", {
        flightNumber: flight.flightNumber,
        origin: flight.origin.iata,
        destination: flight.destination.iata,
      })}
    >
      <AirlineLogo key={airlineLogo?.src ?? airlineMark} code={airlineCode} fallback={airlineMark} asset={airlineLogo} />
      <div className="flight-row-content">
        <div className="flight-row-primary">
          <div className="flight-number">
            <strong>{flight.flightNumber}</strong>
            <span>{airlineName ?? airlineCode}</span>
          </div>
          <div className="flight-route" aria-label={t("flights.routeLabel", { origin: flight.origin.iata, destination: flight.destination.iata })}>
            <div className="flight-route-codes">
              <AirportCode code={flight.origin.iata} />
              <span className="route-direction" aria-hidden="true">→</span>
              <AirportCode code={flight.destination.iata} />
            </div>
            <p>
              <span>{origin ? localizedText(origin.city, locale) : flight.origin.iata}</span>
              <span aria-hidden="true">—</span>
              <span>{destination ? localizedText(destination.city, locale) : flight.destination.iata}</span>
            </p>
          </div>
          <time className="flight-date" dateTime={flight.serviceDate}>
            {formatServiceDate(flight.serviceDate, locale)}
          </time>
        </div>
        <div className="flight-row-secondary">
          <span className="flight-times">
            <time dateTime={departureTimestamp}>{departureTime}</time>
            <span aria-hidden="true">—</span>
            <time dateTime={arrivalTimestamp}>{arrivalTime}</time>
          </span>
          <span className={`flight-status detail-operational-status is-${operationalStatus}`}>{delayLabel}</span>
        </div>
      </div>
    </button>
  );
}
