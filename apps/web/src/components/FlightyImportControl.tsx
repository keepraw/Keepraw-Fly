import { useId, useMemo, useState } from "react";
import {
  assertRecordCount,
  importLimitValues,
  readImportFile,
} from "../data/import-limits";
import { useTranslation } from "react-i18next";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import {
  buildDocumentFromFlightyPreflight,
  isFlightyCsv,
  parseFlightyCsv,
  preflightFlightyImportWork,
} from "../data/flighty-import";
import { ImportPreflightSummary } from "./ImportPreflightSummary";
import { useImportPreflight } from "./useImportPreflight";

interface FlightyImportControlProps {
  document: KeeprawFlyDocument | null;
  onImport: (document: KeeprawFlyDocument) => void | Promise<void>;
}

interface PendingFlighty {
  fileName: string;
  parsed: ReturnType<typeof parseFlightyCsv>;
}

export function FlightyImportControl({
  document,
  onImport,
}: FlightyImportControlProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const [pending, setPending] = useState<PendingFlighty | null>(null);
  const [error, setError] = useState<
    { kind: "file"; code: string } | { kind: "import" } | null
  >(null);
  const [includePossibleDuplicates, setIncludePossibleDuplicates] =
    useState(false);
  const [busy, setBusy] = useState(false);
  const work = useMemo(
    () =>
      pending
        ? () => preflightFlightyImportWork(pending.parsed, document)
        : null,
    [document, pending],
  );
  const { preflight, preflightFailed } = useImportPreflight(work);

  async function selectFile(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = parseFlightyCsv(await readImportFile(file));
      assertRecordCount(parsed.rows.length);
      if (!isFlightyCsv(parsed)) throw new Error("not-flighty-file");
      setPending({ fileName: file.name, parsed });
      setIncludePossibleDuplicates(false);
      setError(null);
    } catch (caught) {
      setPending(null);
      const code = caught instanceof Error ? caught.message : "invalid-file";
      setError({ kind: "file", code });
    }
  }

  async function confirmImport() {
    if (!pending || !preflight?.canImport) return;
    try {
      setBusy(true);
      const nextDocument = buildDocumentFromFlightyPreflight(
        preflight,
        document,
        includePossibleDuplicates,
      );
      const { validateKeeprawFly } = await import("@keepraw-fly/validator");
      const result = validateKeeprawFly(nextDocument);
      if (!result.valid) throw new Error("invalid-import");
      await onImport(result.data);
      setPending(null);
      setIncludePossibleDuplicates(false);
      setError(null);
    } catch {
      setError({ kind: "import" });
    } finally {
      setBusy(false);
    }
  }

  const selectedRecords = preflight
    ? preflight.newRecords +
      (includePossibleDuplicates ? preflight.possibleDuplicateRecords : 0)
    : 0;

  return (
    <div className="csv-import-control">
      <input
        className="sr-only"
        id={inputId}
        type="file"
        accept=".csv,text/csv"
        onChange={(event) => {
          void selectFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <label className="settings-action" htmlFor={inputId}>
        {t("flightyImport.openFile")}
      </label>
      <p className="csv-import-workflow">{t("flightyImport.workflow")}</p>
      {pending ? (
        <section
          className="csv-preview"
          aria-live="polite"
          aria-busy={!preflight && !preflightFailed}
          aria-labelledby={`${inputId}-title`}
        >
          <header className="import-preview-heading">
            <div>
              <span className="eyebrow">
                {t(
                  !preflight && !preflightFailed
                    ? "import.checking"
                    : preflight?.canImport
                      ? "flightyImport.previewEyebrow"
                      : "import.blockedEyebrow",
                )}
              </span>
              <strong id={`${inputId}-title`}>
                {t("flightyImport.previewTitle")}
              </strong>
            </div>
            <span className="import-file-name">
              {pending.fileName} ·{" "}
              {t("flightyImport.rowCount", {
                count: pending.parsed.rows.length,
              })}
            </span>
          </header>
          {!preflight && !preflightFailed ? (
            <p role="status">{t("import.checking")}</p>
          ) : null}
          {preflight ? (
            <ImportPreflightSummary
              preflight={preflight}
              includePossibleDuplicates={includePossibleDuplicates}
              onIncludePossibleDuplicatesChange={setIncludePossibleDuplicates}
            />
          ) : null}
          {preflight?.warnings.length ? (
            <div className="validation-errors" role="status">
              <strong>
                {t("flightyImport.warningTitle", {
                  count: preflight.warnings.length,
                })}
              </strong>
              <ul>
                {preflight.warnings.slice(0, 6).map((warning, index) => (
                  <li
                    key={`${warning.lineNumber ?? "file"}-${warning.code}-${index}`}
                  >
                    {warning.lineNumber
                      ? t("flightyImport.lineNumber", {
                          number: warning.lineNumber,
                        })
                      : null}
                    {t(`flightyImport.issues.${warning.code}`, {
                      value: warning.value,
                      defaultValue: t("import.issueMessages.generic"),
                    })}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {preflight?.issues.length ? (
            <div
              className="validation-errors import-blocking-issues"
              role="alert"
            >
              <strong>{t("import.blockingTitle")}</strong>
              <p>{t("import.blockingDescription")}</p>
              <ul>
                {preflight.issues.slice(0, 6).map((issue, index) => (
                  <li
                    key={`${issue.lineNumber ?? "file"}-${issue.code}-${index}`}
                  >
                    {issue.lineNumber
                      ? t("flightyImport.lineNumber", {
                          number: issue.lineNumber,
                        })
                      : t("flightyImport.fileLabel")}
                    {t(`flightyImport.issues.${issue.code}`, {
                      value: issue.value,
                      defaultValue: t(`csvImport.issues.${issue.code}`, {
                        defaultValue: t("import.issueMessages.generic"),
                      }),
                    })}
                  </li>
                ))}
              </ul>
              {preflight.issues.length > 6 ? (
                <small>
                  {t("import.moreIssues", {
                    count: preflight.issues.length - 6,
                  })}
                </small>
              ) : null}
            </div>
          ) : null}
          <div className="import-preview-actions">
            <button
              className="button-secondary"
              type="button"
              disabled={busy}
              onClick={() => {
                setPending(null);
                setIncludePossibleDuplicates(false);
                setError(null);
              }}
            >
              {t("actions.cancel")}
            </button>
            <button
              className="button-primary"
              type="button"
              disabled={busy || !preflight?.canImport || selectedRecords === 0}
              onClick={() => void confirmImport()}
            >
              {busy
                ? t("flightyImport.importing")
                : !preflight && !preflightFailed
                  ? t("import.checking")
                  : preflight?.canImport && selectedRecords
                    ? t("flightyImport.appendFlights", {
                        count: selectedRecords,
                      })
                    : t("import.resolveIssues")}
            </button>
          </div>
        </section>
      ) : null}
      {error || preflightFailed ? (
        <p className="csv-import-error" role="alert">
          {!error || error.kind === "import"
            ? t("flightyImport.importFailed")
            : t(`flightyImport.fileErrors.${error.code}`, {
                ...importLimitValues,
                defaultValue: t("flightyImport.invalidFile"),
              })}
        </p>
      ) : null}
    </div>
  );
}
