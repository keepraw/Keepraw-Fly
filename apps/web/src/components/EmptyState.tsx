import { useTranslation } from "react-i18next";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import { formatRoute } from "../routing";
import { ImportControl } from "./ImportControl";
import { PageShell } from "./PageShell";

interface EmptyStateProps {
  onCreateArchive: () => void;
  onTryDemo: () => void;
  onImport: (document: KeeprawFlyDocument) => void | Promise<void>;
}

const POINTS = ["map", "log", "export"] as const;

// Fictional flights for the preview; codes and numbers need no translation.
const PREVIEW_FLIGHTS = [
  { date: "2026-03-14", number: "KF 218", from: "PVG", to: "LHR" },
  { date: "2026-02-02", number: "KF 61", from: "SIN", to: "NRT" },
  { date: "2025-11-27", number: "KF 905", from: "SFO", to: "PVG" },
] as const;
const PREVIEW_AIRPORTS = [
  { code: "SFO", x: 46, y: 74, labelY: 18 },
  { code: "LHR", x: 172, y: 50, labelY: 18 },
  { code: "PVG", x: 300, y: 82, labelY: 18 },
  { code: "NRT", x: 334, y: 70, labelY: -10 },
  { code: "SIN", x: 276, y: 128, labelY: 18 },
] as const;
const PREVIEW_ROUTES = [
  "M300 82 Q236 18 172 50",
  "M276 128 Q318 92 334 70",
  "M46 74 Q173 -6 300 82",
  "M172 50 Q230 110 276 128",
] as const;

export function EmptyState({
  onCreateArchive,
  onTryDemo,
  onImport,
}: EmptyStateProps) {
  const { t, i18n } = useTranslation();
  const number = new Intl.NumberFormat(i18n.language);
  const date = new Intl.DateTimeFormat(i18n.language, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <PageShell className="welcome">
      <p className="eyebrow">{t("welcome.eyebrow")}</p>
      <h1>{t("welcome.title")}</h1>
      <p>{t("welcome.description")}</p>
      <ul className="welcome-points">
        {POINTS.map((point) => (
          <li key={point}>{t(`welcome.points.${point}`)}</li>
        ))}
      </ul>
      <div className="welcome-actions">
        <button
          className="button-primary"
          type="button"
          onClick={onCreateArchive}
        >
          {t("actions.createArchive")}
        </button>
        <button className="button-secondary" type="button" onClick={onTryDemo}>
          {t("actions.tryDemo")}
        </button>
        <div className="welcome-import">
          <ImportControl onImport={onImport} />
        </div>
      </div>
      <a className="welcome-import-link" href={formatRoute({ view: "import" })}>
        {t("welcome.importOther")}
      </a>
      <p className="privacy-note">{t("welcome.privacy")}</p>
      <figure className="welcome-preview">
        <div className="welcome-preview-frame" aria-hidden="true">
          <svg
            className="welcome-preview-map"
            viewBox="0 0 380 160"
            focusable="false"
          >
            {PREVIEW_ROUTES.map((path) => (
              <path key={path} d={path} />
            ))}
            {PREVIEW_AIRPORTS.map((airport) => (
              <g key={airport.code}>
                <circle cx={airport.x} cy={airport.y} r="3.5" />
                <text
                  x={airport.x}
                  y={airport.y + airport.labelY}
                  textAnchor="middle"
                >
                  {airport.code}
                </text>
              </g>
            ))}
          </svg>
          <dl className="welcome-preview-stats">
            <div>
              <dt>{t("passport.flights")}</dt>
              <dd>{number.format(128)}</dd>
            </div>
            <div>
              <dt>{t("passport.airports")}</dt>
              <dd>{number.format(47)}</dd>
            </div>
            <div>
              <dt>{t("passport.countries")}</dt>
              <dd>{number.format(23)}</dd>
            </div>
          </dl>
          <ul className="welcome-preview-log">
            {PREVIEW_FLIGHTS.map((flight) => (
              <li key={flight.number}>
                <span>{date.format(new Date(`${flight.date}T00:00:00Z`))}</span>
                <strong>{flight.number}</strong>
                <span>
                  {flight.from} → {flight.to}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <figcaption>{t("welcome.previewCaption")}</figcaption>
      </figure>
    </PageShell>
  );
}
