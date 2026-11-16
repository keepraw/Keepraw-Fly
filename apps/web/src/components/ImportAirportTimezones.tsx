import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { isTimezoneOrOffset, resolveEndpointIdentity } from "@keepraw-fly/core";

/** IATA codes of import rows waiting for a zone, in first-seen order. */
export function pendingTimezoneCodes(
  issues: readonly { code: string; airportCode?: string; value?: string }[],
): string[] {
  const codes = new Set<string>();
  for (const issue of issues)
    if (issue.code === "airport-timezone-required") {
      const code = issue.airportCode ?? issue.value;
      if (code) codes.add(code);
    }
  return [...codes];
}

/**
 * Actionable pending state for rows whose airport Keepraw cannot place and
 * whose times have no UTC offset: the user supplies a zone or offset per code
 * and the preview is checked again. Nothing is guessed or converted to UTC.
 */
export function ImportAirportTimezones({
  codes,
  value,
  onApply,
}: {
  codes: readonly string[];
  value: Readonly<Record<string, string>>;
  onApply: (next: Record<string, string>) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [draft, setDraft] = useState<Record<string, string>>({ ...value });
  useEffect(() => setDraft({ ...value }), [value]);
  if (!codes.length) return null;
  const valid = codes.every(
    (code) => !draft[code] || isTimezoneOrOffset(draft[code]!),
  );
  return (
    <div
      className="validation-errors import-airport-zones"
      role="group"
      aria-labelledby={`${id}-title`}
    >
      <strong id={`${id}-title`}>
        {t("import.airportTimezones.title", { codes: codes.join(", ") })}
      </strong>
      <p>{t("import.airportTimezones.note")}</p>
      <ul>
        {codes.map((code) => {
          const options = resolveEndpointIdentity(
            code,
            "2000-01-01",
            "origin",
          ).timezoneOptions;
          return (
            <li key={code}>
              <label>
                <span>{t("import.airportTimezones.field", { code })}</span>
                <input
                  value={draft[code] ?? ""}
                  list={`${id}-${code}`}
                  placeholder="+08:00"
                  spellCheck={false}
                  autoComplete="off"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      [code]: event.target.value.trim(),
                    }))
                  }
                />
                <datalist id={`${id}-${code}`}>
                  {options.map((zone) => (
                    <option value={zone} key={zone} />
                  ))}
                </datalist>
              </label>
              {options.length > 1 ? (
                <small>
                  {t("import.airportTimezones.candidates", {
                    zones: options.join(", "),
                  })}
                </small>
              ) : null}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="button-secondary"
        disabled={!valid}
        onClick={() =>
          onApply(
            Object.fromEntries(
              Object.entries(draft).filter(
                ([, zone]) => zone && isTimezoneOrOffset(zone),
              ),
            ),
          )
        }
      >
        {t("import.airportTimezones.apply")}
      </button>
    </div>
  );
}
