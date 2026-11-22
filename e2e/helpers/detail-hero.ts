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
    .toBe(width >= 1200 ? 2 : 1);
  // Wait for breakpoint styles and React's mount/unmount before measuring.
  await expect(hero).toHaveCSS("row-gap", width >= 1200 ? "32px" : "0px");
  const map_ = page.locator(".detail-hero-grid > .detail-route-map");
  // The route map is mounted at every width; narrow layouts lead with it.
  await expect(map_).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo(0, 0));
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
      hero: bounds(".detail-hero-grid")!,
      heroBottom: element.getBoundingClientRect().bottom,
      heroPaddingTop: parseFloat(getComputedStyle(element).paddingTop),
      heroPaddingBottom: parseFloat(getComputedStyle(element).paddingBottom),
      viewportHeight: innerHeight,
      scrollHeight: document.documentElement.scrollHeight,
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
  expect(geometry.overflow).toBeLessThanOrEqual(0);
  if (width < 1200) {
    // Single column: the map leads, spans the content width and stays within
    // about half of the viewport height.
    const map = geometry.map!;
    expect(map.bottom).toBeLessThanOrEqual(geometry.information.top + 1);
    expect(map.width).toBeCloseTo(geometry.hero.width, 0);
    expect(map.height).toBeLessThanOrEqual(
      Math.min(geometry.viewportHeight * 0.52, 480) + 1,
    );
  }
  if (width >= 1200) {
    const map = geometry.map!;
    expect(map).not.toBeNull();
    expect(map.width).toBeGreaterThan(0);
    expect(map.height).toBeGreaterThan(0);
    expect(map.x).toBeGreaterThan(geometry.information.right);
    const ratio =
      geometry.information.width / (geometry.information.width + map.width);
    expect(ratio).toBeGreaterThanOrEqual(0.55);
    expect(ratio).toBeLessThanOrEqual(0.6);
    // The 2D route map never mounts the Globe's decorative sky.
    await expect(page.locator(".detail-hero-space")).toHaveCount(0);
    await expect(page.locator(".detail-globe-frame, canvas")).toHaveCount(0);
    const viewport = page.locator(".detail-flight-map .map-viewport");
    if (await viewport.count()) {
      // Content-led Hero: no viewport-driven padding or row height. The title
      // and the 4:3 route map both start at the Hero's natural top, and the
      // Hero is exactly as tall as the taller of the two columns.
      expect(geometry.heroPaddingTop).toBe(0);
      expect(geometry.heroPaddingBottom).toBe(0);
      expect(geometry.information.top).toBeCloseTo(geometry.hero.top, 0);
      expect(geometry.heading.top).toBeCloseTo(geometry.hero.top, 0);
      expect(map.top).toBeCloseTo(geometry.hero.top, 0);
      expect(map.height).toBeCloseTo((map.width * 3) / 4, 0);
      expect(geometry.hero.height).toBeCloseTo(
        Math.max(geometry.information.height, map.height),
        0,
      );
      expect(geometry.stops.bottom).toBeLessThanOrEqual(
        geometry.information.bottom + 1,
      );
      const bounds = (await viewport.boundingBox())!;
      expect(bounds.width).toBeCloseTo(map.width, 0);
      expect(bounds.height).toBeCloseTo(map.height, 0);
      // Automatic framing keeps both endpoints inside the map.
      const markers = await page
        .locator(".detail-flight-map .map-airport:not(.is-planned)")
        .evaluateAll((elements) =>
          elements.map((element) => {
            const rect = element
              .querySelector(".map-airport-point")!
              .getBoundingClientRect();
            return {
              x: rect.x + rect.width / 2,
              y: rect.y + rect.height / 2,
            };
          }),
        );
      expect(markers).toHaveLength(2);
      for (const marker of markers) {
        expect(marker.x).toBeGreaterThan(bounds.x);
        expect(marker.x).toBeLessThan(bounds.x + bounds.width);
        expect(marker.y).toBeGreaterThan(bounds.y);
        expect(marker.y).toBeLessThan(bounds.y + bounds.height);
      }
    } else {
      // Status-only views keep their own natural height: no square slot, no
      // breathing margins and no sky.
      expect(Math.abs(map.top - geometry.heading.top)).toBeLessThanOrEqual(8);
      await expect(map_).toHaveCSS("aspect-ratio", "auto");
      await expect(map_).toHaveCSS("margin-top", "0px");
      const content = await map_.evaluate((element) => {
        const child = element.querySelector<HTMLElement>(
          ".detail-flight-map-message",
        )!;
        return {
          height: child.scrollHeight,
          clipped: child.scrollHeight > child.clientHeight + 1,
        };
      });
      expect(content.clipped).toBe(false);
      expect(map.height).toBeLessThan(map.width / 2);
      expect(geometry.hero.height).toBeCloseTo(
        Math.max(geometry.information.height, map.height),
        0,
      );
    }
  } else {
    await expect(page.locator(".detail-hero-space")).toHaveCount(0);
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
