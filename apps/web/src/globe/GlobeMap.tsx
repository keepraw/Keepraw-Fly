import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import type { RouteSegment } from "@keepraw-fly/core";
import { PassportRouteMap } from "../components/PassportRouteMap";
import {
  createGlobe,
  GlobeInitializationError,
  type GlobeFailure,
  type GlobeController,
  type GlobeSelection,
  type GlobeTheme,
} from "./globe-renderer";
import type { GlobeLighting } from "./globe-lighting";

export function GlobeMap({
  routes,
  flights,
  theme,
  quality,
  lighting,
  selection,
  highlightedRoute,
  onSelect,
}: {
  routes: RouteSegment[];
  flights: KeeprawFlight[];
  theme: GlobeTheme;
  quality: "2048" | "4096";
  lighting: GlobeLighting;
  selection: GlobeSelection | null;
  highlightedRoute?: string;
  onSelect: (selection: GlobeSelection) => void;
}) {
  const { t } = useTranslation();
  const host = useRef<HTMLDivElement>(null),
    labels = useRef<HTMLDivElement>(null),
    controller = useRef<GlobeController | null>(null);
  const latest = useRef({
    onSelect,
    selection,
    theme,
    highlightedRoute,
    lighting,
  });
  latest.current = { onSelect, selection, theme, highlightedRoute, lighting };
  const [error, setError] = useState<GlobeFailure | null>(null),
    [hover, setHover] = useState<string | null>(null),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!host.current || !labels.current) return;
    setError(null);
    const fail = (failure: GlobeFailure) => {
      console.warn("[Globe Lab] Rendering fallback", failure);
      setHover(null);
      setError(failure);
    };
    try {
      const instance = createGlobe(
        host.current,
        labels.current,
        routes,
        latest.current.theme,
        quality,
        {
          select: (s) => latest.current.onSelect(s),
          canvasLabel: t("globe.keyboard"),
          airportLabel: (code, count) =>
            `${code} · ${t("passport.visitFrequency", { count })}`,
          routeLabel: (origin, destination, count) =>
            `${origin} → ${destination} · ${t("passport.flightFrequency", { count })}`,
          hover: setHover,
          error: fail,
        },
      );
      controller.current = instance;
      instance.lighting(latest.current.lighting);
      instance.select(latest.current.selection);
      return () => {
        instance.dispose();
        controller.current = null;
      };
    } catch (cause) {
      fail(
        cause instanceof GlobeInitializationError
          ? cause.failure
          : {
              kind: "initialization",
              message: cause instanceof Error ? cause.message : String(cause),
            },
      );
    }
  }, [routes, quality, retry]);
  useEffect(() => controller.current?.theme(theme), [theme]);
  useEffect(() => controller.current?.lighting(lighting), [lighting]);
  useEffect(() => controller.current?.select(selection), [selection]);
  useEffect(
    () => controller.current?.highlight(highlightedRoute),
    [highlightedRoute],
  );
  return (
    <section
      className="globe-stage"
      aria-label={t("globe.mapLabel")}
      data-theme={theme}
      data-attempt={retry}
      data-error={error ? JSON.stringify(error) : undefined}
    >
      <div className="globe-host" ref={host} hidden={Boolean(error)} />
      <div className="globe-labels" ref={labels} hidden={Boolean(error)} />
      {error ? (
        <div className="globe-fallback">
          <p role="status">
            {t("globe.fallback")}{" "}
            <button onClick={() => setRetry((n) => n + 1)}>
              {t("actions.retry")}
            </button>
          </p>
          <PassportRouteMap
            routes={routes}
            flights={flights}
            selectedAirport={
              selection?.kind === "airport" ? selection.code : undefined
            }
            selectedRoute={selection?.kind === "route" ? selection : undefined}
            onSelectAirport={(code) => onSelect({ kind: "airport", code })}
            onSelectRoute={(origin, destination) =>
              onSelect({ kind: "route", origin, destination })
            }
          />
        </div>
      ) : (
        <>
          <div className="globe-caption">
            {t("globe.surface")}
            <span>{t("globe.local")}</span>
          </div>
          <div className="globe-legend" hidden={lighting.earthOnly}>
            <span className="globe-legend-route" />
            {t("globe.routes")}
            <span className="globe-legend-selected" />
            {t("globe.selected")}
          </div>
          {import.meta.env.DEV && (
            <button
              className="globe-twilight-review"
              onClick={() => controller.current?.twilightReview()}
            >
              {t("globe.twilightReview")}
            </button>
          )}
          <div className="globe-controls">
            <button
              onClick={() => controller.current?.zoom(1 / 1.15)}
              aria-label={t("mapControls.zoomIn")}
            >
              +
            </button>
            <button
              onClick={() => controller.current?.zoom(1.15)}
              aria-label={t("mapControls.zoomOut")}
            >
              −
            </button>
            <button
              onClick={() => controller.current?.home()}
              aria-label={t("mapControls.reset")}
              title={t("mapControls.reset")}
            >
              ⌂
            </button>
          </div>
          <div className="globe-tooltip" role="status">
            {hover ??
              (selection?.kind === "route"
                ? `${selection.origin} → ${selection.destination}`
                : selection?.kind === "airport"
                  ? selection.code
                  : "")}
          </div>
        </>
      )}
    </section>
  );
}
