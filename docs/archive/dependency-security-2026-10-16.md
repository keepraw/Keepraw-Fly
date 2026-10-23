# Dependency security review (P2-3)

Author: keepraw

Status: historical security assessment of the pinned 2026-10-16 revision below.
Retained for advisory/exposure reasoning and release references. Its runner-upgrade
recommendation and dependency counts are superseded by later upgrades, including
[PR #87](https://github.com/keepraw/Keepraw-Fly/pull/87). Current policy and open
advisory follow-up live in [security](../security.md#known-dependency-advisory).
Commands below are the original audit record, not instructions to downgrade.

Reviewed on 2026-10-16 against main `7c6b4dd036de6837936724af3e9cc192ac61a821`, including PR #68. This follows up P2-3 of the audit in PR #63. The current lockfile, npm audit responses, published package versions and GitHub advisory details were checked directly; closed Dependabot PRs were not treated as evidence of remediation.

## Audit results and change

| Scope                                       | Before                                     | After                                     |
| ------------------------------------------- | ------------------------------------------ | ----------------------------------------- |
| All dependencies                            | 11 records: 2 critical, 6 high, 3 moderate | 5 records: 2 critical, 1 high, 2 moderate |
| Production dependencies (`--prod`)          | 6 records: 5 high, 1 moderate              | 0 records                                 |
| Distinct GHSA identifiers, all dependencies | 10                                         | 4                                         |

Vitest and `@vitest/mocker` produce separate records for the same GHSA. Counts are audit records, not distinct attack paths or demonstrated product vulnerabilities. No low or informational findings were reported. Audit output reflects the registry data available on the review date.

Update only the locked transitive dependency `fast-uri` from **3.1.5 to 3.1.8**. Ajv 8.20.0 already accepts `fast-uri ^3.0.1`, so the patch applies to both the production validator and Stylelint's development dependency chain without changing manifests, Ajv, APIs or dependency constraints. No overrides or audit exclusions were added.

The patch clears all six reported fast-uri advisories:

| Advisory                                                                 | Issue                                     | Severity | First patched 3.x version |
| ------------------------------------------------------------------------ | ----------------------------------------- | -------- | ------------------------- |
| [GHSA-5jgf-p345-68v8](https://github.com/advisories/GHSA-5jgf-p345-68v8) | Scheme-relative IDN host confusion        | High     | 3.1.6                     |
| [GHSA-f65p-4m7j-42xc](https://github.com/advisories/GHSA-f65p-4m7j-42xc) | Malformed IPv6 normalization / SSRF       | High     | 3.1.6                     |
| [GHSA-fph4-wmhf-6fwf](https://github.com/advisories/GHSA-fph4-wmhf-6fwf) | Repeated hostname percent-decoding / SSRF | High     | 3.1.6                     |
| [GHSA-jqff-g426-hqxp](https://github.com/advisories/GHSA-jqff-g426-hqxp) | Encoded scheme host confusion             | High     | 3.1.6                     |
| [GHSA-qw65-cvwx-89v3](https://github.com/advisories/GHSA-qw65-cvwx-89v3) | Unvalidated port authority injection      | High     | 3.1.7                     |
| [GHSA-hrr3-gc8f-f4qj](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj) | Encoded host case normalization           | Moderate | 3.1.8                     |

The production path is `web → validator → ajv → fast-uri`. The validator synchronously compiles the repository's fixed JSON Schema; its references are local fragments and its ID is a fixed URL. Imported archives are validation data, not schemas. There is no configured remote schema loader, user-supplied schema compilation, or use of fast-uri to authorize outgoing requests. The application is a static browser application. No exploitable production SSRF or host-allowlist bypass was identified in this usage. Updating still removes vulnerable parsing code from the production dependency graph with a small compatibility surface.

## Remaining development and test findings

These packages are outside the production dependency graph. Their upstream severity remains unchanged; the exposure assessment below is specific to the current repository and is not a claim that the packages are fixed.

| Dependency                              | Remaining records                                                                                                                                                         | Exposure and decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest / `@vitest/mocker` 3.2.7         | 2 moderate records, [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9)                                                                              | Arbitrary file reads require the redirect-mock registration interface and a reachable development server. Current scripts run `vitest run`; no standalone `mockerPlugin` / `interceptorPlugin`, Vitest browser mode, UI or API server is configured. The web development server does bind to `0.0.0.0`, but its config installs only the React plugin, not the affected mocker plugins. Playwright E2E uses this web server, not Vitest browser mode. No current registration endpoint was identified.                                                                                                                      |
| `vitest → tinypool` 1.1.1               | 2 critical records, [GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3) and [GHSA-85c8-ppgw-ccpr](https://github.com/advisories/GHSA-85c8-ppgw-ccpr) | These are prototype-pollution gadgets, requiring a separate pollution primitive in the Node process that manages the pool and attacker-controlled worker code or options. Browser imports do not feed this pool. Vitest supplies its own worker filename, environment and exec arguments when constructing the pool, reducing the first advisory's inherited-option exposure. It does pass a run-options object without an own filename, so the second gadget must not be dismissed: pollution of the controlling process could redirect execution. No such input/pollution path was identified in the current test runner. |
| `stylelint → micromatch → braces` 3.0.3 | 1 high record, [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)                                                                                   | Deeply nested brace patterns can exhaust the Node stack. Stylelint uses trusted glob constants from `lint:css` in the root manifest; user archive data is not a glob input. The registry's latest braces release is still 3.0.3 and the advisory has no published fixed version. Updating within the existing dependency chain cannot fix it today.                                                                                                                                                                                                                                                                         |

Vitest 3.2.7 and tinypool 1.1.1 remain the latest releases in their current major lines. The mocker fix starts at Vitest 4.1.11, and upstream explicitly does not plan a 3.x backport. Tinypool's two fixes require at least 2.1.2, outside Vitest 3's `^1.1.1` range. A forced tinypool 2.x override would bypass the runner's compatibility contract. A Vitest 4 migration changes the test runner and worker implementation and deserves separate review against the full suite; it is not necessary to remove a demonstrated production exploit here. This PR therefore keeps the current runner and documents the debt instead of combining a major migration with the production patch.

Follow up with a dedicated migration to a maintained, patched Vitest release (the current 4.x release is 4.1.12), checking supported Node/Vite versions, mocking and worker behavior, and confirming that both tinypool advisories disappear from the resolved graph. Track braces/Stylelint upstream for a published fix that can be adopted compatibly. Reassess before introducing mocker plugins, a reachable Vitest service, dynamic glob input, or untrusted data in the test-runner process. Keep these findings visible in future audits; no suppression is warranted.

## Validation

Use the repository's pnpm 10.14.0 for the lockfile update and frozen installation:

```sh
pnpm update fast-uri --recursive --depth 100 --lockfile-only
pnpm install --frozen-lockfile
pnpm audit --json
pnpm audit --prod --json
pnpm --filter @keepraw-fly/validator test
pnpm lint:css
pnpm exec prettier --check pnpm-lock.yaml docs/reviews/2026-10-16-dependency-security.md
pnpm check:docs
git diff --check
```

The initial audit used the environment's pnpm 11.25.0. Repeating it with the repository-pinned 10.14.0 against main's unchanged lockfile and workspace manifests confirmed the same 11 findings. The update, frozen installation and post-change audits use 10.14.0. The full audit intentionally continues to exit nonzero because of the documented development findings; the production audit is clean. All 31 existing validator tests passed, exercising schema compilation and validation behavior; CSS lint, changed-file formatting, documentation consistency and whitespace checks also passed. No business code, schema, import logic or test expectations change. Complete tests, workspace checks, production build and browser E2E are delegated to GitHub Actions on the PR.
