import { expect, test, type Page } from "@playwright/test";
import { disablePassportWebGL } from "./helpers/passport-svg";

test.beforeEach(async ({ page }) => disablePassportWebGL(page));

// Views, addressable Flight and primary navigation (docs/views-and-skins.md).

const primaryViews = ["map", "log", "stats", "passport"] as const;
const flightId = "demo-2026-ua123";

async function openDemo(page: Page, fragment = "") {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await expect(page.locator(".passport-layout")).toBeVisible();
  if (fragment) await page.goto(`/${fragment}`);
}

function layout(page: Page) {
  return page.locator(".passport-layout");
}

test.describe("desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("each primary view has its own address and composition", async ({
    page,
  }) => {
    await openDemo(page);
    // Map is the landing view until skins choose their own.
    await expect(page).toHaveURL(/#\/map$/);
    const navigation = page.locator(".site-navigation");
    for (const view of primaryViews) {
      await navigation.locator(`a[href="#/${view}"]`).click();
      await expect(page).toHaveURL(new RegExp(`#/${view}$`));
      await expect(layout(page)).toHaveAttribute("data-view", view);
      await expect(
        navigation.locator('a[aria-current="page"]'),
      ).toHaveAttribute("href", `#/${view}`);
      // Add flight stays reachable from every primary view.
      await expect(page.locator(".site-header-add")).toBeVisible();
    }
    await page.goto("/#/log");
    await expect(page.locator(".flight-row").first()).toBeVisible();
    await expect(page.locator(".route-map")).toHaveCount(0);
    await page.goto("/#/stats");
    await expect(page.locator(".passport-highlights")).toBeVisible();
    await expect(page.locator(".flight-row")).toHaveCount(0);
    await page.goto("/#/passport");
    await expect(page.locator(".route-map")).toBeVisible();
    await expect(page.locator(".passport-share-button")).toBeVisible();
    await page.goto("/#/map");
    await expect(page.locator(".route-map")).toBeVisible();
    await expect(page.locator(".flight-row").first()).toBeVisible();

    await page.locator(".site-header-add").click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("a flight keeps its address across a reload and Back returns to the view it was opened from", async ({
    page,
  }) => {
    await openDemo(page, "#/log");
    await page.locator(`[data-flight-id="${flightId}"] .flight-row`).click();
    await expect(page).toHaveURL(new RegExp(`#/flight/${flightId}$`));
    await expect(page.locator(".detail-page")).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(new RegExp(`#/flight/${flightId}$`));
    await expect(page.locator(".detail-page")).toBeVisible();

    // Previous/next replace the entry, so one Back still leaves the detail.
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page).not.toHaveURL(new RegExp(`#/flight/${flightId}$`));
    await expect(page).toHaveURL(/#\/flight\//);

    await page.goBack();
    await expect(page).toHaveURL(/#\/log$/);
    await expect(layout(page)).toHaveAttribute("data-view", "log");

    await page.goForward();
    await expect(page).toHaveURL(/#\/flight\//);
    await expect(page.locator(".detail-page")).toBeVisible();
    await page.locator(".detail-header-back").click();
    await expect(page).toHaveURL(/#\/log$/);
    await expect(layout(page)).toHaveAttribute("data-view", "log");
  });

  test("Skip to content keeps the view's address, so Back still leaves a flight", async ({
    page,
  }) => {
    await openDemo(page, "#/log");
    await page.locator(".skip-link").focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#\/log$/);
    await expect(layout(page)).toHaveAttribute("data-view", "log");

    await page.locator(`[data-flight-id="${flightId}"] .flight-row`).click();
    await expect(page.locator(".detail-page")).toBeVisible();
    await page.locator(".detail-header-back").click();
    await expect(page).toHaveURL(/#\/log$/);
    await expect(layout(page)).toHaveAttribute("data-view", "log");

    // The anchor entry made inside a flight has no origin to go back to.
    await page.locator(`[data-flight-id="${flightId}"] .flight-row`).click();
    await expect(page.locator(".detail-page")).toBeVisible();
    await page.locator(".skip-link").focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`#/flight/${flightId}$`));
    await page.locator(".detail-header-back").click();
    await expect(layout(page)).toHaveAttribute("data-view", "log");
  });

  test("a flight opened by address returns to a primary view", async ({
    page,
  }) => {
    await openDemo(page);
    await page.goto(`/#/flight/${flightId}`);
    await page.reload();
    await expect(page.locator(".detail-page")).toBeVisible();
    await page.locator(".detail-header-back").click();
    await expect(layout(page)).toBeVisible();
    await expect(page).toHaveURL(/#\/(map|log|stats|passport)$/);
  });

  test("an unknown flight opens Log with a notice instead of a blank page", async ({
    page,
  }) => {
    await openDemo(page);
    // Once from a running application, once as a cold start.
    const cold = await page.context().newPage();
    await page.goto("/#/flight/not-a-real-flight");
    await cold.goto("/#/flight/not-a-real-flight");
    for (const tab of [page, cold]) {
      await expect(tab).toHaveURL(/#\/log$/);
      await expect(layout(tab)).toHaveAttribute("data-view", "log");
      const notice = tab.getByText("That flight is not in this archive.");
      await expect(notice).toBeVisible();
      await tab.getByRole("button", { name: "Dismiss", exact: true }).click();
      await expect(notice).toHaveCount(0);
      await expect(tab.locator(".flight-row").first()).toBeVisible();
    }
  });

  test("legacy addresses keep working", async ({ page }) => {
    await openDemo(page);
    for (const legacy of ["passport", "flights", "share"]) {
      await page.goto(`/#${legacy}`);
      await expect(page).toHaveURL(/#\/map$/);
      await expect(layout(page)).toHaveAttribute("data-view", "map");
    }
    await page.goto("/#settings");
    await expect(page).toHaveURL(/#\/settings$/);
    await expect(page.locator(".settings-page")).toBeVisible();
  });

  test("Settings categories are addressable", async ({ page }) => {
    await openDemo(page);
    await page.goto("/#/settings/data");
    await page.reload();
    await expect(page).toHaveURL(/#\/settings\/data$/);
    await expect(page.locator(".settings-page")).toBeVisible();
    await expect(page.locator('input[type="file"]').first()).toBeAttached();
  });
});

for (const width of [390, 320]) {
  test.describe(`compact ${width}px`, () => {
    test.use({
      viewport: { width, height: width === 390 ? 844 : 640 },
      hasTouch: true,
    });

    test("an addressed Settings category is scrolled into view", async ({
      page,
    }) => {
      await openDemo(page);
      await page.goto("/#/settings/data");
      const section = page.locator("#settings-category-data");
      await expect(section).toBeInViewport();
      await expect
        .poll(async () => (await section.boundingBox())?.y ?? Infinity)
        .toBeLessThan(120);
      await page.reload();
      await expect(section).toBeInViewport();

      // The section's enter animation must not offset where it lands.
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.reload();
      await expect(section).toBeInViewport();
      // Read the offset once the animations and the smooth scroll have settled.
      const settledOffset = () =>
        page.evaluate(async () => {
          const before = window.scrollY;
          await new Promise((done) => setTimeout(done, 150));
          const settled =
            window.scrollY === before &&
            document
              .getAnimations()
              .every((animation) => animation.playState === "finished");
          const top = document
            .querySelector("#settings-category-data")
            ?.getBoundingClientRect().top;
          return settled && top !== undefined ? Math.abs(top) : null;
        });
      await expect.poll(settledOffset).not.toBeNull();
      expect(await settledOffset()).toBeLessThan(2);
      await page.emulateMedia({ reducedMotion: "reduce" });

      // Plain Settings stays at the top, with its Back control on screen.
      await page.goto("/#/settings");
      await expect(page.locator("#settings-category-general")).toBeVisible();
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      await expect(page.locator(".mobile-page-back")).toBeInViewport();
    });

    test("the tab bar and Add flight stay on screen in every primary view", async ({
      page,
    }) => {
      await openDemo(page);
      const tabs = page.locator(".primary-tab-bar");
      await expect(page.locator(".site-navigation")).toBeHidden();
      for (const view of primaryViews) {
        await tabs.locator(`a[href="#/${view}"]`).click();
        await expect(page).toHaveURL(new RegExp(`#/${view}$`));
        await expect(layout(page)).toHaveAttribute("data-view", view);
        await expect(tabs.locator('a[aria-current="page"]')).toHaveAttribute(
          "href",
          `#/${view}`,
        );
        await expect(tabs).toBeInViewport({ ratio: 1 });
        await expect(tabs.locator(".primary-tab-add")).toBeInViewport({
          ratio: 1,
        });
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth -
              document.documentElement.clientWidth,
          ),
        ).toBe(0);
        // Every control in the view is at least 44 px in both directions.
        const small = await page.evaluate(() =>
          [
            ...document.querySelectorAll<HTMLElement>(
              "button, a[href], select, summary, input:not([type=file])",
            ),
          ]
            .filter((element) => {
              if (element.closest("svg")) return false;
              const box = element.getBoundingClientRect();
              if (!box.width || !box.height) return false;
              if (!element.checkVisibility({ visibilityProperty: true }))
                return false;
              return box.width < 43.5 || box.height < 43.5;
            })
            .map(
              (element) =>
                `${element.tagName}.${element.className} ${element.getBoundingClientRect().width}x${element.getBoundingClientRect().height}`,
            ),
        );
        expect(small).toEqual([]);
      }

      // The last flight is not hidden behind the fixed bar.
      await tabs.locator('a[href="#/log"]').click();
      const lastRow = page.locator(".flight-row").last();
      await lastRow.scrollIntoViewIfNeeded();
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight),
      );
      const [rowBox, barBox] = await Promise.all([
        lastRow.boundingBox(),
        tabs.boundingBox(),
      ]);
      expect(rowBox!.y + rowBox!.height).toBeLessThanOrEqual(barBox!.y + 0.5);

      await tabs.locator(".primary-tab-add").click();
      await expect(page.getByRole("dialog")).toBeVisible();
    });

    // The first-screen budget is defined at 390 x 844; CI rejects skipped tests.
    if (width === 390)
      test("Log shows a flight on the first screen", async ({ page }) => {
        await openDemo(page, "#/log");
        await expect(page.locator(".flight-row").first()).toBeInViewport({
          ratio: 1,
        });
      });

    test("flight detail controls are at least 44 px and Back returns to Log", async ({
      page,
    }) => {
      await openDemo(page, "#/log");
      await page.locator(`[data-flight-id="${flightId}"] .flight-row`).click();
      await expect(page).toHaveURL(new RegExp(`#/flight/${flightId}$`));
      await expect(page.locator(".primary-tab-bar")).toBeHidden();
      for (const control of [
        page.locator(".detail-header-back"),
        page.locator(".detail-header-more summary"),
        page.locator(".detail-header-action").last(),
      ]) {
        const box = await control.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(43.5);
        expect(box!.width).toBeGreaterThanOrEqual(43.5);
      }
      await page.goBack();
      await expect(page).toHaveURL(/#\/log$/);
      await expect(layout(page)).toHaveAttribute("data-view", "log");
    });
  });
}
