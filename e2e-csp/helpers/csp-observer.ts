import { expect, type Page } from "@playwright/test";
import { documentDirectives } from "../../apps/web/security-policy.mjs";

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

// Playwright 1.65.0's WebKit no longer emits native <select> style
// violations. Keep every event and console error, including detached nodes
// whose genuine style declarations match the former UA shadow-slot sample.
export async function watchViolations(page: Page, browserName: string) {
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
    // detector stays silent; violation events still detect refused styles.
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
  return {
    readAll,
    violations: async () => {
      const observed = await readAll();
      expect(observed.blockedStyles).toEqual([]);
      return observed.violations;
    },
    // Console messages can land after an earlier violations() snapshot.
    // Re-read both detectors; no native-control events or errors are exempt.
    cspConsoleErrors: async () => {
      const csp = consoleErrors.filter((text) =>
        /Content.Security.Policy|CSP|style-src|script-src|connect-src/i.test(
          text,
        ),
      );
      const observed = await readAll();
      expect(observed.blockedStyles).toEqual([]);
      expect(observed.violations).toEqual([]);
      return csp;
    },
    consoleErrors,
  };
}
