import { useTranslation } from "react-i18next";

interface EmptyStateProps {
  onTryDemo: () => void;
}

export function EmptyState({ onTryDemo }: EmptyStateProps) {
  const { t } = useTranslation();

  return (
    <main className="welcome">
      <p className="eyebrow">{t("welcome.eyebrow")}</p>
      <h1>{t("welcome.title")}</h1>
      <p>{t("welcome.description")}</p>
      <div className="welcome-actions">
        <button type="button" disabled title={t("welcome.importComingSoon")}>
          {t("actions.openFile")}
        </button>
        <button className="button-secondary" type="button" onClick={onTryDemo}>
          {t("actions.tryDemo")}
        </button>
      </div>
      <p className="privacy-note">{t("welcome.privacy")}</p>
    </main>
  );
}

