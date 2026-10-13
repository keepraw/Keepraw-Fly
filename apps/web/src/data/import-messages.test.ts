import { createInstance } from "i18next";
import { describe, expect, it } from "vitest";
import { parseKeeprawFlyJson } from "@keepraw-fly/validator";
import { i18nOptions, translations } from "../locales/test-resources";
import { supportedLanguages } from "../locales/registry";
import { localizedValidationIssue } from "./import-messages";

describe("localized import diagnostics", () => {
  it.each(supportedLanguages)(
    "handles actual parser errors and future validator codes in %s",
    async (language) => {
      const instance = createInstance();
      await instance.init({ ...i18nOptions, lng: language });
      const result = parseKeeprawFlyJson('{"INTERNAL FILE DETAIL":');
      expect(result.valid).toBe(false);
      if (result.valid) throw new Error("Expected parser failure");
      expect(
        localizedValidationIssue(instance.t, result.issues[0]!.keyword),
      ).toBe(instance.t("import.issueMessages.parse"));
      expect(localizedValidationIssue(instance.t, "future-code")).toBe(
        instance.t("import.issueMessages.generic"),
      );
      expect(
        localizedValidationIssue(instance.t, result.issues[0]!.keyword),
      ).not.toContain("INTERNAL FILE DETAIL");
      const messages =
        language === "en-GB" ? translations["en-US"] : translations[language];
      expect(messages.csvImport.importFailed).not.toContain("{{detail}}");
      expect(messages.flightyImport.importFailed).not.toContain("{{detail}}");
    },
  );
});
