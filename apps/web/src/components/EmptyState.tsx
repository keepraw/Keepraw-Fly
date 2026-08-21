import { useTranslation } from "react-i18next";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import { ImportControl } from "./ImportControl";

interface EmptyStateProps {
  onTryDemo: () => void;
  onImport: (document: KeeprawFlyDocument) => void | Promise<void>;
}

export function EmptyState({ onTryDemo, onImport }: EmptyStateProps) {
  const { t } = useTranslation();

  return (
    <main className="welcome">
      <p className="eyebrow">{t("welcome.eyebrow")}</p>
      <h1>{t("welcome.title")}</h1>
      <p>{t("welcome.description")}</p>
      <div className="welcome-actions">
        <ImportControl onImport={onImport} />
        <button className="button-secondary" type="button" onClick={onTryDemo}>
          {t("actions.tryDemo")}
        </button>
      </div>
      <p className="privacy-note">{t("welcome.privacy")}</p>
    </main>
  );
}
