import assert from "node:assert/strict";
import test from "node:test";
import { classifyRuns } from "./cleanup-actions.mjs";

test("cleanup retains recent, active, open PR, main, release and unresolved evidence", () => {
  const now = Date.parse("2026-10-22T00:00:00Z");
  const repo = { full_name: "keepraw/Keepraw-Fly" };
  const old = {
    id: 1,
    status: "completed",
    conclusion: "failure",
    path: ".github/workflows/ci.yml",
    workflow_id: 1,
    head_branch: "old",
    head_sha: "old-sha",
    head_repository: repo,
    created_at: "2026-09-01T00:00:00Z",
  };
  const success = {
    ...old,
    id: 2,
    conclusion: "success",
    created_at: "2026-09-02T00:00:00Z",
  };
  const pr = { number: 1, state: "closed", head: { ref: "old", repo } };
  const result = (
    run = old,
    prs = [pr],
    artifacts = [],
    tags = new Set(),
    later = [success],
  ) => classifyRuns([run, ...later], prs, artifacts, tags, now)[0].delete;
  assert.equal(result(), true);
  assert.equal(result({ ...old, conclusion: "cancelled" }), true);
  for (const patch of [
    { created_at: "2026-10-21T00:00:00Z" },
    { status: "in_progress" },
    { head_branch: "main" },
    { path: ".github/workflows/release.yml" },
    { conclusion: "success" },
  ])
    assert.equal(result({ ...old, ...patch }), false);
  assert.equal(result(old, [{ ...pr, state: "open" }]), false);
  assert.equal(result(old, []), false);
  assert.equal(
    result(old, [pr], [{ name: "release-candidate", workflow_run: { id: 1 } }]),
    false,
  );
  assert.equal(result(old, [pr], [], new Set([old.head_sha])), false);
  assert.equal(result(old, [pr], [], new Set(), []), false);
});
