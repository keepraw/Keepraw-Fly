/**
 * Extension slots (docs/views-and-skins.md). A skin may add content to a view
 * only here. An extension is compiled into the application and receives the
 * read-only insights of its slot: it has no access to storage, the network or
 * the archive itself, and it renders nothing when the insights are empty.
 */
import { useMemo, type ComponentType } from "react";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  flightTimeline,
  plannedActualComparison,
  type FlightTimeline,
  type PlannedActualComparison,
  type SupportedLocale,
  type TimeFormat,
} from "@keepraw-fly/core";
import type { SkinId } from "../registry";
import { AviationFlightExtension } from "./AviationFlightExtension";

/** What `flight.extension` may read about the flight on screen. */
export interface FlightInsights {
  readonly comparison: PlannedActualComparison | null;
  readonly timeline: FlightTimeline | null;
}

export interface FlightExtensionProps {
  insights: FlightInsights;
  locale: SupportedLocale;
  timeFormat: TimeFormat;
}

/** Slots are added here with the first extension that fills them. */
interface SkinExtensions {
  flight?: ComponentType<FlightExtensionProps>;
}

const EXTENSIONS: Record<SkinId, SkinExtensions> = {
  minimal: {},
  aviation: { flight: AviationFlightExtension },
};

export function flightInsights(flight: KeeprawFlight): FlightInsights {
  return Object.freeze({
    comparison: plannedActualComparison(flight),
    timeline: flightTimeline(flight),
  });
}

/** `flight.extension`: nothing when the skin has none or it has no data. */
export function FlightExtensionSlot({
  skin,
  flight,
  locale,
  timeFormat,
}: {
  skin: SkinId;
  flight: KeeprawFlight;
  locale: SupportedLocale;
  timeFormat: TimeFormat;
}) {
  const insights = useMemo(() => flightInsights(flight), [flight]);
  const Extension = EXTENSIONS[skin].flight;
  if (!Extension || (!insights.comparison && !insights.timeline)) return null;
  return (
    <div className="detail-extension" data-slot="flight.extension">
      <Extension insights={insights} locale={locale} timeFormat={timeFormat} />
    </div>
  );
}
