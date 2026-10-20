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
  if (width >= 1200) await expect(map_).toBeVisible();
  else await expect(map_).toHaveCount(0);
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
    const host = page.locator(".detail-globe-frame .globe-host:not([hidden])");
    if (await host.count()) {
      await expect(host).toHaveAttribute("data-ready", "true", {
        timeout: 25000,
      });
      // Content-led Hero: no viewport-driven padding or row height. The title
      // starts at the Hero's natural top; the Globe is its own square frame
      // with 16px breathing room, capped at 560px, and the Hero is exactly as
      // tall as the taller of the two columns.
      expect(geometry.heroPaddingTop).toBe(0);
      expect(geometry.heroPaddingBottom).toBe(0);
      expect(geometry.information.top).toBeCloseTo(geometry.hero.top, 0);
      expect(geometry.heading.top).toBeCloseTo(geometry.hero.top, 0);
      expect(map.top).toBeCloseTo(geometry.hero.top + 16, 0);
      expect(map.height).toBeCloseTo(Math.min(map.width, 560), 0);
      expect(geometry.hero.height).toBeCloseTo(
        Math.max(geometry.information.height, map.height + 32),
        0,
      );
      expect(geometry.stops.bottom).toBeLessThanOrEqual(
        geometry.information.bottom + 1,
      );
      expect(skyBounds.height).toBeLessThanOrEqual(560 + 96 + 1);
      const viewport = (await host.boundingBox())!;
      expect(viewport.width).toBeCloseTo(map.width, 0);
      expect(viewport.height).toBeCloseTo(map.height, 0);
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
      // Status-only views keep their own natural height: no square slot, no
      // breathing margins and no sky.
      expect(Math.abs(map.top - geometry.heading.top)).toBeLessThanOrEqual(8);
      await expect(map_).toHaveCSS("aspect-ratio", "auto");
      await expect(map_).toHaveCSS("margin-top", "0px");
      const content = await map_.evaluate((element) => {
        const child = element.querySelector<HTMLElement>(
          ".detail-globe-message, .globe-fallback",
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
