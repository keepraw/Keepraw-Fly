import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";

/**
 * Share Rendering Foundation (stage 3A): real WebGL → PNG export checks.
 * Every assertion decodes the exported PNG Blob itself (signature, IHDR,
 * createImageBitmap, pixels). There is no Share Studio UI; the modules are
 * imported straight from the dev server.
 */

const fixture = new URL(
  "./fixtures/detail-content-hero.keepraw-fly.json",
  import.meta.url,
);

interface ExportArgs {
  artboard: "4:5" | "9:16";
  privacy?: "overview" | "routes";
  airportLabels?: boolean;
  /** Replace the model's routes (orientation probe) or clear them. */
  routes?: { from: [number, number]; to: [number, number] }[];
  camera?: { latitude: number; longitude: number; distance?: number };
  theme?: "dark" | "light";
  locale?: "en" | "zh-CN" | "zh-TW";
  title?: string;
  body?: string;
  disableWebfont?: boolean;
  readback?: "async" | "sync";
  repeat?: number;
}

interface ImageStats {
  width: number;
  height: number;
  mean: number;
  transparent: number;
  globeStd: number;
  globeColors: number;
  textInk: number;
  hash: string;
}

/** Runs entirely in the page: build model → plan → render → decode PNG. */
async function exportPng(page: Page, args: ExportArgs, flights: unknown[]) {
  return page.evaluate(
    async ({ args, flights }) => {
      const load = (path: string) => import(/* @vite-ignore */ path);
      const [{ buildShareRenderModel }, plans, renderers, sample, png] =
        await Promise.all([
          load("/src/share/share-model.ts"),
          load("/src/share/share-plan.ts"),
          load("/src/share/share-renderer.ts"),
          load("/src/share/share-verification-sample.ts"),
          load("/src/share/share-png.ts"),
        ]);
      const { model } = buildShareRenderModel(flights, {
        privacy: args.privacy ?? "routes",
        airportLabels: args.airportLabels ?? false,
      });
      if (args.routes) {
        model.routes = args.routes.map((r) => ({
          from: { latitude: r.from[0], longitude: r.from[1] },
          to: { latitude: r.to[0], longitude: r.to[1] },
          flights: 1,
        }));
        model.airports = [];
      }
      const plan = plans.createShareRenderPlan(model, {
        artboard: args.artboard,
        theme: args.theme ?? "dark",
        camera: args.camera
          ? {
              lookAt: {
                latitude: args.camera.latitude,
                longitude: args.camera.longitude,
              },
              distance: args.camera.distance ?? plans.fittedCameraDistance(),
              fov: 30,
            }
          : undefined,
      });
      const renderer = await renderers.createShareRenderer({
        readback: args.readback,
      });
      const outputs = [];
      try {
        for (let n = 0; n < (args.repeat ?? 1); n += 1) {
          const result = await renderer.renderPng(model, plan, {
            locale: args.locale ?? "en",
            disableWebfont: args.disableWebfont,
            fontTimeoutMs: 8000,
            compose: sample.verificationComposer({
              title: args.title ?? "Share rendering foundation",
              body: args.body ?? "Real Earth texture, real routes, local PNG.",
            }),
          });
          const bytes = new Uint8Array(await result.blob.arrayBuffer());
          const header = png.readPngHeader(bytes);
          const chunks = png.listPngChunks(bytes);
          // Decode the FINAL file, never the pre-encoding canvas.
          const bitmap = await createImageBitmap(result.blob);
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const context = canvas.getContext("2d", {
            willReadFrequently: true,
          })!;
          context.drawImage(bitmap, 0, 0);
          bitmap.close();
          const data = context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height,
          ).data;
          const lum = (i: number) =>
            0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!;
          let sum = 0,
            transparent = 0;
          for (let i = 0; i < data.length; i += 4) {
            sum += lum(i);
            if (data[i + 3]! < 255) transparent += 1;
          }
          // Central part of the globe disc: texture detail and colour variety.
          const g = plan.globe;
          const cx = g.x + g.size / 2,
            cy = g.y + g.size / 2,
            r = g.size * 0.3;
          let n2 = 0,
            s1 = 0,
            s2 = 0;
          const colors = new Set<number>();
          for (let y = Math.round(cy - r); y < cy + r; y += 2)
            for (let x = Math.round(cx - r); x < cx + r; x += 2) {
              if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
              const i = (y * canvas.width + x) * 4;
              const v = lum(i);
              s1 += v;
              s2 += v * v;
              n2 += 1;
              colors.add(
                ((data[i]! >> 3) << 10) |
                  ((data[i + 1]! >> 3) << 5) |
                  (data[i + 2]! >> 3),
              );
            }
          const mean2 = s1 / n2;
          // Text band (verification title) for glyph ink.
          let ink = 0;
          for (let y = 120; y < 240; y += 1)
            for (let x = 72; x < canvas.width - 72; x += 1) {
              const i = (y * canvas.width + x) * 4;
              if (Math.abs(lum(i) - lum((120 * canvas.width + 20) * 4)) > 60)
                ink += 1;
            }
          const digest = await crypto.subtle.digest("SHA-256", data);
          let binary = "";
          for (const byte of bytes) binary += String.fromCharCode(byte);
          outputs.push({
            base64: btoa(binary),
            size: bytes.length,
            type: result.blob.type,
            header,
            chunks,
            diagnostics: result.diagnostics,
            stats: {
              width: canvas.width,
              height: canvas.height,
              mean: sum / (data.length / 4),
              transparent,
              globeStd: Math.sqrt(Math.max(0, s2 / n2 - mean2 * mean2)),
              globeColors: colors.size,
              textInk: ink,
              hash: Array.from(new Uint8Array(digest))
                .map((b) => b.toString(16).padStart(2, "0"))
                .join(""),
            } satisfies Record<string, unknown>,
            pixels: args.repeat ? Array.from(data.subarray(0, 0)) : [],
          });
        }
        return { outputs, plan, model: JSON.parse(JSON.stringify(model)) };
      } finally {
        renderer.dispose();
      }
    },
    { args, flights },
  );
}

