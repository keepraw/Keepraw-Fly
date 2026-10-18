import { describe, expect, it } from "vitest";
import {
  chineseWebfontIntegrity,
  chineseWebfontStylesheets,
  loadChineseWebfonts,
} from "./load-webfonts";

function fakeDocument() {
  const links: HTMLLinkElement[] = [];
  const document = {
    querySelector: (selector: string) =>
      links.find((link) =>
        selector.includes(`"${link.dataset.chineseWebfont}"`),
      ),
    createElement: () => ({ dataset: {} }),
    head: { append: (link: HTMLLinkElement) => links.push(link) },
  } as unknown as Document;
  return { document, links };
}

describe("Chinese webfonts", () => {
  it.each([
    "en",
    "en-US",
    "en-GB",
    "ja-JP",
    "fr-FR",
    "de-DE",
    "es",
    "pt-BR",
    "ko-KR",
    "unknown",
  ])("does not request Chinese fonts for %s", (language) => {
    const { document, links } = fakeDocument();
    loadChineseWebfonts(language, document);
    expect(links).toHaveLength(0);
  });
  it.each([
    ["zh-CN", "misans/misans"],
    ["zh-TW", "misans-tc/misanstc"],
  ])(
    "loads only the proper subsets for %s once and tolerates network failure",
    (language, path) => {
      const { document, links } = fakeDocument();
      loadChineseWebfonts(language, document);
      loadChineseWebfonts(language, document);
      expect(links).toHaveLength(3);
      for (const link of links) {
        expect(link.href).toContain(path);
        expect(() =>
          link.onerror?.call(link, new Event("error")),
        ).not.toThrow();
        expect(link.dataset.fontStatus).toBe("unavailable");
      }
    },
  );
});

describe("Chinese webfont Subresource Integrity", () => {
  const sriPattern = /^sha384-[A-Za-z0-9+/]{64}$/;

  it("pins exactly the six stylesheets that can be requested", () => {
    expect(Object.keys(chineseWebfontIntegrity).sort()).toEqual(
      [
        "misans-tc/misanstc-medium",
        "misans-tc/misanstc-regular",
        "misans-tc/misanstc-semibold",
        "misans/misans-medium",
        "misans/misans-regular",
        "misans/misans-semibold",
      ].sort(),
    );
    for (const value of Object.values(chineseWebfontIntegrity))
      expect(value).toMatch(sriPattern);
    expect(new Set(Object.values(chineseWebfontIntegrity)).size).toBe(6);
  });

  it.each(["zh-CN", "zh-TW"])(
    "sets the matching SRI hash, CORS and no-referrer on each %s link",
    (language) => {
      const { document, links } = fakeDocument();
      loadChineseWebfonts(language, document);
      const expected = chineseWebfontStylesheets(language);
      expect(links).toHaveLength(3);
      links.forEach((link, index) => {
        const sheet = expected[index]!;
        expect(link.href).toBe(sheet.href);
        expect(link.href).toMatch(
          /^https:\/\/cdn\.jsdelivr\.net\/npm\/misans-webfont@4\.3\.1\//,
        );
        const path = sheet.href
          .replace(/^.*misans-webfont@4\.3\.1\//, "")
          .replace(/\/result\.min\.css$/, "");
        expect(link.integrity).toBe(chineseWebfontIntegrity[path]);
        expect(link.crossOrigin).toBe("anonymous");
        expect(link.referrerPolicy).toBe("no-referrer");
      });
    },
  );

  it("treats an integrity failure (error event) as a system-font fallback", () => {
    const { document, links } = fakeDocument();
    loadChineseWebfonts("zh-CN", document);
    for (const link of links) {
      expect(link.dataset.fontStatus).toBe("loading");
      link.onerror?.call(link, new Event("error"));
      expect(link.dataset.fontStatus).toBe("unavailable");
    }
  });

  it("requests nothing (and needs no hash) for non-Chinese locales", () => {
    expect(chineseWebfontStylesheets("en-US")).toEqual([]);
    expect(chineseWebfontStylesheets("ja-JP")).toEqual([]);
  });
});
