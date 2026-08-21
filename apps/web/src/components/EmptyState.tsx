import { useTranslation } from "react-i18next";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import { ImportControl } from "./ImportControl";

interface EmptyStateProps {
  onCreateArchive: () => void;
  onTryDemo: () => void;
  onImport: (document: KeeprawFlyDocument) => void | Promise<void>;
}

export function EmptyState({ onCreateArchive, onTryDemo, onImport }: EmptyStateProps) {
  const { t } = useTranslation();

  return (
    <main className="welcome" id="main-content" tabIndex={-1}>
      <p className="eyebrow">{t("welcome.eyebrow")}</p>
      <h1>{t("welcome.title")}</h1>
      <p>{t("welcome.description")}</p>
      <div className="welcome-actions">
        <button className="button-primary" type="button" onClick={onCreateArchive}>
          {t("actions.createArchive")}
        </button>
        <button className="button-secondary" type="button" onClick={onTryDemo}>
          {t("actions.tryDemo")}
        </button>
        <div className="welcome-import"><ImportControl onImport={onImport} /></div>
      </div>
      <p className="privacy-note">{t("welcome.privacy")}</p>
    </main>
  );
}
