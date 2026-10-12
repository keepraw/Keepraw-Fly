import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { importArchive } from "./helpers/responsive";

async function open(page: Page) {
  await page.emulateMedia({
    reducedMotion: "reduce",
    colorScheme: "light",
  });
  await page.setViewportSize({ width: 390, height: 900 });
  await importArchive(page);
  await page
    .getByRole("button", { name: "Open UA123, SFO to LAX", exact: true })
    .click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(".detail-globe-frame .globe-host")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 25000 },
  );
}

async function capture(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await info.attach(name, { path, contentType: "image/png" });
}

test(
  "Detail space fades independently and desktop controls follow hover, keyboard and reduced motion",
  { tag: "@cross-browser" },
  async ({ page }, info) => {
    test.setTimeout(90_000);
    await open(page);
    const frame = page.locator(".detail-globe-frame");
    const sky = page.locator(".detail-hero-grid > .detail-hero-space");
    const space = sky.locator(".detail-globe-space");
    const controls = frame.locator(".globe-controls");
    const buttons = controls.getByRole("button");
    expect(
      await page.evaluate(
        () => matchMedia("(hover: hover) and (pointer: fine)").matches,
      ),
    ).toBe(true);
    for (const selector of [
      ".detail-globe-frame",
      ".detail-globe-frame .globe-stage",
      ".detail-globe-frame canvas",
      ".detail-globe-frame .globe-labels",
      ".detail-globe-frame .globe-controls",
    ]) {
      await expect(page.locator(selector)).toHaveCSS("mask-image", "none");
    }
    // B.8 blends the local Light sky horizontally; the old radial perimeter
    // would reintroduce the rejected oval halo. Foreground masks stay forbidden.
    await expect(space).toHaveCSS("mask-image", /^linear-gradient\(to right/);
    await expect(space).not.toHaveCSS("mask-image", /radial-gradient/);
    await expect(space).toHaveCSS("pointer-events", "none");
    await expect(frame).toHaveCSS("border-top-width", "0px");
    await expect(frame).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(frame.locator(".globe-stage")).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    await expect(frame.locator("canvas")).toHaveCSS("opacity", "1");
    await page.mouse.move(0, 0);
    await expect(controls).toHaveCSS("opacity", "0");
    await expect(controls).toHaveCSS("pointer-events", "none");
    const firstBounds = (await buttons.first().boundingBox())!;
    expect(
      await page.evaluate(
        ({ x, y }) =>
          document.elementFromPoint(x, y)?.closest(".globe-controls") !== null,
        {
          x: firstBounds.x + firstBounds.width / 2,
          y: firstBounds.y + firstBounds.height / 2,
        },
      ),
    ).toBe(false);
    await capture(page, info, "detail-controls-default");

    // The sky is a Hero sibling and extends beyond the canvas toward the page
    // edge. Its *outer* perimeter, not the canvas corners, must meet the page.
    const bounds = await sky.boundingBox();
    const foreground = (await frame.boundingBox())!;
    const infoBounds = (await page
      .locator(".detail-hero-information")
      .boundingBox())!;
    const heroBounds = (await page.locator(".detail-hero-grid").boundingBox())!;
    const shelf = (await page.locator(".detail-metadata-shelf").boundingBox())!;
    expect(bounds!.x).toBeGreaterThanOrEqual(
      infoBounds.x + infoBounds.width - 1,
    );
    expect(bounds!.y).toBeLessThan(foreground.y);
    expect(bounds!.y).toBeCloseTo(heroBounds.y, 0);
    expect(bounds!.y + bounds!.height).toBeCloseTo(
      heroBounds.y + heroBounds.height,
      0,
    );
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(shelf.y + 1);
    expect(bounds!.x + bounds!.width).toBeCloseTo(1440, 0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBe(0);
    const png = await sky.screenshot();
    const pageColor = await page
      .locator(".app-shell")
      .evaluate((e) => getComputedStyle(e).backgroundColor);
    const pageInk = await page
      .locator(".app-shell")
      .evaluate((e) => getComputedStyle(e).color);
    await expect(page.locator(".detail-hero-information")).toHaveCSS(
      "color",
      pageInk,
    );
    const corners = await page.evaluate(
      async (url) => {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext("2d")!;
        context.drawImage(image, 0, 0);
        return [
          [0, 0],
          [image.width - 1, 0],
          [0, image.height - 1],
          [image.width - 1, image.height - 1],
        ].map(([x, y]) => {
          const [r, g, b] = context.getImageData(x!, y!, 1, 1).data;
          return `rgb(${r}, ${g}, ${b})`;
        });
      },
      `data:image/png;base64,${png.toString("base64")}`,
    );
    expect(corners).toEqual([pageColor, pageColor, pageColor, pageColor]);
    // A visible, deep navy environment must exist outside the WebGL viewport;
    // otherwise making every corner transparent could just remove the universe.
    const exterior = await page.screenshot({
      clip: {
        x: foreground.x + foreground.width + 20,
        y: foreground.y + foreground.height / 2,
        width: 8,
        height: 8,
      },
    });
    const exteriorColor = await page.evaluate(
      async (url) => {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 8;
        const context = canvas.getContext("2d")!;
        context.drawImage(image, 0, 0);
        return Array.from(context.getImageData(4, 4, 1, 1).data).slice(0, 3);
      },
      `data:image/png;base64,${exterior.toString("base64")}`,
    );
    expect(exteriorColor[2]).toBeGreaterThan(exteriorColor[0]! + 10);
    // The exterior point sits ~80px inside the sky's right edge, where the
    // Light gradient nominates roughly rgb(36, 67, 99) (Chromium measures
    // max 99). Firefox/WebKit interpolate/composite the same gradient and
    // star SVG a few units brighter (max ~102), so gate deep navy with
    // headroom that still rejects the mid-gradient (~150) and page canvas
    // (~250) if the universe were removed.
    expect(Math.max(...exteriorColor)).toBeLessThan(115);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(controls).toHaveCSS("transition-duration", "0.18s");
    await frame.hover({ position: { x: 12, y: 12 } });
    await expect(controls).toHaveCSS("opacity", "1");
    await expect(controls).toHaveCSS("pointer-events", "auto");
    await capture(page, info, "detail-controls-hover");
    await page.mouse.move(0, 0);
    await expect(controls).toHaveCSS("opacity", "0");

    await frame.locator("canvas").focus();
    for (let n = 0; n < 8; n++) {
      await page.keyboard.press("Tab");
      if (await buttons.first().evaluate((e) => e === document.activeElement))
        break;
    }
    await expect(buttons.first()).toBeFocused();
    await expect(buttons.first()).toHaveCSS("outline-style", "solid");
    await expect(controls).toHaveCSS("opacity", "1");
    await capture(page, info, "detail-controls-keyboard-focus");
    const distance = () =>
      frame
        .locator(".globe-host")
        .evaluate((e) =>
          Math.hypot(...JSON.parse((e as HTMLElement).dataset.scene!).camera),
        );
    const initial = await distance();
    await page.keyboard.press("Enter");
    await expect.poll(distance).toBeCloseTo(initial / 1.15, 6);
    await page.keyboard.press("Tab");
    await expect(buttons.nth(1)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect.poll(distance).toBeCloseTo(initial, 6);
    await page.keyboard.press("Tab");
    await expect(buttons.nth(2)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect
      .poll(() =>
        frame
          .locator(".globe-host")
          .evaluate(
            (e) => JSON.parse((e as HTMLElement).dataset.scene!).atHome,
          ),
      )
      .toBe(true);
    await page.emulateMedia({ reducedMotion: "reduce" });
    // The shared reduced-motion policy uses an !important 0.01ms duration.
    await expect
      .poll(() =>
        controls.evaluate((e) =>
          Number.parseFloat(getComputedStyle(e).transitionDuration),
        ),
      )
      .toBeLessThanOrEqual(0.00001);
    await page.locator(".detail-header-back").focus();
    await expect(controls).toHaveCSS("opacity", "0");
    // Native scrollbar gutters reduce the content width without changing 100vw.
    // The extended sky must not create a second, horizontal scrollbar.
    await page.addStyleTag({ content: ":root { scrollbar-gutter: stable; }" });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
    for (const label of await frame.locator(".globe-airport-label").all()) {
      const bounds = (await label.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(
        await page.evaluate(() => document.documentElement.clientWidth),
      );
    }
  },
);

test.describe("Detail touch controls", () => {
  test.use({ hasTouch: true });
  test(
    "no-hover devices retain discoverable, working controls",
    { tag: "@cross-browser" },
    async ({ page }, info) => {
      test.setTimeout(60_000);
      await open(page);
      expect(
        await page.evaluate(() => matchMedia("(hover: none)").matches),
      ).toBe(true);
      const frame = page.locator(".detail-globe-frame");
      const controls = frame.locator(".globe-controls");
      await expect(controls).toHaveCSS("opacity", "1");
      await expect(controls).toHaveCSS("pointer-events", "auto");
      await capture(page, info, "detail-controls-touch");
      const distance = () =>
        frame
          .locator(".globe-host")
          .evaluate((e) =>
            Math.hypot(...JSON.parse((e as HTMLElement).dataset.scene!).camera),
          );
      const initial = await distance();
      await controls
        .getByRole("button", { name: "Zoom in", exact: true })
        .tap();
      await expect.poll(distance).toBeCloseTo(initial / 1.15, 6);
      await controls
        .getByRole("button", { name: "Zoom out", exact: true })
        .tap();
      await expect.poll(distance).toBeCloseTo(initial, 6);
      await controls
        .getByRole("button", { name: "Fit recorded routes", exact: true })
        .tap();
      await expect
        .poll(() =>
          frame
            .locator(".globe-host")
            .evaluate(
              (e) => JSON.parse((e as HTMLElement).dataset.scene!).atHome,
            ),
        )
        .toBe(true);
    },
  );
});
