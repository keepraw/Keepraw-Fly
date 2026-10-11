import { afterEach, describe, expect, it, vi } from "vitest";
import { applyAppearance, initialAppearance } from "./appearance";

afterEach(() => vi.unstubAllGlobals());

describe("early appearance hint", () => {
  it("keeps explicit appearance through loading and removes it for System", () => {
    const dataset: { theme?: string } = { theme: "dark" };
    const cache = new Map<string, string>();
    vi.stubGlobal("document", { documentElement: { dataset } });
    vi.stubGlobal("localStorage", {
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
    const dataset: { theme?: string } = {};
    vi.stubGlobal("document", { documentElement: { dataset } });
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    applyAppearance("dark");
    expect(dataset.theme).toBe("dark");
    applyAppearance("system");
    expect(dataset.theme).toBeUndefined();
  });
});
