import { expect, test, type Page } from "@playwright/test";
import { globeMode, exerciseSvgFallback } from "./helpers/globe-capability";
import {
  FIXED_SUN_DIRECTION,
  solarDirectionFromUtc,
} from "../apps/web/src/globe/globe-solar";

async function ready(page: Page) {
  await expect(page.locator(".globe-host")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 25000 },
  );
}

async function sun(page: Page): Promise<number[]> {
  const lighting = JSON.parse(
    (await page.locator(".globe-host").getAttribute("data-lighting"))!,
  );
  return lighting.sunDirection as number[];
}

function closeTo(actual: number[], expected: readonly number[], digits = 4) {
  expect(actual).toHaveLength(3);
  actual.forEach((value, index) =>
    expect(value).toBeCloseTo(expected[index]!, digits),
  );
}

async function expectSunCloseTo(
  page: Page,
  expected: readonly number[],
  digits = 3,
) {
  await expect
    .poll(async () => {
      const actual = await sun(page);
      const distance = Math.hypot(
        actual[0]! - expected[0]!,
        actual[1]! - expected[1]!,
        actual[2]! - expected[2]!,
      );
      return distance < Math.pow(10, -digits) * 4;
    })
    .toBe(true);
}

test("solar Fixed baseline stays stable across filtering, camera and themes", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/globe-lab");
  if ((await globeMode(page)) === "svg") {
    await expect(
      page.getByRole("radio", { name: "Fixed", exact: true }),
    ).toBeChecked();
    await exerciseSvgFallback(page);
    expect(errors).toEqual([]);
    return;
  }
  await ready(page);
  await expect(
    page.getByRole("radio", { name: "Fixed", exact: true }),
  ).toBeChecked();
  closeTo(await sun(page), FIXED_SUN_DIRECTION, 6);
  const host = page.locator(".globe-host");
  const cameraBefore = await host.getAttribute("data-camera");

  await page.getByRole("button", { name: "2026", exact: true }).click();
  await ready(page);
  closeTo(await sun(page), FIXED_SUN_DIRECTION, 6);

  await page.locator(".globe-webgl").focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => host.getAttribute("data-camera"))
    .not.toBe(cameraBefore);
  closeTo(await sun(page), FIXED_SUN_DIRECTION, 6);

  const cameraAfterMove = await host.getAttribute("data-camera");
  await page.getByRole("button", { name: "Light", exact: true }).click();
  expect(await host.getAttribute("data-camera")).toBe(cameraAfterMove);
  closeTo(await sun(page), FIXED_SUN_DIRECTION, 6);
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  expect(await host.getAttribute("data-camera")).toBe(cameraAfterMove);
  closeTo(await sun(page), FIXED_SUN_DIRECTION, 6);
  expect(errors).toEqual([]);
});

test("solar Real-time follows the UTC clock and shares geography across themes", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/globe-lab");
  if ((await globeMode(page)) === "svg") {
    await page.getByRole("radio", { name: "Real-time", exact: true }).check();
    await exerciseSvgFallback(page);
    expect(errors).toEqual([]);
    return;
  }
  await ready(page);
  await page.clock.install({ time: new Date("2026-06-21T12:00:00.000Z") });
  await page.getByRole("radio", { name: "Real-time", exact: true }).check();
  await expect
    .poll(
      async () =>
        await page.locator(".globe-stage").getAttribute("data-solar-mode"),
    )
    .toBe("realtime");
  const june = solarDirectionFromUtc(new Date("2026-06-21T12:00:00.000Z"));
  await expectSunCloseTo(page, june, 3);

  const camera = await page.locator(".globe-host").getAttribute("data-camera");
  await page.getByRole("button", { name: "Light", exact: true }).click();
  expect(await page.locator(".globe-host").getAttribute("data-camera")).toBe(
    camera,
  );
  await expectSunCloseTo(page, june, 3);
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expectSunCloseTo(page, june, 3);

  await page.clock.setFixedTime(new Date("2026-12-21T12:00:00.000Z"));
  await page.getByRole("radio", { name: "Fixed", exact: true }).check();
  await expectSunCloseTo(page, FIXED_SUN_DIRECTION, 5);
  await page.getByRole("radio", { name: "Real-time", exact: true }).check();
  const december = solarDirectionFromUtc(new Date("2026-12-21T12:00:00.000Z"));
  await expectSunCloseTo(page, december, 3);
  expect(errors).toEqual([]);
});

