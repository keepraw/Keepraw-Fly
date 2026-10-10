import { projectionAt, regionalWorldPaths } from "../data/map-geometry";
import { geoGraticule10, geoPath } from "d3-geo";
import { useId, useMemo } from "react";
import { MapRelief } from "./MapRelief";

interface MapWorldProps {
  countryVisits?: ReadonlyMap<string, number>;
  countryName?: (code: string, fallback: string) => string;
  countryLabel?: (name: string, visited: boolean) => string;
  showOutline?: boolean;
  centerLongitude?: number;
  appearance?: "standard" | "aviation";
}

export function MapWorld({
  countryVisits,
  countryName,
  countryLabel,
  showOutline = true,
  centerLongitude = 0,
  appearance = "standard",
}: MapWorldProps) {
  const id = useId().replace(/:/g, "");
  const aviation = appearance === "aviation";
  const graticule = useMemo(
    () =>
      aviation
        ? geoPath(projectionAt(centerLongitude))(geoGraticule10())
        : null,
    [aviation, centerLongitude],
  );
  const paths = useMemo(
    () => regionalWorldPaths(centerLongitude),
    [centerLongitude],
  );
  const maximumVisits = Math.max(
    1,
    ...(countryVisits ? [...countryVisits.values()] : []),
  );

  return (
    <g
      className={`map-world${aviation ? " map-world--aviation" : ""}`}
      aria-hidden="true"
    >
      {aviation ? (
        <>
          <defs>
            <filter id={`relief-light-${id}`} colorInterpolationFilters="sRGB">
              <feComponentTransfer>
                <feFuncR type="table" tableValues="0.40 0.60 0.82 0.97" />
                <feFuncG type="table" tableValues="0.57 0.75 0.89 0.99" />
                <feFuncB type="table" tableValues="0.75 0.88 0.97 1" />
              </feComponentTransfer>
            </filter>
            <filter id={`relief-dark-${id}`} colorInterpolationFilters="sRGB">
              <feComponentTransfer>
                <feFuncR type="table" tableValues="0.025 0.08 0.16 0.28" />
                <feFuncG type="table" tableValues="0.06 0.16 0.28 0.44" />
                <feFuncB type="table" tableValues="0.12 0.26 0.41 0.58" />
              </feComponentTransfer>
            </filter>
            <clipPath id={`land-${id}`}>
              <path d={paths.land} />
            </clipPath>
            <radialGradient id={`ocean-${id}`} cx="48%" cy="24%" r="82%">
              <stop offset="0" stopColor="var(--color-map-surface)" />
              <stop offset="1" stopColor="var(--color-map-ocean)" />
            </radialGradient>
            <linearGradient
              id={`land-light-${id}`}
              x1="0"
              y1="0"
              x2="0.7"
              y2="1"
            >
              <stop offset="0" stopColor="var(--color-map-land-light)" />
              <stop offset="0.52" stopColor="var(--color-map-land)" />
              <stop offset="1" stopColor="var(--color-map-land-shadow)" />
            </linearGradient>
            <radialGradient id={`limb-${id}`} cx="50%" cy="35%" r="65%">
              <stop
                offset="0.4"
                stopColor="var(--color-map-ocean)"
                stopOpacity="0"
              />
              <stop
                offset="1"
                stopColor="var(--color-map-ocean)"
                stopOpacity="0.65"
              />
            </radialGradient>
          </defs>
          <path d={paths.sphere} fill={`url(#ocean-${id})`} />
          {graticule ? <path className="map-graticule" d={graticule} /> : null}
          <path
            className="map-land-depth"
            d={paths.land}
            fill={`url(#land-light-${id})`}
          />
        </>
      ) : null}
      <path
        className={showOutline ? "map-sphere" : "map-sphere is-outline-hidden"}
        d={paths.sphere}
      />
      <g className="map-countries">
        {paths.countries.map((country) => {
          const visits = countryVisits?.get(country.code) ?? 0;
          const visited = visits > 0;
          const intensity = visits / maximumVisits;
          const className = visited
            ? `map-country is-visited is-${intensity > 0.66 ? "high" : intensity > 0.33 ? "medium" : "low"}`
            : "map-country";
          const name =
            countryName?.(country.code, country.name) ?? country.name;
          return (
            <path key={country.code} className={className} d={country.path}>
              {countryLabel ? (
                <title>{countryLabel(name, visited)}</title>
              ) : null}
            </path>
          );
        })}
      </g>
      {aviation ? (
        <>
          <g clipPath={`url(#land-${id})`} className="map-relief">
            <MapRelief
              centerLongitude={centerLongitude}
              lightFilter={`relief-light-${id}`}
              darkFilter={`relief-dark-${id}`}
            />
          </g>
          <path
            className="map-limb-shade"
            d={paths.sphere}
            fill={`url(#limb-${id})`}
          />
        </>
      ) : null}
      <path className="map-coastline" d={paths.land} />
    </g>
  );
}