/** Region statistics between two exports of the same plan (difference map). */
async function differenceCentroid(
  page: Page,
  a: string,
  b: string,
  globe: { x: number; y: number; size: number },
) {
  return page.evaluate(
    async ({ a, b, globe }) => {
      const decode = async (base64: string) => {
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const bitmap = await createImageBitmap(
          new Blob([bytes], { type: "image/png" }),
        );
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d")!;
        context.drawImage(bitmap, 0, 0);
        return {
          data: context.getImageData(0, 0, canvas.width, canvas.height).data,
          width: canvas.width,
        };
      };
      const [first, second] = await Promise.all([decode(a), decode(b)]);
      let count = 0,
        sx = 0,
        sy = 0;
      for (let i = 0; i < first.data.length; i += 4) {
        const delta =
          Math.abs(first.data[i]! - second.data[i]!) +
          Math.abs(first.data[i + 1]! - second.data[i + 1]!) +
          Math.abs(first.data[i + 2]! - second.data[i + 2]!);
        if (delta > 48) {
          const p = i / 4;
          sx += p % first.width;
          sy += Math.floor(p / first.width);
          count += 1;
        }
      }
      return {
        count,
        dx: count ? sx / count - (globe.x + globe.size / 2) : 0,
        dy: count ? sy / count - (globe.y + globe.size / 2) : 0,
      };
    },
    { a, b, globe },
  );
}

async function save(testInfo: TestInfo, name: string, base64: string) {
  const path = testInfo.outputPath(name);
  await writeFile(path, Buffer.from(base64, "base64"));
  await testInfo.attach(name, { path, contentType: "image/png" });
}

/** WebGL2 availability and the implementation that will actually render. */
async function webgl2(page: Page) {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return null;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(
      gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
    );
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return renderer;
  });
}

async function flights() {
  return JSON.parse(await readFile(fixture, "utf8")).flights as unknown[];
}

