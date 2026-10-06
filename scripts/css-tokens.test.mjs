import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import postcss from "postcss";
import { collectCustomProperties } from "./lib/css-analysis.mjs";
import { collectRuntimeProperties } from "./lib/runtime-css-properties.mjs";

test("CSS AST collects local/media definitions and nested fallbacks, ignoring text/comments", () => {
  const ast = postcss.parse(`
    :root { --global: blue; }
    @media (max-width: 760px) { .card { --local: red; color: var(/* name */ --global, var(--local)); } }
    .card { content: "var(--not-a-reference)"; /* color: var(--comment); */ }
  `);
  const report = collectCustomProperties(ast, "fixture.css");
  assert.deepEqual(
    report.definitions.map(({ name }) => name),
    ["--global", "--local"],
  );
  assert.deepEqual(
    report.variables.map(({ name }) => name),
    ["--global", "--local"],
  );
  assert.equal(report.variables[0].hasFallback, true);
  assert.equal(report.variables[1].hasFallback, false);
  assert.equal(report.definitions[1].context, "@media (max-width: 760px)");
});

test("runtime AST accepts inline/typed assignments and rejects literal/type-only evidence", () => {
  const report = collectRuntimeProperties(
    `
    import type { CSSProperties as Style } from "react";
    import * as React from "react";
    const unrelated = { "--fake-object": 1 };
    const text = "--fake-string"; // "--fake-comment": 1
    type Keys = { "--fake-type": number };
    const a = { "--asserted": 1 } as Style;
    const b: React.CSSProperties = { "--typed": 2 };
    const c = { ["--satisfied"]: 3 } satisfies Style;
    const view = <div style={{ "--inline": 4 }} data-info={{ "--fake-prop": 5 }} />;
  `,
    "fixture.tsx",
  );
  assert.deepEqual(
    report.map(({ name }) => name),
    ["--asserted", "--typed", "--satisfied", "--inline"],
  );
  assert.ok(
    report.every(
      ({ file, line, value }) => file === "fixture.tsx" && line > 0 && value,
    ),
  );
});

test("checker fails nonexistent names even with fallback or source string evidence", () => {
  const root = mkdtempSync(join(tmpdir(), "keepraw-css-tokens-"));
  const src = join(root, "apps/web/src");
  const checker = new URL("./check-css-tokens.mjs", import.meta.url).href;
  try {
    mkdirSync(join(src, "styles"), { recursive: true });
    writeFileSync(join(src, "design-system.css"), ":root { --theme: blue; }");
    writeFileSync(
      join(src, "styles/fixture.css"),
      `.card { --local: red; color: var(--theme); }
@media (max-width: 760px) { .card { --media: 1; width: calc(var(--runtime) * var(--media)); border-color: var(--local); } }`,
    );
    writeFileSync(
      join(src, "fixture.tsx"),
      `import type { CSSProperties } from "react";
const style = { "--runtime": 1 } as CSSProperties; const text = "--missing";`,
    );
    const run = () =>
      spawnSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `import { checkCssTokens } from ${JSON.stringify(checker)}; checkCssTokens(${JSON.stringify(root)});`,
        ],
        { encoding: "utf8" },
      );
    const valid = run();
    assert.equal(valid.status, 0, valid.stderr);
    assert.match(valid.stdout, /0 unresolved tokens/);
    writeFileSync(
      join(src, "styles/fixture.css"),
      ".card {\n  color: var(--missing, var(--theme));\n}",
    );
    const invalid = run();
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /fixture\.css:2: unresolved --missing/);
    assert.match(invalid.stderr, /color: var\(--missing, var\(--theme\)\);/);
    // Removing a real runtime assignment also fails; there is no blanket exemption.
    writeFileSync(
      join(src, "styles/fixture.css"),
      ".card { width: var(--runtime); }",
    );
    writeFileSync(join(src, "fixture.tsx"), 'const text = "--runtime";');
    const removed = run();
    assert.equal(removed.status, 1);
    assert.match(removed.stderr, /unresolved --runtime/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
