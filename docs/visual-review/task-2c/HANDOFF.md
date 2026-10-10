# Task 2C — PAUSED / CHECKPOINT

Status: **WIP checkpoint committed and pushed by owner on 2026-10-10; not visually accepted.**

Historical note: the automated Git save attempts failed permission review, but
the owner subsequently committed and pushed the complete Task 2C checkpoint via
GitHub Desktop (`8cda992fa1563f84d986c9a63f2555dac78bb66b`). A follow-up
commit (`91c7ca5172a782721e8e7438d195b023babce108`) added the missing
Stylelint blank line before `.settings-font-credit`. Do not recreate or recommit
the already-pushed checkpoint.

This checkpoint saves existing work only. Do not start Task 3, redesign Passport,
run full browser suites repeatedly, or pursue unrelated flaky tests.

## A. Current progress and evidence

| Item                                      | Implemented                                                                                                                                                                     | Verified                                                                                                                                                                       | Still pending                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Pinned CDN version                        | `misans-webfont@4.3.1`, explicitly approved by the owner after the requested `4.003.1` URLs returned 404                                                                        | Capture reached the 100% matrix after fetching all six CSS URLs with HTTP 200 and checking `font-display: swap` / `unicode-range`                                              | Final six-weight WOFF2 resource manifest was not written                       |
| Simplified MiSans / Traditional MiSans TC | Locale-specific, non-blocking native stylesheet links for regular / medium / semibold (400 / 500 / 600); links deduplicate across language switches                             | Earlier Simplified Chinese probe downloaded WOFF2 and observed custom glyph fonts with local font sources disabled; both Chinese locales reached the latest 100% layout matrix | Dedicated link lifecycle E2E; complete TC downloaded-font evidence             |
| English Inter                             | Original English Inter/system stack retained; English does not initiate Chinese font loading                                                                                    | English Dark/Light included in latest 100% geometry matrix and two screenshots                                                                                                 | Formal E2E regression; Inter availability depends on the existing environment  |
| Network loading / fallback                | System CJK stacks, `font-display: swap`, anonymous requests and no referrer; link errors recorded without gating application readiness                                          | CDN CSS availability and earlier CN actual font download observed                                                                                                              | CDN-blocked fallback tests, complete loading-shift/resource evidence           |
| Chinese values and units                  | `StatisticValue.tsx` keeps formatted text intact and gives 小时 / 小時 / 分 / 公里 / 英里 smaller unit spans; no KPI calculation change                                         | Latest 100% geometry matrix completed with current unit spans                                                                                                                  | Updated unit tests, keyboard/accessibility and engine regressions              |
| Desktop single screen                     | Right-side independent scrolling removed; map flexes within the available height, six KPIs and three Highlights remain; compact short-desktop arrangement and 24px bottom space | Latest 100% script completed all three locales × two themes × six sizes with geometry assertions                                                                               | 125% matrix, formal focused E2E, owner visual acceptance                       |
| Tests and screenshots                     | Five new typography E2E cases, adjusted markup assertions, synthetic archive, capture and geometry scripts; 14 PNGs saved                                                       | Four baseline PNGs and ten current candidate PNGs exist; latest log records 100% matrix completion                                                                             | Task 2C unit/static/build/E2E checks have not run; full capture failed at 125% |

The latest capture completed **36 geometry cases at native 100% zoom**:
`en`, `zh-CN`, `zh-TW` × Dark/Light × 1646×928, 1440×900, 1366×768,
1280×720, 1024×768, 761×900. Its assertions checked document bounds, no right
scroll requirement, text/clipping, map controls, six KPIs and no Longest Flight map.
This is script evidence, not a passing Playwright suite or owner acceptance.
The per-case records remained in memory when the subsequent 125% stage failed.

Current candidate screenshots: CN/TC Dark/Light at 1440×900 and 1646×928 (8),
English Dark/Light at 1440×900 (2). Baseline: CN/TC Dark/Light at 1440×900 (4).
`checkpoint-evidence.json` records their hashes, original failure logs and earlier
probe data with explicit stage labels. The earlier probe predates the final unit
spans and English line-height adjustment; it is not final-code acceptance.

## B. Immutable owner decisions

