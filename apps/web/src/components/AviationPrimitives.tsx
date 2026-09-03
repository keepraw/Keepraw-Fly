import type { ReactNode } from "react";
import type { FlightOperationalStatus } from "@keepraw-fly/core";

export type AviationIconName =
  | "advanced"
  | "airport"
  | "clock"
  | "data"
  | "display"
  | "distance"
  | "flight"
  | "gate"
  | "profile"
  | "route";

const iconPaths: Record<AviationIconName, ReactNode> = {
  advanced: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
  airport: <><path d="M4 20h16M6 20V9l6-5 6 5v11" /><path d="M9 13h6M9 16h6" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>,
  data: <><ellipse cx="12" cy="5" rx="7" ry="3" /><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
  display: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  distance: <><path d="M5 18 19 6M7 6H5v2M17 18h2v-2" /><circle cx="6" cy="17" r="2" /><circle cx="18" cy="7" r="2" /></>,
  flight: <path d="m3 14 7-2 4-7 2 1-2 6 6 2v2l-7-1-3 5-2-1 2-5-7 2z" />,
  gate: <><path d="M5 20V5h11v15M16 9h3v11M8 9h5M8 13h5" /></>,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21c.7-4.2 3.2-6.5 7.5-6.5s6.8 2.3 7.5 6.5" /></>,
  route: <><path d="M3 17c4-8 8-2 12-7 2-2 3-3 6-3" /><circle cx="3" cy="17" r="1.5" /><circle cx="21" cy="7" r="1.5" /></>,
};

export function AviationIcon({ name, className }: { name: AviationIconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={["aviation-icon", className].filter(Boolean).join(" ")}
      viewBox="0 0 24 24"
    >
      {iconPaths[name]}
    </svg>
  );
}

type AviationStatusTone = "attention" | "critical" | "info" | "neutral" | "positive";

const operationalStatusTone: Record<FlightOperationalStatus, AviationStatusTone> = {
  delayed: "critical",
  early: "positive",
  onTime: "positive",
  scheduled: "neutral",
};

export function FlightStatusBadge({
  children,
  className,
  status,
}: {
  children: ReactNode;
  className?: string;
  status: FlightOperationalStatus;
}) {
  const tone = operationalStatusTone[status];
  return (
    <span
      className={["aviation-status", `aviation-status--${tone}`, className].filter(Boolean).join(" ")}
      data-flight-status={status}
    >
      {children}
    </span>
  );
}

export function AirportCode({
  className,
  code,
  size = "compact",
}: {
  className?: string;
  code: string;
  size?: "compact" | "display";
}) {
  return (
    <span className={["airport-code-display", `airport-code-display--${size}`, className].filter(Boolean).join(" ")}>
      {code}
    </span>
  );
}
