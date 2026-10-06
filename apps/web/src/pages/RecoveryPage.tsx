import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import type { ArchiveLoadResult } from "../storage/adapter";
import { ConfirmationDialog } from "../components/ConfirmationDialog";
import { ImportControl } from "../components/ImportControl";
import { PageShell } from "../components/PageShell";
import { downloadRecoveryCopy } from "../data/recovery-export";

interface RecoveryPageProps {
  archive: Extract<
    ArchiveLoadResult,
    { status: "invalid" | "unsupported-version" }
  >;
  onRetry: () => Promise<void>;
  onImport: (document: KeeprawFlyDocument) => Promise<void>;
  onClear: () => Promise<void>;
  busy: boolean;
}

interface PendingBackup {
  document: KeeprawFlyDocument;
  complete: () => void;
}

type RecoveryError =
  | "downloadError"
  | "retryError"
  | "importReadError"
  | "importError"
  | "clearError";

export function RecoveryPage({
  archive,
  onRetry,
  onImport,
  onClear,
  busy,
}: RecoveryPageProps) {
  const { t } = useTranslation();
  const [error, setError] = useState<RecoveryError | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<PendingBackup | null>(
    null,
  );
  const operationInFlight = useRef(false);

  async function runOperation(
    operation: () => void | Promise<void>,
    failure: RecoveryError,
  ) {
    if (busy || operationInFlight.current) return;
    operationInFlight.current = true;
    setError(null);
    try {
      await operation();
    } catch {
      setError(failure);
    } finally {
      operationInFlight.current = false;
    }
  }

  function requestBackupImport(document: KeeprawFlyDocument): Promise<void> {
    setError(null);
    // Keep the existing import preview busy until the replacement choice and save finish.
    return new Promise<void>((complete) =>
      setPendingBackup({ document, complete }),
    );
  }

  function cancelBackupImport() {
    if (!pendingBackup) return;
    pendingBackup.complete();
    setPendingBackup(null);
  }

  async function confirmBackupImport() {
    if (!pendingBackup) return;
    const backup = pendingBackup;
    setPendingBackup(null);
    try {
      await runOperation(() => onImport(backup.document), "importError");
    } finally {
      backup.complete();
    }
  }

  return (
    <PageShell className="settings-page recovery-page">
      <div className="settings-content recovery-content" aria-busy={busy}>
        <header className="recovery-heading">
          <h1>{t("recovery.title")}</h1>
          <p className="recovery-description">{t("recovery.description")}</p>
          {archive.status === "unsupported-version" ? (
            <p className="recovery-version" role="note">
              {t("recovery.unsupportedVersion")}
            </p>
          ) : null}
        </header>
        {error ? (
          <p className="storage-warning" role="alert">
            {t(`recovery.${error}`)}
          </p>
        ) : null}
        <div className="settings-sections">
          <div className="recovery-actions">
            <button
              className="button-primary"
              type="button"
              disabled={busy}
              onClick={() =>
                void runOperation(
                  () => downloadRecoveryCopy(archive.rawDocument),
                  "downloadError",
                )
              }
            >
              {t("recovery.download")}
            </button>
            <button
              className="button-secondary"
              type="button"
              disabled={busy}
              onClick={() => void runOperation(onRetry, "retryError")}
            >
              {t("recovery.retry")}
            </button>
          </div>
          <section
            className="settings-section"
            aria-labelledby="recovery-import-title"
          >
            <h2 className="settings-section-title" id="recovery-import-title">
              {t("recovery.importTitle")}
            </h2>
            <fieldset
              className="recovery-import settings-panel"
              disabled={busy}
              onDropCapture={(event) => {
                if (busy || operationInFlight.current || pendingBackup) {
                  event.preventDefault();
                  event.stopPropagation();
                }
              }}
            >
              <legend className="sr-only">{t("recovery.importTitle")}</legend>
              <div className="settings-import-row">
                <div className="settings-row-copy">
                  <span className="settings-row-label">
                    {t("recovery.importDescription")}
                  </span>
                  <small>{t("recovery.importNote")}</small>
                </div>
                <ImportControl
                  onImport={requestBackupImport}
                  onError={() => setError("importReadError")}
                  variant="settings"
                />
              </div>
            </fieldset>
          </section>
          <section
            className="settings-section settings-danger-zone"
            aria-labelledby="recovery-danger-title"
          >
            <h2 className="settings-section-title" id="recovery-danger-title">
              {t("settings.dangerZone")}
            </h2>
            <div className="settings-panel">
              <div className="settings-row">
                <div className="settings-row-copy">
                  <span className="settings-row-label">
                    {t("actions.clearData")}
                  </span>
                  <small>{t("recovery.clearDescription")}</small>
                </div>
                <div className="settings-row-control">
                  <button
                    className="settings-action danger-action"
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmClear(true)}
                  >
                    {t("actions.clearData")}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
      {pendingBackup ? (
        <ConfirmationDialog
          title={t("recovery.replaceTitle")}
          description={t("recovery.replaceDescription")}
          confirmLabel={t("recovery.replaceConfirm")}
          cancelLabel={t("actions.cancel")}
          onCancel={cancelBackupImport}
          onConfirm={() => void confirmBackupImport()}
        />
      ) : null}
      {confirmClear ? (
        <ConfirmationDialog
          title={t("actions.clearData")}
          description={t("recovery.clearConfirmation")}
          confirmLabel={t("actions.clearData")}
          cancelLabel={t("actions.cancel")}
          tone="danger"
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            setConfirmClear(false);
            void runOperation(onClear, "clearError");
          }}
        />
      ) : null}
    </PageShell>
  );
}