function expectHealthyImage(
  output: Awaited<ReturnType<typeof exportPng>>["outputs"][number],
  width: number,
  height: number,
) {
  expect(output.type).toBe("image/png");
  expect(output.header).toMatchObject({ width, height });
  expect(output.stats.width).toBe(width);
  expect(output.stats.height).toBe(height);
  // No textual, EXIF or timestamp metadata chunks in the file. Engines add
  // harmless ancillary chunks of their own (Firefox deBG, WebKit sBIT).
  for (const chunk of ["tEXt", "zTXt", "iTXt", "eXIf", "tIME"])
    expect(output.chunks).not.toContain(chunk);
  expect(output.chunks[0]).toBe("IHDR");
  expect(output.chunks).toContain("IDAT");
  expect(output.chunks.at(-1)).toBe("IEND");
  // Opaque, neither black nor blank.
  expect(output.stats.transparent).toBe(0);
  expect(output.stats.mean).toBeGreaterThan(8);
  expect(output.stats.mean).toBeLessThan(200);
  // Real texture detail inside the Earth disc.
  expect(output.stats.globeStd).toBeGreaterThan(8);
  expect(output.stats.globeColors).toBeGreaterThan(150);
  expect(output.diagnostics.globeCoverage).toBeGreaterThan(0.4);
}

