import { useTranslation } from "react-i18next";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import { CsvImportControl } from "../components/CsvImportControl";
import { FlightyImportControl } from "../components/FlightyImportControl";
import { ImportControl } from "../components/ImportControl";
import { PageShell } from "../components/PageShell";
import { UmetripImportControl } from "../components/UmetripImportControl";

interface ImportPageProps {
  document: KeeprawFlyDocument | null;
  isDemo: boolean;
  onImport: (document: KeeprawFlyDocument) => void | Promise<void>;
}

/** The import task on its own page: choose a source, review, then commit. */
export function ImportPage({ document, isDemo, onImport }: ImportPageProps) {
  const { t } = useTranslation();
  // A demo archive is replaced by an import, never merged into.
  const importBase = isDemo ? null : document;

  return (
    <PageShell className="settings-page settings-compact settings-information import-page">
      <div className="settings-content">
        <header className="settings-page-heading import-page-heading">
          <h1>{t("actions.importFlights")}</h1>
          <p>{t("importPage.lead")}</p>
        </header>
        <div className="settings-panel settings-data-panel settings-operations">
          <section
            className="settings-import-row settings-operation"
            id="settings-import"
            aria-label={t("settings.importTitle")}
          >
            <div className="settings-operation-copy">
              <h2 className="settings-item-title" id="settings-json-title">
                {t("settings.importTitle")}
              </h2>
              {isDemo ? (
                <p role="note">{t("demo.importReplacement")}</p>
              ) : (
                <>
                  <p>{t("settings.restoreDescription")}</p>
                  <small>{t("settings.importDescription")}</small>
                </>
              )}
            </div>
            <ImportControl
              existingDocument={importBase}
              onImport={onImport}
              variant="settings"
            />
          </section>
          <section
            className="settings-import-row settings-operation"
            aria-label={t("settings.csvImportTitle")}
          >
            <div className="settings-operation-copy">
              <h2 className="settings-item-title" id="settings-csv-title">
                {t("settings.csvImportTitle")}
              </h2>
              {isDemo ? (
                <p role="note">{t("demo.importReplacement")}</p>
              ) : (
                <p>{t("settings.csvDescription")}</p>
              )}
            </div>
            <CsvImportControl document={importBase} onImport={onImport} />
          </section>
          <section
            className="settings-import-row settings-operation"
            aria-label={t("settings.flightyImportTitle")}
          >
            <div className="settings-operation-copy">
              <h2 className="settings-item-title" id="settings-flighty-title">
                {t("settings.flightyImportTitle")}
              </h2>
              {isDemo ? <small>{t("demo.importReplacement")}</small> : null}
            </div>
            <FlightyImportControl document={importBase} onImport={onImport} />
          </section>
          <section
            className="settings-import-row settings-operation"
            aria-label={t("umetripImport.title")}
          >
            <div className="settings-operation-copy">
              <h2 className="settings-item-title" id="settings-umetrip-title">
                {t("umetripImport.title")}
              </h2>
              <small>
                {t(
                  isDemo
                    ? "demo.importReplacement"
                    : "umetripImport.description",
                )}
              </small>
            </div>
            <UmetripImportControl document={importBase} onImport={onImport} />
          </section>
        </div>
      </div>
    </PageShell>
  );
}
