import { renderToStaticMarkup } from "react-dom/server";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { afterEach, expect, it, vi } from "vitest";
import en from "../locales/en-US.json";
import type { ViewerSettings } from "../storage/types";

// A skin drawn in one appearance, as `aviation` and `archive` will be.
vi.mock("../skins/registry", async (original) => {
  const registry = await original<typeof import("../skins/registry")>();
  const SKINS = {
    ...registry.SKINS,
    "dark-only": {
      id: "dark-only",
      labelKey: "settings.skinOption.minimal",
      appearances: ["dark"],
      landingView: "map",
      mapTheme: { dark: "neon-aviation" },
      passportTemplate: "neon",
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
          mapTheme: "neon-aviation",
          passportTemplate: "neon",
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
  expect(skins).toContain('<option value="classic">Classic</option>');
  expect(skins).toContain(
    '<option value="minimal" selected="">Minimal</option>',
  );
  const appearance = select(markup, "settings-appearance");
  expect(appearance).not.toContain("disabled");
  expect(appearance).toContain('<option value="light" selected="">');
  expect(markup).not.toContain("settings-appearance-hint");
});

it("hides the map theme and layout a skin owns", async () => {
  const owned = await render("minimal", "system");
  expect(owned).not.toContain("settings-map-theme");
  expect(owned).not.toContain("settings-passport-layout");
  const classic = await render("classic", "system");
  expect(classic).toContain('id="settings-map-theme"');
  expect(classic).toContain('id="settings-passport-layout"');
});

it("greys out Appearance and says why on a single-appearance skin", async () => {
  const markup = await render("dark-only", "light");
  const appearance = select(markup, "settings-appearance");
  expect(appearance).toContain("disabled");
  expect(appearance).toContain('aria-describedby="settings-appearance-hint"');
  // The control shows what is on screen, not the request it cannot honour.
  expect(appearance).toContain('<option value="dark" selected="">');
  expect(markup).toContain(
    '<p id="settings-appearance-hint">Minimal is only available in dark.</p>',
  );
});
