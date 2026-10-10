import type { Page } from "@playwright/test";

/** Run the existing SVG contracts against the production failure path.
 * Task 3's WebGL journeys run independently in passport-globe.pw.ts.
 */
export async function disablePassportWebGL(page: Page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === "webgl2") return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
}
