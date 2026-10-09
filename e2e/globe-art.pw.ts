import { expect, test } from "@playwright/test";

test("art direction changes local light without reinitializing the globe @cross-browser", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [],
    textures: string[] = [],
    external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("request", (r) => {
    if (/\/(earth|night)-(2048|4096)\.webp/.test(r.url()))
      textures.push(r.url());
    if (/^https?:/.test(r.url()) && new URL(r.url()).hostname !== "127.0.0.1")
      external.push(r.url());
  });
  await page.goto("/globe-lab");
  const host = page.locator(".globe-host"),
    canvas = page.locator(".globe-webgl");
  await expect(host).toHaveAttribute("data-ready", "true");
  const read = async () => ({
    scene: JSON.parse((await host.getAttribute("data-scene"))!),
    lighting: JSON.parse((await host.getAttribute("data-lighting"))!),
  });
  const direction = page.getByRole("combobox", {
    name: "Art Direction",
    exact: true,
  });
  await expect(direction).toHaveValue("A");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect.poll(async () => (await read()).lighting.theme).toBe("dark");
  const original = await read(),
    loaded = textures.length;
  // Retain the actual DOM/context identity, rather than only checking a count.
  await canvas.evaluate((el) => {
    (window as unknown as { reviewCanvas: Element }).reviewCanvas = el;
  });
  const a = (await canvas.screenshot()).toString("base64");
  await direction.selectOption("B");
  await expect.poll(async () => (await read()).lighting.artDirection).toBe("B");
  const b = (await canvas.screenshot()).toString("base64");
  const changed = await page.evaluate(
    async ({ a, b }) => {
      const images = await Promise.all(
        [a, b].map(async (data) => {
          const image = new Image();
          image.src = `data:image/png;base64,${data}`;
          await image.decode();
          const target = document.createElement("canvas");
          target.width = image.width;
          target.height = image.height;
          const ctx = target.getContext("2d")!;
          ctx.drawImage(image, 0, 0);
          return ctx.getImageData(0, 0, target.width, target.height).data;
        }),
      );
      let changed = 0;
      for (let i = 0; i < images[0]!.length; i += 4) {
        if (
          Math.max(
            ...[0, 1, 2].map((c) =>
              Math.abs(images[0]![i + c]! - images[1]![i + c]!),
            ),
          ) > 2
        )
          changed++;
      }
      return { changed, total: images[0]!.length / 4 };
    },
    { a, b },
  );
  expect(changed.changed).toBeGreaterThan(500);
  expect(changed.changed).toBeLessThan(changed.total * 0.35);
  expect((await read()).scene).toEqual(original.scene);
  expect((await read()).lighting.sunDirection).toEqual(
    original.lighting.sunDirection,
  );
  expect((await read()).lighting.exposure).toBe(original.lighting.exposure);
  expect((await read()).lighting.nightIntensity).toBe(
    original.lighting.nightIntensity,
  );
  await page
    .getByRole("combobox", { name: "Route", exact: true })
    .selectOption("PEK-PVG");
  await expect(
    page.locator(".globe-airport-label.is-selected:visible"),
  ).toHaveCount(2);
  const selected = (await read()).scene;
  for (const theme of ["Light", "Dark"]) {
    await page.getByRole("button", { name: theme, exact: true }).click();
    for (const option of ["A", "B"]) {
      await direction.selectOption(option);
      await expect
        .poll(async () => (await read()).lighting.artDirection)
        .toBe(option);
      expect((await read()).scene).toEqual(selected);
      expect((await read()).lighting.sunDirection).toEqual(
        original.lighting.sunDirection,
      );
      await expect(
        page.locator(".globe-airport-label.is-selected:visible"),
      ).toHaveCount(2);
    }
  }
  expect(
    await canvas.evaluate(
      (el) =>
        (window as unknown as { reviewCanvas: Element }).reviewCanvas === el,
    ),
  ).toBe(true);
  expect(textures).toHaveLength(loaded);
  await page.mouse.move(0, 0);
  // Drain pending invalidations, then assert that no animation runs at rest.
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const frames = await host.evaluate(
    (el) =>
      (el as HTMLDivElement & { globeMetrics: { frames: number } }).globeMetrics
        .frames,
  );
  await page.waitForTimeout(300);
  expect(
    await host.evaluate(
      (el) =>
        (el as HTMLDivElement & { globeMetrics: { frames: number } })
          .globeMetrics.frames,
    ),
  ).toBe(frames);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
