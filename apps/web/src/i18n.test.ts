import { afterEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

afterEach(() => vi.unstubAllGlobals());

it("synchronizes HTML language and preserves explicit localized missing-key defaults", async () => {
  const document = { documentElement: { lang: "" } };
  vi.stubGlobal("document", document);
  vi.stubGlobal("navigator", {
    languages: ["it-IT", "en-GB"],
    language: "en-US",
  });
  vi.stubGlobal("fetch", async (url: string) => {
    const locale = /([a-z]{2}(?:-[A-Z]{2})?)\.json/.exec(url)![1];
    return new Response(
      readFileSync(
        new URL(`./locales/${locale}.json`, import.meta.url),
        "utf8",
      ),
    );
  });
  const { i18n, initialLanguageReady, changeUiLanguage } =
    await import("./i18n");
  await initialLanguageReady;
  expect(i18n.language).toBe("en-GB");
  expect(document.documentElement.lang).toBe("en-GB");
  expect(i18n.t("settings.kilometers")).toBe("Kilometres");
  await changeUiLanguage("zh-TW");
  expect(document.documentElement.lang).toBe("zh-TW");
  const generic = i18n.t("import.issueMessages.generic");
  expect(
    i18n.t("import.issueMessages.future-code", { defaultValue: generic }),
  ).toBe(generic);
  expect(i18n.t("future.key")).toBe(i18n.t("app.unavailable"));
});

it.each(["ja-JP", "fr-FR", "de-DE", "es", "pt-BR", "ko-KR"])(
  "loads %s through a cloned instance's native changeLanguage API without changing the parent language",
  async (language) => {
    vi.stubGlobal("fetch", async (url: string) => {
      const locale = /([a-z]{2}(?:-[A-Z]{2})?)\.json/.exec(url)![1];
      return new Response(
        readFileSync(
          new URL(`./locales/${locale}.json`, import.meta.url),
          "utf8",
        ),
      );
    });
    const { i18n } = await import("./i18n");
    const parentLanguage = i18n.language;
    const clone = i18n.cloneInstance({ lng: "en-US" });
    await clone.changeLanguage(language);
    const resource = JSON.parse(
      readFileSync(
        new URL(`./locales/${language}.json`, import.meta.url),
        "utf8",
      ),
    );
    expect(clone.resolvedLanguage).toBe(language);
    expect(clone.t("globe.keyboard")).toBe(resource.globe.keyboard);
    expect(i18n.language).toBe(parentLanguage);
  },
);
