import type { Page } from "@playwright/test";

/** The app has no WebGL renderer: these journeys run with WebGL2 refused so a
 * reintroduced dependency on it fails them. */
export async function disablePassportWebGL(page: Page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === "webgl2") return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
}
