import { afterEach, describe, expect, it, vi } from "vitest";

const key = "keepraw-fly.passport-profile.v1";

async function storage(initial?: string) {
  vi.resetModules();
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(key, initial);
  const local = {
    getItem: vi.fn((name: string) => values.get(name) ?? null),
    setItem: vi.fn((name: string, value: string) => values.set(name, value)),
  };
  vi.stubGlobal("localStorage", local);
  const module = await import("./passport-profile");
  return { ...module, local, values };
}

afterEach(() => vi.unstubAllGlobals());

describe("local souvenir profile", () => {
  it("persists an opaque number once, independently of archives and nicknames", async () => {
    const first = await storage();
    const loaded = first.loadPassportProfile();
    expect(loaded.persisted).toBe(true);
    expect(loaded.profile.number).toMatch(/^KRF-[A-F0-9]{16}$/);
    first.savePassportProfile({
      ...loaded.profile,
      name: "  Cloud   Walker  ",
    });
    const second = await storage(first.values.get(key));
    expect(second.loadPassportProfile()).toEqual({
      profile: { name: "Cloud Walker", number: loaded.profile.number },
      persisted: true,
    });
    expect(second.local.setItem).not.toHaveBeenCalled();
  });

  it("limits names by Unicode grapheme and removes control/bidi overrides", async () => {
    const { normalizePassportName } = await storage();
    expect(normalizePassportName("e\u0301 \u0000\u202eSky")).toBe("é Sky");
    expect(normalizePassportName("飞".repeat(40))).toBe("飞".repeat(32));
    expect(normalizePassportName("🧑‍✈️".repeat(40))).toBe("🧑‍✈️".repeat(32));
  });

  it("recovers from malformed storage without exposing its contents", async () => {
    for (const invalid of [
      "broken",
      "null",
      '{"name":"x","number":"internal-user-id"}',
    ]) {
      const { loadPassportProfile } = await storage(invalid);
      expect(loadPassportProfile().profile.number).toMatch(
        /^KRF-[A-F0-9]{16}$/,
      );
    }
  });

  it("reports blocked storage and retains the same number in this session", async () => {
    const { local, loadPassportProfile, savePassportProfile } = await storage();
    local.getItem.mockImplementation(() => {
      throw new Error("blocked");
    });
    local.setItem.mockImplementation(() => {
      throw new Error("blocked");
    });
    const first = loadPassportProfile();
    expect(first.persisted).toBe(false);
    expect(loadPassportProfile().profile.number).toBe(first.profile.number);
    expect(savePassportProfile({ ...first.profile, name: "Traveller" })).toBe(
      false,
    );
  });
});
