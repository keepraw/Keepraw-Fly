import { useTranslation } from "react-i18next";
import { delayDirection, type DisplayTime } from "@keepraw-fly/core";

export function FlightTime({
  value,
  showSource = false,
  sourceLabel,
  showZone = false,
  timeZone,
  className,
}: {
  value: DisplayTime;
  showSource?: boolean;
  sourceLabel?: string;
  showZone?: boolean;
  timeZone?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <span className={className}>
      {showSource ? (
        <span className="time-source">
          {sourceLabel ?? t(`flightTiming.${value.source}`)}{" "}
        </span>
      ) : null}
      <time dateTime={value.timestamp}>
        {value.time}
        {value.dayOffset > 0 ? (
          <span
            className="time-day-offset"
            aria-label={t("flightTiming.daysLater", { count: value.dayOffset })}
          >
            {" "}
            +{value.dayOffset}
          </span>
        ) : null}
      </time>
      {showZone ? (
        <span className="time-zone">
          {zoneLabel(value.timestamp, timeZone)}
        </span>
      ) : null}
    </span>
  );
}

export function FlightDeviation({
  kind,
  minutes,
}: {
  kind: "departure" | "arrival";
  minutes: number | null;
}) {
  const { t } = useTranslation();
  if (minutes === null) return null;
  return (
    <span className={`flight-deviation is-${delayDirection(minutes)}`}>
      {t(`flightTiming.${kind}.${delayDirection(minutes)}`, {
        count: Math.abs(minutes),
      })}
    </span>
  );
}

/**
 * The UTC offset to show beside a time. Without a determined airport zone, the
 * offset written in the stored RFC 3339 timestamp is shown, never UTC.
 */
function zoneLabel(timestamp: string, timeZone: string | undefined): string {
  const written = /(Z|[+-]\d{2}:\d{2})$/.exec(timestamp)?.[1];
  const fixed =
    timeZone && /^[+-]\d{2}:\d{2}$/.test(timeZone) ? timeZone : undefined;
  if (!timeZone || fixed) {
    const offset = fixed ?? written;
    if (!offset || offset === "Z" || offset === "+00:00") return "UTC";
    const [, sign, hours, minutes] = /^([+-])(\d{2}):(\d{2})$/.exec(offset)!;
    return `UTC${sign}${Number(hours)}${minutes === "00" ? "" : `:${minutes}`}`;
  }
  return (
    new Intl.DateTimeFormat("en", { timeZone, timeZoneName: "shortOffset" })
      .formatToParts(new Date(timestamp))
      .find((part) => part.type === "timeZoneName")
      ?.value.replace("GMT", "UTC") ?? "UTC"
  );
}
