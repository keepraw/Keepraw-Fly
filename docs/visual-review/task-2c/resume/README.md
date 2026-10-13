# Task 2C — retained font and long-city evidence

Task 2C was approved and merged through PR #34. These original datasets preserve
real CDN stylesheet/WOFF2 requests and hashes, rendered MiSans/MiSans TC
Regular/Medium/Semibold PostScript faces with local font sources disabled, native
100%/125% zoom diagnostics and long Chinese city-name checks.

- [Browser and font evidence](browser-evidence.json)
- [Long-city evidence](long-cities/browser-evidence.json)

Both recorded source fixture hashes still match the corresponding formal E2E
fixtures. Geometry and screenshots describe the historical checkpoint, not current
page baselines. The [original screenshots](https://github.com/keepraw/Keepraw-Fly/tree/0bb6660d41605dbeb1da3bc3f15df5b56798aba8/docs/visual-review/task-2c/resume)
and [completed handoff/validation records](https://github.com/keepraw/Keepraw-Fly/tree/0412603fe518471c3816883cce8ff37680d60265/docs/visual-review/task-2c)
remain in Git history; intermediate logs are no longer kept in the current tree.

The existing `scripts/capture-task-2c.mjs` still provides the real rendered-font
verification referenced by the typography tests. With `pnpm dev` and Chromium
available, capture into ignored output rather than replacing these historical data:

```sh
TASK_2C_EVIDENCE_DIRECTORY=artifacts/task-2c pnpm exec node scripts/capture-task-2c.mjs
TASK_2C_EVIDENCE_DIRECTORY=artifacts/task-2c-long TASK_2C_FIXTURE=e2e/fixtures/chinese-long-city-passport.keepraw-fly.json pnpm exec node scripts/capture-task-2c.mjs
```

The capture requires the unchanged [approved Dark Control](../../task-1b-7b2/comp-control-fixed-dark.png).
Formal typography, native zoom and Passport E2E tests remain intact.
