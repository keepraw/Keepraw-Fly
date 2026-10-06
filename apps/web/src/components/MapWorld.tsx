import { regionalWorldPaths } from "../data/map-geometry";
import { useMemo } from "react";

interface MapWorldProps {
  countryVisits?: ReadonlyMap<string, number>;
  countryName?: (code: string, fallback: string) => string;
  countryLabel?: (name: string, visited: boolean) => string;
  showOutline?: boolean;
  centerLongitude?: number;
}

export function MapWorld({
  countryVisits,
  countryName,
  countryLabel,
  showOutline = true,
  centerLongitude = 0,
}: MapWorldProps) {
  const paths = useMemo(
    () => regionalWorldPaths(centerLongitude),
    [centerLongitude],
  );
  const maximumVisits = Math.max(
    1,
    ...(countryVisits ? [...countryVisits.values()] : []),
  );

  return (
    <g className="map-world" aria-hidden="true">
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
      <path className="map-coastline" d={paths.land} />
    </g>
  );
}