- PR #34 stays **Draft**. No merge, deployment, force push, rebase, main merge or PR #33 changes.
- Desktop Passport right side **must not have independent scrolling**. The earlier scroll fallback is revoked.
- Desktop should show the map, six KPIs and all three Highlights on one screen as completely as possible. Resolve layout rather than reintroducing scrolling.
- Do not modify Mobile. No mobile-specific source/styles were edited; the existing ≤760px branch and ≤540px desktop compact behavior remain. Their regressions are pending.
- Longest Flight is information only: **no small map, SVG, canvas or image**.
- Approved Control Globe composition, camera, lighting, sun algorithm/settings, textures and visual parameters remain frozen. No such production files changed in this checkpoint.
- Use third-party `misans-webfont@4.3.1`, retain attribution, Xiaomi font license and system fallbacks. The distribution code license and font license are different.
- Preserve Task 2B annual delay columns, Top 4 ranking and information-only Longest Flight. Do not weaken assertions, replace approved hashes or add retries to chase unrelated flakiness.

The approved Dark Control reference is
`docs/visual-review/task-1b-7b2/comp-control-fixed-dark.png`, SHA-256
`c17d906dc74bd44d91e80f247bc784f6d41e6a19e083778dc2a54d07e8bf24d5`.
The capture's final hash assertion was not reached in the failed run. No reference
or Globe production file is part of this checkpoint diff.

## C. Remaining work — actual status

| Work                                                 | Status                                                                                                                                                                       |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Traditional Chinese layout                           | 100% geometry matrix completed and four candidate PNGs saved; **Pending** 125%, formal E2E and visual acceptance                                                             |
| Dark / Light screenshot matrix                       | Ten current candidate PNGs saved at the sizes above; **Pending** remaining sizes, 125% screenshots and owner review                                                          |
| 100% browser zoom                                    | Latest 36-case geometry loop completed; no final consolidated manifest because the later stage failed                                                                        |
| 125% browser zoom                                    | Native zoom mechanism separately observed (`1440×900` physical → `1152×720` CSS, DPR 1.25); **Pending** layout matrix, latest capture timed out                              |
| Font loading failure fallback                        | Four locale/theme tests written with CDN requests aborted; **Pending**, never executed                                                                                       |
| Six desktop sizes                                    | Latest 100% script loop completed; **Pending** formal tests / 125% boundary matrix. At 125%, physical width 761 becomes CSS width ≤760 and enters the existing Mobile branch |
| Chromium regression                                  | **Pending** Task 2C focused E2E and full regression; no Task 2C Playwright pass claimed                                                                                      |
| Firefox regression                                   | **Pending** Task 2C. Earlier Task 2B local launch failed with Windows `spawn UNKNOWN`; do not treat that as a current assertion failure                                      |
| WebKit regression                                    | **Pending** Task 2C                                                                                                                                                          |
| Unit / type / format / docs / CSS / build checks     | **Pending** Task 2C. Checkpoint only ran whitespace diff checking and evidence-script syntax checks; see checkpoint evidence for actual results                              |
| `capture-task-2c.mjs` complete execution             | **Failed / Pending** at 125% wait; `browser-evidence.json` was never generated                                                                                               |
| `passport-typography-evidence.mjs`                   | Used successfully by earlier probe and 100% capture; **Pending** full native-125% completion                                                                                 |
| New typography tests and changed Passport unit tests | **Pending**, saved intact, not removed or reported as passed                                                                                                                 |

Task 2B's earlier 333 unit tests, five focused Chromium passes and successful
remote CI belong to commit `b54f1b0`; they do **not** validate this Task 2C diff.

## D. Complete source / test / documentation change list

