/** Explicit manual research only. This module is dynamically imported by the review button. */
import formal from "../../../../packages/core/data/airport-history/formal/airports.json";

export const researchRevision = "bb1046455e949c6c0bf3a18769464cb232bec19e";
const base = `https://raw.githubusercontent.com/keepraw/airport-history/${researchRevision}/reference/generated/`;
// SHA-256 from the upstream reference/generated/manifest.json at researchRevision.
const hashes: Record<string, string> = {
  "index.IATA.jsonl.gz":
    "a64c152e062e7668007440e895cc50ad0941dde4d0004b9f1e309cf7297491c4",
  "records.0.jsonl.gz":
    "20408e2bd7fa1ec8147150acc5aeebdb63831755214401946160a7b92690bf99",
  "records.1.jsonl.gz":
    "7639f1b483c833bb19607f9067a5ae7d651be86e82d76a746d9b2b40cb963a10",
  "records.2.jsonl.gz":
    "c7e2362f3af1ecd0887b2fe877f6aa2f834858cd5d0662e6f9c3b88fa650d403",
  "records.3.jsonl.gz":
    "80ee620904e0add57248bd319e6aac0e0be578d0325edd41cda1a32d2130fd64",
  "records.4.jsonl.gz":
    "ab58993840b8147ae4a85a869b54a0d67ea7382d017695995a414a212724c980",
  "records.5.jsonl.gz":
    "31331da7743edc29c1d1b198241e70a272dacebc90c6e0222e257a3b75b19d83",
  "records.6.jsonl.gz":
    "1bbfcac18912fbd648230dfd8fff953bc4f4219ce0ae163dfb745c8b6c6551d2",
  "records.7.jsonl.gz":
    "6ab9bd33ffe23dd7f0cb6628d020fa677a1342a7d83137b41c10ad46281436f2",
  "records.8.jsonl.gz":
    "e2b265b8e2fb2e0cea5287952c147ad7b2e5f49959ab2dfc66089f5496dde3a6",
  "records.9.jsonl.gz":
    "02ef00eb8fba59f4700288576a6354a695ef3ab858438ae71fa15e132699b30f",
  "records.a.jsonl.gz":
    "4cb57f0130d2da8bf00d6984ca830a87198415cd0fc4021b962645981851f20c",
  "records.b.jsonl.gz":
    "71a564d273d9cae922c5c4a69ae3c31fa9e847eb0479982bf0d4ca2299b76e44",
  "records.c.jsonl.gz":
    "12805e2fe82f24c05b6562530f25983f7e17ce7ec107305f404d43d7f8be76f7",
  "records.d.jsonl.gz":
    "df8e4ee23d07954d8b842d10e87ae59c24ce5dcd991caa862b5ec85c9357a464",
  "records.e.jsonl.gz":
    "5d678ba1341da5c4d5ab829a3343767df95992f5b999e86a834baf10a5173008",
  "records.f.jsonl.gz":
    "1645b2df761f58ec10c9907efea2eed55f7cd5eff3012dba0e7eb79f8ce54395",
};
interface ReferenceRow {
  key?: string;
  referenceIds?: string[];
  referenceId?: string;
  sourceEntityId?: string;
  name?: string;
  country?: string;
}
export interface AirportResearchResult {
  referenceId: string;
  name: string;
  country: string;
  /** Only an explicit external-ID cross-reference to the reviewed directory permits selection. */
  airportId?: string;
}
const cache = new Map<string, Promise<ReferenceRow[]>>();
async function rows(path: string): Promise<ReferenceRow[]> {
  const existing = cache.get(path);
  if (existing) return existing;
  const pending = (async () => {
    if (!hashes[path] || !globalThis.crypto?.subtle)
      throw new Error("research-unavailable");
    const response = await fetch(base + path, {
      cache: "default",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("research-unavailable");
    const bytes = await response.arrayBuffer();
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    const hash = [...digest]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    if (hash !== hashes[path]) throw new Error("research-integrity");
    const text = await new Response(
      new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")),
    ).text();
    return text
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as ReferenceRow);
  })();
  if (cache.size >= 4) cache.delete(cache.keys().next().value!);
  cache.set(path, pending);
  try {
    return await pending;
  } catch (error) {
    cache.delete(path);
    throw error;
  }
}
export async function researchAirportCode(
  raw: string,
): Promise<AirportResearchResult[]> {
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return [];
  const index = await rows("index.IATA.jsonl.gz");
  const ids = new Set(
    index.find((entry) => entry.key === code)?.referenceIds ?? [],
  );
  const shards = [...new Set([...ids].map((id) => id[4]))];
  const matches: AirportResearchResult[] = [];
  // Only record shards named by this query; never scan the global corpus for names.
  for (const shard of shards) {
    for (const row of await rows(`records.${shard}.jsonl.gz`)) {
      if (!row.referenceId || !ids.has(row.referenceId)) continue;
      const airport = row.sourceEntityId
        ? formal.airports.find(
            (entity) => entity.externalIds?.ourAirports === row.sourceEntityId,
          )
        : undefined;
      matches.push({
        referenceId: row.referenceId,
        name: row.name ?? code,
        country: row.country ?? "",
        airportId: airport?.airportId,
      });
    }
  }
  return matches;
}
