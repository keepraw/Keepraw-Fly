import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import {
  formatDuration,
  formatTimeAtAirport,
  type TimelineClock,
} from "@keepraw-fly/core";
import { zoneLabel } from "../../components/FlightTime";
import type { FlightExtensionProps } from "./index";

const share = (value: number) => `${Math.min(1, Math.max(0, value)) * 100}%`;

/**
 * `aviation` `flight.extension`: the scheduled and the actual operation on one
 * axis, and the flight on the clocks of both airports with the date line.
 */
export function AviationFlightExtension({
  insights,
  locale,
  timeFormat,
}: FlightExtensionProps) {
  const { t } = useTranslation();
  const { comparison, timeline } = insights;
  // Unrounded, so a share of it is the same minute the times themselves give.
  const elapsed = timeline
    ? Date.parse(timeline.arrival) - Date.parse(timeline.departure)
    : 0;
  const notes = timeline
    ? [
        ...(timeline.origin.midnights.length ||
        timeline.destination.midnights.length
          ? [t("extension.aviation.midnightNote")]
          : []),
        ...(timeline.dateLineFraction !== null
          ? [t("extension.aviation.dateLineNote")]
          : []),
      ]
    : [];

  function clockTime(clock: TimelineClock, timestamp: string, offset: number) {
    return (
      <time dateTime={timestamp}>
        {formatTimeAtAirport(
          timestamp,
          clock.iata,
          locale,
          timeFormat,
          clock.timezone,
        )}
        {offset !== 0 ? (
          <span
            className="time-day-offset"
            aria-label={t(
              offset > 0
                ? "flightTiming.daysLater"
                : "flightTiming.daysEarlier",
              { count: Math.abs(offset) },
            )}
          >
            {" "}
            {offset > 0 ? "+" : ""}
            {offset}
          </span>
        ) : null}
      </time>
    );
  }

  return (
    <>
      {comparison ? (
        <section
          className="aviation-comparison"
          aria-labelledby="aviation-comparison-title"
        >
          <h2 id="aviation-comparison-title">
            {t("extension.aviation.comparisonTitle")}
          </h2>
          <div className="aviation-comparison-rows">
            {(["scheduled", "actual"] as const).map((kind) => (
              <div
                key={kind}
                className={`aviation-comparison-row is-${kind}`}
                data-kind={kind}
              >
                <span className="aviation-row-label">
                  {t(`flightTiming.${kind}`)}
                </span>
                <span className="aviation-track" aria-hidden="true">
                  <span
                    className="aviation-bar"
                    style={
                      {
                        "--bar-start": share(
                          comparison[kind].startMinutes /
                            comparison.spanMinutes,
                        ),
                        "--bar-end": share(
                          1 -
                            comparison[kind].endMinutes /
                              comparison.spanMinutes,
                        ),
                      } as CSSProperties
                    }
                  />
                </span>
                <span className="aviation-row-value">
                  {formatDuration(comparison[kind].durationMinutes, locale)}
                </span>
              </div>
            ))}
          </div>
          <p className="aviation-comparison-summary">
            {comparison.durationDeltaMinutes === 0
              ? t("extension.aviation.durationSame")
              : t(
                  comparison.durationDeltaMinutes > 0
                    ? "extension.aviation.durationLonger"
                    : "extension.aviation.durationShorter",
                  { count: Math.abs(comparison.durationDeltaMinutes) },
                )}
          </p>
        </section>
      ) : null}
      {timeline ? (
        <section
          className="aviation-clocks"
          aria-labelledby="aviation-clocks-title"
        >
          <h2 id="aviation-clocks-title">
            {t("extension.aviation.clocksTitle")}
          </h2>
          <div className="aviation-clock-rows">
            {[timeline.origin, timeline.destination].map((clock, index) => {
              // An airport may change its offset during the flight.
              const from = zoneLabel(timeline.departure, clock.timezone);
              const to = zoneLabel(timeline.arrival, clock.timezone);
              const zone = from === to ? from : `${from} → ${to}`;
              return (
                <div
                  key={index}
                  className="aviation-clock-row"
                  role="group"
                  aria-label={`${clock.iata} ${zone}`}
                >
                  <span className="aviation-row-label" aria-hidden="true">
                    <strong>{clock.iata}</strong> {zone}
                  </span>
                  <span className="aviation-clock-time is-departure">
                    <span className="sr-only">
                      {t("flightDetail.departure")}{" "}
                    </span>
                    {clockTime(
                      clock,
                      timeline.departure,
                      clock.departureDayOffset,
                    )}
                  </span>
                  <span className="aviation-track" aria-hidden="true">
                    <span className="aviation-line" />
                    {clock.midnights.map((fraction) => (
                      <span
                        key={fraction}
                        className="aviation-midnight"
                        style={{ "--at": share(fraction) } as CSSProperties}
                      />
                    ))}
                  </span>
                  {clock.midnights.map((fraction) => (
                    <span key={fraction} className="sr-only">
                      {t("extension.aviation.midnightAfter", {
                        duration: formatDuration(
                          // Whole milliseconds first: the share is inexact,
                          // and half a minute must still round up.
                          Math.round(Math.round(fraction * elapsed) / 60_000),
                          locale,
                        ),
                      })}{" "}
                    </span>
                  ))}
                  <span className="aviation-clock-time is-arrival">
                    <span className="sr-only">
                      {t("flightDetail.arrival")}{" "}
                    </span>
                    {clockTime(clock, timeline.arrival, clock.arrivalDayOffset)}
                  </span>
                </div>
              );
            })}
            {timeline.dateLineFraction !== null ? (
              <span className="aviation-date-line-track" aria-hidden="true">
                <span
                  className="aviation-date-line"
                  style={
                    {
                      "--at": share(timeline.dateLineFraction),
                    } as CSSProperties
                  }
                >
                  <span>{t("extension.aviation.dateLine")}</span>
                </span>
              </span>
            ) : null}
          </div>
          {notes.length ? (
            <p className="aviation-clocks-note">
              {notes.join(" ")}
              {timeline.dateLineFraction !== null ? (
                <span className="sr-only">
                  {" "}
                  {t("extension.aviation.dateLineAt", {
                    percent: new Intl.NumberFormat(locale, {
                      style: "percent",
                      maximumFractionDigits: 0,
                    }).format(timeline.dateLineFraction),
                  })}
                </span>
              ) : null}
            </p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
