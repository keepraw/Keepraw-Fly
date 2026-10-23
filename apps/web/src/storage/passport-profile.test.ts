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
    expect(loaded.profile.id).toMatch(/^KRF-[A-F0-9]{16}$/);
    expect(loaded.profile.number).toMatch(/^[A-Z0-9]{9}$/);
    first.savePassportProfile({
      ...loaded.profile,
      name: "Cloud Walker",
    });
    const second = await storage(first.values.get(key));
    expect(second.loadPassportProfile()).toEqual({
      profile: { ...loaded.profile, name: "Cloud Walker" },
      persisted: true,
    });
    expect(second.local.setItem).not.toHaveBeenCalled();
  });

  it("migrates the entire legacy ID deterministically without changing its saved nickname", async () => {
    const legacy = { name: "  云间漫游  ", number: "KRF-C1670C279628ACE1" };
    const first = await storage(JSON.stringify(legacy));
    const migrated = first.loadPassportProfile();
    expect(migrated.profile).toEqual({
      id: legacy.number,
      name: legacy.name,
      number: first.souvenirDocumentNumber(legacy.number),
    });
    expect(migrated.profile.number).toBe("MKN4KMM01");
    expect(first.souvenirDocumentNumber("KRF-C1670C279628ACE2")).not.toBe(
      migrated.profile.number,
    );
    expect(first.souvenirDocumentNumber("KRF-01670C279628ACE1")).not.toBe(
      migrated.profile.number,
    );
    const reload = await storage(first.values.get(key));
    expect(reload.loadPassportProfile()).toEqual(migrated);
    const retry = await storage(JSON.stringify(legacy));
    retry.local.setItem.mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(retry.loadPassportProfile().profile).toEqual(migrated.profile);
    expect(retry.loadPassportProfile().profile).toEqual(migrated.profile);
    expect(() => retry.souvenirDocumentNumber("KRF-bad")).toThrow();
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
      expect(loadPassportProfile().profile.number).toMatch(/^[A-Z0-9]{9}$/);
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
