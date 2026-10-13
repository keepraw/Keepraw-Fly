# Task 5A: mobile Passport palette review

Historical PNGs were removed from the current tree during the [post-Task A cleanup](https://github.com/keepraw/Keepraw-Fly/blob/0412603fe518471c3816883cce8ff37680d60265/docs/visual-review/CLEANUP-2026-10-11.md). Screenshot links now point to the fixed pre-cleanup commit; reports and capture metadata remain local.

Review baseline: `main` at `792e6295a645adca12bed5ba19118f50eda324c4`.
This draft adapts the desktop Passport's cool blue-gray palette to the mobile
Passport shell. The existing three identity panels retain their deep blue,
burgundy and teal surfaces, text, grouping and geometry.

## Before and after

Each comparison uses the same 24-flight bundled Demo archive, distance unit and
appearance. Left is the baseline; right is Task 5A. Images retain the original
CSS pixel size and show the upper 1,380 pixels of each full-page capture, including
the panels, search, buttons and first flight rows.
Captures wait for the selected appearance and flight/year text colors to settle
before measuring and taking screenshots. Theme transition frames are excluded.

| Language            | Viewport | Appearance | Comparison                                                                                                                                          |
| ------------------- | -------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| English             | 390×844  | Light      | [Before / after](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/reviews/task-5a/en-light-390x844.png)    |
| English             | 390×844  | Dark       | [Before / after](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/reviews/task-5a/en-dark-390x844.png)     |
| English             | 430×932  | Light      | [Before / after](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/reviews/task-5a/en-light-430x932.png)    |
| English             | 430×932  | Dark       | [Before / after](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/reviews/task-5a/en-dark-430x932.png)     |
| English             | 375×812  | Dark       | [Before / after](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/reviews/task-5a/en-dark-375x812.png)     |
| Simplified Chinese  | 390×844  | Light      | [Before / after](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/reviews/task-5a/zh-CN-light-390x844.png) |
| Simplified Chinese  | 390×844  | Dark       | [Before / after](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/reviews/task-5a/zh-CN-dark-390x844.png)  |
| Traditional Chinese | 390×844  | Light      | [Before / after](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/reviews/task-5a/zh-TW-light-390x844.png) |
| Traditional Chinese | 390×844  | Dark       | [Before / after](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/reviews/task-5a/zh-TW-dark-390x844.png)  |

Only these nine review comparisons are retained in the repository. Full-page
before/after captures for all three languages at all five viewport/appearance
combinations, measurements and the local review gallery are retained under the
ignored `artifacts/task-5a/` directory in the development environment.

## Scope and implementation

- A separate `passport-mobile.css` scopes the existing semantic color roles to
  `.app-shell:has(.passport-archive-page)` below the unchanged 761px desktop
  boundary. It also covers the Passport header and notices.
- The existing explicit theme selectors and OS color-scheme media query keep
  Light, Dark and System behavior without adding a newer color-function
  requirement for mobile browsers.
- Inherited legacy aliases and the 3px mobile focus ring resolve against the
  scoped palette. The search field uses the same purple focus color as desktop
  with a visible border and outer 1px ring.
- The new stylesheet is imported between the shared Passport rules and the
  existing desktop rules. Desktop layout, palette and Globe code are unchanged.
- Statistics, filtering, sorting, persistence, schema, font loading, logo assets,
  npm dependencies and deployment configuration are unchanged.

## Validation

The 15-case before/after measurement comparison found **zero differences** in
sampled bounds, text, font family or font size for the title, all three panels,
archive heading, search and every flight row. Panel surface/text colors are
unchanged. Every case fits horizontally and contains no map or Globe; no Globe
resources were requested. Simplified and Traditional Chinese font stylesheets
loaded successfully in all captured cases.

The added browser journeys cover the complete five-case viewport/appearance
matrix in each language, Axe AA checks, search/clear, real Tab focus and Enter
navigation, detail return, System/explicit appearance precedence with reload,
and palette isolation from Settings and Flight Detail.

- Frozen dependency installation, all 333 unit tests, documentation consistency,
  formatting, CSS lint/token checks, workspace type checking and production build
  passed.
- Chromium covered all 140 current journeys across the full and targeted runs.
  The initial full run passed 138/139; the existing flight-row navigation journey
  reached its 30-second deadline under concurrent load. With no concurrent build
  or browser work, the unchanged journey passed in 24.4 seconds (baseline:
  24.8 seconds). All six new mobile journeys passed without timeout changes.
- Firefox: **44/44 passed**. WebKit: **44/44 passed**. Chromium and WebKit exercised
  the desktop WebGL path. Firefox reported unavailable WebGL in this cloud image
  and exercised the existing interactive SVG fallback.
- The subsequent initial-entry checks passed all six mobile journeys in Chromium
  and Firefox. One WebKit fixture navigated before reload restored the Demo archive.
  Waiting for its 24 flight rows fixed the startup race; the WebKit rerun passed
  **6/6** with the same assertions and timeout budgets.
- Axe reported no WCAG A/AA violations in the new mobile journeys. Cancelled
  text on the focused Light row exceeds 4.5:1 contrast; keyboard focus uses the
  visible purple ring in both appearances.
- Chromium and WebKit also passed a mobile touch-context check: tapping Demo,
  searching, opening the first and last flights, returning from Detail and
  opening Settings. These are browser checks, not physical iOS/Android testing.

Local WebKit uses verified official Debian libraries extracted into the workspace.
Its `ldconfig` cache probe cannot see the workspace GLES library, so only that
preflight probe is bypassed; actual library loading, browser startup and all
44 test assertions executed successfully.

GitHub CI at the implementation commit passed Chromium verification and Firefox.
Its WebKit job failed in the initial run and one retry. The cloud network denied
the redirected diagnostic download; the required log domains are saved in the
environment draft but need to be applied in environment settings before diagnosis
can continue. The remote failure remains unexplained and is not treated as a pass.
See the [failed job](https://github.com/keepraw/Keepraw-Fly/actions/runs/38072562008/job/114275649907)
and the PR's current checks for the latest remote result.

## Owner review

This is an independent **Task 5A draft** for visual approval. Task 5B remains
pending that approval. GitHub Pages automatic deployment remains paused with
`deploy.if: ${{ false }}`.
