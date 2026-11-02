import { airportByIata, type SupportedLocale } from "./reference-data";

export type TimeFormat = "12-hour" | "24-hour";
export type DistanceUnit = "miles" | "kilometers";

export function formatServiceDate(
  serviceDate: string,
  locale: SupportedLocale,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
): string {
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: "UTC",
  }).format(new Date(`${serviceDate}T00:00:00Z`));
}

/**
 * Formats an instant at an airport. `timezone` is the flight-date historical
 * zone (IANA or `±HH:MM`); `null` means the airport is not determined, so the
 * wall time written in the RFC 3339 offset is shown instead of guessing UTC.
 */
export function formatTimeAtAirport(
  isoDateTime: string,
  airportIata: string,
  locale: SupportedLocale,
  timeFormat: TimeFormat,
  timezone?: string | null,
): string {
  const zone =
    timezone === undefined
      ? (airportByIata.get(airportIata)?.timezone ?? null)
      : timezone;
  const options: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hour12: timeFormat === "12-hour",
  };
  const fixed = zone ? /^([+-])(\d{2}):(\d{2})$/.exec(zone) : null;
  if (zone && !fixed) {
    try {
      return new Intl.DateTimeFormat(locale, {
        ...options,
        timeZone: zone,
      }).format(new Date(isoDateTime));
    } catch {
      // Fall through to the written offset for an invalid zone.
    }
  }
  const instant = Date.parse(isoDateTime);
  let wall: number;
  if (fixed) {
    const minutes =
      (fixed[1] === "-" ? -1 : 1) * (Number(fixed[2]) * 60 + Number(fixed[3]));
    wall = instant + minutes * 60_000;
  } else {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(isoDateTime);
    wall = match
      ? Date.UTC(
          Number(match[1]),
          Number(match[2]) - 1,
          Number(match[3]),
          Number(match[4]),
          Number(match[5]),
        )
      : instant;
  }
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: "UTC",
  }).format(new Date(wall));
}

export function formatDistance(
  kilometers: number,
  locale: SupportedLocale,
  unit: DistanceUnit,
): string {
  const value = unit === "miles" ? kilometers * 0.6213711922 : kilometers;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    value,
  );
}

export interface DurationLabels {
  hour: string;
  minute: string;
  padMinutes?: boolean;
}

// Add duration wording here, or supply labels from a caller. No React/i18next
// dependency and no Intl.DurationFormat requirement on older browsers.
const durationLabels: Record<string, DurationLabels> = {
  en: { hour: "h", minute: "m", padMinutes: true },
  "zh-CN": { hour: "小时", minute: "分" },
  "zh-TW": { hour: "小時", minute: "分" },
  ja: { hour: "時間", minute: "分" },
  fr: { hour: " h", minute: " min" },
  de: { hour: " Std.", minute: " Min." },
  es: { hour: " h", minute: " min" },
  pt: { hour: " h", minute: " min" },
  ko: { hour: "시간", minute: "분" },
};

export function formatDuration(
  minutes: number,
  locale: SupportedLocale = "en-US",
  labels: DurationLabels = durationLabels[locale] ??
    durationLabels[locale.split("-")[0] ?? "en"] ??
    durationLabels.en!,
): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.abs(minutes % 60);
  const hoursText = new Intl.NumberFormat(locale, {
    useGrouping: false,
  }).format(hours);
  const minutesText = new Intl.NumberFormat(locale, {
    useGrouping: false,
    minimumIntegerDigits: labels.padMinutes ? 2 : 1,
  }).format(remainingMinutes);
  return `${hoursText}${labels.hour} ${minutesText}${labels.minute}`;
}
