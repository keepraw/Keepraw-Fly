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
import type { ProfileName } from "@keepraw-fly/schema";
import { pinyin } from "pinyin-pro";
import { buildTd3Mrz, latinMrzName, SOUVENIR_TD3 } from "./td3-mrz";
import type { PassportProfile } from "../storage/passport-profile";
import { shareLocaleForLanguage, type ShareLocale } from "./share-text";

/**
 * Poster Copy: the finished strings a poster draws, plus the route geometry.
 * This is the drawing layer's entire input besides the layout and palette.
 * No flight objects, internal IDs, airport codes or airport names. The only
 * identity is the saved Settings name and the local souvenir display number.
 */
export interface PosterStat {
  label: string;
  value: string;
  unit?: string;
}

/**
 * Map geometry and coverage diagnostics. The photograph draws routes and
 * unlabelled airport dots; it has no map captions or legend.
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
  labels: Record<
    | "archive"
    | "heading"
    | "journeys"
    | "explore"
    | "profile"
    | "routeMap"
    | "documentType"
    | "documentValue"
    | "issuingState"
    | "issuingAuthority"
    | "name"
    | "number"
    | "firstFlight"
    | "period"
    | "journal",
    string
  >;
  holder: { name: string; number: string };
  /** Encoding limitations are metadata, never extra photo captions. */
  mrzIssues: string[];
  firstFlight: string;
  recordPeriod: string;
  recordTitle: string;
  disclaimer: string;
  routes: PosterStat;
  brand: string;
  title: string;
  /** "Issued by Keepraw Fly" in the interface language. */
  issuer: string;
  span: PosterStat | null;
  distance: PosterStat;
  flights: PosterStat;
  duration: PosterStat;
  secondary: PosterStat[];
  map: PosterMapCopy;
  /** ICAO TD3: two 44-character lines. Specimen policy, not a travel credential. */
  mrz: [string, string];
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
  profile: Pick<PassportProfile, "number">,
  name?: ProfileName,
): PosterCopy {
  const formatter = posterNumberFormat(language);
  const number = (value: number) => formatter.format(value);
  const unit = t(
    distanceUnit === "miles" ? "share.poster.mi" : "share.poster.km",
  );
  const stats = model.statistics;

  const range = model.yearRange;
  const map = model.map;
  const labels = Object.fromEntries(
    [
      "archive",
      "heading",
      "journeys",
      "explore",
      "profile",
      "routeMap",
      "documentType",
      "documentValue",
      "issuingState",
      "issuingAuthority",
      "name",
      "number",
      "firstFlight",
      "period",
      "journal",
    ].map((key) => [key, t(`share.journal.${key}`)]),
  ) as PosterCopy["labels"];
  const displayName =
    (name?.primary === "romanized"
      ? name.romanized || name.native
      : name?.native || name?.romanized) ?? "";
  // The profile has one unstructured full name, so do not guess its surname.
  // An explicit comma is the ICAO primary/secondary separator; otherwise the
  // entire saved name is the primary identifier (Part 3 §3.4).
  const usePinyin =
    !name?.romanized?.trim() && /\p{Script=Han}/u.test(displayName);
  const sourceName =
    name?.romanized?.trim() ||
    (usePinyin
      ? pinyin(displayName, {
          toneType: "none",
          type: "array",
          surname: "head",
          toneSandhi: false,
        }).join(" ")
      : displayName);
  const [primarySource, ...secondarySources] = sourceName.split(",");
  const primaryName = latinMrzName(primarySource ?? "");
  const secondaryName = latinMrzName(secondarySources.join(" "));
  const encodable = !!primaryName && secondaryName !== null;
  const mrz = buildTd3Mrz({
    ...SOUVENIR_TD3,
    documentNumber: profile.number,
    primaryName: encodable ? primaryName : "",
    secondaryName: encodable ? secondaryName : "",
  });
  return {
    locale: shareLocaleForLanguage(language),
    labels,
    holder: {
      name: displayName,
      number: profile.number,
    },
    mrzIssues: [
      ...(usePinyin ? ["automatic-pinyin"] : []),
      ...(!sourceName.trim()
        ? ["missing-name"]
        : !encodable || !primaryName
          ? ["name-needs-romanization"]
          : []),
      "birth-date-unknown",
      "nationality-unspecified",
      "sex-unspecified",
      "specimen-issuer",
      "fixed-souvenir-expiry",
    ],
    firstFlight: model.recordPeriod?.first.replaceAll("-", ".") ?? "—",
    recordPeriod: model.recordPeriod
      ? `${model.recordPeriod.first.replaceAll("-", ".")} — ${model.recordPeriod.last.replaceAll("-", ".")}`
      : "—",
    recordTitle: t("share.journal.flightRecord"),
    disclaimer: t("share.journal.disclaimer"),
    routes: {
      label: t("share.journal.routes"),
      value: number(model.routeCount),
    },
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
    map: {
      routes: map.routes,
      airports: map.airports,
      centerLongitude: map.centerLongitude,
      note:
        model.routeCount === 0
          ? null
          : map.routes.length !== model.routeCount
            ? t(
                "share.journal.routeCoverage",
                ungrouped({
                  shown: map.routes.length,
                  total: model.routeCount,
                }),
              )
            : t(
                "share.poster.routesAll",
                ungrouped({ count: model.routeCount }),
              ),
    },
    mrz,
  };
}
