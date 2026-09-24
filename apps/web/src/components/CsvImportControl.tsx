import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import {
  buildDocumentFromCsvPreflight,
  csvFlightFields,
  detectCsvMapping,
  parseCsv,
  preflightCsvImport,
  type CsvColumnMapping,
  type ParsedCsv,
} from "../data/csv-import";
import { ImportPreflightSummary } from "./ImportPreflightSummary";

interface CsvImportControlProps {
  document: KeeprawFlyDocument | null;
  onImport: (document: KeeprawFlyDocument) => void | Promise<void>;
}

interface PendingCsv {
  fileName: string;
  parsed: ParsedCsv;
  mapping: CsvColumnMapping;
}

const csvTemplate = [
  csvFlightFields.join(","),
  "MU510,2025-04-12,PVG,HKG,2025-04-12T09:00,2025-04-12T11:45,2025-04-12T09:12,2025-04-12T11:50,1,D45,1,,false,,781-1234567890,ABC123,B789,B-1234,12A,Y,economy",
].join("\r\n");

function downloadCsvTemplate() {
  const blob = new Blob([`\uFEFF${csvTemplate}\r\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = "keepraw-fly-import-template.csv";
  window.document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function CsvImportControl({ document, onImport }: CsvImportControlProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const [pending, setPending] = useState<PendingCsv | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [includePossibleDuplicates, setIncludePossibleDuplicates] = useState(false);
  const [busy, setBusy] = useState(false);
  const preflight = useMemo(
    () => pending ? preflightCsvImport(pending.parsed, pending.mapping, document) : null,
    [document, pending],
  );

  async function selectFile(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = parseCsv(await file.text());
      setPending({ fileName: file.name, parsed, mapping: detectCsvMapping(parsed.headers) });
      setIncludePossibleDuplicates(false);
      setError(null);
    } catch (caught) {
      setPending(null);
      const code = caught instanceof Error ? caught.message : "invalid-file";
      setError(t(`csvImport.fileErrors.${code}`, { defaultValue: t("csvImport.invalidFile") }));
    }
  }

  async function confirmImport() {
    if (!pending || !preflight?.canImport) return;
    try {
      setBusy(true);
      const nextDocument = buildDocumentFromCsvPreflight(
        preflight,
        document,
        includePossibleDuplicates,
      );
      const { validateKeeprawFly } = await import("@keepraw-fly/validator");
      const result = validateKeeprawFly(nextDocument);
      if (!result.valid) throw new Error(result.issues[0]?.message);
      await onImport(result.data);
      setPending(null);
      setIncludePossibleDuplicates(false);
      setError(null);
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : "";
      setError(t("csvImport.importFailed", { detail }));
    } finally {
      setBusy(false);
    }
  }

  const selectedRecords = preflight
    ? preflight.newRecords + (includePossibleDuplicates ? preflight.possibleDuplicateRecords : 0)
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
      <div className="csv-action-group">
        <label className="settings-action" htmlFor={inputId}>{t("csvImport.openFile")}</label>
        <button className="button-secondary" type="button" onClick={downloadCsvTemplate}>{t("csvImport.downloadTemplate")}</button>
      </div>
      <p className="csv-import-workflow">{t("csvImport.workflow")}</p>
      {pending ? (
        <section className="csv-preview" aria-live="polite" aria-labelledby={`${inputId}-title`}>
          <header className="import-preview-heading">
            <div>
              <span className="eyebrow">
                {t(preflight?.canImport ? "csvImport.previewEyebrow" : "import.blockedEyebrow")}
              </span>
              <strong id={`${inputId}-title`}>{t("csvImport.previewTitle")}</strong>
            </div>
            <span className="import-file-name">{pending.fileName} · {t("csvImport.rowCount", { count: pending.parsed.rows.length })}</span>
          </header>

          <div className="csv-mapping" aria-label={t("csvImport.mappingLabel")}>
            {csvFlightFields.map((field) => (
              <div key={field}>
                <label htmlFor={`${inputId}-${field}`}>{t(`csvImport.fields.${field}`)}</label>
                <select
                  id={`${inputId}-${field}`}
                  value={pending.mapping[field] ?? ""}
                  onChange={(event) => {
                    setIncludePossibleDuplicates(false);
                    setPending({
                      ...pending,
                      mapping: {
                        ...pending.mapping,
                        [field]: event.target.value === "" ? null : Number(event.target.value),
                      },
                    });
                  }}
                >
                  <option value="">{t("csvImport.chooseColumn")}</option>
                  {pending.parsed.headers.map((header, index) => (
                    <option value={index} key={`${header}-${index}`}>{header}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {preflight ? (
            <ImportPreflightSummary
              preflight={preflight}
              includePossibleDuplicates={includePossibleDuplicates}
              onIncludePossibleDuplicatesChange={setIncludePossibleDuplicates}
            />
          ) : null}
          {preflight?.assessments.length ? (
            <div className="csv-record-preview" aria-label={t("csvImport.sampleRecords")}>
              <span>{t("csvImport.sampleRecords")}</span>
              <ul>
                {preflight.assessments.slice(0, 3).map(({ flight, disposition }) => (
                  <li key={flight.id}>
                    <strong>{flight.flightNumber}</strong>
                    <span>{flight.origin.iata} → {flight.destination.iata}</span>
                    <time dateTime={flight.serviceDate}>{flight.serviceDate}</time>
                    <em className={`import-disposition import-disposition-${disposition}`}>
                      {t(`import.dispositions.${disposition}`)}
                    </em>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {preflight?.issues.length ? (
            <div className="validation-errors import-blocking-issues" role="alert">
              <strong>{t("import.blockingTitle")}</strong>
              <p>{t("import.blockingDescription")}</p>
              <ul>
                {preflight.issues.slice(0, 6).map((issue, index) => (
                  <li key={`${issue.lineNumber ?? "mapping"}-${issue.code}-${index}`}>
                    <span>{issue.lineNumber ? t("csvImport.lineNumber", { number: issue.lineNumber }) : t("csvImport.mappingIssue")}</span>
                    {t(`csvImport.issues.${issue.code}`)}
                  </li>
                ))}
              </ul>
              {preflight.issues.length > 6 ? (
                <small>{t("import.moreIssues", { count: preflight.issues.length - 6 })}</small>
              ) : null}
            </div>
          ) : null}
          <p className="csv-timezone-note">{t("csvImport.timezoneNote")}</p>
          <div className="import-preview-actions">
            <button className="button-secondary" type="button" disabled={busy} onClick={() => { setPending(null); setIncludePossibleDuplicates(false); setError(null); }}>{t("actions.cancel")}</button>
            <button className="button-primary" type="button" disabled={busy || !preflight?.canImport || selectedRecords === 0} onClick={() => void confirmImport()}>
              {busy
                ? t("csvImport.importing")
                : preflight?.canImport
                  ? selectedRecords
                    ? t("csvImport.appendFlights", { count: selectedRecords })
                    : t("import.noNewFlights")
                  : t("import.resolveIssues")}
            </button>
          </div>
        </section>
      ) : null}
      {error ? <p className="csv-import-error" role="alert">{error}</p> : null}
    </div>
  );
}
