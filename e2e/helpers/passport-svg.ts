import type { Page } from "@playwright/test";

/** The app has no WebGL renderer: these journeys run with every WebGL
 * context refused so a reintroduced dependency on one fails them. */
export async function disablePassportWebGL(page: Page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (/^(?:experimental-)?webgl2?$/.test(type)) return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
}
