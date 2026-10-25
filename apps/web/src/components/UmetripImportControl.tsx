import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import { importLimitValues } from "../data/import-limits";
import { readUmetripFile, type ParsedUmetrip } from "../data/umetrip-xls";
import { ImportPreflightSummary } from "./ImportPreflightSummary";
import { useImportPreflight } from "./useImportPreflight";

export function UmetripImportControl({
  document,
  onImport,
}: {
  document: KeeprawFlyDocument | null;
  onImport: (document: KeeprawFlyDocument) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const inputId = useId();
  const selection = useRef(0);
  const [pending, setPending] = useState<{
    fileName: string;
    parsed: ParsedUmetrip;
    adapter: typeof import("../data/umetrip-import");
  } | null>(null);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleRows, setVisibleRows] = useState(20);
  const [includePossibleDuplicates, setIncludePossibleDuplicates] =
    useState(false);
  useEffect(
    () => () => {
      selection.current++;
    },
    [],
  );
  const work = useMemo(
    () =>
      pending
        ? () =>
            pending.adapter.preflightUmetripImportWork(pending.parsed, document)
        : null,
    [pending, document],
  );
  const { preflight, preflightFailed } = useImportPreflight(work);

  function cancel() {
    selection.current++;
    setPending(null);
    setReading(false);
    setError(null);
    setIncludePossibleDuplicates(false);
    setVisibleRows(20);
  }

  async function selectFile(file: File | undefined) {
    if (!file) return;
    cancel();
    const request = selection.current;
    setReading(true);
    try {
      const parsed = await readUmetripFile(file);
      const adapter = await import("../data/umetrip-import");
      if (selection.current === request)
        setPending({ fileName: file.name, parsed, adapter });
    } catch (caught) {
      if (selection.current === request)
        setError(caught instanceof Error ? caught.message : "invalid-xls");
    } finally {
      if (selection.current === request) setReading(false);
    }
  }

  async function confirmImport() {
    if (!pending || !preflight?.canImport || busy) return;
    try {
      setBusy(true);
      const next = pending.adapter.buildDocumentFromUmetripPreflight(
        preflight,
        document,
        includePossibleDuplicates,
      );
      const { validateKeeprawFly } = await import("@keepraw-fly/validator");
      const validated = validateKeeprawFly(next);
      if (!validated.valid) throw new Error("invalid-import");
      await onImport(validated.data);
      cancel();
    } catch {
      setError("import-failed");
    } finally {
      setBusy(false);
    }
  }

  const selected = preflight
    ? preflight.newRecords +
      (includePossibleDuplicates ? preflight.possibleDuplicateRecords : 0)
    : 0;
  const location = (source: { sheetName: string; lineNumber: number }) =>
    t("umetripImport.location", {
      sheet: source.sheetName,
      number: source.lineNumber,
    });
  return (
    <div className="csv-import-control">
      <input
        className="sr-only"
        id={inputId}
        type="file"
        accept=".xls,application/vnd.ms-excel"
        disabled={busy}
        onChange={(event) => {
          void selectFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <label className="settings-action" htmlFor={inputId}>
        {t("umetripImport.openFile")}
      </label>
      <p className="csv-import-workflow">{t("umetripImport.workflow")}</p>
      {reading ? (
        <div role="status">
          <p>{t("import.checking")}</p>
          <button className="button-secondary" type="button" onClick={cancel}>
            {t("actions.cancel")}
          </button>
        </div>
      ) : null}
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
                      ? "import.previewEyebrow"
                      : "import.blockedEyebrow",
                )}
              </span>
              <strong id={`${inputId}-title`}>
                {t("umetripImport.previewTitle")}
              </strong>
            </div>
            <span className="import-file-name">{pending.fileName}</span>
          </header>
          {!preflight && !preflightFailed ? (
            <p role="status">{t("import.checking")}</p>
          ) : null}
          {preflight ? (
            <>
              <ImportPreflightSummary
                preflight={preflight}
                includePossibleDuplicates={includePossibleDuplicates}
                onIncludePossibleDuplicatesChange={setIncludePossibleDuplicates}
              />
              <p>
                {t("umetripImport.excludedRecords")}:{" "}
                <strong>{preflight.excludedRecords}</strong>
              </p>
              {preflight.exclusions.length ? (
                <div className="validation-errors" role="note">
                  <ul>
                    {(
                      [
                        "unused",
                        "open",
                        "refunded",
                        "exchanged",
                        "invalid",
                      ] as const
                    ).map((reason) => {
                      const count = preflight.exclusions.filter(
                        (row) => row.reason === reason,
                      ).length;
                      return count ? (
                        <li key={reason}>
                          {t(`umetripImport.exclusions.${reason}`)}: {count}
                        </li>
                      ) : null;
                    })}
                  </ul>
                  <details>
                    <summary>{t("umetripImport.excludedDetails")}</summary>
                    <ul>
                      {preflight.exclusions.slice(0, visibleRows).map((row) => (
                        <li key={`${row.sheetName}-${row.lineNumber}`}>
                          {location(row)}
                          {t(`umetripImport.exclusions.${row.reason}`)}
                        </li>
                      ))}
                    </ul>
                    {preflight.exclusions.length > visibleRows ? (
                      <>
                        <small>
                          {t("umetripImport.firstRows", { count: visibleRows })}
                        </small>
                        <button
                          className="button-secondary"
                          type="button"
                          onClick={() => setVisibleRows((count) => count + 20)}
                        >
                          {t("umetripImport.showMore")}
                        </button>
                      </>
                    ) : null}
                  </details>
                </div>
              ) : null}
              {preflight.assessments.length ? (
                <div
                  className="csv-record-preview"
                  aria-label={t("csvImport.sampleRecords")}
                >
                  <span>{t("csvImport.sampleRecords")}</span>
                  <ul>
                    {preflight.assessments
                      .slice(0, 3)
                      .map(({ flight, disposition }) => (
                        <li key={flight.id}>
                          <strong>{flight.flightNumber}</strong>
                          <span>
                            {flight.origin.iata} → {flight.destination.iata}
                          </span>
                          <time dateTime={flight.serviceDate}>
                            {flight.serviceDate}
                          </time>
                          <em
                            className={`import-disposition import-disposition-${disposition}`}
                          >
                            {t(`import.dispositions.${disposition}`)}
                          </em>
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}
              {preflight.issues.length ? (
                <div
                  className="validation-errors import-blocking-issues"
                  role="alert"
                >
                  <strong>{t("import.blockingTitle")}</strong>
                  <p>{t("import.blockingDescription")}</p>
                  <ul>
                    {preflight.issues
                      .slice(0, visibleRows)
                      .map((issue, index) => (
                        <li
                          key={`${issue.sheetName}-${issue.lineNumber}-${index}`}
                        >
                          {location(issue)}
                          {t(`umetripImport.issues.${issue.code}`, {
                            defaultValue: t(`csvImport.issues.${issue.code}`, {
                              defaultValue: t("import.issueMessages.generic"),
                            }),
                          })}
                        </li>
                      ))}
                  </ul>
                  {preflight.issues.length > visibleRows ? (
                    <>
                      <small>
                        {t("import.moreIssues", {
                          count: preflight.issues.length - visibleRows,
                        })}
                      </small>
                      <button
                        className="button-secondary"
                        type="button"
                        onClick={() => setVisibleRows((count) => count + 20)}
                      >
                        {t("umetripImport.showMore")}
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
          <p className="csv-timezone-note">{t("umetripImport.timeNote")}</p>
          <div className="import-preview-actions">
            <button
              className="button-secondary"
              type="button"
              disabled={busy}
              onClick={cancel}
            >
              {t("actions.cancel")}
            </button>
            <button
              className="button-primary"
              type="button"
              disabled={busy || !preflight?.canImport || selected === 0}
              onClick={() => void confirmImport()}
            >
              {busy
                ? t("import.importing")
                : !preflight && !preflightFailed
                  ? t("import.checking")
                  : !preflight?.canImport
                    ? t("import.resolveIssues")
                    : selected
                      ? t("csvImport.appendFlights", { count: selected })
                      : t("import.noNewFlights")}
            </button>
          </div>
        </section>
      ) : null}
      {error || preflightFailed ? (
        <p className="csv-import-error" role="alert">
          {preflightFailed || error === "import-failed"
            ? t("import.operationFailed")
            : t(`umetripImport.fileErrors.${error}`, {
                ...importLimitValues,
                defaultValue: t(`import.fileErrors.${error}`, {
                  ...importLimitValues,
                  defaultValue: t("umetripImport.fileErrors.invalid-xls"),
                }),
              })}
        </p>
      ) : null}
    </div>
  );
}
