import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import type { ValidationIssue } from "@keepraw-fly/validator";
import { summarizeImport } from "../data/import-preview";

interface ImportControlProps {
  onImport: (document: KeeprawFlyDocument) => void | Promise<void>;
  existingDocument?: KeeprawFlyDocument | null;
  onBackup?: () => void | Promise<void>;
  variant?: "primary" | "settings";
}

interface PendingImport {
  document: KeeprawFlyDocument;
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
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [busy, setBusy] = useState(false);

  async function importFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    const { parseKeeprawFlyJson } = await import("@keepraw-fly/validator");
    const result = parseKeeprawFlyJson(await file.text());
    if (result.valid) {
      setPending({ document: result.data, fileName: file.name });
      setIssues([]);
    } else {
      setPending(null);
      setIssues(result.issues);
    }
    setBusy(false);
  }

  async function confirmImport() {
    if (!pending) return;
    setBusy(true);
    await onImport(pending.document);
    setPending(null);
    setBusy(false);
  }

  const summary = pending ? summarizeImport(pending.document) : null;
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
      {pending && summary ? (
        <section className="import-preview" aria-live="polite" aria-labelledby={`${inputId}-preview-title`}>
          <div className="import-preview-heading">
            <div>
              <span className="eyebrow">{t("import.previewEyebrow")}</span>
              <strong id={`${inputId}-preview-title`}>{t("import.previewTitle")}</strong>
            </div>
            <span className="import-file-name">{pending.fileName}</span>
          </div>
          <dl>
            <div><dt>{t("import.owner")}</dt><dd>{summary.profileName ?? t("import.notRecorded")}</dd></div>
            <div><dt>{t("import.flights")}</dt><dd>{summary.flightCount}</dd></div>
            <div><dt>{t("import.dates")}</dt><dd>{dateRange}</dd></div>
          </dl>
          {existingDocument ? (
            <div className="import-replacement" role="note">
              <strong>{t("import.replaceWarningTitle")}</strong>
              <span>{t("import.replaceWarning", { flights: existingDocument.flights.length })}</span>
            </div>
          ) : null}
          <div className="import-preview-actions">
            {existingDocument && onBackup ? (
              <button className="button-secondary" type="button" disabled={busy} onClick={() => void onBackup()}>
                {t("import.exportBackup")}
              </button>
            ) : null}
            <button className="button-secondary" type="button" disabled={busy} onClick={() => setPending(null)}>
              {t("actions.cancel")}
            </button>
            <button className="button-primary" type="button" disabled={busy} onClick={() => void confirmImport()}>
              {busy
                ? t("import.importing")
                : t(existingDocument ? "import.replaceArchive" : "import.importArchive")}
            </button>
          </div>
        </section>
      ) : null}
      {issues.length ? (
        <div className="validation-errors" role="alert">
          <strong>{t("import.failed")}</strong>
          <ul>
            {issues.slice(0, 6).map((issue, index) => (
              <li key={`${issue.path}-${issue.keyword}-${index}`}>
                <span>
                  {issue.flightIndex !== undefined
                    ? `${t("import.flightNumber", { number: issue.flightIndex + 1 })} · `
                    : ""}
                  {issue.path}
                </span>
                {issue.message}
                {issue.received !== undefined ? <code>{JSON.stringify(issue.received)}</code> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
