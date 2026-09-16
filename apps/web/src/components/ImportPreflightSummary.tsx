import { useTranslation } from "react-i18next";
import type { ImportPreflightCounts } from "../data/import-preview";

interface ImportPreflightSummaryProps {
  preflight: ImportPreflightCounts;
}

export function ImportPreflightSummary({ preflight }: ImportPreflightSummaryProps) {
  const { t } = useTranslation();

  return (
    <>
      <dl className="import-preflight-stats" aria-label={t("import.preflightSummary")}>
        <div>
          <dt>{t("import.totalRecords")}</dt>
          <dd>{preflight.totalRecords}</dd>
        </div>
        <div className="import-stat-valid">
          <dt>{t("import.validRecords")}</dt>
          <dd>{preflight.validRecords}</dd>
        </div>
        <div className={preflight.problemRecords ? "import-stat-problem" : ""}>
          <dt>{t("import.problemRecords")}</dt>
          <dd>{preflight.problemRecords}</dd>
        </div>
        <div className={preflight.duplicateRecords ? "import-stat-duplicate" : ""}>
          <dt>{t("import.duplicateRecords")}</dt>
          <dd>{preflight.duplicateRecords}</dd>
        </div>
      </dl>
      {preflight.duplicateRecords ? (
        <p className="import-duplicate-note" role="note">
          {t("import.duplicateNote", { count: preflight.duplicateRecords })}
        </p>
      ) : null}
    </>
  );
}
