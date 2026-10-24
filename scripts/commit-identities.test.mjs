import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("incoming history rejects incorrect identities without rewriting other authors", () => {
  const directory = mkdtempSync(join(tmpdir(), "keepraw-identities-"));
  const script = fileURLToPath(
    new URL("./check-commit-identities.mjs", import.meta.url),
  );
  const owner = {
    name: "keepraw",
    email: "49091395+keepraw@users.noreply.github.com",
  };
  const git = (...args) =>
    execFileSync("git", args, { cwd: directory, encoding: "utf8" }).trim();
  const makeCommit = (
    author = owner,
    committer = owner,
    message = "Test commit",
    parents = [],
  ) => {
    const tree = git("mktree");
    return execFileSync(
      "git",
      ["commit-tree", tree, ...parents.flatMap((p) => ["-p", p])],
      {
        cwd: directory,
        encoding: "utf8",
        input: message,
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: author.name,
          GIT_AUTHOR_EMAIL: author.email,
          GIT_COMMITTER_NAME: committer.name,
          GIT_COMMITTER_EMAIL: committer.email,
        },
      },
    ).trim();
  };
  const check = (base, head) =>
    spawnSync(process.execPath, [script, base, head], {
      cwd: directory,
      encoding: "utf8",
    });
  try {
    git("init", "--quiet");
    const old = makeCommit({
      name: "Hongchuan Zhang",
      email: "forgottenpedestrian@gmail.com",
    });
    const base = makeCommit(owner, owner, "Existing history boundary", [old]);
    const bot = {
      name: "dependabot[bot]",
      email: "49699333+dependabot[bot]@users.noreply.github.com",
    };
    const github = { name: "GitHub", email: "noreply@github.com" };
    const independent = {
      name: "Independent Contributor",
      email: "contributor@example.org",
    };
    const first = makeCommit(bot, github, "Dependency update", [base]);
    const second = makeCommit(independent, independent, "Independent work", [
      base,
    ]);
    const merge = makeCommit(
      owner,
      github,
      "Merge work\n\nThe forbidden email forgottenpedestrian@gmail.com is discussed, not credited.",
      [first, second],
    );
    assert.equal(
      check(base, merge).status,
      0,
      "old history, bots, independent authors and prose are allowed",
    );
    for (const role of ["author", "committer", "coauthor"]) {
      const wrong = { name: "keepraw", email: "FORGOTTENPEDESTRIAN@gmail.com" };
      const head = makeCommit(
        role === "author" ? wrong : owner,
        role === "committer" ? wrong : owner,
        role === "coauthor"
          ? "Work\n\nCo-authored-by: Hongchuan Zhang <forgottenpedestrian@gmail.com>"
          : "Work",
        [base],
      );
      assert.equal(check(base, head).status, 1, role);
    }
    const wrongBranch = makeCommit(
      { name: "zzvw", email: "person@example.org" },
      owner,
      "Side work",
      [base],
    );
    const badMerge = makeCommit(owner, github, "Merge bad side", [
      first,
      wrongBranch,
    ]);
    assert.equal(
      check(base, badMerge).status,
      1,
      "merge traversal checks both parents",
    );
    assert.equal(
      check(
        base,
        makeCommit(
          { name: "keepraw", email: "123+zzvw@users.noreply.github.com" },
          owner,
          "Wrong account",
          [base],
        ),
      ).status,
      1,
    );
    assert.notEqual(
      check("missing-ref", merge).status,
      0,
      "missing range cannot silently pass",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
