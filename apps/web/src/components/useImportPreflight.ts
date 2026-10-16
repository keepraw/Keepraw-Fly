import { useEffect, useState } from "react";
import {
  runImportPreflight,
  type ImportPreflightWork,
} from "../data/import-preflight-work";

export function useImportPreflight<T>(
  work: (() => ImportPreflightWork<T>) | null,
) {
  const [completed, setCompleted] = useState<{
    work: () => ImportPreflightWork<T>;
    result?: T;
    failed?: boolean;
  } | null>(null);

  useEffect(() => {
    setCompleted(null);
    if (!work) return;
    const controller = new AbortController();
    void runImportPreflight(work(), controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) setCompleted({ work, result });
      },
      () => {
        if (!controller.signal.aborted) setCompleted({ work, failed: true });
      },
    );
    return () => controller.abort();
  }, [work]);

  // Invalidate immediately on new input, before the effect has run. Import
  // must never use a result from an older file, mapping or archive snapshot.
  return {
    preflight: completed?.work === work ? (completed?.result ?? null) : null,
    preflightFailed: completed?.work === work && Boolean(completed?.failed),
  };
}
