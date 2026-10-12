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
  const map = page.locator(".detail-hero-grid > .detail-route-map");
  if (width >= 1200) await expect(map).toBeVisible();
  else await expect(map).toHaveCount(0);
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
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
  expect(geometry.overflow).toBeLessThanOrEqual(0);
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
    const sky = page.locator(".detail-hero-grid > .detail-hero-space");
    await expect(sky).toHaveCount(1);
    await expect(sky).toHaveCSS("pointer-events", "none");
    const skyBounds = (await sky.boundingBox())!;
    expect(skyBounds.x).toBeGreaterThanOrEqual(geometry.information.right - 1);
    expect(skyBounds.x + skyBounds.width).toBeLessThanOrEqual(width + 1);
    if (geometry.shelf)
      expect(skyBounds.y + skyBounds.height).toBeLessThanOrEqual(
        geometry.shelf.top + 1,
      );
    const host = page.locator(".detail-globe-frame .globe-host");
    if (await host.count()) {
      await expect(host).toHaveAttribute("data-ready", "true", {
        timeout: 25000,
      });
      // The map fills the Hero row, independently of the information's height.
      expect(map.top).toBeCloseTo(
        geometry.hero.top + geometry.heroPaddingTop,
        0,
      );
      expect(map.bottom).toBeCloseTo(
        geometry.hero.bottom - geometry.heroPaddingBottom,
        0,
      );
      const contentHeight = geometry.stops.bottom - geometry.heading.top;
      const minimumHeight =
        contentHeight + geometry.heroPaddingTop + geometry.heroPaddingBottom;
      if (minimumHeight <= geometry.viewportHeight - geometry.hero.top) {
        expect(geometry.heroBottom).toBeCloseTo(geometry.viewportHeight, 0);
      }
      // Keep exceptional information readable rather than clipping its end.
      expect(geometry.heading.top).toBeGreaterThanOrEqual(map.top - 1);
      expect(geometry.stops.bottom).toBeLessThanOrEqual(map.bottom + 1);
      const viewport = (await host.boundingBox())!;
      expect(viewport.height).toBeLessThanOrEqual(
        Math.min(560, Math.max(360, geometry.viewportHeight * 0.52)) + 1,
      );
      expect(viewport.y + viewport.height / 2).toBeCloseTo(
        map.top + map.height / 2,
        0,
      );
      const labels = (await page
        .locator(".detail-globe-frame .globe-labels")
        .boundingBox())!;
      expect(labels).toEqual(viewport);
      await expect
        .poll(() =>
          host.evaluate(
            (element) =>
              JSON.parse((element as HTMLElement).dataset.scene!).viewport
                .height - element.clientHeight,
          ),
        )
        .toBe(0);
      // Verify the physical atmosphere fits inside the real rendering viewport.
      // This does not infer clipping from a stretched wrapper or a CSS mask.
      const atmosphereRatio = await host.evaluate((element) => {
        const scene = JSON.parse((element as HTMLElement).dataset.scene!);
        const distance = Math.hypot(...scene.camera);
        return (
          1.026 /
          (Math.sqrt(distance ** 2 - 1.026 ** 2) *
            Math.tan((scene.fov * Math.PI) / 360) *
            Math.min(1, scene.viewport.width / scene.viewport.height))
        );
      });
      expect(atmosphereRatio).toBeLessThanOrEqual(0.98);
    } else {
      // Status-only views retain their compact layout and have no sky/viewport.
      expect(Math.abs(map.top - geometry.heading.top)).toBeLessThanOrEqual(8);
    }
  } else {
    expect(geometry.map).toBeNull();
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
