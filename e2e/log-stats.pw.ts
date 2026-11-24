import { expect, test, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { disablePassportWebGL } from "./helpers/passport-svg";

test.beforeEach(async ({ page }) => disablePassportWebGL(page));

// Log filters and order, the Stats regions and the flight's place in the
// archive (docs/views-and-skins.md, phase 2).

const regions = [
  "totals",
  "byYear",
  "months",
  "airports",
  "airlines",
  "aircraft",
  "cabins",
  "records",
];

async function openDemo(page: Page, fragment = "") {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await expect(page.locator(".passport-layout")).toBeVisible();
  if (fragment) await page.goto(`/${fragment}`);
}

async function setLanguage(page: Page, language: string) {
  await page.goto("/#/settings");
  await page.locator(".settings-fields select").first().selectOption(language);
  await expect(page.locator("html")).toHaveAttribute("lang", language);
}

const fitsWidth = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );

/** Every control is at least as wide as its longest choice needs. */
const showWholeChoices = (controls: Locator) =>
  controls.evaluateAll((selects) =>
    selects.every((select) => {
      const copy = select.cloneNode(true) as HTMLElement;
      copy.style.cssText = "position:absolute;width:auto;max-width:none";
      select.after(copy);
      const needed = copy.getBoundingClientRect().width;
      copy.remove();
      return select.getBoundingClientRect().width >= needed - 0.5;
    }),
  );

const rows = (page: Page) => page.locator(".flight-row");
const flightNumbers = (page: Page) =>
  page.locator(".flight-row .flight-number strong").allTextContents();

