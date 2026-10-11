import { expect, type Page } from "@playwright/test";

// Measure the actual heading/stops, rather than a stretched left wrapper.
export async function expectDetailHero(page: Page, width: number) {
  await expect(
    page.locator(
      ".detail-hero-grid > .detail-hero-information > .detail-heading",
    ),
  ).toHaveCount(1);
  await expect(
    page.locator(
      ".detail-hero-grid > .detail-hero-information > .detail-stops",
    ),
  ).toHaveCount(1);
  const hero = page.locator(".detail-hero-grid");
  await expect(hero).toHaveCSS("display", "grid");
  await expect
    .poll(() =>
      hero.evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.split(/\s+/).length,
      ),
    )
    .toBe(width >= 1024 ? 2 : 1);
  // Wait for breakpoint styles and React's mount/unmount before measuring.
  await expect(hero).toHaveCSS("row-gap", width >= 1024 ? "32px" : "0px");
  const map = page.locator(".detail-hero-grid > .detail-route-map");
  if (width >= 1024) await expect(map).toBeVisible();
  else await expect(map).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  const geometry = await hero.evaluate((element) => {
    const bounds = (selector: string) => {
      const target = document.querySelector(selector);
      if (!target) return null;
      const rect = target.getBoundingClientRect();
      return {
        x: rect.x,
        top: rect.top,
        bottom: rect.bottom,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      };
    };
    return {
      heading: bounds(".detail-heading")!,
      stops: bounds(".detail-stops")!,
      information: bounds(".detail-hero-information")!,
      map: bounds(".detail-hero-grid > .detail-route-map"),
      shelf: bounds(".detail-flight-card > .detail-metadata-shelf"),
      card: bounds(".detail-flight-card")!,
      heroBottom: element.getBoundingClientRect().bottom,
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
  expect(geometry.overflow).toBeLessThanOrEqual(0);
  if (width >= 1024) {
    const map = geometry.map!;
    expect(map).not.toBeNull();
    expect(map.width).toBeGreaterThan(0);
    expect(map.height).toBeGreaterThan(0);
    expect(map.x).toBeGreaterThan(geometry.information.right);
    expect(Math.abs(map.top - geometry.heading.top)).toBeLessThanOrEqual(8);
    const contentHeight = geometry.stops.bottom - geometry.heading.top;
    if (contentHeight <= 640) {
      expect(Math.abs(map.bottom - geometry.stops.bottom)).toBeLessThanOrEqual(
        12,
      );
    } else {
      // Exceptional content keeps reading in full; the Globe stops growing.
      expect(map.height).toBeLessThanOrEqual(640);
    }
    const ratio =
      geometry.information.width / (geometry.information.width + map.width);
    expect(ratio).toBeGreaterThanOrEqual(0.55);
    expect(ratio).toBeLessThanOrEqual(0.6);
  } else {
    expect(geometry.map).toBeNull();
    await expect(page.locator(".detail-stop").first()).toHaveCSS(
      "grid-template-columns",
      /^(\d+(?:\.\d+)?px)$/,
    );
    await expect(page.locator(".detail-header-more")).toBeVisible();
    await expect(page.locator(".detail-adjacent-navigation")).toBeHidden();
    if (geometry.shelf)
      await expect(page.locator(".detail-metadata-shelf")).toHaveCSS(
        "grid-template-columns",
        /^(\d+(?:\.\d+)?px)$/,
      );
  }
  if (geometry.shelf) {
    expect(geometry.shelf.top).toBeGreaterThanOrEqual(geometry.heroBottom + 23);
    expect(geometry.shelf.width).toBeCloseTo(geometry.card.width, 0);
  }
  return geometry;
}
