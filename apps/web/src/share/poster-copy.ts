import {
  formatDistance,
  formatDuration,
  type DistanceUnit,
  type SupportedLocale,
} from "@keepraw-fly/core";
import type { PosterDataModel, PosterHighlight } from "./poster-data";
import { shareLocaleForLanguage, type ShareLocale } from "./share-text";

/**
 * Poster Copy: the finished strings and chart numbers a poster draws. This is
 * the drawing layer's entire input besides the layout: labels, formatted
 * values, bar labels and bar values. No flight objects, no dates, no ids.
 */
export interface PosterStat {
  label: string;
  value: string;
  unit?: string;
}

export interface PosterChart {
  title: string;
  labels: string[];
  values: number[];
  valueLabels: string[];
  /** Bar drawn in the accent color (Year in Flight's busiest month). */
  accentIndex: number | null;
  emptyText: string;
}

export interface PosterAirportRow {
  code: string;
  name: string;
  value: string;
}

export interface PosterCopy {
  locale: ShareLocale;
  brand: string;
  title: string;
  scopeLabel: string;
  /** Large year for Year in Flight; null for Flight Passport. */
  year: string | null;
  span: PosterStat | null;
  distance: PosterStat;
  flights: PosterStat;
  duration: PosterStat;
  secondary: PosterStat[];
  chart: PosterChart;
  highlights: PosterStat[];
  airports: { title: string; rows: PosterAirportRow[] } | null;
  notes: string[];
}

export type PosterTranslate = (
  key: string,
  options?: Record<string, unknown>,
) => string;

export const POSTER_BRAND = "KEEPRAW FLY";

export function buildPosterCopy(
  model: PosterDataModel,
  t: PosterTranslate,
  language: SupportedLocale,
  distanceUnit: DistanceUnit,
): PosterCopy {
  const number = (value: number) =>
    new Intl.NumberFormat(language, { maximumFractionDigits: 0 }).format(value);
  const unit = t(
    distanceUnit === "miles" ? "share.poster.mi" : "share.poster.km",
  );
  const distance = (kilometers: number) =>
    formatDistance(kilometers, language, distanceUnit);
  const month = (value: number, style: "short" | "long") =>
    new Intl.DateTimeFormat(language, { month: style, timeZone: "UTC" }).format(
      new Date(Date.UTC(2001, value - 1, 1)),
    );
  const stats = model.statistics;
  const yearText =
    model.scope.kind === "year" ? String(model.scope.year) : null;

  const highlight = (item: PosterHighlight): PosterStat => {
    if (item.kind === "longestFlight")
      return {
        label: t("share.poster.longestFlight"),
        value: distance(item.kilometers),
        unit,
      };
    if (item.kind === "busiestMonth")
      return {
        label: t("share.poster.busiestMonth"),
        value: month(item.month, "long"),
        unit: t("share.poster.flightsCount", { count: item.flights }),
      };
    return {
      label: t("share.poster.airportsVisited"),
      value: number(item.count),
    };
  };

  const points = model.trend.points;
  const maxFlights = Math.max(0, ...points.map((point) => point.flights));
  const accent =
    model.template === "year" &&
    model.highlights.some((item) => item.kind === "busiestMonth")
      ? points.findIndex((point) => point.flights === maxFlights)
      : null;

  const notes: string[] = [];
  if (stats.distanceUnknownFlights > 0)
    notes.push(
      t("share.poster.distanceCoverage", {
        known: stats.distanceKnownFlights,
        total: stats.flights,
      }),
    );
  if (stats.durationUnknownFlights > 0)
    notes.push(
      t("share.poster.durationCoverage", {
        known: stats.durationKnownFlights,
        total: stats.flights,
      }),
    );
  if (model.trend.undatedFlights > 0)
    notes.push(
      t("share.poster.undatedFlights", { count: model.trend.undatedFlights }),
    );

  const range = model.yearRange;
  return {
    locale: shareLocaleForLanguage(language),
    brand: POSTER_BRAND,
    title: t(
      model.template === "year"
        ? "share.poster.yearTitle"
        : "share.poster.passportTitle",
    ),
    scopeLabel: yearText ?? t("share.poster.lifetime"),
    year: model.template === "year" ? yearText : null,
    span: range
      ? {
          label: t("share.poster.span"),
          value:
            range.first === range.last
              ? String(range.first)
              : `${range.first} – ${range.last}`,
        }
      : null,
    distance: {
      label: t("share.poster.distance"),
      value: distance(stats.distanceKilometers),
      unit,
    },
    flights: { label: t("share.poster.flights"), value: number(stats.flights) },
    duration: {
      label: t("share.poster.duration"),
      value: formatDuration(stats.durationMinutes, language),
    },
    secondary: [
      { label: t("share.poster.airports"), value: number(stats.airports) },
      { label: t("share.poster.airlines"), value: number(stats.airlines) },
      { label: t("share.poster.countries"), value: number(stats.countries) },
    ],
    chart: {
      title:
        model.trend.kind === "month"
          ? t("share.poster.flightsByMonth")
          : model.trend.omittedYears > 0
            ? t("share.poster.flightsByRecentYears", { count: points.length })
            : t("share.poster.flightsByYear"),
      labels: points.map((point) =>
        model.trend.kind === "month"
          ? month(point.label, "short")
          : String(point.label),
      ),
      values: points.map((point) => point.flights),
      valueLabels: points.map((point) => number(point.flights)),
      accentIndex: accent !== null && accent >= 0 ? accent : null,
      emptyText: t("share.poster.noFlights"),
    },
    highlights: model.highlights.map(highlight),
    airports:
      model.privacy === "airports" && model.airports.length
        ? {
            title: t("share.poster.topAirports"),
            rows: model.airports.map((airport) => ({
              code: airport.code,
              name: airport.name,
              value: t("share.poster.visitsCount", { count: airport.visits }),
            })),
          }
        : null,
    notes,
  };
}