test.describe("desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("Log filters and order narrow the list and live in the address", async ({
    page,
  }) => {
    await openDemo(page, "#/log");
    await expect(rows(page)).toHaveCount(24);
    const airline = page.getByRole("combobox", { name: "Airline" });
    const aircraft = page.getByRole("combobox", { name: "Aircraft type" });
    const order = page.getByRole("combobox", { name: "Sort order" });
    // The filters are always in view here; only Compact folds them away.
    await expect(page.locator(".log-filters-toggle")).toBeHidden();
    await expect(airline.locator("option")).toHaveCount(17);
    await expect(aircraft.locator("option")).toHaveCount(13);
    const entries = await page.evaluate(() => history.length);

    await airline.selectOption("UA");
    await expect(rows(page)).toHaveCount(3);
    await expect(page).toHaveURL(/#\/log\?airline=UA$/);
    await expect(page.locator(".passport-core-stat").nth(1)).toHaveText(
      "3Flights",
    );
    await expect(
      page.locator('.passport-exploration[data-filter="airline"]'),
    ).toContainText("Airline · United Airlines · UA");
    // The other filter lists what the first one leaves; its own list is whole.
    await expect(airline.locator("option")).toHaveCount(17);
    await expect(aircraft.locator("option")).toHaveText([
      "All aircraft types",
      "B739 (1)",
      "B772 (1)",
    ]);

    expect(await flightNumbers(page)).toEqual(["UA123", "UA2402", "UA857"]);
    await order.selectOption("longest");
    await expect(page).toHaveURL(/#\/log\?airline=UA&sort=longest$/);
    expect(await flightNumbers(page)).toEqual(["UA857", "UA2402", "UA123"]);
    await expect(page.locator(".year-heading h1")).toHaveText(
      "Longest distance first",
    );
    await order.selectOption("oldest");
    expect(await flightNumbers(page)).toEqual(["UA857", "UA2402", "UA123"]);
    await expect(page.locator(".year-heading :is(h1, h2)")).toHaveText([
      "2025",
      "2026",
    ]);
    await order.selectOption("shortest");
    expect(await flightNumbers(page)).toEqual(["UA123", "UA2402", "UA857"]);

    // Search text never reaches the address.
    await page.locator("#passport-flight-search").fill("JFK");
    await expect(rows(page)).toHaveCount(1);
    await expect(page).toHaveURL(/#\/log\?airline=UA&sort=shortest$/);
    await page.locator("#passport-flight-search").fill("");
    // Filtering replaces the entry instead of filling the history.
    expect(await page.evaluate(() => history.length)).toBe(entries);

    await page.reload();
    await expect(rows(page)).toHaveCount(3);
    await expect(airline).toHaveValue("UA");
    await expect(order).toHaveValue("shortest");

    // The filter follows into Stats, and the year joins it in the address.
    await page.locator('.site-navigation a[href="#/stats"]').click();
    await expect(page).toHaveURL(/#\/stats\?airline=UA&sort=shortest$/);
    await expect(page.locator('.stats-rank[data-key="UA"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      page.locator('.passport-exploration[data-filter="airline"]'),
    ).toBeVisible();
    await page.getByRole("button", { name: "2026", exact: true }).click();
    await expect(page).toHaveURL(
      /#\/stats\?year=2026&airline=UA&sort=shortest$/,
    );
    await expect(page.locator(".stats-years tbody tr")).toHaveCount(1);

    // Back returns to the Log entry and the state its address names.
    await page.goBack();
    await expect(page).toHaveURL(/#\/log\?airline=UA&sort=shortest$/);
    await expect(
      page.getByRole("button", { name: "All", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(rows(page)).toHaveCount(3);

    await aircraft.selectOption("B772");
    await expect(rows(page)).toHaveCount(1);
    await expect(page.locator(".passport-exploration")).toHaveCount(2);
    await page.getByRole("button", { name: "Remove filter: B772" }).click();
    await page
      .getByRole("button", { name: "Remove filter: United Airlines · UA" })
      .click();
    await expect(page.locator(".passport-exploration")).toHaveCount(0);
    await order.selectOption("newest");
    await expect(page).toHaveURL(/#\/log$/);
    await expect(rows(page)).toHaveCount(24);
  });

  test("an address restores its filters and ignores malformed values", async ({
    page,
  }) => {
    await openDemo(page, "#/log?year=2026&aircraft=B789&sort=oldest");
    await expect(rows(page)).toHaveCount(2);
    await expect(
      page.getByRole("button", { name: "2026", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("combobox", { name: "Aircraft type" }),
    ).toHaveValue("B789");

    await page.goto("/#/stats?airport=SFO");
    await expect(page.locator('.stats-rank[data-key="SFO"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator(".passport-core-stat").nth(1)).toHaveText(
      "9Flights",
    );
    await page.goto("/#/map?route=LAX-SYD");
    await expect(rows(page)).toHaveCount(1);
    await expect(page.locator(".passport-exploration")).toContainText(
      "LAX → SYD",
    );

    // A year without flights and unknown values fall back to everything.
    await page.goto("/#/log?year=1999&airline=%3Cb%3E&sort=random");
    await expect(page).toHaveURL(/#\/log$/);
    await expect(rows(page)).toHaveCount(24);

    // A filter that matches nothing stays visible and removable.
    await page.goto("/#/log?airline=ZZ");
    await expect(rows(page)).toHaveCount(0);
    await expect(page.locator(".no-results")).toContainText(
      "No flights match the current filters.",
    );
    await page.locator(".passport-exploration-close").click();
    await expect(rows(page)).toHaveCount(24);
  });

  test("a map selection focuses the first flight of the chosen order", async ({
    page,
  }) => {
    await openDemo(page, "#/log");
    await page
      .getByRole("combobox", { name: "Sort order" })
      .selectOption("oldest");
    await page.locator('.site-navigation a[href="#/map"]').click();
    await expect(page).toHaveURL(/#\/map\?sort=oldest$/);
    // Other arcs cross this one, so activate it directly.
    await page
      .locator(".map-route")
      .filter({ hasText: "HND to SFO" })
      .dispatchEvent("click");
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).first()).toHaveAttribute("aria-current", "true");
  });

  test("a reloaded Flight keeps the previous and next of the list it came from", async ({
    page,
  }) => {
    await openDemo(page, "#/log?airline=UA&sort=longest");
    expect(await flightNumbers(page)).toEqual(["UA857", "UA2402", "UA123"]);
    await rows(page).nth(1).click();
    await expect(page.locator(".detail-page")).toBeVisible();
    await page.reload();
    await expect(page.locator(".detail-page")).toContainText("UA2402");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator(".detail-page")).toContainText("UA123");
    await expect(
      page.getByRole("button", { name: "Next", exact: true }),
    ).toBeDisabled();
    await page.goBack();
    await expect(page).toHaveURL(/#\/log\?airline=UA&sort=longest$/);
    await expect(rows(page)).toHaveCount(3);
  });

  test("Forward restores an unfiltered entry and a bare address keeps the filters", async ({
    page,
  }) => {
    await openDemo(page, "#/log?airline=UA");
    await page.locator('.site-navigation a[href="#/stats"]').click();
    await expect(page).toHaveURL(/#\/stats\?airline=UA$/);
    await page
      .getByRole("button", { name: "Remove filter: United Airlines · UA" })
      .click();
    await expect(page).toHaveURL(/#\/stats$/);

    await page.goBack();
    await expect(page).toHaveURL(/#\/log\?airline=UA$/);
    await expect(rows(page)).toHaveCount(3);
    // The Stats entry was left unfiltered, so Forward clears the filter again.
    await page.goForward();
    await expect(page).toHaveURL(/#\/stats$/);
    await expect(page.locator(".passport-exploration")).toHaveCount(0);

    // A typed address without a query is a move between views.
    await page.goBack();
    await expect(rows(page)).toHaveCount(3);
    await page.evaluate(() => {
      window.location.hash = "#/map";
    });
    await expect(page).toHaveURL(/#\/map\?airline=UA$/);
    await expect(rows(page)).toHaveCount(3);
  });

  test("Log rows carry duration, distance, aircraft, seat and a late arrival", async ({
    page,
  }) => {
    await openDemo(page, "#/log");
    const detail = page.locator(
      '.flight-record[data-flight-id="demo-2026-ua123"] .flight-row-detail',
    );
    await expect(detail.locator("[data-fact]")).toHaveText([
      "Duration 1h 24m",
      "Distance 338 mi",
      "Aircraft B739",
      "Seat 12A",
    ]);
    await expect(detail.locator(".flight-deviation.is-late")).toHaveText(
      "Arrival delayed 29 min",
    );
    // Map lists the same row.
    await page.goto("/#/map");
    await expect(detail.locator("[data-fact]")).toHaveCount(4);
  });

  test("Stats lists every region and its entries filter the shared state", async ({
    page,
  }) => {
    await openDemo(page, "#/stats");
    await expect(page.locator(".stats-panel")).toHaveCount(regions.length);
    expect(
      await page
        .locator(".stats-panel")
        .evaluateAll((panels) =>
          panels.map((panel) => panel.getAttribute("data-region")),
        ),
    ).toEqual(regions);
    await expect(page.locator(".stats-years tbody th")).toHaveText([
      "2026",
      "2025",
      "2024",
    ]);
    await expect(page.locator(".stats-months li")).toHaveCount(12);
    expect(
      await page
        .locator(".stats-months li")
        .evaluateAll((items) =>
          items.reduce(
            (sum, item) => sum + Number(item.getAttribute("data-count")),
            0,
          ),
        ),
    ).toBe(24);

    // A long ranking opens in place.
    const airlines = page.locator('.stats-panel[data-region="airlines"]');
    await expect(airlines.locator(".stats-rank")).toHaveCount(6);
    await airlines.getByRole("button", { name: "Show all 16" }).click();
    await expect(airlines.locator(".stats-rank")).toHaveCount(16);
    await airlines.getByRole("button", { name: "Show fewer" }).click();
    await expect(airlines.locator(".stats-rank")).toHaveCount(6);

    const aircraft = page.locator('.stats-rank[data-key="A388"]');
    await aircraft.click();
    await expect(aircraft).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/#\/stats\?aircraft=A388$/);
    await expect(page.locator(".passport-core-stat").nth(1)).toHaveText(
      "3Flights",
    );
    await page.locator('.site-navigation a[href="#/log"]').click();
    await expect(rows(page)).toHaveCount(3);
    await expect(
      page.getByRole("combobox", { name: "Aircraft type" }),
    ).toHaveValue("A388");
    await page.locator('.site-navigation a[href="#/stats"]').click();
    await aircraft.click();
    await expect(aircraft).toHaveAttribute("aria-pressed", "false");
    await expect(page).toHaveURL(/#\/stats$/);

    const route = page.locator('.stats-record[data-record="route"]');
    await expect(route).toContainText("flights");
    await route.click();
    await expect(route).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/#\/stats\?route=[A-Z]{3}-[A-Z]{3}&from=/);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });

  test("a flight shows its place among the visits and on its route", async ({
    page,
  }) => {
    await openDemo(page, "#/flight/demo-2026-ua123");
    const context = page.locator(".detail-context");
    await expect(context.getByRole("heading", { level: 2 })).toHaveText(
      "In this archive",
    );
    await expect(context.locator("dt")).toHaveText(["SFO", "LAX", "SFO → LAX"]);
    await expect(context.locator("dd")).toHaveText([
      /^Visit \d+ of 9$/,
      /^Visit \d+ of 5$/,
      /^Flight \d+ of \d+$/,
    ]);
  });
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 640 },
]) {
  test.describe(`Compact ${viewport.width}`, () => {
    test.use({ viewport, hasTouch: true });

    for (const language of ["en-US", "zh-CN", "de-DE"]) {
      test(`Log and Stats keep one inventory, 44 px targets and the width in ${language}`, async ({
        page,
      }) => {
        await openDemo(page);
        await setLanguage(page, language);
        await page.goto("/#/log");
        await expect(rows(page)).toHaveCount(24);
        const filters = page.locator(".log-filters select");
        await expect(filters).toHaveCount(3);
        // The filters cost one row until their control opens them.
        const toggle = page.locator(".log-filters-toggle");
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await expect(filters.first()).toBeHidden();
        expect((await toggle.boundingBox())?.height).toBeGreaterThanOrEqual(44);
        await toggle.click();
        await expect(toggle).toHaveAttribute("aria-expanded", "true");
        await expect(filters.first()).toBeVisible();
        expect(
          await filters.evaluateAll((controls) =>
            controls.map((control) => control.getBoundingClientRect().height),
          ),
        ).toEqual([44, 44, 44]);
        expect(await fitsWidth(page)).toBe(true);
        expect(await showWholeChoices(filters)).toBe(true);
        // The totals stay inside their card, whatever the unit words' length.
        expect(
          await page.locator(".passport-mobile-summary").evaluate((card) => {
            const bounds = card.getBoundingClientRect();
            const values = [
              ...card.querySelectorAll(".passport-mobile-journey strong"),
            ].map((value) => value.getBoundingClientRect());
            return (
              values.every(
                (box) =>
                  box.left >= bounds.left && box.right <= bounds.right + 0.5,
              ) &&
              (values[0].right <= values[1].left ||
                values[0].bottom <= values[1].top)
            );
          }),
        ).toBe(true);
        await expect(
          page
            .locator(".flight-record")
            .first()
            .locator(".flight-row-detail [data-fact]"),
        ).toHaveCount(4);

        await filters.nth(0).selectOption("UA");
        await filters.nth(2).selectOption("longest");
        await expect(rows(page)).toHaveCount(3);
        await expect(page).toHaveURL(/#\/log\?airline=UA&sort=longest$/);
        expect(await fitsWidth(page)).toBe(true);
        expect(await showWholeChoices(filters)).toBe(true);
        const remove = page.locator(".passport-exploration-close");
        expect((await remove.boundingBox())?.height).toBeGreaterThanOrEqual(44);
        await remove.click();
        await expect(rows(page)).toHaveCount(24);

        await page.locator('.primary-tab-bar a[href="#/stats"]').click();
        await expect(page.locator(".stats-panel")).toHaveCount(regions.length);
        expect(
          await page
            .locator(".stats-panel")
            .evaluateAll((panels) =>
              panels.map((panel) => panel.getAttribute("data-region")),
            ),
        ).toEqual(regions);
        expect(await fitsWidth(page)).toBe(true);
        expect(
          await page
            .locator("button.stats-rank, button.stats-more")
            .evaluateAll((controls) =>
              controls.every(
                (control) => control.getBoundingClientRect().height >= 44,
              ),
            ),
        ).toBe(true);
        // Nothing in a panel is cut off or pushed past its edge.
        expect(
          await page.locator(".stats-panel").evaluateAll((panels) =>
            panels.every((panel) => {
              const bounds = panel.getBoundingClientRect();
              return [...panel.querySelectorAll("*")].every((element) => {
                if (element.closest(".sr-only")) return true;
                const box = element.getBoundingClientRect();
                return (
                  !box.width ||
                  (box.left >= bounds.left - 0.5 &&
                    box.right <= bounds.right + 0.5)
                );
              });
            }),
          ),
        ).toBe(true);
        const rank = page.locator('.stats-rank[data-key="MU"]');
        await rank.click();
        await expect(rank).toHaveAttribute("aria-pressed", "true");
        await expect(
          page.locator('.passport-exploration[data-filter="airline"]'),
        ).toBeVisible();
        await page.locator('.primary-tab-bar a[href="#/log"]').click();
        await expect(rows(page)).toHaveCount(3);
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
      });
    }
  });
}

test.describe("Compact first screen", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  for (const language of ["en-US", "zh-CN", "de-DE", "fr-FR"]) {
    test(`Log shows a flight above the tab bar in ${language}`, async ({
      page,
    }) => {
      await openDemo(page);
      await setLanguage(page, language);
      await page.goto("/#/log");
      await expect(page.locator(".log-filters-toggle")).toBeVisible();
      const bar = await page.locator(".primary-tab-bar").boundingBox();
      const first = await page
        .locator(".flight-row .flight-route-cities")
        .first()
        .boundingBox();
      expect(first!.y + first!.height).toBeLessThanOrEqual(bar!.y);
    });
  }
});
