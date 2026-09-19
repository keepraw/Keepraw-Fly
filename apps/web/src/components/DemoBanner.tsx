import { useTranslation } from "react-i18next";

interface DemoBannerProps {
  onCreateArchive: () => void | Promise<void>;
  compact?: boolean;
}

export function DemoBanner({ onCreateArchive, compact = false }: DemoBannerProps) {
  const { t } = useTranslation();

  return (
    <aside className={`demo-banner${compact ? " demo-banner--compact" : ""}`} aria-label={t("demo.label")}>
      <div>
        <strong>{t("demo.label")}</strong>
        <span>{t("demo.description")}</span>
      </div>
      <button type="button" onClick={() => void onCreateArchive()}>
        {t("demo.createPersonal")}
      </button>
    </aside>
  );
}
