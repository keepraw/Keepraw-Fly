# Task 2C — PAUSED / CHECKPOINT

Status: **WIP, paused by the owner on 2026-10-10. Not visually accepted.
Local files saved; not committed or pushed.**

The Git save command and its one allowed retry were both rejected before process
creation because automatic permission review did not finish before its deadline.
No Git add/commit/push executed. The owner then explicitly chose **keep local
files and commit next session**. Do not retry Git writes during this session.

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

First read this local handoff and preserve the dirty working tree. Do not switch
branches or pull over it before saving the effective work. There is **no remote
Task 2C checkpoint to restore yet**. Use Node ≥20.19 and pnpm 10.14.0:

```powershell
Set-Location 'C:\Users\forgo\Documents\Keepraw-Fly'
Get-Content docs/visual-review/task-2c/HANDOFF.md
git branch --show-current
git status --short
git diff --stat
git diff --check
pnpm install --frozen-lockfile
```

After checking that only the listed effective changes are selected, save them
when Git write approval is available. Include the untracked typography files,
fixture, scripts, handoff, evidence JSON and PNGs; keep `artifacts/` ignored:

```powershell
git add -- README.md THIRD_PARTY_NOTICES.md apps/web/src docs/design-system.md docs/visual-review/task-2c e2e/fixtures e2e/typography.pw.ts scripts/capture-task-2c.mjs scripts/passport-typography-evidence.mjs
git diff --cached --check
git diff --cached --stat
git commit -m 'wip(task-2c): checkpoint MiSans and desktop typography'
git push origin codex/globe-prototype-experiment
git rev-parse HEAD
git ls-remote origin refs/heads/codex/globe-prototype-experiment
```

Compare the two HEAD values and then append the actual SHA and remote handoff
link to PR #34, preserving its Draft state and existing history. Do not force
push, rebase or merge. Update this handoff's status before that future commit.

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

## Checkpoint identity and remote CI

- Repository: `keepraw/Keepraw-Fly`.
- Branch: `codex/globe-prototype-experiment`.
- PR: <https://github.com/keepraw/Keepraw-Fly/pull/34> — **Draft**.
- Previous HEAD / Task 2B baseline: `b54f1b04f936bf227f1c3882a4aee58163df2647`.
- **Checkpoint Commit SHA: Pending — not committed / not pushed.** Current
  committed local HEAD is the Task 2B baseline above. Planned commit message:
  `wip(task-2c): checkpoint MiSans and desktop typography`.
- The owner deferred committing after two automatic approval timeouts. All
  effective Task 2C source, tests, scripts, screenshots and handoff files remain
  modified or untracked locally. PR #34 does not contain this work yet.
- Latest observed pre-checkpoint remote CI:
  [run 38036355339](https://github.com/keepraw/Keepraw-Fly/actions/runs/38036355339),
  `completed / success`, for exact previous HEAD `b54f1b0` (Verify, Firefox and
  WebKit succeeded; deployment skipped).
- Task 2C checkpoint CI: **Pending / not verified at document creation**.
  This session will not wait for CI and claims no Task 2C remote pass.
  PR checkpoint block may contain one immediate post-push snapshot.

All effective modifications listed above are intended for one future WIP commit.
Local/remote equality for a new checkpoint could not be checked because no new
commit or push occurred. PR #34 receives a paused/local-only status note; the
handoff link becomes available remotely only after a future successful push.
Resume only after the owner reopens work.
