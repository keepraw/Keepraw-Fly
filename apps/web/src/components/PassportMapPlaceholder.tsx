import { useTranslation } from "react-i18next";
import type { RouteSegment } from "@keepraw-fly/core";

interface PassportMapPlaceholderProps {
  routes: RouteSegment[];
}

export function PassportMapPlaceholder({ routes }: PassportMapPlaceholderProps) {
  const { t } = useTranslation();
  const airportCount = new Set(
    routes.flatMap((route) => [route.origin.iata, route.destination.iata]),
  ).size;

  return (
    <section className="map-placeholder" aria-labelledby="map-title">
      <div>
        <p className="eyebrow">{t("passport.routes")}</p>
        <h2 id="map-title">{t("passport.map")}</h2>
        <p>{t("passport.mapDescription")}</p>
        <span>{t("passport.mapSummary", { routes: routes.length, airports: airportCount })}</span>
      </div>
      <svg viewBox="0 0 520 230" role="img" aria-label={t("passport.mapPreviewLabel")}>
        <path className="map-land" d="M38 76c43-42 97-53 142-30 24 12 35 38 16 52-29 21-29 42-7 71-47 23-89 13-105-18-14-28-41-33-46-75Zm221-19c29-29 68-43 114-30 61 17 98 73 98 116-43-17-72-9-99 31-45 6-77-8-92-38-16-31-10-56-21-79Z" />
        <path className="map-route" d="M104 109Q191 34 289 88M109 109Q242 180 392 121M289 88Q343 60 392 121M289 88Q256 102 195 94" />
        <g className="map-points">
          <circle cx="104" cy="109" r="4" /><circle cx="195" cy="94" r="4" />
          <circle cx="289" cy="88" r="4" /><circle cx="392" cy="121" r="4" />
        </g>
      </svg>
    </section>
  );
}

