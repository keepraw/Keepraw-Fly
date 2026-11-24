import { useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  aircraftFacts,
  airportByIata,
  arrivalDelayMinutes,
  distanceForFlight,
  flightDuration,
  formatDistance,
  formatDuration,
  seatFacts,
  originIdentity,
  plannedDestinationIdentity,
  airportCityGroupForAirport,
  airportCityGroupName,
  flightTimeDisplay,
  formatCityDisplayName,
  formatServiceDate,
  localizedText,
  localizedAirportName,
  type DistanceUnit,
  type SupportedLocale,
  type TimeFormat,
} from "@keepraw-fly/core";
import { AirportCode } from "./AviationPrimitives";
import { FlightDeviation, FlightTime } from "./FlightTime";
import {
  airlineLogoByCode,
  type AirlineLogoAsset,
} from "../generated/airline-icons";

interface FlightRowProps {
  flight: KeeprawFlight;
  locale: SupportedLocale;
  timeFormat: TimeFormat;
  distanceUnit?: DistanceUnit;
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
  distanceUnit = "kilometers",
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
  // Undetermined flight-date airports are flagged, never silently relabelled.
  const originEndpoint = originIdentity(flight);
  const destinationEndpoint = plannedDestinationIdentity(flight);
  const endpointCity = (
    identity: typeof originEndpoint,
    directory: typeof origin,
  ) =>
    identity.confirmed && !identity.differsFromCurrentDirectory
      ? cityName(identity.iata, directory)
      : identity.city
        ? formatCityDisplayName(
            localizedText(identity.city, locale),
            identity.country ?? "",
            locale,
          )
        : identity.iata;
  const originCity = endpointCity(originEndpoint, origin);
  const destinationCity = endpointCity(destinationEndpoint, destination);
  // A cancelled flight was not flown: its schedule is not a duration or distance.
  const duration = flight.cancelled ? null : flightDuration(flight).minutes;
  const distance = flight.cancelled ? null : distanceForFlight(flight);
  const arrivalDelay = flight.cancelled ? null : arrivalDelayMinutes(flight);
  const facts = [
    ["duration", duration === null ? null : formatDuration(duration, locale)],
    [
      "distance",
      distance === null
        ? null
        : t(
            distanceUnit === "miles"
              ? "passport.distanceMiles"
              : "passport.distanceKilometers",
            { value: formatDistance(distance, locale, distanceUnit) },
          ),
    ],
    ["aircraft", aircraftFacts(flight)?.type ?? null],
    ["seat", seatFacts(flight)?.seat ?? null],
  ].filter((fact): fact is [string, string] => Boolean(fact[1]));
  const late = arrivalDelay !== null && arrivalDelay > 0;
  const unresolved = [originEndpoint, destinationEndpoint]
    .filter((identity) => !identity.confirmed)
    .map((identity) => identity.iata);

  return (
    <div
      className={`flight-record${selected ? " is-selected" : ""}`}
      data-flight-id={flight.id}
      data-unresolved-airports={
        unresolved.length ? unresolved.join(" ") : undefined
      }
      title={
        unresolved.length
          ? t("flightDetail.airportHistory.rowUnresolved", {
              airports: unresolved.join(", "),
            })
          : undefined
      }
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
                <AirportCode
                  code={flight.origin.iata}
                  size="compact"
                  title={
                    localizedAirportName(
                      originEndpoint.airportId,
                      locale,
                      originEndpoint.localDate,
                    ) ?? flight.origin.iata
                  }
                />
                <span aria-hidden="true">→</span>
                <AirportCode
                  code={flight.destination.iata}
                  size="compact"
                  title={
                    localizedAirportName(
                      destinationEndpoint.airportId,
                      locale,
                      destinationEndpoint.localDate,
                    ) ?? flight.destination.iata
                  }
                />
              </div>
              {facts.length || late ? (
                <div className="flight-row-detail">
                  {facts.map(([fact, value]) => (
                    <span key={fact} data-fact={fact}>
                      <span className="sr-only">
                        {t(`insights.facts.${fact}`)}{" "}
                      </span>
                      {value}
                    </span>
                  ))}
                  {late ? (
                    <FlightDeviation kind="arrival" minutes={arrivalDelay} />
                  ) : null}
                </div>
              ) : null}
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
        <span className="sr-only">
          {t("flights.openFlight", {
            flightNumber: flight.flightNumber,
            origin: flight.origin.iata,
            destination: flight.destination.iata,
          })}
        </span>
      </button>
    </div>
  );
}
