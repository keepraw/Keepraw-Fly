import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { buildRouteSegments } from "@keepraw-fly/core";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import type { Appearance } from "../storage/types";
import { GlobeMap } from "./GlobeMap";
import { defaultLighting } from "./globe-lighting";
import type { GlobeSelection } from "./globe-renderer";
import type { SolarMode } from "./globe-solar";
import "./globe-lab.css";
import "./detail-globe.css";
import "./lab-locales";

export function DetailGlobe({
  flight,
  appearance,
  solarMode,
}: {
  flight: KeeprawFlight;
  appearance: Appearance;
  solarMode: SolarMode;
}) {
  const { t } = useTranslation();
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    media.addEventListener("change", update);
    update();
    return () => media.removeEventListener("change", update);
  }, []);
  // Only flight identity and route semantics rebuild the scene. Editing notes,
  // language, units, solar time or appearance preserves the user's camera.
  const { id, origin, destination, divertedTo, cancelled } = flight;
  const routes = useMemo(
    () => buildRouteSegments([flight]),
    [id, origin.iata, destination.iata, divertedTo?.iata, cancelled],
  );
  const [selected, setSelected] = useState<{
    routes: typeof routes;
    value: GlobeSelection;
  } | null>(null);
  // Scope selection to the actual route before the replacement scene mounts.
  // A later effect reset would let a retained airport redirect its initial view.
  const selection = selected?.routes === routes ? selected.value : null;
  const theme =
    appearance === "system" ? (systemDark ? "dark" : "light") : appearance;
  return (
    <div className="detail-route-map detail-globe-frame" data-theme={theme}>
      {routes.length ? (
        <GlobeMap
          key={id}
          variant="detail"
          routes={routes}
          flights={[flight]}
          theme={theme}
          quality="4096"
          lighting={defaultLighting}
          solarMode={solarMode}
          selection={selection}
          onSelect={(value) => setSelected({ routes, value })}
        />
      ) : (
        <div className="detail-globe-message" role="status">
          {t(cancelled ? "globe.detailCancelled" : "globe.detailUnavailable")}
        </div>
      )}
    </div>
  );
}
