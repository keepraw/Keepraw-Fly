import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { addMissing } from "./update-zh-tw-locale.mjs";

test("locale updates preserve reviewed Taiwan terminology and report new keys", () => {
  const reviewed = {
    page: { loading: "載入", file: "檔案" },
    removed: "人工審校",
  };
  const candidate = {
    page: { loading: "加載", file: "文件", retry: "重試" },
    newPage: { title: "新增" },
  };
  const original = structuredClone(candidate);
  assert.deepEqual(addMissing(reviewed, candidate), ["page.retry", "newPage"]);
  assert.deepEqual(reviewed, {
    page: { loading: "載入", file: "檔案", retry: "重試" },
    removed: "人工審校",
    newPage: { title: "新增" },
  });
  assert.deepEqual(candidate, original);
  assert.deepEqual(addMissing(reviewed, candidate), []);
});

test("OpenCC candidate output cannot replace either maintained Chinese resource", () => {
  for (const language of ["zh-CN", "zh-TW"]) {
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          [
            "scripts/update-zh-tw-locale.mjs",
            "--candidate",
            `apps/web/src/locales/${language}.json`,
          ],
          { stdio: "pipe" },
        ),
      /Candidate output must not overwrite maintained locales/,
    );
  }
});