| Path                                                        | Purpose                                                                                                  |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `apps/web/src/typography/StatisticValue.tsx` (new)          | Presentation-only Chinese unit spans, preserving formatted values                                        |
| `apps/web/src/typography/load-webfonts.ts` (new)            | Pinned, deduplicated locale stylesheet loader and diagnostic load/error status                           |
| `apps/web/src/App.tsx`                                      | Calls loader from the existing language effect                                                           |
| `apps/web/src/design-system.css`                            | MiSans / MiSans TC CJK stacks; original English stack and Latin data stack retained                      |
| `apps/web/src/pages/PassportPage.tsx`                       | Applies `StatisticValue` to desktop KPIs, delay and Longest Flight facts                                 |
| `apps/web/src/pages/PassportPage.test.tsx`                  | Strips unit-span markup while retaining exact localized value expectations                               |
| `apps/web/src/styles/passport-desktop.css`                  | Chinese typography, unit scale, glyph line-height, single-screen rows and short-desktop layout           |
| `apps/web/src/pages/SettingsPage.tsx`                       | Font attribution, license link and network explanation                                                   |
| `apps/web/src/styles/settings.css`                          | Font attribution caption style                                                                           |
| `apps/web/src/locales/en.json`                              | English font credit/license/network strings                                                              |
| `apps/web/src/locales/zh-CN.json`                           | Simplified Chinese credit strings                                                                        |
| `apps/web/src/locales/zh-TW.json`                           | Traditional Chinese credit strings                                                                       |
| `e2e/fixtures/chinese-passport.keepraw-fly.json` (new)      | Synthetic 12-flight archive, no personal archive data                                                    |
| `e2e/typography.pw.ts` (new)                                | Link lifecycle/deduplication plus four blocked-CDN layout, keyboard, persistence and accessibility cases |
| `scripts/passport-typography-evidence.mjs` (new)            | DOM/text/control bounds and font/layout/animation settlement helpers                                     |
| `scripts/capture-task-2c.mjs` (new)                         | Real CDN/WOFF2 evidence, native 100/125% zoom, candidate screenshots and final manifest                  |
| `README.md`                                                 | Third-party font network/privacy disclosure                                                              |
| `THIRD_PARTY_NOTICES.md`                                    | Distribution-code versus Xiaomi font license attribution and version                                     |
| `docs/design-system.md`                                     | Documented locale font stacks                                                                            |
| `docs/visual-review/task-2c/HANDOFF.md` (new)               | This permanent WIP handoff                                                                               |
| `docs/visual-review/task-2c/checkpoint-evidence.json` (new) | Frozen screenshot hashes, logs and explicitly preliminary probe data                                     |
| `docs/visual-review/task-2c/*.png` (14 new)                 | Four baseline and ten current candidate screenshots, listed in the evidence manifest                     |

No dependency manifests/lockfiles, Playwright retries/configuration, font binaries,
Globe renderer/camera/light/solar sources or Mobile-specific source files changed.
Ignored `artifacts/` profiles, traces, caches and temporary diagnostic scripts stay
local and are not committed. Useful log text/probe records are preserved in the
permanent evidence JSON without copying binary caches or traces.

## E. Known issues, logs and exact recovery

Latest run: `artifacts/task-2c-capture-final.log` contains
`Native browser zoom 100%: locale/theme/viewport matrix completed.` followed by
`page.waitForFunction: Timeout 30000ms exceeded.` at
`scripts/passport-typography-evidence.mjs:162`, called from
`scripts/capture-task-2c.mjs:178`. This is the `.app-shell` height versus
`innerHeight` settlement predicate in the 125% stage. Cause is **not established**;
the run exited by itself before checkpoint cleanup, so no capture process remained
to terminate. Do not weaken the predicate or increase timeouts without diagnosing
the actual layout/zoom behavior in the next authorized session.

Previous run: `artifacts/task-2c-capture.log` failed at the geometry assertion for
`1/en/dark/1646` with text entries `3h 22m`, `BOM`, `HKG`. The existing latest
code raises the affected line heights to 1.45; the next 100% loop completed.
No complete 125% or consolidated resource validation follows from that fix.
Both logs are copied as text into `checkpoint-evidence.json`.

Earlier successful CN probe: `artifacts/task-2c-probe.json`; earlier baseline:
`artifacts/task-2c-before.json`. Both are frozen in the evidence manifest, labeled
as earlier stages. Native zoom diagnostic script:
`artifacts/task-2c-native-zoom.mjs` (local temporary file, not required to resume).
Apparent SVG route discontinuity in an earlier resize sample was not proven to
be a product bug; map projection, route geometry and approved Globe settings were
not changed. The current capture waits and resets map framing through existing UI.

## F. Remote recovery (updated 2026-10-10)

