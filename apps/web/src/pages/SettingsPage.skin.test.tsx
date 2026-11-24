import { renderToStaticMarkup } from "react-dom/server";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { afterEach, expect, it, vi } from "vitest";
import en from "../locales/en-US.json";
import type { ViewerSettings } from "../storage/types";

// A skin drawn only in light, as `archive` will be.
vi.mock("../skins/registry", async (original) => {
  const registry = await original<typeof import("../skins/registry")>();
  const SKINS = {
    ...registry.SKINS,
    "light-only": {
      id: "light-only",
      labelKey: "settings.skinOption.minimal",
      appearances: ["light"],
      landingView: "passport",
      mapTheme: { light: "daylight-chart" },
      passportTemplate: "book",
    },
  };
  return {
    ...registry,
    SKINS,
    SKIN_IDS: Object.keys(SKINS),
    resolveSkin: (id: string) =>
      SKINS[id as keyof typeof SKINS] ?? SKINS[registry.DEFAULT_SKIN_ID],
  };
});

const { SettingsPage } = await import("./SettingsPage");

afterEach(() => vi.unstubAllGlobals());

async function render(skin: string, appearance: ViewerSettings["appearance"]) {
  vi.stubGlobal("window", undefined);
  vi.stubGlobal("document", undefined);
  const i18n = createInstance();
  await i18n.init({
    lng: "en",
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  });
  return renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <SettingsPage
        document={null}
        isDemo={false}
        settings={{
          language: "en-US",
          appearance,
          skin: skin as ViewerSettings["skin"],
          distanceUnit: "miles",
          timeFormat: "24-hour",
          powerUserMode: false,
        }}
        onImport={() => {}}
        onSettingsChange={() => {}}
        onProfileChange={() => {}}
        onMembershipsChange={() => {}}
      />
    </I18nextProvider>,
  );
}

const select = (markup: string, id: string) =>
  new RegExp(`<select id="${id}"[^>]*>.*?</select>`, "s").exec(markup)?.[0];

it("offers every registered skin and leaves Appearance free on minimal", async () => {
  const markup = await render("minimal", "light");
  const skins = select(markup, "settings-skin");
  expect(skins).not.toContain("classic");
  expect(skins).toContain('<option value="aviation">Aviation</option>');
  expect(skins).toContain(
    '<option value="minimal" selected="">Minimal</option>',
  );
  const appearance = select(markup, "settings-appearance");
  expect(appearance).not.toContain("disabled");
  expect(appearance).toContain('<option value="light" selected="">');
  expect(markup).not.toContain("settings-appearance-hint");
});

it("never offers the map theme or the passport layout on their own", async () => {
  for (const skin of ["minimal", "aviation", "light-only"]) {
    const markup = await render(skin, "system");
    expect(markup).not.toContain("settings-map-theme");
    expect(markup).not.toContain("settings-passport-layout");
  }
});

it("greys out Appearance and says why on aviation", async () => {
  const markup = await render("aviation", "light");
  const appearance = select(markup, "settings-appearance");
  expect(appearance).toContain("disabled");
  expect(appearance).toContain('aria-describedby="settings-appearance-hint"');
  // The control shows what is on screen, not the request it cannot honour.
  expect(appearance).toContain('<option value="dark" selected="">');
  expect(markup).toContain(
    '<p id="settings-appearance-hint">Aviation is only available in dark.</p>',
  );
});

it("explains a light-only skin the same way", async () => {
  const markup = await render("light-only", "dark");
  const appearance = select(markup, "settings-appearance");
  expect(appearance).toContain("disabled");
  expect(appearance).toContain('<option value="light" selected="">');
  expect(markup).toContain(
    '<p id="settings-appearance-hint">Minimal is only available in light.</p>',
  );
});
