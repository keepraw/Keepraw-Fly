# Task 5A: mobile Passport palette review

Review baseline: `main` at `792e6295a645adca12bed5ba19118f50eda324c4`.
This draft adapts the desktop Passport's cool blue-gray palette to the mobile
Passport shell. The existing three identity panels retain their deep blue,
burgundy and teal surfaces, text, grouping and geometry.

## Before and after

Each comparison uses the same 24-flight bundled Demo archive, distance unit and
appearance. Left is the baseline; right is Task 5A. Images retain the original
CSS pixel size and show the upper 1,380 pixels of each full-page capture, including
the panels, search, buttons and first flight rows.

| Language            | Viewport | Appearance | Comparison                                        |
| ------------------- | -------- | ---------- | ------------------------------------------------- |
| English             | 390×844  | Light      | [Before / after](task-5a/en-light-390x844.png)    |
| English             | 390×844  | Dark       | [Before / after](task-5a/en-dark-390x844.png)     |
| English             | 430×932  | Light      | [Before / after](task-5a/en-light-430x932.png)    |
| English             | 430×932  | Dark       | [Before / after](task-5a/en-dark-430x932.png)     |
| English             | 375×812  | Dark       | [Before / after](task-5a/en-dark-375x812.png)     |
| Simplified Chinese  | 390×844  | Light      | [Before / after](task-5a/zh-CN-light-390x844.png) |
| Simplified Chinese  | 390×844  | Dark       | [Before / after](task-5a/zh-CN-dark-390x844.png)  |
| Traditional Chinese | 390×844  | Light      | [Before / after](task-5a/zh-TW-light-390x844.png) |
| Traditional Chinese | 390×844  | Dark       | [Before / after](task-5a/zh-TW-dark-390x844.png)  |

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

Final automated results will be recorded here after the runs complete.

## Owner review

This is an independent **Task 5A draft** for visual approval. Task 5B remains
pending that approval. GitHub Pages automatic deployment remains paused with
`deploy.if: ${{ false }}`.
