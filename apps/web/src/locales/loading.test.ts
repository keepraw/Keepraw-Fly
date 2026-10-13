import { beforeEach, afterEach, expect, it, vi } from "vitest";

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

it("deduplicates in-flight loads and does not depend on CacheStorage permission", async () => {
  vi.stubGlobal("caches", {
    open: async () => {
      throw new Error("denied");
    },
  });
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  const fetch = vi.fn(async () => {
    await ready;
    return Response.json({ app: { loading: "Chargement" } });
  });
  vi.stubGlobal("fetch", fetch);
  const { loadTranslation } = await import("./resources");
  const first = loadTranslation("fr-FR");
  expect(loadTranslation("fr-FR")).toBe(first);
  release();
  await expect(first).resolves.toEqual({ app: { loading: "Chargement" } });
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("reads cached resources offline without a network request", async () => {
  const fetch = vi.fn(() => {
    throw new Error("offline");
  });
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("caches", {
    open: async () => ({
      match: async () => Response.json({ app: { loading: "読み込み中" } }),
    }),
  });
  const { loadTranslation } = await import("./resources");
  await expect(loadTranslation("ja-JP")).resolves.toEqual({
    app: { loading: "読み込み中" },
  });
  expect(fetch).not.toHaveBeenCalled();
});

it("allows retry after a failed fetch and ignores cache write failures", async () => {
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(Response.json({ app: { loading: "불러오는 중" } }));
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("caches", {
    open: async () => ({
      match: async () => undefined,
      put: async () => {
        throw new Error("quota");
      },
    }),
  });
  const { loadTranslation } = await import("./resources");
  await expect(loadTranslation("ko-KR")).rejects.toThrow("offline");
  await expect(loadTranslation("ko-KR")).resolves.toEqual({
    app: { loading: "불러오는 중" },
  });
  expect(fetch).toHaveBeenCalledTimes(2);
});
