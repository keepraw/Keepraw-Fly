import type { TFunction } from "i18next";

/** Validator messages are diagnostics, never fallback UI copy. */
export function localizedValidationIssue(
  t: TFunction,
  keyword: string,
): string {
  return t(`import.issueMessages.${keyword}`, {
    defaultValue: t("import.issueMessages.generic"),
  });
}
