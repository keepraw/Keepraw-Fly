import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import { parseKeeprawFlyJson, type ValidationIssue } from "@keepraw-fly/validator";

interface ImportControlProps {
  onImport: (document: KeeprawFlyDocument) => void | Promise<void>;
  variant?: "primary" | "settings";
}

export function ImportControl({ onImport, variant = "primary" }: ImportControlProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [busy, setBusy] = useState(false);

  async function importFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    const result = parseKeeprawFlyJson(await file.text());
    if (result.valid) {
      await onImport(result.data);
      setIssues([]);
    } else {
      setIssues(result.issues);
    }
    setBusy(false);
  }

  return (
    <div className={`import-control import-control-${variant}`}>
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
