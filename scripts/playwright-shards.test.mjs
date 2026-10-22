import assert from "node:assert/strict";
import test from "node:test";
import { balanceFiles, chromiumShardMatch } from "./playwright-shards.mjs";

test("duration balancing includes every file once, including unknown and renamed files", () => {
  const files = ["new.pw.ts", "long.pw.ts", "medium.pw.ts", "short.pw.ts"];
  const times = {
    "long.pw.ts": 100,
    "medium.pw.ts": 60,
    "short.pw.ts": 40,
    "deleted.pw.ts": 50,
  };
  const shards = balanceFiles(files, times, 2);
  assert.deepEqual(
    shards.flatMap((shard) => shard.files).sort(),
    [...files].sort(),
  );
  assert.deepEqual(balanceFiles([...files].reverse(), times, 2), shards);
  assert.ok(Math.max(...shards.map((shard) => shard.ms)) <= 160);
});

test("invalid shard values fail instead of silently running an empty subset", () => {
  for (const value of ["0/6", "7/6", "1/0", "1/999", "1", "1/6x"])
    assert.throws(() => chromiumShardMatch(value), value);
  assert.equal(chromiumShardMatch(undefined), undefined);
  assert.throws(() => balanceFiles(["a", "a"], {}, 1));
});

test("six actual shards form a disjoint partition of the discovered files", () => {
  const whole = chromiumShardMatch("1/1").sort();
  const parts = Array.from({ length: 6 }, (_, i) =>
    chromiumShardMatch(`${i + 1}/6`),
  ).flat();
  assert.equal(new Set(parts).size, parts.length);
  assert.deepEqual(parts.sort(), whole);
});
