import { globSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Median summed Chromium attempt durations from 14 successful runs in the
// 2026-10-20–22 audit. These are scheduling hints, never an allowlist.
const times = JSON.parse(
  readFileSync(
    new URL("./playwright-file-times.json", import.meta.url),
    "utf8",
  ),
);

export function balanceFiles(files, durations, count) {
  if (!Number.isInteger(count) || count < 1 || count > files.length)
    throw new Error("Shard count must be between 1 and the number of files");
  if (new Set(files).size !== files.length)
    throw new Error("Duplicate test file in discovery");
  const known = Object.values(durations).filter(
    (value) => Number.isFinite(value) && value > 0,
  );
  known.sort((a, b) => a - b);
  const fallback = known[Math.floor(known.length / 2)] ?? 60_000;
  const weight = (file) =>
    Number.isFinite(durations[file]) && durations[file] > 0
      ? durations[file]
      : fallback;
  const shards = Array.from({ length: count }, () => ({ files: [], ms: 0 }));
  for (const file of [...files].sort(
    (a, b) => weight(b) - weight(a) || a.localeCompare(b, "en"),
  )) {
    const target = shards.reduce((a, b) => (b.ms < a.ms ? b : a));
    target.files.push(file);
    target.ms += weight(file);
  }
  return shards;
}

export function chromiumShardMatch(value) {
  if (!value) return undefined;
  if (!/^[1-9]\d*\/[1-9]\d*$/.test(value))
    throw new Error("CI_CHROMIUM_SHARD must be index/count");
  const [index, count] = value.split("/").map(Number);
  if (index > count) throw new Error("Shard index exceeds shard count");
  const directory = fileURLToPath(new URL("../e2e/", import.meta.url));
  const files = [...globSync("**/*.pw.ts", { cwd: directory })];
  const shards = balanceFiles(files, times, count);
  // Whole files preserve serial suites, hooks, persistent profiles and existing
  // parallel annotations. New files are discovered and assigned automatically.
  return shards[index - 1].files.map((file) => `${directory}${file}`);
}
