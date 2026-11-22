import type { Page } from "@playwright/test";

/** Production Passport is the 2D SVG map, so these journeys must stay green
 * even when WebGL2 is unavailable. Globe Lab suites cover the retained Globe.
 */
export async function disablePassportWebGL(page: Page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === "webgl2" && this.dataset.globeView !== "detail") return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
}
