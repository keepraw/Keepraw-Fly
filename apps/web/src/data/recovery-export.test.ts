import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadRecoveryCopy, serializeRecoveryCopy } from "./recovery-export";

afterEach(() => vi.unstubAllGlobals());

const rawArchive = {
  format: "keepraw-fly",
  formatVersion: "99.0.0",
  profile: {},
  flights: [{ broken: true, unknownField: { retained: [1, "原始数据"] } }],
  unknownTopLevel: { untouched: true },
  extensions: { "example.recovery": { nested: [null, false] } },
};

function mockDownload(click = vi.fn()) {
  const link = { href: "", download: "", click, remove: vi.fn() };
  const append = vi.fn();
  const createObjectURL = vi.fn((_blob: Blob) => "blob:recovery-copy");
  const revokeObjectURL = vi.fn();
  const setTimeout = vi.fn();
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  vi.stubGlobal("window", {
    document: { createElement: vi.fn(() => link), body: { append } },
    setTimeout,
  });
  return { link, append, createObjectURL, revokeObjectURL, setTimeout };
}

describe("raw recovery export", () => {
  it("preserves an unsupported, invalid archive and unknown fields without migration", () => {
    const original = structuredClone(rawArchive);
    const result = serializeRecoveryCopy(rawArchive);

    expect(JSON.parse(result)).toEqual(original);
    expect(result).toBe(`${JSON.stringify(original, null, 2)}\n`);
    expect(rawArchive).toEqual(original);
  });

  it("can export raw JSON values that are not canonical archive objects", () => {
    expect(serializeRecoveryCopy(null)).toBe("null\n");
    expect(serializeRecoveryCopy(["raw", 42])).toBe('[\n  "raw",\n  42\n]\n');
  });

  it.each([undefined, Symbol("unserializable"), 1n])(
    "rejects a value with no JSON representation: %s",
    (raw) => {
      expect(() => serializeRecoveryCopy(raw)).toThrow();
    },
  );

  it("rejects circular raw data without mutating it", () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(() => serializeRecoveryCopy(circular)).toThrow();
    expect(circular.self).toBe(circular);
  });

  it("downloads the raw JSON with a recovery filename and releases its URL", async () => {
    const mocks = mockDownload();
    downloadRecoveryCopy(rawArchive);

    const blob = mocks.createObjectURL.mock.calls[0]![0] as unknown as Blob;
    expect(blob.type).toBe("application/json");
    expect(JSON.parse(await blob.text())).toEqual(rawArchive);
    expect(mocks.link.download).toMatch(
      /^keepraw-fly-recovery-\d{4}-\d{2}-\d{2}\.json$/,
    );
    expect(mocks.link.href).toBe("blob:recovery-copy");
    expect(mocks.append).toHaveBeenCalledWith(mocks.link);
    expect(mocks.link.click).toHaveBeenCalledOnce();
    expect(mocks.link.remove).toHaveBeenCalledOnce();
    const releaseUrl = mocks.setTimeout.mock.calls[0]![0] as () => void;
    releaseUrl();
    expect(mocks.revokeObjectURL).toHaveBeenCalledWith("blob:recovery-copy");
  });

  it("does not create a download for unserializable raw data", () => {
    const mocks = mockDownload();
    expect(() => downloadRecoveryCopy({ unsupported: 1n })).toThrow();
    expect(mocks.createObjectURL).not.toHaveBeenCalled();
    expect(mocks.link.click).not.toHaveBeenCalled();
  });

  it("cleans up the download link and URL when clicking fails", () => {
    const mocks = mockDownload(
      vi.fn(() => {
        throw new Error("Download failed");
      }),
    );
    expect(() => downloadRecoveryCopy(rawArchive)).toThrow("Download failed");
    expect(mocks.link.remove).toHaveBeenCalledOnce();
    const releaseUrl = mocks.setTimeout.mock.calls[0]![0] as () => void;
    releaseUrl();
    expect(mocks.revokeObjectURL).toHaveBeenCalledWith("blob:recovery-copy");
  });
});
