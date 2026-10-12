# Task B.7 — Light Flight Hero visual review

Review base: PR #45, `codex/flight-detail-hierarchy`, B.6 commit `66bd422`.
This checkpoint awaits owner visual approval. Full regression, WebKit diagnosis,
merging and deployment are outside this checkpoint.

Light desktop Detail now has three explicit regions: existing light navigation,
a single full-width navy Hero, and the existing light reference area. The Hero
uses `#172b43` to `#0c1b31`, with light text and crisp, restrained stars. Its sky
ends at the Hero boundary; the old Light perimeter mask and blurred nebula are
replaced. There is no additional card, border, shadow or globe background tile.
Light reference information uses two balanced columns, including when a third
Frequent Flyer section exists. The existing conditional rendering still omits
that section when there is no data.

The foreground grid, typography, Actual/Scheduled/UTC layout, globe viewport and
camera calculations are unchanged. Renderer, shaders, textures and Passport are
untouched. Dark retains the B.6 styling.

## Real Chromium screenshots

All five PNGs were opened and visually inspected. They use the existing acceptance
records from `e2e/flight-detail-hierarchy.pw.ts`, at 1x device scale, English,
fixed solar mode and a 1000px viewport height. UA857 deliberately retains the
existing acceptance fixture's aircraft/ticket fields; these are test records.

- [CA1831 — 1440 — Light](screenshots/CA1831-1440-light.png)
- [UA857 — 1440 — Light](screenshots/UA857-1440-light.png)
- [CA1831 — 1440 — Dark](screenshots/CA1831-1440-dark.png)
- [UA857 — 1440 — Dark](screenshots/UA857-1440-dark.png)
- [CA1831 — 1200 — Light](screenshots/CA1831-1200-light.png)

Visual inspection: Light has a complete navy Hero with the information and earth
in the same space; no separate rectangle, oval halo, black smoke or irregular
shadow. The lower light region starts at a clean horizontal boundary. Both routes
and labels are visible, and the complete globe remains visible at 1200px.
The Dark controls were visually checked and matched the B.6 captures pixel for
pixel for both flights using Pillow's `ImageChops.difference`.

## Focused validation only

- Five real browser captures completed without uncaught page exceptions.
- All captures have zero horizontal overflow and visible endpoint labels.
- Foreground Hero/information/globe geometry and camera match B.6 exactly for
  all five captures. Atmosphere projection ratio is 0.96, within the 0.98 limit.
- Each fresh context opened Detail at 390px, then 1199px: no Globe mounted and
  no Detail Globe, renderer or 4096px texture requests occurred before 1200px.
- Two-column reference layout and absent Frequent Flyer placeholder checked.
- Formatting, Stylelint for the two changed stylesheets, and `git diff --check`
  passed. No full CI or browser regression suite was run for this checkpoint.

Measurements are saved in [measurements.json](screenshots/measurements.json).
The pre-existing tests for Light's faded perimeter/right-only sky describe the
retired B.6 direction. After visual approval, update their design expectations
with strict full-Hero boundary assertions and investigate the existing WebKit
failures; do not skip tests or relax unrelated assertions.

To reproduce with the existing checkout (no additional worktree): start `pnpm dev`
from the repository root, then run:

```sh
pnpm exec node docs/reviews/task-b7/capture.mjs
```

The script uses installed `/usr/bin/chromium` with SwiftShader software WebGL2
(`--use-angle=swiftshader --enable-unsafe-swiftshader`), needed in this GPU-less
cloud environment. This is real Chromium/WebGL rendering, not a static mock.
Playwright's own browser CDN is currently blocked by the network policy; the
repository-supported executable override is available for later Chromium tests.
