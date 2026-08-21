import { useTranslation } from "react-i18next";

export function App() {
  const { t } = useTranslation();

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="wordmark" href="/" aria-label={t("app.homeLabel")}>
          Keepraw Fly
        </a>
        <nav aria-label={t("nav.label")}>
          <a aria-current="page" href="#flights">
            {t("nav.flights")}
          </a>
          <a href="#passport">{t("nav.passport")}</a>
          <a href="#settings">{t("nav.settings")}</a>
        </nav>
      </header>
      <main className="welcome">
        <p className="eyebrow">{t("welcome.eyebrow")}</p>
        <h1>{t("welcome.title")}</h1>
        <p>{t("welcome.description")}</p>
        <div className="welcome-actions">
          <button type="button">{t("actions.openFile")}</button>
          <button className="button-secondary" type="button">
            {t("actions.tryDemo")}
          </button>
        </div>
      </main>
    </div>
  );
}

