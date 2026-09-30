import { useTranslation } from "react-i18next";
import { delayDirection, type DisplayTime } from "@keepraw-fly/core";

export function FlightTime({ value, showSource = false, className }: {
  value: DisplayTime; showSource?: boolean; className?: string;
}) {
  const { t } = useTranslation();
  return <span className={className}>
    {showSource ? <span className="time-source">{t(`flightTiming.${value.source}`)} </span> : null}
    <time dateTime={value.timestamp}>{value.time}{value.dayOffset > 0
      ? <span className="time-day-offset" aria-label={t("flightTiming.daysLater", { count: value.dayOffset })}> +{value.dayOffset}</span> : null}</time>
  </span>;
}

export function FlightDeviation({ kind, minutes }: { kind: "departure" | "arrival"; minutes: number | null }) {
  const { t } = useTranslation();
  if (minutes === null) return null;
  return <span className={`flight-deviation is-${delayDirection(minutes)}`}>
    {t(`flightTiming.${kind}.${delayDirection(minutes)}`, { count: Math.abs(minutes) })}
  </span>;
}
