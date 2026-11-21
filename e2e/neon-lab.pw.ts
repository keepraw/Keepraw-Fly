import { expect, test } from "@playwright/test";

test("Neon Aviation lab renders its samples and interactive SVG states", async ({
  page,
}) => {
  await page.goto("/neon-lab?sample=all&density=sparse&state=normal");
  await expect(page.locator('[data-neon-samples-ready="true"]')).toBeVisible();
  await expect(page.locator("[data-neon-world-ready='true']")).toBeVisible();
  await expect(page.locator("[data-neon-detail-ready='true']")).toBeVisible();
  await expect(page.locator("[data-neon-passport-ready='true']")).toBeVisible();

  expect(await page.locator(".neon-aviation svg filter").count()).toBe(0);
  const route = page.locator(".neon-route[role=button]").first();
  const hoverPoint = await route
    .locator(".neon-route-hit")
    .evaluate((element: SVGPathElement) => {
      const midpoint = element.getPointAtLength(element.getTotalLength() / 2);
      const matrix = element.getScreenCTM();
      if (!matrix) throw new Error("Route path has no screen transform.");
      const point = new DOMPoint(midpoint.x, midpoint.y).matrixTransform(
        matrix,
      );
      return { x: point.x, y: point.y };
    });
  await page.mouse.move(hoverPoint.x, hoverPoint.y);
  await expect(route).toHaveAttribute("data-state", "hover");
  await expect(route).toHaveClass(/is-hovered/);
  await page.mouse.click(hoverPoint.x, hoverPoint.y);
  await expect(route).toHaveAttribute("data-state", "selected");
  await expect(route).toHaveClass(/is-selected/);

  const canvas = page.locator(".neon-passport-canvas");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  const canvasInfo = await canvas.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext("2d");
    if (!context) throw new Error("Canvas context did not initialize.");
    const first = [...context.getImageData(2, 2, 1, 1).data];
    const center = [...context.getImageData(540, 675, 1, 1).data];
    return {
      width: element.width,
      height: element.height,
      dpr: window.devicePixelRatio,
      first,
      center,
    };
  });
  expect(canvasInfo.width).toBe(1080 * canvasInfo.dpr);
  expect(canvasInfo.height).toBe(1350 * canvasInfo.dpr);
  expect(canvasInfo.first).not.toEqual(canvasInfo.center);
});

test("Neon Aviation lab fits mobile and disables motion when requested", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/neon-lab?sample=all&density=dense");
  await expect(page.locator('[data-neon-samples-ready="true"]')).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);

  const motion = await page
    .locator(".neon-route-line, .neon-airport-point, .neon-route-switch button")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element);
        return {
          transition: style.transitionDuration,
          animation: style.animationName,
        };
      }),
    );
  expect(motion.length).toBeGreaterThan(0);
  expect(
    motion.every(
      ({ transition, animation }) =>
        transition.split(",").every((duration) => duration.trim() === "0s") &&
        animation.split(",").every((name) => name.trim() === "none"),
    ),
  ).toBe(true);
});
