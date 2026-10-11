import { useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  airportByIata,
  airportCityGroupForAirport,
  airportCityGroupName,
  flightTimeDisplay,
  formatCityDisplayName,
  formatServiceDate,
  localizedText,
  type SupportedLocale,
  type TimeFormat,
} from "@keepraw-fly/core";
import { AirportCode } from "./AviationPrimitives";
import { FlightTime } from "./FlightTime";
import {
  airlineLogoByCode,
  type AirlineLogoAsset,
} from "../generated/airline-icons";

interface FlightRowProps {
  flight: KeeprawFlight;
  locale: SupportedLocale;
  timeFormat: TimeFormat;
  onOpen: () => void;
  selected?: boolean;
  onHoverChange?: (flight: KeeprawFlight | null) => void;
  revealIndex?: number;
  presentation?: "standard" | "passport";
}

interface AirlineLogoProps {
  code: string;
  fallback: string;
  asset?: AirlineLogoAsset;
}

function AirlineLogo({ code, fallback, asset }: AirlineLogoProps) {
  const [failed, setFailed] = useState(false);

  if (!asset || failed) {
    return (
      <span className="airline-logo airline-logo--fallback" aria-hidden="true">
        {fallback}
      </span>
    );
  }

  return (
    <span className="airline-logo airline-logo--image" aria-hidden="true">
      <img
        src={asset.src}
        alt=""
        onError={() => setFailed(true)}
        data-airline-code={code}
      />
    </span>
  );
}

export function FlightRow({
  flight,
  locale,
  timeFormat,
  onOpen,
  selected,
  onHoverChange,
  revealIndex = 0,
  presentation = "standard",
}: FlightRowProps) {
  const { t } = useTranslation();
  const times = flightTimeDisplay(flight, locale, timeFormat);
  const airlineCode = flight.airline.iata ?? flight.airline.icao ?? "";
  const airlineMark = airlineCode.slice(0, 2).toUpperCase() || "--";
  const airlineLogo =
    airlineLogoByCode[flight.airline.iata?.toUpperCase() ?? ""];
  const origin = airportByIata.get(flight.origin.iata);
  const destination = airportByIata.get(flight.destination.iata);
  const specialStatus = flight.cancelled
    ? "cancelled"
    : flight.divertedTo
      ? "diverted"
      : undefined;
  const cityName = (code: string, airport: typeof origin) => {
    const cityGroup = airportCityGroupForAirport(code);
    const name = cityGroup
      ? airportCityGroupName(cityGroup, locale)
      : airport && localizedText(airport.city, locale);
    return name
      ? formatCityDisplayName(
          name,
          cityGroup?.country ?? airport?.country ?? "",
          locale,
        )
      : code;
  };
  const originCity = cityName(flight.origin.iata, origin);
  const destinationCity = cityName(flight.destination.iata, destination);

  return (
    <div
      className={`flight-record${selected ? " is-selected" : ""}`}
      data-flight-id={flight.id}
    >
      <button
        className={`flight-row flight-row--${presentation}${selected ? " is-selected" : ""}`}
        type="button"
        onClick={onOpen}
        aria-current={selected ? "true" : undefined}
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
        <AirlineLogo
          key={airlineLogo?.src ?? airlineMark}
          code={airlineCode}
          fallback={airlineMark}
          asset={airlineLogo}
        />
        <div className="flight-row-content">
          <div className="flight-row-primary">
            <div className="flight-number">
              <strong>{flight.flightNumber}</strong>
              {specialStatus ? (
                <span className={`flight-status is-${specialStatus}`}>
                  {t(`status.${specialStatus}`)}
                  {specialStatus === "diverted"
                    ? ` ${flight.divertedTo?.iata}`
                    : null}
                </span>
              ) : null}
            </div>
            <time className="flight-date" dateTime={flight.serviceDate}>
              {formatServiceDate(flight.serviceDate, locale, {
                month: "short",
                day: "numeric",
              })}
            </time>
          </div>
          <div
            className="flight-route"
            aria-label={t("flights.routeLabel", {
              origin: flight.origin.iata,
              destination: flight.destination.iata,
            })}
          >
            <div
              className="flight-route-cities"
              title={`${originCity} ${flight.origin.iata} → ${destinationCity} ${flight.destination.iata}`}
            >
              <span>{originCity}</span>
              <span className="route-direction" aria-hidden="true">
                →
              </span>
              <span>{destinationCity}</span>
            </div>
            <div className="flight-row-meta">
              <div className="flight-route-codes">
                <AirportCode code={flight.origin.iata} size="compact" />
                <span aria-hidden="true">→</span>
                <AirportCode code={flight.destination.iata} size="compact" />
              </div>
              <div className="flight-time-column">
                <span className="flight-times">
                  <FlightTime value={times.departure.primary} />
                  <span aria-hidden="true">—</span>
                  <FlightTime value={times.arrival.primary} />
                </span>
              </div>
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}
