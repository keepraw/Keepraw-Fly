> Historical task review. Measurements, validation outcomes, approval status and deployment statements describe the recorded checkpoint. See the [current documentation](../../../README.md).

# Task B.8 — retained Detail visual references

These representative Light and Dark captures preserve the final B.8 sky design
from PR #45. They use CA1831, English, fixed solar mode, device scale factor 1 and
1440 × 1000 viewports.

- [Light reference](screenshots/CA1831-1440-light.png)
- [Dark reference](screenshots/CA1831-1440-dark.png)

They predate the PR #46 Hero viewport fix. They are design references, not current
layout baselines. Recapture the current product before using them in a product
README. The duplicate route/1200px captures and intermediate measurements remain
in the [original Git tree](https://github.com/keepraw/Keepraw-Fly/tree/0412603fe518471c3816883cce8ff37680d60265/docs/reviews/task-b8).

The retained [capture helper](../../../reviews/task-b8/capture.mjs) exercises five current Detail scenarios,
including cold-start mobile resource isolation, viewport geometry and page errors.
With `pnpm dev` running, write generated output to the ignored artifact directory:

```sh
pnpm exec node docs/reviews/task-b8/capture.mjs artifacts/detail-visual-review
```

It uses installed Chromium with SwiftShader WebGL2. Formal Playwright tests remain
the source of current regression assertions.
