import { useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  airlineNames,
  airportByIata,
  flightOperationalStatus,
  flightTimeDisplay,
  formatServiceDate,
  localizedText,
  resolveAirline,
  type SupportedLocale,
  type TimeFormat,
} from "@keepraw-fly/core";
import { AirportCode } from "./AviationPrimitives";
import { FlightDeviation, FlightTime } from "./FlightTime";
import { airlineLogoByCode, type AirlineLogoAsset } from "../generated/airline-icons";

interface FlightRowProps {
  flight: KeeprawFlight;
  locale: SupportedLocale;
  timeFormat: TimeFormat;
  onOpen: () => void;
  onSelect?: () => void;
  selected?: boolean;
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

export function FlightRow({ flight, locale, timeFormat, onOpen, onSelect, selected, onHoverChange, revealIndex = 0 }: FlightRowProps) {
  const { t } = useTranslation();
  const times = flightTimeDisplay(flight, locale, timeFormat);
  const operationalStatus = flightOperationalStatus(flight);
  const airlineCode = flight.airline.iata ?? flight.airline.icao ?? "";
  const airlineMark = airlineCode.slice(0, 2).toUpperCase() || "--";
  const airlineLogo = airlineLogoByCode[flight.airline.iata?.toUpperCase() ?? ""];
  const airline = resolveAirline(flight.airline);
  const airlineName = airline ? airlineNames(airline, locale)[0] : undefined;
  const origin = airportByIata.get(flight.origin.iata);
  const destination = airportByIata.get(flight.destination.iata);
  const specialStatus = flight.cancelled || flight.divertedTo;

  return (
    <div className={`flight-record${selected ? " is-selected" : ""}`} data-flight-id={flight.id}>
      <button
        className={`flight-row${selected ? " is-selected" : ""}`}
        type="button"
        onClick={onSelect ?? onOpen}
        aria-pressed={onSelect ? Boolean(selected) : undefined}
        onPointerEnter={() => onHoverChange?.(flight)}
        onPointerLeave={() => onHoverChange?.(null)}
        onFocus={() => onHoverChange?.(flight)}
        onBlur={() => onHoverChange?.(null)}
        style={{ "--flight-row-index": revealIndex } as CSSProperties}
        aria-label={t(onSelect ? "flights.selectFlight" : "flights.openFlight", {
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
              <div className="flight-route-cities">
                <span>{origin ? localizedText(origin.city, locale) : flight.origin.iata}</span>
                <span className="route-direction" aria-hidden="true">→</span>
                <span>{destination ? localizedText(destination.city, locale) : flight.destination.iata}</span>
              </div>
              <div className="flight-route-codes">
                <AirportCode code={flight.origin.iata} size="compact" />
                <span aria-hidden="true">→</span>
                <AirportCode code={flight.destination.iata} size="compact" />
              </div>
            </div>
            <time className="flight-date" dateTime={flight.serviceDate}>
              {formatServiceDate(flight.serviceDate, locale, { month: "short", day: "numeric" })}
            </time>
          </div>
          <div className="flight-row-secondary">
            <div className="flight-time-column">
              <span className="flight-times">
                <FlightTime value={times.departure.primary} />
                <span aria-hidden="true">—</span>
                <FlightTime value={times.arrival.primary} />
              </span>
              <span className="flight-scheduled-times">
                {times.departure.scheduled || times.arrival.scheduled ? <>
                  <span>{t("flightTiming.scheduled")} </span>
                  <FlightTime value={times.scheduled.departure} />
                  <span aria-hidden="true"> — </span>
                  <FlightTime value={times.scheduled.arrival} />
                </> : null}
                {times.overnight ? <small className="flight-overnight">{t("flightTiming.overnight")}</small> : null}
              </span>
            </div>
            <span className={`flight-status detail-operational-status is-${operationalStatus}`}>
              {specialStatus ? t(`status.${operationalStatus}`) : <>
                <FlightDeviation kind="arrival" minutes={times.arrival.delayMinutes} />
                {times.departure.delayMinutes !== null && (times.departure.delayMinutes > 0 || times.arrival.delayMinutes === null)
                  ? <FlightDeviation kind="departure" minutes={times.departure.delayMinutes} /> : null}
                {times.arrival.delayMinutes === null && times.departure.delayMinutes === null ? t("status.scheduled") : null}
              </>}
            </span>
            {flight.divertedTo ? <small className="flight-diverted-note">{t("status.divertedTo", { airport: flight.divertedTo.iata })}</small> : null}
          </div>
        </div>
      </button>
      {onSelect ? <button className="flight-row-open" type="button" onClick={onOpen}
        aria-label={t("flights.openFlight", { flightNumber: flight.flightNumber, origin: flight.origin.iata, destination: flight.destination.iata })}>
        {t("flights.details")} <span aria-hidden="true">→</span>
      </button> : null}
    </div>
  );
}
