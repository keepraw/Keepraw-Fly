# Engineering standards

This is the maintained entry point for contribution rules and quality gates.
[Design system](design-system.md) owns UI conventions; [architecture](architecture.md)
owns package and runtime boundaries. Executable configuration takes precedence
over examples in prose. Change the configuration and its documentation together.

## Toolchain and code conventions

Use the Node version in [.nvmrc](../.nvmrc) and the exact pnpm version declared by
[`packageManager`](../package.json). [.npmrc](../.npmrc) enforces the supported
Node range. Install with `pnpm install --frozen-lockfile`.

- [Prettier](../.prettierrc.json) owns formatting; [.prettierignore](../.prettierignore)
  identifies generated and vendor files. Use the formatter rather than maintaining
  a second style configuration in documentation.
- [Stylelint](../stylelint.config.mjs) and `pnpm check:css-tokens` own CSS checks.
  Read the design system before changing selector ownership or cascade order.
- [TypeScript base options](../tsconfig.base.json) and package `tsconfig.json`
  files own type-checking rules. Preserve strict checking and explicit boundaries.
- Match the existing module: PascalCase for React components and types,
  camelCase for values/functions, kebab-case for ordinary modules and CSS classes.
  Keep tests beside their module as `*.test.ts(x)`; browser journeys use `*.pw.ts`.
  Public format field names follow the [schema](schema.md), not naming cleanup.

## Local development

From the repository root, select the Node version and install the pinned dependencies:

```sh
nvm use
pnpm install --frozen-lockfile
pnpm dev
```

Open <http://localhost:5173>. The development server uses this fixed port and
exits if it is occupied. To inspect a production build:

```sh
pnpm build
pnpm preview
```

Open <http://127.0.0.1:4173> (the default preview address). Serve `apps/web/dist/`
over HTTP; opening `index.html` directly is unsupported. See
[deployment](deployment.md#developers-and-official-publishing) for hosting source
builds and the separate official publishing procedure.

## Dependency maintenance

[Dependabot](../.github/dependabot.yml) checks workspace dependencies and GitHub
Actions weekly. Minor and patch updates are grouped by ecosystem. Major updates
remain separate except for the coordinated Vite/plugin and i18next/React groups
in that configuration. Existing CI validates them, and maintainers review and
decide whether to squash merge; updates are never automatically merged. Commit
`pnpm-lock.yaml` and keep frozen installs. See [security](security.md) for exposure
and advisory review.

## Directory and module responsibilities

| Location                         | Responsibility                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------- |
| `packages/schema`                | Portable facts and versioned contracts                                                    |
| `packages/validator`             | Structural/semantic validation and generated schema validation                            |
| `packages/core`                  | Framework-independent calculations and reference data                                     |
| `apps/web`                       | React UI, localization, browser persistence and feature composition                       |
| `scripts`                        | Repeatable maintenance, capture, validation and release tools                             |
| `e2e`, `e2e-csp`                 | Browser regression journeys and production security checks                                |
| `e2e/fixtures`, `tests/fixtures` | Fixed regression inputs with identified consumers                                         |
| `examples`                       | Documented user import samples, explicitly shared with import tests                       |
| `docs`                           | Current guidance, protected release/legal records and selected historical decisions       |
| `artifacts`                      | Ignored generated screenshots, comparisons, temporary JSON and browser debugging evidence |

Keep calculations independent of React and storage. Route imports through the
existing validation/preflight boundary and persistence through the storage adapter.
Do not make a documentation or tooling change alter public data, product behavior
or test expectations. The in-app demo remains in `packages/core/data/demo.keepraw-fly.json`;
user samples and test fixtures have separate purposes.

## Documentation and evidence

Update the maintained topic with its implementation and link new topics from
[the documentation index](README.md). Reference configuration and code rather
than copying mutable token values, dependency versions or CI inventories.
English and translated guidance must agree on operational facts.

Archive only a lasting decision, rejected alternative, compliance record or
otherwise unrecoverable provenance. State the source revision, retention reason
and whether the decision is still applicable or superseded. Completed task reports
and obsolete screenshots are recoverable from Git history and need not remain in
the current tree. Carry unresolved actions into current guidance before removal.

New screenshots, visual comparisons, temporary JSON and browser debugging evidence
default to Git-ignored `artifacts/`. Existing Playwright failure diagnostics use
the ignored directories configured by Playwright and CI. Never overwrite an
approved reference, snapshot, golden file or regression fixture from a normal
capture. Inspect consumers before moving these inputs; review baseline updates
with the corresponding assertions and original provenance.

## Commit identity and pull requests

Repository-owner work must use the owner's verified identity. For keepraw's
checkouts (including Codex), configure the repository before committing:

```sh
git config --local user.name keepraw
git config --local user.email 49091395+keepraw@users.noreply.github.com
git config --local user.useConfigOnly true
git var GIT_AUTHOR_IDENT
git var GIT_COMMITTER_IDENT
```

This address is established by GitHub-verified keepraw commits. Check environment
overrides (`GIT_AUTHOR_*`, `GIT_COMMITTER_*`, `EMAIL`) and script-specific `--author`
arguments as well as repository/global configuration. A repository cannot change
another clone's global Git configuration. Independent contributors must retain
their own identity; Dependabot and GitHub's merge committer are legitimate.

The known incorrect identity is `forgottenpedestrian@gmail.com` / `zzvw`.
`pnpm check:commits -- <base-sha> <head-sha>` rejects it in new Author, Committer
and `Co-authored-by` fields. CI checks the incoming commit range, including the
PR merge commit. It does not impose an owner-only allowlist on other contributors.
If a force push removes the event's previous SHA from the full checkout, CI
checks all history reachable from the replacement head. An unavailable base
still fails ordinary pushes and PRs; shallow checkouts cannot use this fallback.
Review squash-message trailers before merging: GitHub may copy original
coauthor emails. `.mailmap` alone does not establish a GitHub attribution repair.

Use a focused branch, an English imperative commit message and an English PR
title/description. Explain the concrete problem, resulting behavior, validation
and remaining limitations. Preserve localized strings, code and upstream quotes.
Keep unrelated changes separate; do not merge or publish a release as an implicit
part of opening a PR. History repair belongs in an isolated workspace with an
external backup, a commit map, tree/topology verification and an explicit SHA lease.
Never move published tags or replace release assets to repair authorship.

## Quality gates

[CI](../.github/workflows/ci.yml) and [package scripts](../package.json) define
the executable gates. Before review run:

```sh
pnpm check:docs
pnpm format:check
pnpm lint:css
pnpm check:css-tokens
pnpm typecheck
pnpm test
pnpm build
pnpm check:security-headers
git diff --check
```

Run the relevant Playwright journeys and capture-helper smoke checks when changing
their inputs or paths. [Testing](testing.md) explains browser selection, full CI,
CSP, release packaging and deployment verification. Report failures and unexecuted
checks explicitly. Do not delete assertions, relax rules, raise timeouts or lower
coverage to make maintenance pass.
