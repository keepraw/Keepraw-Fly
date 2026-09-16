import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import {
  preflightJsonImport,
  summarizeImport,
  type JsonImportPreflight,
} from "../data/import-preview";
import { ImportPreflightSummary } from "./ImportPreflightSummary";

interface ImportControlProps {
  onImport: (document: KeeprawFlyDocument) => void | Promise<void>;
  existingDocument?: KeeprawFlyDocument | null;
  onBackup?: () => void | Promise<void>;
  variant?: "primary" | "settings";
}

interface PendingImport extends JsonImportPreflight {
  fileName: string;
}

export function ImportControl({
  onImport,
  existingDocument = null,
  onBackup,
  variant = "primary",
}: ImportControlProps) {
  const { i18n, t } = useTranslation();
  const inputId = useId();
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [busy, setBusy] = useState(false);

  async function importFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    const { parseKeeprawFlyJson } = await import("@keepraw-fly/validator");
    const text = await file.text();
    const result = parseKeeprawFlyJson(text);
    setPending({ fileName: file.name, ...preflightJsonImport(text, result, existingDocument) });
    setBusy(false);
  }

  async function confirmImport() {
    if (!pending?.document) return;
    setBusy(true);
    await onImport(pending.document);
    setPending(null);
    setBusy(false);
  }

  const summary = pending?.document ? summarizeImport(pending.document) : null;
  const dateFormatter = new Intl.DateTimeFormat(i18n.resolvedLanguage ?? "en", {
    dateStyle: "medium",
    timeZone: "UTC",
  });
  const dateRange = summary?.firstServiceDate && summary.lastServiceDate
    ? summary.firstServiceDate === summary.lastServiceDate
      ? dateFormatter.format(new Date(`${summary.firstServiceDate}T00:00:00Z`))
      : t("import.dateRange", {
        first: dateFormatter.format(new Date(`${summary.firstServiceDate}T00:00:00Z`)),
        last: dateFormatter.format(new Date(`${summary.lastServiceDate}T00:00:00Z`)),
      })
    : t("import.noFlights");

  return (
    <div
      className={`import-control import-control-${variant}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        void importFile(event.dataTransfer.files[0]);
      }}
    >
      <input
        className="sr-only"
        id={inputId}
        type="file"
        disabled={busy}
        accept=".json,application/json"
        onChange={(event) => {
          void importFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <label className={variant === "primary" ? "import-primary" : "settings-action"} htmlFor={inputId}>
        {busy ? t("actions.validating") : t("actions.openFile")}
      </label>
      {variant === "primary" ? <span className="drop-hint">{t("import.dropHint")}</span> : null}
      {pending ? (
        <section className="import-preview" aria-live="polite" aria-labelledby={`${inputId}-preview-title`}>
          <div className="import-preview-heading">
            <div>
              <span className="eyebrow">
                {t(pending.canImport ? "import.previewEyebrow" : "import.blockedEyebrow")}
              </span>
              <strong id={`${inputId}-preview-title`}>{t("import.previewTitle")}</strong>
            </div>
            <span className="import-file-name">{pending.fileName}</span>
          </div>
          <ImportPreflightSummary preflight={pending} />
          {summary ? <dl className="import-preview-meta">
            <div><dt>{t("import.owner")}</dt><dd>{summary.profileName ?? t("import.notRecorded")}</dd></div>
            <div><dt>{t("import.dates")}</dt><dd>{dateRange}</dd></div>
          </dl> : null}
          {pending.migrations.length ? (
            <p className="import-migration" role="note">
              {t("import.migratedArchive", { count: pending.migrations.length })}
            </p>
          ) : null}
          {existingDocument && pending.canImport ? (
            <div className="import-replacement" role="note">
              <strong>{t("import.replaceWarningTitle")}</strong>
              <span>{t("import.replaceWarning", { flights: existingDocument.flights.length })}</span>
            </div>
          ) : null}
          {pending.issues.length ? (
            <div className="validation-errors import-blocking-issues" role="alert">
              <strong>{t("import.blockingTitle")}</strong>
              <p>{t("import.blockingDescription")}</p>
              <ul>
                {pending.issues.slice(0, 6).map((issue, index) => (
                  <li key={`${issue.path}-${issue.keyword}-${index}`}>
                    <span>
                      {issue.flightIndex !== undefined
                        ? `${t("import.flightNumber", { number: issue.flightIndex + 1 })} · `
                        : `${t("import.fileIssue")} · `}
                      {issue.path}
                    </span>
                    {t(`import.issueMessages.${issue.keyword}`, { defaultValue: issue.message })}
                  </li>
                ))}
              </ul>
              {pending.issues.length > 6 ? (
                <small>{t("import.moreIssues", { count: pending.issues.length - 6 })}</small>
              ) : null}
            </div>
          ) : null}
          <div className="import-preview-actions">
            {existingDocument && pending.canImport && onBackup ? (
              <button className="button-secondary" type="button" disabled={busy} onClick={() => void onBackup()}>
                {t("import.exportBackup")}
              </button>
            ) : null}
            <button className="button-secondary" type="button" disabled={busy} onClick={() => setPending(null)}>
              {t("actions.cancel")}
            </button>
            <button className="button-primary" type="button" disabled={busy || !pending.canImport} onClick={() => void confirmImport()}>
              {busy
                ? t("import.importing")
                : pending.canImport
                  ? t(existingDocument ? "import.replaceArchive" : "import.importArchive")
                  : t("import.resolveIssues")}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