test.describe("share rendering foundation", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  test(
    "exports real 4:5 and 9:16 PNGs with the real Earth and routes",
    { tag: "@cross-browser" },
    async ({ page, browserName }, testInfo) => {
      const requests: { method: string; url: string }[] = [];
      page.on("request", (request) =>
        requests.push({ method: request.method(), url: request.url() }),
      );
      await page.goto("/");
      const implementation = await webgl2(page);
      if (!implementation) {
        // Prove the explicit failure, then report the engine as not verified.
        const kind = await page.evaluate(async () => {
          const { createShareRenderer } = await import(
            /* @vite-ignore */ "/src/share/share-renderer.ts"
          );
          try {
            await createShareRenderer();
            return "created";
          } catch (error) {
            return (error as { kind?: string }).kind;
          }
        });
        expect(kind).toBe("webgl2-unavailable");
        testInfo.annotations.push({
          type: "webgl",
          description: `${browserName}: WebGL2 unavailable; real export NOT verified`,
        });
        test.skip(true, "WebGL2 unavailable in this engine/environment");
      }
      const data = await flights();
      const portrait = await exportPng(page, { artboard: "4:5" }, data);
      const story = await exportPng(page, { artboard: "9:16" }, data);
      expectHealthyImage(portrait.outputs[0]!, 1080, 1350);
      expectHealthyImage(story.outputs[0]!, 1080, 1920);
      expect(portrait.outputs[0]!.diagnostics.routesDrawn).toBeGreaterThan(0);
      await save(
        testInfo,
        `share-4x5-${browserName}.png`,
        portrait.outputs[0]!.base64,
      );
      await save(
        testInfo,
        `share-9x16-${browserName}.png`,
        story.outputs[0]!.base64,
      );
      testInfo.annotations.push({
        type: "share-export",
        description: JSON.stringify({
          browser: browserName,
          webgl: implementation,
          "4:5": {
            bytes: portrait.outputs[0]!.size,
            ...portrait.outputs[0]!.diagnostics,
          },
          "9:16": {
            bytes: story.outputs[0]!.size,
            ...story.outputs[0]!.diagnostics,
          },
        }),
      });
      // No uploads, telemetry or backend calls: only GETs of app/static assets.
      const origin = new URL(page.url()).origin;
      for (const request of requests) {
        expect(request.method).toBe("GET");
        expect([origin, "https://cdn.jsdelivr.net"]).toContain(
          new URL(request.url).origin,
        );
      }
    },
  );

  test("routes produce a visible, correctly oriented difference; overview stays route-free", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    const data = await flights();
    // A single real-coordinate route around 60°N, 25–30°E (Helsinki → St
    // Petersburg), viewed from (0°, 0°): it must appear up and to the right.
    const camera = { latitude: 0, longitude: 0 };
    const withRoute = await exportPng(
      page,
      {
        artboard: "4:5",
        camera,
        routes: [{ from: [60.32, 24.96], to: [59.8, 30.26] }],
      },
      data,
    );
    const withoutRoute = await exportPng(
      page,
      { artboard: "4:5", camera, routes: [] },
      data,
    );
    const difference = await differenceCentroid(
      page,
      withRoute.outputs[0]!.base64,
      withoutRoute.outputs[0]!.base64,
      withRoute.plan.globe,
    );
    expect(difference.count).toBeGreaterThan(80);
    expect(difference.dy).toBeLessThan(-100); // north is up (no row flip)
    expect(difference.dx).toBeGreaterThan(40); // east is right (no mirror)

    const overview = await exportPng(
      page,
      { artboard: "4:5", privacy: "overview" },
      data,
    );
    const routes = await exportPng(
      page,
      { artboard: "4:5", privacy: "routes" },
      data,
    );
    expect(overview.model.routes).toEqual([]);
    expect(overview.model.airports).toEqual([]);
    expect(overview.outputs[0]!.diagnostics.routesDrawn).toBe(0);
    expect(routes.outputs[0]!.diagnostics.routesDrawn).toBeGreaterThan(0);
    expectHealthyImage(overview.outputs[0]!, 1080, 1350);
    expect(overview.outputs[0]!.stats.hash).not.toBe(
      routes.outputs[0]!.stats.hash,
    );
    await save(testInfo, "share-4x5-overview.png", overview.outputs[0]!.base64);
    await save(
      testInfo,
      "share-orientation-route.png",
      withRoute.outputs[0]!.base64,
    );
  });

  test("repeated exports of one plan are stable and the sync readback matches", async ({
    page,
  }) => {
    await page.goto("/");
    const data = await flights();
    const repeated = await exportPng(
      page,
      { artboard: "9:16", repeat: 3 },
      data,
    );
    const hashes = repeated.outputs.map((o) => o.stats.hash);
    expect(new Set(hashes).size).toBe(1);
    expect(repeated.outputs[0]!.diagnostics.readback).toBe("async");
    const sync = await exportPng(
      page,
      { artboard: "9:16", readback: "sync" },
      data,
    );
    expect(sync.outputs[0]!.diagnostics.readback).toBe("sync");
    const difference = await differenceCentroid(
      page,
      repeated.outputs[0]!.base64,
      sync.outputs[0]!.base64,
      repeated.plan.globe,
    );
    expect(difference.count).toBe(0);
  });

  for (const [locale, title, body] of [
    [
      "en",
      "Flight history, rendered locally",
      "Latin glyphs and digits 0123456789",
    ],
    [
      "zh-CN",
      "本地生成的飞行记录 Flight Passport",
      "简体中文与 English 混排换行测试",
    ],
    [
      "zh-TW",
      "本機產生的飛行紀錄 Year in Flight",
      "繁體中文與 English 混排換行測試",
    ],
  ] as const)
    test(`draws ${locale} text with webfont or deterministic fallback`, async ({
      page,
    }, testInfo) => {
      await page.goto("/");
      const data = await flights();
      const normal = await exportPng(
        page,
        { artboard: "4:5", locale, title, body },
        data,
      );
      const output = normal.outputs[0]!;
      expectHealthyImage(output, 1080, 1350);
      expect(output.stats.textInk).toBeGreaterThan(1500);
      expect(["webfont", "system", "fallback"]).toContain(
        output.diagnostics.fonts,
      );
      if (locale === "en") expect(output.diagnostics.fonts).toBe("system");
      // Forced fallback: deterministic family, re-measured layout, same result twice.
      const fallback = await exportPng(
        page,
        {
          artboard: "4:5",
          locale,
          title,
          body,
          disableWebfont: true,
          repeat: 2,
        },
        data,
      );
      if (locale !== "en")
        expect(fallback.outputs[0]!.diagnostics.fonts).toBe("fallback");
      expect(fallback.outputs[0]!.stats.textInk).toBeGreaterThan(1500);
      expect(fallback.outputs[0]!.stats.hash).toBe(
        fallback.outputs[1]!.stats.hash,
      );
      testInfo.annotations.push({
        type: "share-fonts",
        description: `${locale}: normal=${output.diagnostics.fonts}, forced=${fallback.outputs[0]!.diagnostics.fonts}`,
      });
      await save(testInfo, `share-text-${locale}.png`, output.base64);
    });

  test("fonts that fail to load fall back deterministically", async ({
    page,
  }) => {
    await page.route("https://cdn.jsdelivr.net/**", (route) => route.abort());
    await page.goto("/");
    const data = await flights();
    const result = await exportPng(
      page,
      { artboard: "4:5", locale: "zh-CN", title: "字体加载失败时的后备字体" },
      data,
    );
    expect(result.outputs[0]!.diagnostics.fonts).toBe("fallback");
    expect(result.outputs[0]!.stats.textInk).toBeGreaterThan(1500);
  });

  test("texture, WebGL, context-loss and disposal failures are explicit and recoverable", async ({
    page,
  }) => {
    await page.goto("/");
    const outcome = await page.evaluate(async () => {
      const load = (path: string) => import(/* @vite-ignore */ path);
      const [{ createShareRenderer }, { buildShareRenderModel }, plans] =
        await Promise.all([
          load("/src/share/share-renderer.ts"),
          load("/src/share/share-model.ts"),
          load("/src/share/share-plan.ts"),
        ]);
      const kind = async (run: () => Promise<unknown>) => {
        try {
          await run();
          return "succeeded";
        } catch (error) {
          return (error as { kind?: string }).kind ?? String(error);
        }
      };
      const { model } = buildShareRenderModel([]);
      const plan = plans.createShareRenderPlan(model, { artboard: "4:5" });
      const texture = await kind(() =>
        createShareRenderer({
          textures: {
            day: "/missing-earth-texture.webp",
            night: "/missing-night.webp",
          },
        }),
      );
      // Context lost before a job: rejected, never a Blob.
      const canvas = document.createElement("canvas");
      const renderer = await createShareRenderer({ canvas });
      const ext = (
        canvas.getContext("webgl2") as WebGL2RenderingContext
      ).getExtension("WEBGL_lose_context");
      ext!.loseContext();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const lostBefore = await kind(() => renderer.renderPng(model, plan));
      const stateAfterLoss = renderer.state();
      renderer.dispose();
      const afterDispose = await kind(() => renderer.renderPng(model, plan));
      // Context lost during a job.
      const canvas2 = document.createElement("canvas");
      const renderer2 = await createShareRenderer({ canvas: canvas2 });
      const job = kind(() => renderer2.renderPng(model, plan));
      (canvas2.getContext("webgl2") as WebGL2RenderingContext)
        .getExtension("WEBGL_lose_context")!
        .loseContext();
      const lostDuring = await job;
      renderer2.dispose();
      // A clean retry succeeds with a new instance.
      const fresh = await createShareRenderer();
      const retry = await fresh.renderPng(model, plan);
      fresh.dispose();
      return {
        texture,
        lostBefore,
        stateAfterLoss,
        afterDispose,
        lostDuring,
        retry: {
          type: retry.blob.type,
          width: retry.width,
          height: retry.height,
        },
      };
    });
    expect(outcome.texture).toBe("texture");
    expect(outcome.lostBefore).toBe("context-lost");
    expect(outcome.stateAfterLoss).toBe("lost");
    expect(outcome.afterDispose).toBe("disposed");
    expect(outcome.lostDuring).toBe("context-lost");
    expect(outcome.retry).toEqual({
      type: "image/png",
      width: 1080,
      height: 1350,
    });
  });

  test("WebGL2 unavailable fails explicitly without a fallback image", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        type: string,
        ...rest: unknown[]
      ) {
        if (type === "webgl2") return null;
        return (original as (...args: unknown[]) => unknown).call(
          this,
          type,
          ...rest,
        );
      } as typeof original;
    });
    await page.goto("/");
    const kind = await page.evaluate(async () => {
      const { createShareRenderer } = await import(
        /* @vite-ignore */ "/src/share/share-renderer.ts"
      );
      try {
        await createShareRenderer();
        return "created";
      } catch (error) {
        return (error as { kind?: string }).kind;
      }
    });
    expect(kind).toBe("webgl2-unavailable");
  });
});

test.describe("share rendering at a high device pixel ratio", () => {
  test.use({ deviceScaleFactor: 2, viewport: { width: 640, height: 480 } });
  test("artboard pixels ignore window size and devicePixelRatio", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto("/");
    expect(await page.evaluate(() => devicePixelRatio)).toBe(2);
    const result = await exportPng(page, { artboard: "9:16" }, await flights());
    expectHealthyImage(result.outputs[0]!, 1080, 1920);
  });
});
