import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { checkEvent, inspectCommit } from "./check-git-identities.mjs";

const oldEmail = "forgottenpedestrian@gmail.com";
const goodEmail = "49091395+keepraw@users.noreply.github.com";
const sha = "a".repeat(40);
function fixture({
  author = "keepraw",
  committer = "keepraw",
  email = goodEmail,
  message = "feat: valid",
} = {}) {
  return {
    sha,
    author: author ? { login: author } : null,
    committer: committer ? { login: committer } : null,
    commit: {
      author: { email },
      committer: { email },
      message,
    },
  };
}
const env = {
  GITHUB_REPOSITORY: "keepraw/Keepraw-Fly",
  GITHUB_TOKEN: "fake",
  GITHUB_EVENT_NAME: "pull_request",
};
function mockApi(pages) {
  return async (url) => {
    const key = new URL(url).pathname + new URL(url).search;
    return {
      ok: key in pages,
      status: key in pages ? 200 : 404,
      json: async () => pages[key],
    };
  };
}
const endpoint =
  "/repos/keepraw/Keepraw-Fly/pulls/74/commits?per_page=100&page=1";

test("legacy author and committer are rejected; external contributions are permitted", () => {
  assert.equal(
    inspectCommit(
      fixture({ author: "zzvw", committer: "zzvw", email: oldEmail }),
    ).length,
    4,
  );
  assert.deepEqual(
    inspectCommit(
      fixture({
        author: "outside",
        committer: null,
        email: "outside@example.com",
      }),
    ),
    [],
  );
});

test("squash merge co-author metadata is rejected", () => {
  const result = inspectCommit(
    fixture({
      committer: "web-flow",
      message: `fix: release\n\nCo-authored-by: Hongchuan Zhang <${oldEmail}>`,
    }),
  );
  assert.equal(result.length, 1);
  assert.match(result[0], /trailer/);
});

test("case-insensitive identity and trailer are rejected; ordinary prose is allowed", () => {
  assert.equal(inspectCommit(fixture({ author: "ZZVW" })).length, 1);
  assert.equal(
    inspectCommit(
      fixture({ message: "Co-authored-by: ZZVW <other@example.com>" }),
    ).length,
    1,
  );
  assert.deepEqual(
    inspectCommit(fixture({ message: `docs: do not use ${oldEmail}` })),
    [],
  );
});

test("PR checks all commits and rejects contaminated commits", async () => {
  const first = fixture();
  const second = { ...fixture({ author: "zzvw" }), sha: "b".repeat(40) };
  const api = mockApi({ [endpoint]: [first, second] });
  await assert.rejects(
    checkEvent({ pull_request: { number: 74, commits: 2 } }, env, api),
    /Forbidden commit identity/,
  );
  assert.equal(
    await checkEvent(
      { pull_request: { number: 74, commits: 1 } },
      env,
      mockApi({ [endpoint]: [first] }),
    ),
    1,
  );
});

test("truncated PR, invalid response, API failure and push truncation fail closed", async () => {
  await assert.rejects(
    checkEvent(
      { pull_request: { number: 74, commits: 2 } },
      env,
      mockApi({ [endpoint]: [fixture()] }),
    ),
    /Incomplete/,
  );
  await assert.rejects(
    checkEvent({ pull_request: { number: 74, commits: 1 } }, env, mockApi({})),
    /HTTP 404/,
  );
  assert.throws(() => inspectCommit({ sha }), /Incomplete/);
  await assert.rejects(
    checkEvent(
      { commits: [], distinct_size: 21 },
      { ...env, GITHUB_EVENT_NAME: "push" },
    ),
    /Truncated/,
  );
});

test("trusted-base guard and existing verify gate remain wired", () => {
  const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
  assert.match(workflow, /run: node scripts\/check-git-identities\.mjs/);
  assert.match(
    workflow,
    /  verify:\n    needs: \[checks, chromium, cross-browser\]/,
  );
  const trusted = readFileSync(".github/workflows/commit-identity.yml", "utf8");
  assert.match(trusted, /  pull_request_target:/);
  assert.match(
    trusted,
    /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/,
  );
  assert.match(trusted, /persist-credentials: false/);
  assert.doesNotMatch(trusted, /pull_request\.head\.sha/);
});
