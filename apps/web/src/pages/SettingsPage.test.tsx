import { renderToStaticMarkup } from "react-dom/server";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { afterEach, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";
import en from "../locales/en.json";

afterEach(() => vi.unstubAllGlobals());

it.each(["general", "data"] as const)(
  "renders the %s navigation intent without a browser DOM",
  async (category) => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);
    const i18n = createInstance();
    await i18n.init({
      lng: "en",
      resources: { en: { translation: en } },
      interpolation: { escapeValue: false },
    });
    const markup = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <SettingsPage
          {...(category === "data" ? { initialCategory: category } : {})}
          document={null}
          isDemo={false}
          settings={{
            language: "en",
            appearance: "system",
            distanceUnit: "miles",
            timeFormat: "24-hour",
            solarMode: "fixed",
            powerUserMode: false,
          }}
          onImport={() => {}}
          onSettingsChange={() => {}}
          onProfileChange={() => {}}
          onMembershipsChange={() => {}}
        />
      </I18nextProvider>,
    );
    expect(markup).toContain(
      `aria-current="true" aria-controls="settings-category-${category}"`,
    );
    expect(markup).toContain(
      `id="settings-category-${category}" data-active="true"`,
    );
  },
);
