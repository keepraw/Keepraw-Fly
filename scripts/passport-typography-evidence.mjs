/** Geometry in the right scrollport, including text and clipping ancestors. */
export async function passportTypographyBounds(page) {
  return page.evaluate(() => {
    const visual = document.querySelector(".passport-visual");
    const box = (e) => {
      const r = e.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        right: r.right,
        bottom: r.bottom,
      };
    };
    const viewport = box(visual);
    const selectors = [
      ".passport-scope",
      ".route-map",
      ".passport-core-stats",
      ".passport-highlights",
      ".passport-longest-flight",
    ];
    const components = Object.fromEntries(
      selectors.map((s) => [s, box(document.querySelector(s))]),
    );
    const failures = [];
    const nodes = [
      ...document.querySelectorAll(
        ".passport-core-stat, .passport-highlights *",
      ),
    ].filter((e) => !e.closest(".sr-only"));
    for (const e of nodes) {
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.left < viewport.x - 1 || r.right > viewport.right + 1)
        failures.push(`horizontal:${e.className}`);
      if (
        e.childNodes.length === 1 &&
        e.firstChild.nodeType === Node.TEXT_NODE
      ) {
        const range = document.createRange();
        range.selectNodeContents(e);
        for (const t of range.getClientRects())
          if (
            t.left < r.left - 1 ||
            t.right > r.right + 1 ||
            t.bottom > r.bottom + 1
          )
            failures.push(`text:${e.className}:${e.textContent}`);
      }
      for (
        let parent = e.parentElement;
        parent && parent !== visual;
        parent = parent.parentElement
      ) {
        const style = getComputedStyle(parent),
          p = parent.getBoundingClientRect();
        if (
          ["hidden", "clip"].includes(style.overflowY) &&
          (r.top < p.top - 1 || r.bottom > p.bottom + 1)
        )
          failures.push(`vertical-clip:${e.className}`);
      }
    }
    const controls = [
      ...document.querySelectorAll(".route-map .map-zoom-controls button"),
    ].map(box);
    const canvas = box(document.querySelector(".route-map-canvas"));
    const controlsContained = controls.every(
      (r) =>
        r.x >= canvas.x - 1 &&
        r.right <= canvas.right + 1 &&
        r.y >= canvas.y - 1 &&
        r.bottom <= canvas.bottom + 1,
    );
    const archive = document.querySelector(".passport-archive-scroll");
    const highlights = document.querySelector(".passport-highlights");
    const previous = visual.scrollTop;
    visual.scrollTop = visual.scrollHeight;
    const reachableBottom =
      highlights.getBoundingClientRect().bottom <=
      visual.getBoundingClientRect().bottom + 1;
    visual.scrollTop = previous;
    return {
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
      documentFits:
        document.documentElement.scrollWidth <= innerWidth + 1 &&
        document.documentElement.scrollHeight <= innerHeight + 1,
      right: viewport,
      components,
      failures,
      controlsContained,
      singleScreen:
        components[".passport-highlights"].bottom <= viewport.bottom + 1 &&
        visual.scrollHeight <= visual.clientHeight + 1,
      rightScroll: {
        clientHeight: visual.clientHeight,
        scrollHeight: visual.scrollHeight,
        overflowY: getComputedStyle(visual).overflowY,
        required: visual.scrollHeight > visual.clientHeight + 1,
        reachableBottom,
      },
      bottomSafety: innerHeight - viewport.bottom,
      archiveScroll: {
        clientHeight: archive.clientHeight,
        scrollHeight: archive.scrollHeight,
        overflowY: getComputedStyle(archive).overflowY,
      },
      longestHasMap: Boolean(
        document.querySelector(
          ".passport-longest-flight svg, .passport-longest-flight canvas, .passport-longest-flight img",
        ),
      ),
      kpis: [...document.querySelectorAll(".passport-core-stat")].map((e) => ({
        text: e.textContent,
        ...box(e),
      })),
      routePaths: [...document.querySelectorAll(".map-route")].map((e) => ({
        route: e.getAttribute("aria-label"),
        path: e.querySelector("path")?.getAttribute("d") ?? e.getAttribute("d"),
      })),
    };
  });
}

export async function waitForTypography(page, language) {
  if (language !== "en") {
    await page.waitForFunction(
      (locale) =>
        [
          ...document.querySelectorAll(
            `link[data-chinese-webfont^="${locale}"]`,
          ),
        ].length === 3 &&
        [
          ...document.querySelectorAll(
            `link[data-chinese-webfont^="${locale}"]`,
          ),
        ].every((l) => l.dataset.fontStatus === "loaded"),
      language,
    );
    await page.evaluate(async (locale) => {
      const family = locale === "zh-TW" ? "MiSans TC" : "MiSans";
      const sample =
        locale === "zh-TW"
          ? "飛行護照 飛過的世界 深圳青島 香港孟買 35小時51分"
          : "飞行护照 飞过的世界 深圳青岛 香港孟买 35小时51分";
      await Promise.all(
        [400, 500, 600].map((weight) =>
          document.fonts.load(`${weight} 16px "${family}"`, sample),
        ),
      );
    }, language);
  }
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
  await page.waitForFunction(
    () =>
      Math.abs(
        parseFloat(
          getComputedStyle(document.querySelector(".app-shell")).height,
        ) - innerHeight,
      ) < 1,
  );
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    );
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
}
