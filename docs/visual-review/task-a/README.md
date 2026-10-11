# Task A — shared page theme evidence

Historical PNGs were removed from the current tree during the [post-Task A cleanup](../CLEANUP-2026-10-11.md). Screenshot links now point to the fixed pre-cleanup commit; reports and capture metadata remain local.

The before captures use main `802c5d510d1e4c96633a4259e58fccb0fb83522b`.
The after source revision is recorded separately for every image in
[after/manifest.json](after/manifest.json). These are real Chromium 153 screenshots,
with the real application and its demo archive, English UI, device scale factor 1,
reduced motion, and the clock fixed at `2026-10-11T12:00:00Z`. The desktop Passport
uses the production WebGL Globe; the capture does not mock or replace its renderer.
Detail uses the existing SVG route map. Mobile retains its existing map-free layout.

The dimensions below are the browser viewport. Page images capture the full page,
so tall mobile pages extend beyond the viewport. Dialog images capture the viewport.
The manifests record viewport, theme, source commit, PNG SHA-256 and a SHA-256 of
computed presentation properties for the shell and every descendant (including
colors, SVG fill/stroke, borders, outlines, typography, dimensions and visibility).

## Before and after

| Page               | Viewport    | Theme | Before                                                                                                                                                        | After                                                                                                                                                        |
| ------------------ | ----------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Passport           | 390 × 844   | Light | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/before/passport-390x844-light.png)       | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/after/passport-390x844-light.png)       |
| Passport           | 390 × 844   | Dark  | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/before/passport-390x844-dark.png)        | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/after/passport-390x844-dark.png)        |
| Passport           | 1440 × 1000 | Light | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/before/passport-1440x1000-light.png)     | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/after/passport-1440x1000-light.png)     |
| Passport           | 1440 × 1000 | Dark  | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/before/passport-1440x1000-dark.png)      | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/after/passport-1440x1000-dark.png)      |
| Flight Detail      | 390 × 844   | Light | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/before/detail-390x844-light.png)         | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/after/detail-390x844-light.png)         |
| Flight Detail      | 390 × 844   | Dark  | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/before/detail-390x844-dark.png)          | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/after/detail-390x844-dark.png)          |
| Flight Detail      | 1440 × 1000 | Light | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/before/detail-1440x1000-light.png)       | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/after/detail-1440x1000-light.png)       |
| Flight Detail      | 1440 × 1000 | Dark  | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/before/detail-1440x1000-dark.png)        | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/after/detail-1440x1000-dark.png)        |
| Settings           | 390 × 844   | Light | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/before/settings-390x844-light.png)       | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/after/settings-390x844-light.png)       |
| Settings           | 390 × 844   | Dark  | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/before/settings-390x844-dark.png)        | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/after/settings-390x844-dark.png)        |
| Settings           | 1440 × 1000 | Light | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/before/settings-1440x1000-light.png)     | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/after/settings-1440x1000-light.png)     |
| Settings           | 1440 × 1000 | Dark  | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/before/settings-1440x1000-dark.png)      | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/after/settings-1440x1000-dark.png)      |
| Clear confirmation | 390 × 844   | Light | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/before/clear-dialog-390x844-light.png)   | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/after/clear-dialog-390x844-light.png)   |
| Clear confirmation | 390 × 844   | Dark  | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/before/clear-dialog-390x844-dark.png)    | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/after/clear-dialog-390x844-dark.png)    |
| Clear confirmation | 1440 × 1000 | Light | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/before/clear-dialog-1440x1000-light.png) | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/after/clear-dialog-1440x1000-light.png) |
| Clear confirmation | 1440 × 1000 | Dark  | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/before/clear-dialog-1440x1000-dark.png)  | [PNG](https://github.com/keepraw/Keepraw-Fly/blob/e002f9d08ca43f153eccadffd0fcfdb7c1ee4c07/docs/visual-review/task-a/after/clear-dialog-1440x1000-dark.png)  |

## Passport freeze check

[Comparison measurements](passport-comparison.json) contain exact pixel counts and
computed-style equality, with both source revisions. No Passport layout, renderer,
statistics, selection or hover rules were changed. Palette declarations and their
existing breakpoint differences were moved into the shared stylesheet. The Chinese
font-weight rule remains exclusively in Passport's desktop stylesheet.

Pixel results are documented in the comparison report rather than assuming that
matching tokens prove identical browser rendering. Owner approval of the visual
comparison remains pending.

Both mobile images are pixel-identical. The desktop Light pair differs in 15 of
1,440,000 pixels (maximum RGB channel difference 1); Dark differs in 3 pixels
(maximum difference 13, on the airline logo edge). All recorded color properties
are identical. Desktop's full computed-style hashes differ only in the intrinsic
width of `.passport-globe-picker`, the unrendered content inside a closed
`<details>` menu: `0px` versus `118.828px`. Its colors, height and display rules are
unchanged. These small raster differences and the hidden-width difference are
reported explicitly; desktop images are not described as pixel-identical.

## Reproduction and review limits

Run the local development server on port 5173. From the recorded main baseline,
run `node docs/visual-review/task-a/capture.mjs before`; from the final code commit,
run the same command with `after`. Copy the capture script into an isolated baseline
checkout if necessary. The script rejects a mismatched before revision and tracked
application changes. Playwright Chromium must be installed. Set
`PLAYWRIGHT_BROWSERS_PATH` when the browser lives outside its default cache.
`TASK_A_CAPTURE_ORIGIN` and `TASK_A_CAPTURE_OUTPUT` allow an isolated baseline
server and an output directory in the task checkout. Set
`TASK_A_CAPTURE_COMPUTED_OUTPUT` to retain the raw computed properties for diagnosis.

The GitHub terminal proxy failed during delivery, so the task tree was uploaded
through the GitHub Git Data API. [capture-source.bundle](capture-source.bundle)
retains the original local code commits used by the after captures; it requires
the recorded main baseline. `git bundle verify` confirms that prerequisite. Fetch
revision `4ae21f88a2b317d1bea24b416995ee32f09246c2` from the bundle when reproducing
the exact recorded after version. The uploaded task tree contains the same
application sources, plus final regression expectations and this evidence.

The screenshot gallery covers English at the two requested representative sizes.
Automated browser checks additionally cover English, Simplified and Traditional
Chinese at 360, 390, 430, 760, 761, 1024 and 1440px; explicit Light/Dark precedence,
live System changes on mounted pages and portals, long cities, complete detail
facts, navigation, focus, overflow, imports, memberships, storage and cancellation.
The automated zoom checks cover both CSS layout zoom and native Chromium profile
zoom at 125%. The native check verifies `devicePixelRatio === 1.25` and exercises
Detail, Settings and its confirmation at all seven widths in all three languages
and both themes. Existing native Passport zoom tests are also retained. Physical
devices and Owner visual approval remain manual checks. [Validation record](VALIDATION.md)
lists exact commands, outcomes and any remaining failures.
