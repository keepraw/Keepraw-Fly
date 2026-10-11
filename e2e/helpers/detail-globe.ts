import { expect, type Page } from "@playwright/test";

/** Layout journeys still exercise the explicit error UI on engines without WebGL.
 * detail-map-curve.pw.ts requires real WebGL and never treats this as a 3D pass. */
export async function expectDetailGlobe(page: Page) {
  await expect(page.locator(".detail-globe-frame")).toBeVisible();
  await expect(page.locator(".detail-globe-frame svg")).toHaveCount(0);
  const capable = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.dataset.globeView = "detail";
    const gl = canvas.getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  });
  if (capable) {
    await expect(
      page.locator(".detail-globe-frame .globe-host"),
    ).toHaveAttribute("data-ready", "true", { timeout: 25000 });
    await expect(page.locator(".detail-globe-frame canvas")).toBeVisible();
  } else {
    await expect(
      page.locator(".detail-globe-frame .globe-stage"),
    ).toHaveAttribute("data-error", /webgl2-unavailable/);
    await expect(
      page.locator(".detail-globe-frame .globe-fallback button"),
    ).toBeEnabled();
  }
  return capable;
}
