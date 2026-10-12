# Task B.8 — Light Detail, local directional sky

PR #45, existing `codex/flight-detail-hierarchy` branch. Base: B.7 `5f3e51e`.
This visual checkpoint awaits owner review. No full regression, merge or deployment
was performed for this checkpoint.

Light is a light page again. The B.7 full-Hero sky and light text overrides have
been removed. Navigation, the information column and the reference area retain
the existing light canvas and dark ink. The local sky begins at the right-hand
column gap, blends horizontally from pale blue to a brighter blue navy, and
extends to the right viewport edge. Short vertical transitions remain within the
Hero's existing gutters, with no sky extending into the reference area.

A small original SVG supplies deterministic star dust and a quiet diagonal galaxy
belt behind the earth. It is decorative background artwork, not satellite imagery
or a replacement globe. No blur, radial mask, ellipse, box shadow, new card or
placeholder was added. The renderer, shaders, earth textures, camera calculations,
interactions and Passport remain unchanged. All new background rules select only
the Light Detail frame.

## Actual Chromium PNGs

All three Light captures and the Dark control were opened and visually inspected.

- [CA1831 — 1440px — Light](screenshots/CA1831-1440-light.png)
- [UA857 — 1440px — Light](screenshots/UA857-1440-light.png)
- [CA1831 — 1200px — Light](screenshots/CA1831-1200-light.png)
- [CA1831 — 1440px — unchanged Dark control](screenshots/CA1831-1440-dark.png)

These use the existing B.7 capture fixture: English, fixed solar mode, 1x device
scale and a 1000px viewport height. The same acceptance records are retained;
UA857 inherits the aircraft and ticket fields of that fixture. No product content
was invented or added.

Visual inspection confirms a light information column with clean dark text, a
blue local space environment behind the complete earth, a horizontal transition
at the column gap, and an unobstructed light reference area. The background is
intentionally much quieter than the supplied design illustration.

## Focused evidence

- All five capture runs finished without uncaught page exceptions or horizontal
  overflow. Both airport labels are visible.
- The three Light skies start at the information column's right edge, extend
  exactly to the viewport's right edge, and fit within the Hero's vertical bounds.
- At 1440px, a fixed right-sky sample brightened from RGB `(13, 28, 51)` in B.7
  to `(33, 63, 92)` in B.8. At 1200px it changed from `(13, 29, 51)` to
  `(39, 68, 99)`. The reference area below the sky remains RGB `(243, 246, 250)`.
- Hero/information/globe rectangles and camera values match B.7 in every capture.
  The projected atmosphere ratio remains 0.96, below the existing 0.98 limit.
- Both CA1831 and UA857 Dark PNGs are pixel-identical to the B.7/B.6 controls
  (`ImageChops.difference(...).getbbox()` is `None`). Only CA1831 is attached here.
- Each fresh context opened Detail at 390px and 1199px before widening: the Globe
  was absent and no Detail Globe, renderer or 4096px texture request occurred.
- The existing conditional Frequent Flyer rendering remains intact. Neither
  acceptance record has Frequent Flyer data, and neither capture has a placeholder.
- Prettier and Stylelint checks for the two changed stylesheets, plus
  `git diff --check`, passed. Full regression and WebKit diagnosis remain deferred.

[Measurements](screenshots/measurements.json) retain all five scenarios.

Reproduce from the existing checkout, with `pnpm dev` running at the repository
root:

```sh
pnpm exec node docs/reviews/task-b7/capture.mjs /tmp/keepraw-b8-captures
```

The existing capture helper uses real installed Chromium with SwiftShader WebGL2.
It runs only the visual capture scenarios, not the full Playwright regression suite.

Design conclusion: Light Mode remains a light page, with a brighter local space
background only around the right-hand earth, extending to the Hero's right edge
and blending horizontally back into the light information region.
