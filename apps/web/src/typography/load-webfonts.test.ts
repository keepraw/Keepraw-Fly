import { describe, expect, it } from "vitest";
import { loadChineseWebfonts } from "./load-webfonts";

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
