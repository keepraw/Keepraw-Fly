import { expect, test, type Page } from "@playwright/test";

// Decide from a real independent context, never from a browser name or app error.
// A shader/texture/application failure on a capable browser must still fail ready.
export async function globeMode(page: Page): Promise<"webgl" | "svg"> {
  const capability = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    let reason = "WebGL2 context unavailable";
    canvas.addEventListener("webglcontextcreationerror", (event) => {
      reason = (event as WebGLContextEvent).statusMessage || reason;
    });
    const gl = canvas.getContext("webgl2", {
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
    if (!gl) return { usable: false, reason };
    gl.clearColor(0.25, 0.5, 0.75, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const pixel = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    const error = gl.getError();
    const version = gl.getParameter(gl.VERSION) as string;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return { usable: true, pixel: Array.from(pixel), error, version };
  });
  await test.info().attach("WebGL2 capability", {
    body: JSON.stringify(capability, null, 2),
    contentType: "application/json",
  });
  if (capability.usable) {
    expect(capability.error).toBe(0);
    expect(capability.pixel![1]).toBeGreaterThanOrEqual(127);
    expect(capability.pixel![1]).toBeLessThanOrEqual(128);
    await expect(page.locator(".globe-host")).toHaveAttribute(
      "data-ready",
      "true",
      { timeout: 25000 },
    );
    await expect(page.locator(".globe-fallback")).toHaveCount(0);
    return "webgl";
  }
  await expectUnavailableGlobe(page);
  test.info().annotations.push({
    type: "render-mode",
    description: `Functional SVG fallback: ${capability.reason}`,
  });
  console.info(
    `[Globe capability] ${test.info().title}: functional SVG fallback (${capability.reason})`,
  );
  return "svg";
}

export async function expectUnavailableGlobe(page: Page) {
  await expect(page.locator(".globe-fallback svg[role=group]")).toBeVisible();
  await expect(page.locator(".globe-host")).toBeHidden();
  await expect
    .poll(
      async () =>
        JSON.parse(
          (await page.locator(".globe-stage").getAttribute("data-error")) ||
            "null",
        )?.kind,
    )
    .toBe("webgl2-unavailable");
  const failure = JSON.parse(
    (await page.locator(".globe-stage").getAttribute("data-error"))!,
  );
  expect(failure.message.length).toBeGreaterThan(0);
  await expect(page.locator(".globe-host")).not.toHaveAttribute(
    "data-ready",
    "true",
  );
}

export async function exerciseSvgFallback(page: Page) {
  await test.step("Functional SVG selection, keyboard activation and explicit unavailable retry", async () => {
    const map = page.locator(".globe-fallback");
    const route = map
      .locator(".map-route[role=button]")
      .filter({ has: page.locator("title", { hasText: "SFO to LAX" }) })
      .first();
    await route.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("combobox", { name: "Route", exact: true }),
    ).toHaveValue("SFO-LAX");
    await expect(route).toHaveAttribute("aria-pressed", "true");
    const airport = map
      .locator(".map-airport[role=button]")
      .filter({ has: page.locator("title", { hasText: /^LAX/ }) });
    await airport.focus();
    await page.keyboard.press("Space");
    await expect(
      page.getByRole("combobox", { name: "Airport", exact: true }),
    ).toHaveValue("LAX");
    await expect(airport).toHaveAttribute("aria-pressed", "true");
    // Pointer selection uses the real SVG hit geometry; keyboard selection above
    // also works when the current regional crop does not show a distant airport.
    await page
      .getByRole("combobox", { name: "Airport", exact: true })
      .selectOption("SFO");
    await airport.locator(".map-airport-point").click();
    await expect(airport).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("combobox", { name: "Airport", exact: true }),
    ).toHaveValue("LAX");
    const attempt = Number(
      await page.locator(".globe-stage").getAttribute("data-attempt"),
    );
    const retried = page.waitForEvent("console", {
      predicate: (message) =>
        message.type() === "warning" &&
        message.text().startsWith("[Globe Lab] Rendering fallback"),
    });
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await retried;
    await expect(page.locator(".globe-stage")).toHaveAttribute(
      "data-attempt",
      String(attempt + 1),
    );
    await expectUnavailableGlobe(page);
    await expect(
      page.getByRole("combobox", { name: "Airport", exact: true }),
    ).toHaveValue("LAX");
    await expect(
      map.locator(".map-airport[aria-pressed=true] title"),
    ).toHaveText(/^LAX/);
  });
}
