import { useEffect, useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";

export type Page = "passport" | "settings";

interface AppHeaderProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  detailActions?: {
    onBack: () => void;
    onDuplicate: () => void;
    onEdit: () => void;
  };
}

export function AppHeader({ currentPage, onNavigate, detailActions }: AppHeaderProps) {
  const { t } = useTranslation();
  const [mobileDestination, setMobileDestination] = useState<"flights" | Page>(
    currentPage === "settings" ? "settings" : "passport",
  );
  const links: Array<{ page: Page; label: string }> = [
    { page: "passport", label: t("nav.passport") },
    { page: "settings", label: t("nav.settings") },
  ];

  useEffect(() => {
    setMobileDestination((current) => currentPage === "settings"
      ? "settings"
      : current === "settings" ? "passport" : current);
  }, [currentPage]);

  function navigateToPassportSection(
    event: MouseEvent<HTMLAnchorElement>,
    destination: "flights" | "passport",
  ) {
    event.preventDefault();
    setMobileDestination(destination);
    onNavigate("passport");
    window.history.replaceState(null, "", "#passport");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const selector = destination === "flights" ? "#flight-archive" : "#passport-visual";
        document.querySelector(selector)?.scrollIntoView({ block: "start", behavior: "auto" });
      });
    });
  }

  return (
    <>
      <header className={`site-header${detailActions ? " site-header--detail" : ""}`}>
        <div className="site-header-inner">
          {detailActions ? <>
            <button className="detail-header-back" type="button" onClick={detailActions.onBack}>
              <HeaderIcon kind="back" />
              <span>{t("nav.passport")}</span>
            </button>
            <div className="detail-header-actions">
              <button className="detail-header-action" type="button" onClick={detailActions.onDuplicate}>
                <HeaderIcon kind="duplicate" />
                <span>{t("actions.duplicateFlight")}</span>
              </button>
              <button className="detail-header-action" type="button" onClick={detailActions.onEdit}>
                <HeaderIcon kind="edit" />
                <span>{t("actions.editFlight")}</span>
              </button>
            </div>
          </> : <>
            <a
              className="wordmark"
              href="#passport"
              aria-label={t("app.homeLabel")}
              onClick={() => onNavigate("passport")}
            >
              <span className="wordmark-name">KEEPRAW FLY</span>
              <span className="wordmark-context" aria-hidden="true">LOGBOOK</span>
            </a>
            <nav className="site-navigation" aria-label={t("nav.label")}>
              {links.map(({ page, label }) => (
                <a
                  key={page}
                  href={`#${page}`}
                  aria-current={currentPage === page ? "page" : undefined}
                  onClick={() => onNavigate(page)}
                >
                  {label}
                </a>
              ))}
            </nav>
          </>}
        </div>
      </header>
      {!detailActions ? (
        <nav className="mobile-navigation" aria-label={t("nav.label")}>
          <a
            href="#flights"
            aria-current={currentPage === "passport" && mobileDestination === "flights" ? "page" : undefined}
            onClick={(event) => navigateToPassportSection(event, "flights")}
          >
            {t("nav.flights")}
          </a>
          <a
            href="#passport"
            aria-current={currentPage === "passport" && mobileDestination === "passport" ? "page" : undefined}
            onClick={(event) => navigateToPassportSection(event, "passport")}
          >
            {t("nav.passport")}
          </a>
          <a
            href="#settings"
            aria-current={currentPage === "settings" ? "page" : undefined}
            onClick={() => {
              setMobileDestination("settings");
              onNavigate("settings");
            }}
          >
            {t("nav.settings")}
          </a>
        </nav>
      ) : null}
    </>
  );
}

function HeaderIcon({ kind }: { kind: "back" | "duplicate" | "edit" }) {
  if (kind === "back") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>;
  }
  if (kind === "duplicate") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7v8a2 2 0 0 0 2 2h6M8 7V5a2 2 0 0 1 2-2h4.6a1 1 0 0 1 .7.3l4.4 4.4a1 1 0 0 1 .3.7V15a2 2 0 0 1-2 2h-2M8 7H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15.2 5.2 3.6 3.6m-2.1-5.1a2.5 2.5 0 1 1 3.6 3.6L6.5 21H3v-3.5L16.7 3.7Z" /></svg>;
}
