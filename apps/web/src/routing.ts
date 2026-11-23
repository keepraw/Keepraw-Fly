/**
 * Fragment routing for the view architecture (docs/views-and-skins.md).
 * The application is served as static files from arbitrary sub-paths, so the
 * route lives in the URL fragment and never needs a server rewrite.
 */
export const PRIMARY_VIEWS = ["log", "map", "stats", "passport"] as const;
export type PrimaryView = (typeof PRIMARY_VIEWS)[number];

export type Route =
  | { view: PrimaryView }
  | { view: "flight"; flightId: string }
  | { view: "settings"; part?: string };

/** Landing view until skins choose their own (phase 3). */
export const DEFAULT_LANDING_VIEW: PrimaryView = "map";

/** Fragments of earlier versions that now open the landing view. */
const LEGACY_LANDING_FRAGMENTS = new Set(["passport", "flights", "share"]);

function isPrimaryView(value: string): value is PrimaryView {
  return (PRIMARY_VIEWS as readonly string[]).includes(value);
}

function decodeSegment(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/**
 * Resolve a fragment (with or without the leading `#`). Returns `null` for an
 * unknown fragment so in-page anchors and foreign fragments are left alone.
 */
export function parseRoute(
  fragment: string,
  landing: PrimaryView = DEFAULT_LANDING_VIEW,
): Route | null {
  const raw = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  if (raw === "" || raw === "/") return { view: landing };
  if (LEGACY_LANDING_FRAGMENTS.has(raw)) return { view: landing };
  if (raw === "settings") return { view: "settings" };
  if (!raw.startsWith("/")) return null;

  const path = raw.slice(1).split("?")[0] ?? "";
  const [head = "", ...rest] = path.split("/");
  if (isPrimaryView(head) && rest.length === 0) return { view: head };
  if (head === "settings" && rest.length <= 1) {
    const part = rest[0] ? decodeSegment(rest[0]) : null;
    return part ? { view: "settings", part } : { view: "settings" };
  }
  if (head === "flight" && rest.length === 1 && rest[0]) {
    const flightId = decodeSegment(rest[0]);
    return flightId ? { view: "flight", flightId } : null;
  }
  return null;
}

/** Canonical fragment, including the leading `#`. */
export function formatRoute(route: Route): string {
  if (route.view === "flight")
    return `#/flight/${encodeURIComponent(route.flightId)}`;
  if (route.view === "settings")
    return route.part
      ? `#/settings/${encodeURIComponent(route.part)}`
      : "#/settings";
  return `#/${route.view}`;
}

export function sameRoute(a: Route, b: Route): boolean {
  return formatRoute(a) === formatRoute(b);
}

/** Primary destinations with the landing view first; DOM order follows it. */
export function primaryViewOrder(
  landing: PrimaryView = DEFAULT_LANDING_VIEW,
): PrimaryView[] {
  return [landing, ...PRIMARY_VIEWS.filter((view) => view !== landing)];
}
