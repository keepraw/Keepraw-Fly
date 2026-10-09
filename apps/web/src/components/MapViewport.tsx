import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { WORLD_HEIGHT, WORLD_WIDTH } from "../data/map-geometry";
import { type MapCamera } from "../data/map-camera";

interface MapViewportProps {
  ariaLabel: string;
  className?: string;
  initialCamera: MapCamera;
  cameraForViewport?: (height: number, pixelScale: number) => MapCamera;
  maxZoom?: number;
  minZoom?: number;
  labels: {
    zoomIn: string;
    zoomOut: string;
    reset: string;
  };
  children: (
    camera: MapCamera,
    viewportHeight: number,
    pixelScale: number,
  ) => ReactNode;
}

interface Gesture {
  camera: MapCamera;
  midpoint: { x: number; y: number };
  distance: number;
  worldAnchor: { x: number; y: number };
}

export function MapViewport({
  ariaLabel,
  className,
  initialCamera,
  cameraForViewport,
  maxZoom = 6,
  minZoom = 1,
  labels,
  children,
}: MapViewportProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewportHeight, setViewportHeight] = useState(WORLD_HEIGHT);
  const [viewportWidth, setViewportWidth] = useState(WORLD_WIDTH);
  const fittedCamera =
    cameraForViewport?.(viewportHeight, WORLD_WIDTH / viewportWidth) ??
    initialCamera;
  const cameraRef = useRef(initialCamera);
  const animationRef = useRef<number | undefined>(undefined);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<Gesture | undefined>(undefined);
  const gestureMovedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const mountedRef = useRef(false);
  const [camera, setCameraState] = useState(() =>
    clampCamera(initialCamera, maxZoom, viewportHeight, minZoom),
  );

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === "undefined") return;
    // Establish screen scale before paint. SVG endpoint radii must not spend a
    // frame using the 960px fallback when a different-width stage is mounted.
    if (svg.clientWidth > 0 && svg.clientHeight > 0) {
      setViewportHeight((WORLD_WIDTH * svg.clientHeight) / svg.clientWidth);
      setViewportWidth(svg.clientWidth);
    }
    const observer = new ResizeObserver(([entry]) => {
      if (
        entry &&
        entry.contentRect.width > 0 &&
        entry.contentRect.height > 0
      ) {
        setViewportHeight(
          (WORLD_WIDTH * entry.contentRect.height) / entry.contentRect.width,
        );
        setViewportWidth(entry.contentRect.width);
      }
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  const setCamera = useCallback(
    (next: MapCamera) => {
      const clamped = clampCamera(next, maxZoom, viewportHeight, minZoom);
      cameraRef.current = clamped;
      setCameraState(clamped);
    },
    [maxZoom, minZoom, viewportHeight],
  );

  const stopAnimation = useCallback(() => {
    if (animationRef.current !== undefined)
      cancelAnimationFrame(animationRef.current);
    animationRef.current = undefined;
  }, []);

  const animateTo = useCallback(
    (target: MapCamera) => {
      stopAnimation();
      const destination = clampCamera(target, maxZoom, viewportHeight, minZoom);
      const start = cameraRef.current;
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduceMotion) {
        setCamera(destination);
        return;
      }
      const startedAt = performance.now();
      const duration = 240;
      const step = (now: number) => {
        const progress = Math.min((now - startedAt) / duration, 1);
        const eased = 1 - (1 - progress) ** 3;
        setCamera({
          centerX: mix(start.centerX, destination.centerX, eased),
          centerY: mix(start.centerY, destination.centerY, eased),
          zoom: mix(start.zoom, destination.zoom, eased),
        });
        if (progress < 1) animationRef.current = requestAnimationFrame(step);
        else animationRef.current = undefined;
      };
      animationRef.current = requestAnimationFrame(step);
    },
    [maxZoom, minZoom, viewportHeight, setCamera, stopAnimation],
  );

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      setCamera(fittedCamera);
      return;
    }
    animateTo(fittedCamera);
  }, [
    animateTo,
    fittedCamera.centerX,
    fittedCamera.centerY,
    fittedCamera.zoom,
    setCamera,
  ]);

  useEffect(() => () => stopAnimation(), [stopAnimation]);

  const zoomAt = useCallback(
    (anchor: { x: number; y: number }, nextZoom: number, animate = false) => {
      const current = cameraRef.current;
      const zoom = Math.min(maxZoom, Math.max(minZoom, nextZoom));
      const worldX =
        current.centerX + (anchor.x - WORLD_WIDTH / 2) / current.zoom;
      const worldY =
        current.centerY + (anchor.y - viewportHeight / 2) / current.zoom;
      const next = {
        centerX: worldX - (anchor.x - WORLD_WIDTH / 2) / zoom,
        centerY: worldY - (anchor.y - viewportHeight / 2) / zoom,
        zoom,
      };
      if (animate) animateTo(next);
      else setCamera(next);
    },
    [animateTo, maxZoom, minZoom, viewportHeight, setCamera],
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      stopAnimation();
      const point = clientToMap(svg, event.clientX, event.clientY);
      const delta = event.deltaMode === 1 ? event.deltaY * 18 : event.deltaY;
      zoomAt(point, cameraRef.current.zoom * Math.exp(-delta * 0.0016));
    };
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, [stopAnimation, zoomAt]);

  const resetGesture = useCallback(() => {
    const points = [...pointersRef.current.values()];
    if (points.length === 0) {
      gestureRef.current = undefined;
      return;
    }
    const midpoint = averagePoint(points);
    gestureRef.current = {
      camera: cameraRef.current,
      midpoint,
      distance: points.length > 1 ? pointDistance(points[0]!, points[1]!) : 0,
      worldAnchor: screenToWorld(midpoint, cameraRef.current, viewportHeight),
    };
  }, [viewportHeight]);

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    stopAnimation();
    if (!(event.target as Element).closest('[role="button"]'))
      event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(
      event.pointerId,
      clientToMap(event.currentTarget, event.clientX, event.clientY),
    );
    gestureMovedRef.current = false;
    resetGesture();
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointersRef.current.has(event.pointerId) || !gestureRef.current)
      return;
    pointersRef.current.set(
      event.pointerId,
      clientToMap(event.currentTarget, event.clientX, event.clientY),
    );
    const points = [...pointersRef.current.values()];
    const gesture = gestureRef.current;
    const midpoint = averagePoint(points);
    if (
      Math.hypot(
        midpoint.x - gesture.midpoint.x,
        midpoint.y - gesture.midpoint.y,
      ) > 2
    ) {
      gestureMovedRef.current = true;
    }

    if (points.length === 1) {
      setCamera({
        centerX:
          gesture.camera.centerX -
          (midpoint.x - gesture.midpoint.x) / gesture.camera.zoom,
        centerY:
          gesture.camera.centerY -
          (midpoint.y - gesture.midpoint.y) / gesture.camera.zoom,
        zoom: gesture.camera.zoom,
      });
      return;
    }

    const distance = Math.max(pointDistance(points[0]!, points[1]!), 1);
    const zoom = Math.min(
      maxZoom,
      Math.max(
        minZoom,
        (gesture.camera.zoom * distance) / Math.max(gesture.distance, 1),
      ),
    );
    setCamera({
      centerX: gesture.worldAnchor.x - (midpoint.x - WORLD_WIDTH / 2) / zoom,
      centerY: gesture.worldAnchor.y - (midpoint.y - viewportHeight / 2) / zoom,
      zoom,
    });
  };

  const handlePointerEnd = (event: ReactPointerEvent<SVGSVGElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (gestureMovedRef.current) suppressClickRef.current = true;
    resetGesture();
  };

  const handleClickCapture = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDoubleClick = (event: ReactMouseEvent<SVGSVGElement>) => {
    if ((event.target as Element).closest('[role="button"]')) return;
    event.preventDefault();
    zoomAt(
      clientToMap(event.currentTarget, event.clientX, event.clientY),
      cameraRef.current.zoom * 1.8,
      true,
    );
  };

  const translateX = WORLD_WIDTH / 2 - camera.centerX * camera.zoom;
  const translateY = viewportHeight / 2 - camera.centerY * camera.zoom;

  return (
    <div
      className={`map-viewport ${className ?? ""}`}
      data-zoom={camera.zoom.toFixed(2)}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WORLD_WIDTH} ${viewportHeight}`}
        role="group"
        aria-label={ariaLabel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onDoubleClick={handleDoubleClick}
        onClickCapture={handleClickCapture}
      >
        <g
          className="map-viewport-content"
          transform={`translate(${translateX} ${translateY}) scale(${camera.zoom})`}
        >
          {children(camera, viewportHeight, WORLD_WIDTH / viewportWidth)}
        </g>
      </svg>
      <div className="map-zoom-controls" role="group" aria-label={labels.reset}>
        <button
          type="button"
          onClick={() =>
            zoomAt(
              { x: WORLD_WIDTH / 2, y: viewportHeight / 2 },
              camera.zoom * 1.5,
              true,
            )
          }
          disabled={camera.zoom >= maxZoom - 0.01}
          aria-label={labels.zoomIn}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 3v10M3 8h10" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() =>
            zoomAt(
              { x: WORLD_WIDTH / 2, y: viewportHeight / 2 },
              camera.zoom / 1.5,
              true,
            )
          }
          disabled={camera.zoom <= minZoom + 0.01}
          aria-label={labels.zoomOut}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 8h10" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => animateTo(fittedCamera)}
          aria-label={labels.reset}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 7.2 8 3l5 4.2v5.3H9.8V9.3H6.2v3.2H3Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function clampCamera(
  camera: MapCamera,
  maxZoom: number,
  viewportHeight: number,
  minZoom: number,
): MapCamera {
  const zoom = Math.min(maxZoom, Math.max(minZoom, camera.zoom));
  const halfWidth = Math.min(WORLD_WIDTH / 2, WORLD_WIDTH / (2 * zoom));
  const halfHeight = Math.min(WORLD_HEIGHT / 2, viewportHeight / (2 * zoom));
  return {
    centerX: Math.min(
      WORLD_WIDTH - halfWidth,
      Math.max(halfWidth, camera.centerX),
    ),
    centerY: Math.min(
      WORLD_HEIGHT - halfHeight,
      Math.max(halfHeight, camera.centerY),
    ),
    zoom,
  };
}

function clientToMap(svg: SVGSVGElement, clientX: number, clientY: number) {
  const rect = svg.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) * WORLD_WIDTH) / rect.width,
    y: ((clientY - rect.top) * svg.viewBox.baseVal.height) / rect.height,
  };
}

function screenToWorld(
  point: { x: number; y: number },
  camera: MapCamera,
  viewportHeight: number,
) {
  return {
    x: camera.centerX + (point.x - WORLD_WIDTH / 2) / camera.zoom,
    y: camera.centerY + (point.y - viewportHeight / 2) / camera.zoom,
  };
}

function averagePoint(points: { x: number; y: number }[]) {
  const count = points.length;
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / count,
    y: points.reduce((sum, point) => sum + point.y, 0) / count,
  };
}

function pointDistance(
  left: { x: number; y: number },
  right: { x: number; y: number },
) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function mix(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}
