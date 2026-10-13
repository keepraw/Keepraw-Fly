import { afterEach, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllGlobals());

it("synchronizes HTML language and preserves explicit localized missing-key defaults", async () => {
  const document = { documentElement: { lang: "" } };
  vi.stubGlobal("document", document);
  vi.stubGlobal("navigator", {
    languages: ["fr-FR", "en-GB"],
    language: "en-US",
  });
  const { i18n } = await import("./i18n");
  expect(i18n.language).toBe("en-GB");
  expect(document.documentElement.lang).toBe("en-GB");
  expect(i18n.t("settings.kilometers")).toBe("Kilometres");
  await i18n.changeLanguage("zh-TW");
  expect(document.documentElement.lang).toBe("zh-TW");
  const generic = i18n.t("import.issueMessages.generic");
  expect(
    i18n.t("import.issueMessages.future-code", { defaultValue: generic }),
  ).toBe(generic);
  expect(i18n.t("future.key")).toBe(i18n.t("app.unavailable"));
});
