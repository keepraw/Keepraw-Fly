import { expect, type Page } from "@playwright/test";

/** The Flight Detail map is the themed 2D SVG route map: no canvas, no WebGL. */
export async function expectDetailMap(page: Page) {
  const map = page.locator(".detail-flight-map");
  await expect(map).toBeVisible();
  await expect(map.locator("canvas")).toHaveCount(0);
  await expect(page.locator(".detail-globe-frame")).toHaveCount(0);
  await expect(map).toHaveAttribute("data-map-theme", /.+/);
  await expect(
    map.locator(".map-route.is-selected .map-route-line"),
  ).toBeVisible();
  await expect(map.locator(".map-zoom-controls button")).toHaveCount(3);
  return map;
}
