import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  formatRoute,
  primaryViewOrder,
  type PrimaryView,
  type Route,
} from "../routing";

interface NavigationProps {
  route: Route;
  /** The skin's landing view: the wordmark opens it and it is listed first. */
  landingView: PrimaryView;
  onNavigate: (route: Route) => void;
  onAddFlight?: () => void;
}

interface AppHeaderProps extends NavigationProps {
  /** Primary destinations need an archive; Settings is always reachable. */
  hasArchive: boolean;
  /** Leaves Settings on small screens, where the tab bar is replaced by Back. */
  onBack: () => void;
  detailActions?: {
    backLabel: string;
    onBack: () => void;
    onDuplicate: () => void;
    onEdit: () => void;
    onPrevious?: () => void;
    onNext?: () => void;
  };
}

/** Let the browser handle modified clicks so links open in a new tab. */
function followInApp(
  event: MouseEvent<HTMLAnchorElement>,
  route: Route,
  onNavigate: (route: Route) => void,
) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  event.preventDefault();
  onNavigate(route);
}

export function AppHeader({
  route,
  landingView,
  hasArchive,
  onNavigate,
  onAddFlight,
  onBack,
  detailActions,
}: AppHeaderProps) {
  const { t } = useTranslation();
  const home: Route = { view: landingView };
  const links: Route[] = [
    ...(hasArchive
      ? primaryViewOrder(landingView).map((view) => ({ view }))
      : []),
    { view: "settings" },
  ];
  const currentView = route.view === "flight" ? null : route.view;

  return (
    <>
      <header
        className={`site-header${detailActions ? " site-header--detail" : ""}`}
      >
        <div className="site-header-inner">
          {detailActions ? (
            <>
              <button
                className="detail-header-back"
                type="button"
                onClick={detailActions.onBack}
              >
                <HeaderIcon kind="back" />
                <span>{detailActions.backLabel}</span>
              </button>
              <div className="detail-header-actions">
                <div
                  className="detail-adjacent-navigation"
                  role="group"
                  aria-label={t("actions.adjacentFlights")}
                >
                  <button
                    className="detail-header-action"
                    type="button"
                    disabled={!detailActions.onPrevious}
                    onClick={detailActions.onPrevious}
                  >
                    {t("actions.previousFlight")}
                  </button>
                  <button
                    className="detail-header-action"
                    type="button"
                    disabled={!detailActions.onNext}
                    onClick={detailActions.onNext}
                  >
                    {t("actions.nextFlight")}
                  </button>
                </div>
                <button
                  className="detail-header-action detail-header-duplicate"
                  type="button"
                  onClick={detailActions.onDuplicate}
                >
                  <HeaderIcon kind="duplicate" />
                  <span>{t("actions.duplicateFlight")}</span>
                </button>
                <details
                  className="detail-header-more"
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget))
                      event.currentTarget.removeAttribute("open");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.currentTarget.removeAttribute("open");
                      event.currentTarget.querySelector("summary")?.focus();
                    }
                  }}
                >
                  <summary
                    aria-label={t("actions.moreActions")}
                    title={t("actions.moreActions")}
                  >
                    <HeaderIcon kind="more" />
                  </summary>
                  <div className="detail-header-more-menu">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.currentTarget
                          .closest("details")
                          ?.removeAttribute("open");
                        detailActions.onDuplicate();
                      }}
                    >
                      <HeaderIcon kind="duplicate" />
                      {t("actions.duplicateFlight")}
                    </button>
                  </div>
                </details>
                <button
                  className="detail-header-action"
                  type="button"
                  onClick={detailActions.onEdit}
                >
                  <HeaderIcon kind="edit" />
                  <span>{t("actions.editFlight")}</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <a
                className="wordmark"
                href={formatRoute(home)}
                aria-label={t("app.homeLabel")}
                onClick={(event) => followInApp(event, home, onNavigate)}
              >
                <span className="wordmark-name">KEEPRAW FLY</span>
              </a>
              <nav className="site-navigation" aria-label={t("nav.label")}>
                {links.map((link) => (
                  <a
                    key={link.view}
                    href={formatRoute(link)}
                    aria-current={
                      currentView === link.view ? "page" : undefined
                    }
                    onClick={(event) => followInApp(event, link, onNavigate)}
                  >
                    {t(`nav.${link.view}`)}
                  </a>
                ))}
              </nav>
              {onAddFlight ? (
                <button
                  className="add-flight-button site-header-add"
                  type="button"
                  onClick={onAddFlight}
                >
                  <span aria-hidden="true">＋</span>
                  <span className="site-header-add-label">
                    {t("actions.addFlight")}
                  </span>
                </button>
              ) : null}
            </>
          )}
          {!detailActions && currentView ? (
            <div className="mobile-page-heading">
              {currentView === "settings" ? (
                <button
                  className="mobile-page-back"
                  type="button"
                  onClick={onBack}
                  aria-label={t("nav.back")}
                >
                  <HeaderIcon kind="back" />
                </button>
              ) : null}
              <h1>
                {t(
                  `nav.${hasArchive || currentView === "settings" ? currentView : "passport"}`,
                )}
              </h1>
              {currentView !== "settings" ? (
                <a
                  className="mobile-settings-button"
                  href={formatRoute({ view: "settings" })}
                  aria-label={t("nav.settings")}
                  onClick={(event) =>
                    followInApp(event, { view: "settings" }, onNavigate)
                  }
                >
                  <HeaderIcon kind="settings" />
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>
    </>
  );
}

/** Bottom tab bar for the Compact screen class; hidden from 761 px. */
export function PrimaryTabBar({
  route,
  landingView,
  onNavigate,
  onAddFlight,
}: NavigationProps) {
  const { t } = useTranslation();
  return (
    <div className="primary-tab-bar">
      <nav aria-label={t("nav.label")}>
        {primaryViewOrder(landingView).map((view) => (
          <a
            key={view}
            href={formatRoute({ view })}
            aria-current={route.view === view ? "page" : undefined}
            onClick={(event) => followInApp(event, { view }, onNavigate)}
          >
            <TabIcon view={view} />
            <span>{t(`nav.${view}`)}</span>
          </a>
        ))}
      </nav>
      {onAddFlight ? (
        <button
          className="add-flight-button primary-tab-add"
          type="button"
          onClick={onAddFlight}
          aria-label={t("actions.addFlight")}
          title={t("actions.addFlight")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

function TabIcon({ view }: { view: PrimaryView }) {
  const paths: Record<PrimaryView, string> = {
    log: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
    map: "M4 17c4-9 12-9 16-9M4 17h.01M20 8h.01M4 17a1.5 1.5 0 1 0 0-.01M20 8a1.5 1.5 0 1 0 0-.01",
    stats: "M5 20V11M12 20V4M19 20v-6M3 20h18",
    passport:
      "M6 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6zM6 3v18M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM10 17h4",
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[view]} />
    </svg>
  );
}

function HeaderIcon({
  kind,
}: {
  kind: "back" | "duplicate" | "edit" | "more" | "settings";
}) {
  if (kind === "back") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
      </svg>
    );
  }
  if (kind === "duplicate") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 7v8a2 2 0 0 0 2 2h6M8 7V5a2 2 0 0 1 2-2h4.6a1 1 0 0 1 .7.3l4.4 4.4a1 1 0 0 1 .3.7V15a2 2 0 0 1-2 2h-2M8 7H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2" />
      </svg>
    );
  }
  if (kind === "settings") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9.8 2.8h4.4l.5 2.3a7.5 7.5 0 0 1 1.5.9l2.2-.7 2.2 3.8-1.7 1.6a7.7 7.7 0 0 1 0 1.7l1.7 1.6-2.2 3.8-2.2-.7a7.5 7.5 0 0 1-1.5.9l-.5 2.3H9.8l-.5-2.3a7.5 7.5 0 0 1-1.5-.9l-2.2.7-2.2-3.8 1.7-1.6a7.7 7.7 0 0 1 0-1.7L3.4 9.1l2.2-3.8 2.2.7a7.5 7.5 0 0 1 1.5-.9l.5-2.3Z" />
        <circle cx="12" cy="11.5" r="2.6" />
      </svg>
    );
  }
  if (kind === "more") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m15.2 5.2 3.6 3.6m-2.1-5.1a2.5 2.5 0 1 1 3.6 3.6L6.5 21H3v-3.5L16.7 3.7Z" />
    </svg>
  );
}
