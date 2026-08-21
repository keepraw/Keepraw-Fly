import { airportByIata, type SupportedLocale } from "./reference-data";

export type TimeFormat = "12-hour" | "24-hour";
export type DistanceUnit = "miles" | "kilometers";

export function formatServiceDate(
  serviceDate: string,
  locale: SupportedLocale,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(
    new Date(`${serviceDate}T00:00:00Z`),
  );
}

export function formatTimeAtAirport(
  isoDateTime: string,
  airportIata: string,
  locale: SupportedLocale,
  timeFormat: TimeFormat,
): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: timeFormat === "12-hour",
    timeZone: airportByIata.get(airportIata)?.timezone ?? "UTC",
  }).format(new Date(isoDateTime));
}

export function formatDistance(
  kilometers: number,
  locale: SupportedLocale,
  unit: DistanceUnit,
): string {
  const value = unit === "miles" ? kilometers * 0.6213711922 : kilometers;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

export function formatDuration(minutes: number, locale: SupportedLocale = "en"): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.abs(minutes % 60);
  if (locale === "zh-CN") return `${hours}小时 ${remainingMinutes}分`;
  return `${hours}h ${remainingMinutes.toString().padStart(2, "0")}m`;
}
