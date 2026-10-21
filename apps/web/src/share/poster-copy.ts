import {
  formatDuration,
  type DistanceUnit,
  type SupportedLocale,
} from "@keepraw-fly/core";
import type {
  PosterDataModel,
  PosterMapAirport,
  PosterRoute,
} from "./poster-data";
import { shareLocaleForLanguage, type ShareLocale } from "./share-text";

/**
 * Poster Copy: the finished strings a poster draws, plus the route geometry.
 * This is the drawing layer's entire input besides the layout and palette.
 * No flight objects, no dates, no ids, no airport codes or names.
 */
export interface PosterStat {
  label: string;
  value: string;
  unit?: string;
}

/**
 * What the map draws: every route of the archive (or a clearly labelled
 * busiest selection) and unlabelled airport dots.
 */
export interface PosterMapCopy {
  routes: PosterRoute[];
  airports: PosterMapAirport[];
  centerLongitude: number;
  /** "All 50 routes shown" or "Busiest 60 of 112 routes shown"; null when
   * the archive has no plottable route. */
  note: string | null;
}

export interface PosterCopy {
  locale: ShareLocale;
  brand: string;
  title: string;
  /** "Issued by Keepraw Fly" in the interface language. */
  issuer: string;
  span: PosterStat | null;
  distance: PosterStat;
  flights: PosterStat;
  duration: PosterStat;
  secondary: PosterStat[];
  notes: string[];
  map: PosterMapCopy;
  /** Two machine-readable-zone style lines built only from the brand and
   * the aggregate totals (ASCII, no identity). */
  mrz: [string, string];
}

/** Machine-readable-zone line: A–Z, 0–9 and "<", padded to `length`. */
export function posterMrzLine(parts: string[], length = 44): string {
  const clean = parts
    .map((part) =>
      part
        .toUpperCase()
        .normalize("NFKD")
        .replace(/[^A-Z0-9]+/g, "<")
        .replace(/^<+|<+$/g, ""),
    )
    .filter(Boolean)
    .join("<<");
  return clean.length >= length
    ? clean.slice(0, length)
    : clean + "<".repeat(length - clean.length);
}

export type PosterTranslate = (
  key: string,
  options?: Record<string, unknown>,
) => string;

/** The product name is a brand and is never translated. */
export const POSTER_BRAND = "Keepraw Fly";

/** Same factor as core `formatDistance`, so the poster and app agree. */
const MILES_PER_KILOMETER = 0.6213711922;

/**
 * Poster numbers never use digit grouping ("571474", not "571,474"), in
 * every locale. Only the poster: the app keeps its own grouped formats.
 */
export function posterNumberFormat(language: SupportedLocale) {
  return new Intl.NumberFormat(language, {
    maximumFractionDigits: 0,
    useGrouping: false,
  });
}

/** i18next `{{name, number}}` interpolations, ungrouped like the figures. */
function ungrouped(values: Record<string, number>) {
  return {
    ...values,
    formatParams: Object.fromEntries(
      Object.keys(values).map((key) => [key, { useGrouping: false }]),
    ),
  };
}

export function buildPosterCopy(
  model: PosterDataModel,
  t: PosterTranslate,
  language: SupportedLocale,
  distanceUnit: DistanceUnit,
): PosterCopy {
  const formatter = posterNumberFormat(language);
  const number = (value: number) => formatter.format(value);
  const unit = t(
    distanceUnit === "miles" ? "share.poster.mi" : "share.poster.km",
  );
  const stats = model.statistics;

  const notes: string[] = [];
  if (stats.distanceUnknownFlights > 0)
    notes.push(
      t(
        "share.poster.distanceCoverage",
        ungrouped({ known: stats.distanceKnownFlights, total: stats.flights }),
      ),
    );
  if (stats.durationUnknownFlights > 0)
    notes.push(
      t(
        "share.poster.durationCoverage",
        ungrouped({ known: stats.durationKnownFlights, total: stats.flights }),
      ),
    );

  const range = model.yearRange;
  const map = model.map;
  return {
    locale: shareLocaleForLanguage(language),
    brand: POSTER_BRAND,
    title: t("share.poster.passportTitle"),
    issuer: t("share.poster.issuedBy", { brand: POSTER_BRAND }),
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
      value: number(
        distanceUnit === "miles"
          ? stats.distanceKilometers * MILES_PER_KILOMETER
          : stats.distanceKilometers,
      ),
      unit,
    },
    flights: { label: t("share.poster.flights"), value: number(stats.flights) },
    duration:
      stats.durationMinutes >= 600
        ? {
            label: t("share.poster.duration"),
            value: number(Math.round(stats.durationMinutes / 60)),
            unit: t("share.poster.hoursUnit"),
          }
        : {
            label: t("share.poster.duration"),
            value: formatDuration(stats.durationMinutes, language),
          },
    secondary: [
      { label: t("share.poster.airports"), value: number(stats.airports) },
      { label: t("share.poster.airlines"), value: number(stats.airlines) },
      { label: t("share.poster.countries"), value: number(stats.countries) },
    ],
    notes,
    map: {
      routes: map.routes,
      airports: map.airports,
      centerLongitude: map.centerLongitude,
      note: !map.totalRoutes
        ? null
        : map.curated
          ? t(
              "share.poster.routesCurated",
              ungrouped({ shown: map.routes.length, total: map.totalRoutes }),
            )
          : t("share.poster.routesAll", ungrouped({ count: map.totalRoutes })),
    },
    mrz: [
      posterMrzLine(["KEEPRAW FLY", "FLIGHT PASSPORT"]),
      posterMrzLine([
        "LIFETIME",
        range ? `${range.first}${range.last}` : "",
        `${stats.flights}FLT`,
        `${Math.round(stats.distanceKilometers)}KM`,
        `${Math.round(stats.durationMinutes / 60)}H`,
      ]),
    ],
  };
}
