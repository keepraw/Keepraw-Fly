import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyAppearance,
  initialAppearance,
  initialSkin,
  resolveAppearance,
} from "./appearance";
import { DEFAULT_SKIN_ID } from "./skins/registry";

afterEach(() => vi.unstubAllGlobals());

describe("early appearance hint", () => {
  it("keeps explicit appearance through loading and removes it for System", () => {
    const dataset: { theme?: string; skin?: string } = { theme: "dark" };
    const cache = new Map([["keepraw-fly-appearance", "dark"]]);
    vi.stubGlobal("document", { documentElement: { dataset } });
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => cache.get(key) ?? null,
      setItem: (key: string, value: string) => cache.set(key, value),
      removeItem: (key: string) => cache.delete(key),
    });
    expect(initialAppearance()).toBe("dark");
    applyAppearance("light");
    expect(dataset.theme).toBe("light");
    expect(cache.get("keepraw-fly-appearance")).toBe("light");
    applyAppearance("system");
    expect(initialAppearance()).toBe("system");
    expect(cache.has("keepraw-fly-appearance")).toBe(false);
  });

  it("changes appearance even when localStorage is blocked", () => {
    const dataset: { theme?: string; skin?: string } = {};
    vi.stubGlobal("document", { documentElement: { dataset } });
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    expect(initialAppearance()).toBe("system");
    applyAppearance("dark");
    expect(dataset.theme).toBe("dark");
    applyAppearance("system");
    expect(dataset.theme).toBeUndefined();
  });
});

describe("early skin hint", () => {
  function stub(dataset: { theme?: string; skin?: string }) {
    const cache = new Map<string, string>();
    vi.stubGlobal("document", { documentElement: { dataset } });
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => cache.get(key) ?? null,
      setItem: (key: string, value: string) => cache.set(key, value),
      removeItem: (key: string) => cache.delete(key),
    });
    return cache;
  }

  it("reads the skin the head script restored and ignores unknown values", () => {
    stub({ skin: "minimal" });
    expect(initialSkin()).toBe("minimal");
    stub({ skin: "from-a-newer-version" });
    expect(initialSkin()).toBe(DEFAULT_SKIN_ID);
    stub({});
    expect(initialSkin()).toBe(DEFAULT_SKIN_ID);
  });

  it("marks the root and caches only a non-default skin", () => {
    const dataset: { theme?: string; skin?: string } = {};
    const cache = stub(dataset);
    applyAppearance("dark", "minimal");
    expect(dataset).toEqual({ skin: "minimal", theme: "dark" });
    expect(cache.get("keepraw-fly-skin")).toBe("minimal");
    applyAppearance("system", DEFAULT_SKIN_ID);
    expect(dataset).toEqual({ skin: DEFAULT_SKIN_ID });
    expect(cache.has("keepraw-fly-skin")).toBe(false);
  });

  it("does not mistake a theme forced by the skin for the saved appearance", () => {
    stub({ skin: "minimal", theme: "dark" });
    expect(initialAppearance()).toBe("system");
  });
});

describe("resolved appearance", () => {
  const media = (dark: boolean) => (query: string) => ({
    matches: query === "(prefers-color-scheme: dark)" && dark,
  });

  it("keeps explicit light and dark regardless of the system", () => {
    expect(resolveAppearance("light", media(true))).toBe("light");
    expect(resolveAppearance("dark", media(false))).toBe("dark");
  });

  it("resolves System through prefers-color-scheme", () => {
    expect(resolveAppearance("system", media(true))).toBe("dark");
    expect(resolveAppearance("system", media(false))).toBe("light");
    expect(resolveAppearance("system", undefined)).toBe("light");
  });
});
