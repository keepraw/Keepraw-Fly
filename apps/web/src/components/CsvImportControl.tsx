import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import {
  buildDocumentFromCsv,
  csvFlightFields,
  detectCsvMapping,
  parseCsv,
  type CsvColumnMapping,
  type ParsedCsv,
} from "../data/csv-import";

interface CsvImportControlProps {
  document: KeeprawFlyDocument | null;
  onImport: (document: KeeprawFlyDocument) => void | Promise<void>;
}

interface PendingCsv {
  fileName: string;
  parsed: ParsedCsv;
  mapping: CsvColumnMapping;
}

export function CsvImportControl({ document, onImport }: CsvImportControlProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const [pending, setPending] = useState<PendingCsv | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function selectFile(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = parseCsv(await file.text());
      setPending({ fileName: file.name, parsed, mapping: detectCsvMapping(parsed.headers) });
      setError(null);
    } catch {
      setPending(null);
      setError(t("csvImport.invalidFile"));
    }
  }

  async function confirmImport() {
    if (!pending) return;
    try {
      setBusy(true);
      const nextDocument = buildDocumentFromCsv(pending.parsed, pending.mapping, document);
      const { validateKeeprawFly } = await import("@keepraw-fly/validator");
      const result = validateKeeprawFly(nextDocument);
      if (!result.valid) throw new Error(result.issues[0]?.message);
      await onImport(result.data);
      setPending(null);
      setError(null);
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : "";
      setError(t("csvImport.importFailed", { detail }));
    } finally {
      setBusy(false);
    }
  }

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
      <label className="settings-action" htmlFor={inputId}>{t("csvImport.openFile")}</label>
      {pending ? (
        <section className="csv-preview" aria-live="polite" aria-labelledby={`${inputId}-title`}>
          <header className="import-preview-heading">
            <div>
              <span className="eyebrow">{t("csvImport.previewEyebrow")}</span>
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
                  onChange={(event) => setPending({
                    ...pending,
                    mapping: {
                      ...pending.mapping,
                      [field]: event.target.value === "" ? null : Number(event.target.value),
                    },
                  })}
                >
                  <option value="">{t("csvImport.chooseColumn")}</option>
                  {pending.parsed.headers.map((header, index) => (
                    <option value={index} key={`${header}-${index}`}>{header}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="csv-table-wrap">
            <table>
              <thead><tr>{pending.parsed.headers.map((header, index) => <th key={`${header}-${index}`}>{header}</th>)}</tr></thead>
              <tbody>{pending.parsed.rows.slice(0, 5).map((row, rowIndex) => (
                <tr key={rowIndex}>{pending.parsed.headers.map((_, columnIndex) => <td key={columnIndex}>{row[columnIndex] ?? ""}</td>)}</tr>
              ))}</tbody>
            </table>
          </div>
          <p className="csv-timezone-note">{t("csvImport.timezoneNote")}</p>
          <div className="import-preview-actions">
            <button className="button-secondary" type="button" disabled={busy} onClick={() => { setPending(null); setError(null); }}>{t("actions.cancel")}</button>
            <button className="button-primary" type="button" disabled={busy} onClick={() => void confirmImport()}>
              {busy ? t("csvImport.importing") : t("csvImport.appendFlights", { count: pending.parsed.rows.length })}
            </button>
          </div>
        </section>
      ) : null}
      {error ? <p className="csv-import-error" role="alert">{error}</p> : null}
    </div>
  );
}