The Task 2C checkpoint **is already pushed** to PR #34. Latest verified PR HEAD
before this documentation update: `91c7ca5172a782721e8e7438d195b023babce108`.
Do not repeat the older staging/commit/push recipe from this handoff's original
checkpoint. Inspect the remote branch and local working-tree state first, preserve
uncommitted local changes, and avoid force push, rebase, or main changes.

- Task 2C WIP commit: `8cda992fa1563f84d986c9a63f2555dac78bb66b`.
- Follow-up CSS lint fix: `91c7ca5172a782721e8e7438d195b023babce108`.
- CI #125 for `8cda992`: Verify failed at Stylelint (settings.css:826);
  Firefox and WebKit succeeded; Deploy skipped. Downstream Verify stages were
  not executed and cannot be claimed as passed.
- CI #126 for `91c7ca5`: [workflow run](https://github.com/keepraw/Keepraw-Fly/actions/runs/38041402331),
  observed in progress when this update was prepared. Inspect final job results
  before claiming test or build success.
- Remaining priorities: diagnose native 125% zoom wait without weakening tests;
  validate actual MiSans TC WOFF2 requests, weight handling and CDN failure
  fallback; complete multilingual/theme geometry, targeted browser and mobile
  regressions, screenshot review and owner acceptance.

After the owner resumes Task 2C, run each needed check once and record actual
results. Do not automatically launch a full E2E loop:

```powershell
pnpm check:docs
pnpm format:check
pnpm lint:css
pnpm check:css-tokens
pnpm typecheck
pnpm test
pnpm build
$env:PLAYWRIGHT_EXECUTABLE_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
pnpm test:e2e e2e/typography.pw.ts e2e/passport-statistics.pw.ts e2e/passport-desktop-design.pw.ts --project=chromium --output=artifacts/task-2c-focused-results
```

Playwright starts/reuses the Vite server automatically. For capture, start the
server in a separate PowerShell window, then run the saved script after diagnosing
the pending 125% wait (it requires installed Chrome and CDN access):

```powershell
# Window A, repository root:
pnpm dev
# Window B, repository root:
node scripts/capture-task-2c.mjs *> artifacts/task-2c-capture-resume.log
```

The script currently writes `browser-evidence.json` only after both zoom loops
and final resource/hash assertions. A partial run will preserve already written
PNGs but no final manifest. Do not report a partial run as success. Preserve
previous logs under their existing names before any further authorized run.
The captured PNGs themselves currently cover only 100%; 125% screenshot delivery
remains Pending even after a future geometry-only completion.

Cross-engine focused regression, when authorized in the resumed session:

```powershell
pnpm exec playwright install firefox webkit
pnpm test:e2e e2e/typography.pw.ts --project=firefox --output=artifacts/task-2c-firefox-results
pnpm test:e2e e2e/typography.pw.ts --project=webkit --output=artifacts/task-2c-webkit-results
```

## Checkpoint identity and remote CI (updated)

- Repository: `keepraw/Keepraw-Fly`; branch: `codex/globe-prototype-experiment`.
- PR #34: <https://github.com/keepraw/Keepraw-Fly/pull/34>, **Open / Draft**,
  base `codex/desktop-passport-redesign-checkpoint` (PR #33).
- Task 2B baseline: `b54f1b04f936bf227f1c3882a4aee58163df2647`;
  successful CI [38036355339](https://github.com/keepraw/Keepraw-Fly/actions/runs/38036355339).
- Owner-pushed Task 2C checkpoint: `8cda992fa1563f84d986c9a63f2555dac78bb66b`;
  failed Verify CI [38040519013](https://github.com/keepraw/Keepraw-Fly/actions/runs/38040519013).
- Stylelint fix HEAD before this documentation update:
  `91c7ca5172a782721e8e7438d195b023babce108`;
  CI [38041402331](https://github.com/keepraw/Keepraw-Fly/actions/runs/38041402331)
  was in progress at inspection time.
- This documentation-only update makes a further commit on PR #34; consult the
  live PR head and its CI rather than treating an earlier SHA as immutable.
- Task 2C remains **unaccepted**. Do not begin Task 3, mark either PR ready,
  merge, deploy or modify approved Globe visual parameters.
