import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
import {
  FIXED_SUN_DIRECTION,
  msUntilNextUtcMinute,
  solarDirectionFromUtc,
  type SolarMode,
} from "./globe-solar";

export function GlobeMap({
  variant = "lab",
  routes,
  flights,
  theme,
  quality,
  lighting,
  solarMode,
  selection,
  highlightedRoute,
  onSelect,
}: {
  variant?: "lab" | "passport" | "detail";
  routes: RouteSegment[];
  flights: KeeprawFlight[];
  theme: GlobeTheme;
  quality: "2048" | "4096";
  lighting: GlobeLighting;
  solarMode: SolarMode;
  selection: GlobeSelection | null;
  highlightedRoute?: string;
  onSelect: (selection: GlobeSelection) => void;
}) {
  const { t, i18n } = useTranslation();
  const host = useRef<HTMLDivElement>(null),
    labels = useRef<HTMLDivElement>(null),
    controller = useRef<GlobeController | null>(null);
  const latest = useRef({
    onSelect,
    selection,
    theme,
    highlightedRoute,
    lighting,
    solarMode,
    t,
  });
  latest.current = {
    onSelect,
    selection,
    theme,
    highlightedRoute,
    lighting,
    solarMode,
    t,
  };
  const [error, setError] = useState<GlobeFailure | null>(null),
    [hover, setHover] = useState<string | null>(null),
    [retry, setRetry] = useState(0);
  // OrbitControls removes root-level key listeners via canvas.getRootNode().
  // Dispose before React detaches the host so that root is still the document.
  useLayoutEffect(() => {
    if (!host.current || !labels.current) return;
    setError(null);
    if (variant === "detail") setHover(null);
    let active = true;
    let instance: GlobeController | undefined;
    const dispose = () => {
      instance?.dispose();
      instance = undefined;
      controller.current = null;
    };
    const fail = (failure: GlobeFailure) => {
      if (!active) return;
      console.warn("[Globe Lab] Rendering fallback", failure);
      dispose();
      setHover(null);
      setError(failure);
    };
    try {
      instance = createGlobe(
        host.current,
        labels.current,
        routes,
        latest.current.theme,
        quality,
        {
          select: (s) => latest.current.onSelect(s),
          get canvasLabel() {
            return latest.current.t("globe.keyboard");
          },
          airportLabel: (code, count) =>
            `${code} · ${latest.current.t("passport.visitFrequency", { count })}`,
          routeLabel: (origin, destination, count) =>
            `${origin} → ${destination} · ${latest.current.t("passport.flightFrequency", { count })}`,
          hover: setHover,
          error: fail,
        },
        variant === "detail" ? "detail" : "passport",
        // Passport keeps the whole home globe disc within the map width;
        // Globe Lab keeps its cropped-cap composition.
        variant === "passport" ? { containDisc: true } : {},
      );
      controller.current = instance;
      instance.lighting(latest.current.lighting);
      instance.select(latest.current.selection);
      instance.highlight(latest.current.highlightedRoute);
      if (latest.current.solarMode === "realtime") {
        instance.solar(solarDirectionFromUtc(new Date()));
      }
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
    return () => {
      active = false;
      dispose();
    };
  }, [
    routes,
    quality,
    retry,
    variant,
    variant === "detail" ? null : i18n.resolvedLanguage,
  ]);
  useEffect(
    () => controller.current?.accessibility(),
    [t, i18n.resolvedLanguage],
  );
  useEffect(() => controller.current?.theme(theme), [theme]);
  useEffect(() => controller.current?.lighting(lighting), [lighting]);
  useEffect(() => {
    if (!controller.current) return;
    controller.current.solar(
      solarMode === "realtime"
        ? solarDirectionFromUtc(new Date())
        : FIXED_SUN_DIRECTION,
    );
  }, [solarMode]);
  useEffect(() => {
    if (solarMode !== "realtime") return;
    let disposed = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      if (timeout !== undefined) {
        clearTimeout(timeout);
        timeout = undefined;
      }
    };
    const schedule = () => {
      // At most one active timer: always replace, never stack.
      clear();
      if (disposed) return;
      timeout = setTimeout(tick, msUntilNextUtcMinute(new Date()) + 50);
    };
    const tick = () => {
      timeout = undefined;
      if (disposed) return;
      // Suspended while hidden: the visibility handler resynchronizes and
      // reschedules on restoration, so do not chain another timer here.
      if (document.hidden) return;
      controller.current?.solar(solarDirectionFromUtc(new Date()));
      schedule();
    };
    const onVisibility = () => {
      if (disposed) return;
      if (document.hidden) {
        // Suspend updates while hidden; drop any pending minute timer.
        clear();
        return;
      }
      // Visible again: resynchronize once, then resume the minute cadence.
      controller.current?.solar(solarDirectionFromUtc(new Date()));
      schedule();
    };
    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) schedule();
    return () => {
      disposed = true;
      clear();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [solarMode]);
  useEffect(() => controller.current?.select(selection), [selection]);
  useEffect(
    () => controller.current?.highlight(highlightedRoute),
    [highlightedRoute],
  );
  return (
    <section
      className={`globe-stage ${variant === "passport" ? "globe-stage-passport" : variant === "detail" ? "globe-stage-detail" : ""}`}
      aria-label={t(
        variant === "detail" ? "globe.detailLabel" : "globe.mapLabel",
      )}
      data-theme={theme}
      data-solar-mode={solarMode}
      data-attempt={retry}
      data-error={error ? JSON.stringify(error) : undefined}
    >
      <div className="globe-host" ref={host} hidden={Boolean(error)} />
      <div className="globe-labels" ref={labels} hidden={Boolean(error)} />
      {error ? (
        <div className="globe-fallback">
          <p role="status">
            {t(
              variant === "detail"
                ? `globe.errors.${error.kind}`
                : "globe.fallback",
            )}{" "}
            <button onClick={() => setRetry((n) => n + 1)}>
              {t("actions.retry")}
            </button>
          </p>
          {variant !== "detail" && (
            <PassportRouteMap
              routes={routes}
              flights={flights}
              selectedAirport={
                selection?.kind === "airport" ? selection.code : undefined
              }
              selectedRoute={
                selection?.kind === "route" ? selection : undefined
              }
              highlightedRoute={
                highlightedRoute
                  ? {
                      origin: highlightedRoute.split("-")[0]!,
                      destination: highlightedRoute.split("-")[1]!,
                    }
                  : undefined
              }
              onSelectAirport={(code) => onSelect({ kind: "airport", code })}
              onSelectRoute={(origin, destination) =>
                onSelect({ kind: "route", origin, destination })
              }
            />
          )}
        </div>
      ) : (
        <>
          {variant === "lab" ? (
            <div className="globe-caption">
              {t("globe.surface")}
              <span>{t("globe.local")}</span>
            </div>
          ) : null}
          <div
            className="globe-legend"
            hidden={lighting.earthOnly || variant === "detail"}
          >
            <span className="globe-legend-route" />
            {t("globe.routes")}
            <span className="globe-legend-selected" />
            {t("globe.selected")}
          </div>
          {variant === "lab" && import.meta.env.DEV && (
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
