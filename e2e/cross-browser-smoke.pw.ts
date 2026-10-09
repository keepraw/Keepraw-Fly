import { expect, test } from "@playwright/test";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  collectBrowserErrors,
  expectDetailLayout,
  expectHealthyPage,
  expectPassportLayout,
  expectReachable,
  expectSeparateBoxes,
  expectSettingsLayout,
  expectShell,
  expectUnclipped,
  importArchive,
  navigateTo,
} from "./helpers/responsive";

function routeFlight(
  index: number,
  origin: string,
  destination: string,
): KeeprawFlight {
  return {
    id: `smoke-${index}`,
    flightNumber: `CX${100 + index}`,
    serviceDate: "2026-09-22",
    airline: { iata: "CX" },
    origin: { iata: origin },
    destination: { iata: destination },
    scheduledDeparture: "2026-09-22T02:00:00Z",
    scheduledArrival: "2026-09-22T12:00:00Z",
  };
}

// Bounded engine checks, also run by Chromium. Business/error/locale matrices
// belong in the untagged full regression tests, not in this smoke suite.
test.describe("Cross-browser engine smoke", { tag: "@cross-browser" }, () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  // Check both sides of the CSS/media-query breakpoint and the short desktop
  // scrollports. Test themes at representative sizes, not a Cartesian product.
  for (const viewport of [
    { width: 760, height: 900, theme: "light" },
    { width: 761, height: 900, theme: "light" },
    { width: 844, height: 390, theme: "dark" },
  ]) {
    test(`boundary layout and scrolling at ${viewport.width}x${viewport.height} in ${viewport.theme}`, async ({
      page,
    }) => {
      const errors = collectBrowserErrors(page);
      const mobile = viewport.width <= 760;
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await importArchive(page);
      await navigateTo(page, "settings");
      await expectSettingsLayout(page, mobile);
      await page
        .getByRole("combobox", { name: "Appearance", exact: true })
        .selectOption(viewport.theme);
      await expect(page.locator("html")).toHaveCSS(
        "color-scheme",
        viewport.theme,
      );
      await expect(page.locator("body")).toHaveCSS(
        "background-color",
        viewport.theme === "dark" ? "rgb(9, 11, 14)" : "rgb(250, 249, 246)",
      );
      await expectHealthyPage(page, errors);
      await navigateTo(page, "passport");
      await expectShell(page, mobile, "passport");
      await expectPassportLayout(page, mobile);

      // Sample the first and last rows, not every row at every viewport.
      for (const row of [
        page.locator(".flight-row").first(),
        page.locator(".flight-row").last(),
      ]) {
        await expectReachable(row);
        await expectUnclipped(row.locator(".flight-date"));
        await expectSeparateBoxes(
          row.locator(".flight-date"),
          row.locator(mobile ? ".flight-time-column" : ".flight-route-cities"),
        );
      }
      if (!mobile) {
        // The date occupies its own column in the desktop ledger.
        await expect(page.locator(".flight-date").last()).toHaveCSS(
          "grid-column-start",
          "3",
        );
        expect(
          await page
            .locator(".passport-archive-scroll")
            .evaluate((element) => element.scrollLeft),
        ).toBe(0);
        const legend = page.locator(".passport-map-frequency-legend");
        await legend.scrollIntoViewIfNeeded();
        await expectUnclipped(legend);
        await expectSeparateBoxes(
          legend,
          page.locator(".route-map .map-zoom-controls"),
        );
      }
      await expectHealthyPage(page, errors);
      const row = page.locator(".flight-row").last();
      await row.click();
      await expectDetailLayout(page, mobile);
      await expectReachable(
        page.locator(".detail-stop--arrival .detail-airport-time"),
      );
      await expectHealthyPage(page, errors);
      await page.locator(".detail-header-back").click();
      await expect(row).toBeInViewport({ ratio: 0.99 });
      await expect(
        page.locator(".flight-row.is-selected, .flight-row[aria-current]"),
      ).toHaveCount(0);
      await expectHealthyPage(page, errors);
    });
  }

  test("short landscape editor saves a new flight with keyboard focus and usable confirmation controls", async ({
    page,
  }) => {
    const errors = collectBrowserErrors(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await importArchive(page);
    const add = page.getByRole("button", { name: "Add flight", exact: true });
    await add.focus();
    await add.press("Enter");
    const editor = page.getByRole("dialog", {
      name: "Add a flight",
      exact: true,
    });
    await editor.getByLabel("Flight number").fill("UA999");
    const origin = editor.getByRole("combobox", {
      name: "Origin",
      exact: true,
    });
    await origin.fill("SFO");
    await expect(
      editor.getByRole("option", { name: /SFO/ }).first(),
    ).toBeVisible();
    await origin.press("Enter");
    await expect(origin).toHaveAttribute("aria-expanded", "false");
    await editor
      .getByRole("combobox", { name: "Destination", exact: true })
      .fill("LAX");
    // Expanding optional content exercises the short-height modal scrollport.
    await editor.locator(".editor-optional summary").click();
    const save = editor.getByRole("button", {
      name: "Save flight",
      exact: true,
    });
    await expectReachable(save);
    await save.focus();
    await page.keyboard.press("Tab");
    await expect(editor.locator(".editor-close")).toBeFocused();
    await save.click();
    await expect(editor).toHaveCount(0);
    await expect(page.locator(".detail-heading-eyebrow")).toContainText(
      "UA999",
    );
    await expect(page.locator(".persistence-status")).toHaveText("");
    // WebKit does not focus buttons on mouse click; test the keyboard contract.
    const editButton = page.getByRole("button", {
      name: "Edit flight",
      exact: true,
    });
    await editButton.focus();
    await editButton.press("Enter");
    const edit = page.getByRole("dialog", { name: "Edit flight", exact: true });
    const remove = edit.getByRole("button", {
      name: "Delete flight",
      exact: true,
    });
    await remove.focus();
    await remove.press("Enter");
    const confirmation = page.getByRole("alertdialog", {
      name: "Delete flight",
      exact: true,
    });
    await expect(
      confirmation.getByRole("button", { name: "Cancel", exact: true }),
    ).toBeFocused();
    await expectReachable(
      confirmation.getByRole("button", { name: "Delete flight", exact: true }),
    );
    await page.keyboard.press("Escape");
    await expect(confirmation).toHaveCount(0);
    await expect(remove).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(edit).toHaveCount(0);
    await expect(editButton).toBeFocused();
    await expectHealthyPage(page, errors);
    await page.reload();
    await expect(
      page.getByRole("button", { name: /Open UA999/ }),
    ).toBeVisible();
    await expect(page.locator(".storage-warning")).toHaveCount(0);
  });

  test("Passport SVG renders offline and responds to wheel zoom and pointer panning", async ({
    page,
    context,
  }) => {
    const errors = collectBrowserErrors(page);
    await page.setViewportSize({ width: 761, height: 900 });
    await importArchive(page, [
      routeFlight(0, "HKG", "BOM"),
      ...Array.from({ length: 8 }, (_, index) =>
        routeFlight(index + 1, "SZX", "TAO"),
      ),
    ]);
    const canvas = page.locator(".route-map-canvas");
    const svg = canvas.locator(":scope > svg");
    const line = page
      .locator(".map-route")
      .filter({ hasText: "HKG to BOM" })
      .locator(".map-route-line");
    await expect(line).toBeVisible();
    const stroke = await line.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        width: parseFloat(style.strokeWidth),
        color: style.stroke,
        opacity: Number(style.opacity),
        vectorEffect: style.vectorEffect,
        length: (element as SVGPathElement).getTotalLength(),
      };
    });
    expect(stroke.width).toBeGreaterThan(0);
    expect(stroke.opacity).toBeGreaterThan(0);
    expect(stroke.vectorEffect).toBe("non-scaling-stroke");
    expect(stroke.length).toBeGreaterThan(0);
    const frequent = await page
      .locator(".map-route")
      .filter({ hasText: "SZX to TAO" })
      .locator(".map-route-line")
      .evaluate((element) => ({
        width: parseFloat(getComputedStyle(element).strokeWidth),
        color: getComputedStyle(element).stroke,
      }));
    expect(frequent.width).toBeGreaterThan(stroke.width);
    expect(frequent.color).not.toBe(stroke.color);
    // No navigations while offline: only the already loaded local SVG is tested.
    await context.setOffline(true);
    await svg.hover();
    const initialZoom = await canvas.getAttribute("data-zoom");
    const zoom = Number(initialZoom);
    await page.mouse.wheel(0, -180);
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-zoom")))
      .toBeGreaterThan(zoom);
    const camera = canvas.locator(".map-viewport-content");
    const before = await camera.getAttribute("transform");
    const bounds = await svg.boundingBox();
    expect(bounds).not.toBeNull();
    await page.mouse.move(
      bounds!.x + bounds!.width * 0.55,
      bounds!.y + bounds!.height * 0.55,
    );
    await page.mouse.down();
    await page.mouse.move(
      bounds!.x + bounds!.width * 0.4,
      bounds!.y + bounds!.height * 0.45,
      { steps: 4 },
    );
    await page.mouse.up();
    await expect(camera).not.toHaveAttribute("transform", before!);
    await page
      .getByRole("button", { name: "Fit recorded routes", exact: true })
      .click();
    await expect(canvas).toHaveAttribute("data-zoom", initialZoom!);
    await expect(line).toBeVisible();
    await expectHealthyPage(page, errors);
  });

  test("balanced international detail title keeps Latin words whole at the mobile boundary", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 760, height: 900 });
    await importArchive(page, [routeFlight(0, "KUL", "BWN")]);
    // One long English title checks text-wrap/range geometry, without repeating
    // every airport pair and locale from the full typography acceptance matrix.
    const row = page.getByRole("button", { name: /Open .*KUL to BWN/ });
    await page.getByRole("searchbox").focus();
    await page.keyboard.press("Tab");
    await expect(row).toBeFocused();
    await expect
      .poll(() => row.evaluate((element) => element.matches(":focus-visible")))
      .toBe(true);
    await row.press("Enter");
    const title = page.locator("#flight-detail-title");
    await expect(title).toBeVisible();
    await expect(title).toHaveCSS("text-wrap", "balance");
    const layout = await title.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const words: { lines: number; fits: boolean }[] = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        for (const match of node.textContent!.matchAll(/[A-Za-z]+/g)) {
          const range = document.createRange();
          range.setStart(node, match.index!);
          range.setEnd(node, match.index! + match[0].length);
          const rects = Array.from(range.getClientRects());
          words.push({
            lines: new Set(rects.map((rect) => Math.round(rect.top))).size,
            fits: rects.every(
              (rect) =>
                rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1,
            ),
          });
        }
      }
      return { words, fits: element.scrollWidth <= element.clientWidth };
    });
    expect(layout.fits).toBe(true);
    expect(layout.words.length).toBeGreaterThan(0);
    expect(layout.words.every((word) => word.lines === 1 && word.fits)).toBe(
      true,
    );
  });
});
