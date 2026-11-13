import { gzipSync, gunzipSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { originIdentity } from "@keepraw-fly/core";
import type { KeeprawFlight } from "@keepraw-fly/schema";

const indexHash = "a64c152e062e7668007440e895cc50ad0941dde4d0004b9f1e309cf7297491c4";
const shardHash = "20408e2bd7fa1ec8147150acc5aeebdb63831755214401946160a7b92690bf99";
const buffer = (hex: string) => Uint8Array.from(hex.match(/../g)!, (pair) => parseInt(pair, 16)).buffer;
function responses() {
  const digest = vi.fn(async (_algorithm: string, bytes: ArrayBuffer) =>
    buffer(gunzipSync(Buffer.from(bytes)).toString().includes('"key"') ? indexHash : shardHash),
  );
  vi.stubGlobal("crypto", { subtle: { digest } });
  const fetcher = vi.fn(async (url: string) => {
    const rows = url.endsWith("index.IATA.jsonl.gz")
      ? [{ key: "HKG", referenceIds: ["ref_0fixture"] }, { key: "XYZ", referenceIds: ["ref_fother"] }]
      : [{ referenceId: "ref_0fixture", sourceEntityId: "28112", name: "Kai Tak", country: "HK" }];
    return new Response(new Uint8Array(gzipSync(rows.map((row) => JSON.stringify(row)).join("\n"))));
  });
  vi.stubGlobal("fetch", fetcher);
  return { digest, fetcher };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
describe("explicit manual research", () => {
  it("loads only this query's shards, checks hashes and reuses the bounded cache", async () => {
    const { fetcher, digest } = responses();
    const { researchAirportCode, researchRevision } = await import("./airport-history");
    expect(fetcher).not.toHaveBeenCalled();
    const results = await researchAirportCode("HKG");
    expect(results[0]?.airportId).toBe("apt_86460159-a072-4a18-afcc-ab376cda7047");
    expect(fetcher.mock.calls.map(([url]) => url.split("/").at(-1))).toEqual(["index.IATA.jsonl.gz", "records.0.jsonl.gz"]);
    expect(fetcher.mock.calls.every(([url]) => url.includes(researchRevision))).toBe(true);
    expect(digest).toHaveBeenCalledTimes(2);
    await researchAirportCode("HKG");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("rejects a checksum mismatch and allows retry without installing anything", async () => {
    const { digest } = responses();
    digest.mockResolvedValueOnce(new ArrayBuffer(32));
    const { researchAirportCode } = await import("./airport-history");
    await expect(researchAirportCode("HKG")).rejects.toThrow("research-integrity");
    expect(await researchAirportCode("HKG")).toHaveLength(1);
  });
  it("keeps saved airport identities unchanged when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const record: KeeprawFlight = {
      id: "saved", flightNumber: "CX100", serviceDate: "2024-01-01", airline: { iata: "CX" },
      origin: { iata: "HKG", airportId: "apt_86460159-a072-4a18-afcc-ab376cda7047" }, destination: { iata: "NRT" },
      scheduledDeparture: "2024-01-01T10:00:00+08:00", scheduledArrival: "2024-01-01T17:00:00+09:00",
    };
    const before = originIdentity(record);
    const { researchAirportCode } = await import("./airport-history");
    await expect(researchAirportCode("HKG")).rejects.toThrow();
    expect(originIdentity(record)).toEqual(before);
    expect(record.origin.iata).toBe("HKG");
  });
});
