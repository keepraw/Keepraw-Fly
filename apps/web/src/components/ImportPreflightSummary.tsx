import { useTranslation } from "react-i18next";
import type { ImportPreflightCounts } from "../data/import-preview";

interface ImportPreflightSummaryProps {
  preflight: ImportPreflightCounts;
  includePossibleDuplicates?: boolean;
  onIncludePossibleDuplicatesChange?: (include: boolean) => void;
}

export function ImportPreflightSummary({
  preflight,
  includePossibleDuplicates = false,
  onIncludePossibleDuplicatesChange,
}: ImportPreflightSummaryProps) {
  const { t } = useTranslation();
  const selectedRecords = preflight.newRecords
    + (includePossibleDuplicates ? preflight.possibleDuplicateRecords : 0);

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
        <div className="import-stat-new">
          <dt>{t("import.newRecords")}</dt>
          <dd>{preflight.newRecords}</dd>
        </div>
        <div className={preflight.possibleDuplicateRecords ? "import-stat-possible" : ""}>
          <dt>{t("import.possibleDuplicateRecords")}</dt>
          <dd>{preflight.possibleDuplicateRecords}</dd>
        </div>
        <div className={preflight.exactDuplicateRecords ? "import-stat-exact" : ""}>
          <dt>{t("import.exactDuplicateRecords")}</dt>
          <dd>{preflight.exactDuplicateRecords}</dd>
        </div>
      </dl>
      {preflight.canImport ? (
        <div className="import-resolution" role="note">
          <strong>{t("import.importPlan", { count: selectedRecords })}</strong>
          {preflight.exactDuplicateRecords ? (
            <span>{t("import.exactDuplicateNote", { count: preflight.exactDuplicateRecords })}</span>
          ) : null}
          {preflight.possibleDuplicateRecords ? (
            <label>
              <input
                type="checkbox"
                checked={includePossibleDuplicates}
                onChange={(event) => onIncludePossibleDuplicatesChange?.(event.target.checked)}
              />
              <span>
                {t("import.includePossibleDuplicates", { count: preflight.possibleDuplicateRecords })}
                <small>{t("import.possibleDuplicateNote")}</small>
              </span>
            </label>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