test("switching solar modes preserves renderer, camera and selection", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/globe-lab");
  if ((await globeMode(page)) === "svg") {
    await exerciseSvgFallback(page);
    expect(errors).toEqual([]);
    return;
  }
  await ready(page);
  await page
    .getByRole("combobox", { name: "Airport", exact: true })
    .selectOption("SFO");
  await expect(
    page.locator(".globe-airport-label.is-selected:visible"),
  ).toHaveText("SFO");
  await page.evaluate(() => {
    (window as unknown as { __globeCanvas?: Element | null }).__globeCanvas =
      document.querySelector(".globe-webgl");
  });
  const camera = await page.locator(".globe-host").getAttribute("data-camera");
  const fixed = await sun(page);

  await page.getByRole("radio", { name: "Real-time", exact: true }).check();
  await expect.poll(async () => await sun(page)).not.toEqual(fixed);
  expect(
    await page.evaluate(
      () =>
        document.querySelector(".globe-webgl") ===
        (window as unknown as { __globeCanvas?: Element | null }).__globeCanvas,
    ),
  ).toBe(true);
  expect(await page.locator(".globe-host").getAttribute("data-camera")).toBe(
    camera,
  );
  await expect(
    page.getByRole("combobox", { name: "Airport", exact: true }),
  ).toHaveValue("SFO");

  await page.getByRole("radio", { name: "Fixed", exact: true }).check();
  await expect.poll(async () => await sun(page)).toEqual(fixed);
  expect(
    await page.evaluate(
      () =>
        document.querySelector(".globe-webgl") ===
        (window as unknown as { __globeCanvas?: Element | null }).__globeCanvas,
    ),
  ).toBe(true);
  expect(await page.locator(".globe-host").getAttribute("data-camera")).toBe(
    camera,
  );
  await expect(
    page.getByRole("combobox", { name: "Airport", exact: true }),
  ).toHaveValue("SFO");
  expect(errors).toEqual([]);
});

test("real-time minute updates stay on demand without leaking render work", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/globe-lab");
  if ((await globeMode(page)) === "svg") {
    await exerciseSvgFallback(page);
    expect(errors).toEqual([]);
    return;
  }
  await ready(page);
  const frames = async () =>
    (
      (await page
        .locator(".globe-host")
        .evaluate(
          (el) =>
            (el as HTMLElement & { globeMetrics: { frames: number } })
              .globeMetrics,
        )) as { frames: number }
    ).frames;
  await page.getByRole("radio", { name: "Real-time", exact: true }).check();
  await page.waitForTimeout(400);
  const idleA = await frames();
  await page.waitForTimeout(400);
  expect(await frames()).toBe(idleA);
  await page.getByRole("radio", { name: "Fixed", exact: true }).check();
  await page.waitForTimeout(300);
  const fixedA = await frames();
  await page.waitForTimeout(400);
  expect(await frames()).toBe(fixedA);
  expect(errors).toEqual([]);
});

async function setPageHidden(page: Page, hidden: boolean) {
  await page.evaluate((value) => {
    Object.defineProperty(document, "hidden", {
      value,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
}

test("real-time timer suspends while hidden and resumes on visibility", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/globe-lab");
  if ((await globeMode(page)) === "svg") {
    await expect(
      page.getByRole("radio", { name: "Fixed", exact: true }),
    ).toBeChecked();
    await page.getByRole("radio", { name: "Real-time", exact: true }).check();
    await exerciseSvgFallback(page);
    expect(errors).toEqual([]);
    return;
  }
  await ready(page);
  // No minute timer exists in Fixed, so installing the mock clock here is safe.
  await page.clock.install({ time: new Date("2026-06-21T11:59:30.000Z") });
  await page.getByRole("radio", { name: "Real-time", exact: true }).check();
  await expect
    .poll(() => page.locator(".globe-stage").getAttribute("data-solar-mode"))
    .toBe("realtime");
  const camera = await page.locator(".globe-host").getAttribute("data-camera");
  const mockedNow = async () => new Date(await page.evaluate(() => Date.now()));
  await expectSunCloseTo(
    page,
    solarDirectionFromUtc(new Date("2026-06-21T11:59:30.000Z")),
    2,
  );

  // First minute transition while visible.
  await page.clock.runFor(45_000);
  const afterFirst = await sun(page);
  await expectSunCloseTo(page, solarDirectionFromUtc(await mockedNow()), 2);
  expect(
    Math.hypot(
      afterFirst[0]! -
        solarDirectionFromUtc(new Date("2026-06-21T11:59:30.000Z"))[0]!,
      afterFirst[1]! -
        solarDirectionFromUtc(new Date("2026-06-21T11:59:30.000Z"))[1]!,
      afterFirst[2]! -
        solarDirectionFromUtc(new Date("2026-06-21T11:59:30.000Z"))[2]!,
    ),
  ).toBeGreaterThan(0.002);

  // Second minute transition while visible.
  await page.clock.runFor(70_000);
  const afterSecond = await sun(page);
  await expectSunCloseTo(page, solarDirectionFromUtc(await mockedNow()), 2);
  expect(afterSecond).not.toEqual(afterFirst);

  // Hide across a minute boundary: no update may fire while hidden.
  await setPageHidden(page, true);
  const hiddenSun = await sun(page);
  await page.clock.runFor(75_000);
  expect(await sun(page)).toEqual(hiddenSun);

  // Restore visibility: one resync, then the minute cadence resumes.
  await setPageHidden(page, false);
  await expectSunCloseTo(page, solarDirectionFromUtc(await mockedNow()), 2);
  expect(await sun(page)).not.toEqual(hiddenSun);
  await page.clock.runFor(70_000);
  await expectSunCloseTo(page, solarDirectionFromUtc(await mockedNow()), 2);

  // Back to Fixed: the minute timer is cancelled.
  await page.getByRole("radio", { name: "Fixed", exact: true }).check();
  await expectSunCloseTo(page, FIXED_SUN_DIRECTION, 5);
  await page.clock.runFor(130_000);
  closeTo(await sun(page), FIXED_SUN_DIRECTION, 5);

  expect(await page.locator(".globe-host").getAttribute("data-camera")).toBe(
    camera,
  );
  expect(errors).toEqual([]);
});
