# Task A historical capture helper

The [capture script](capture.mjs) retains its original path for reconstruction;
output now defaults to ignored `artifacts/task-a/before/` or `artifacts/task-a/after/`.
The [source provenance and bundle](../../archive/visual-review/task-a/README.md)
are archived; follow that note for the required historical source revisions.
This helper is not part of routine CI or a current product baseline.

From the recorded source checkout, with its local development server and Chromium
available, run from the repository root:

```sh
pnpm exec node docs/visual-review/task-a/capture.mjs before
pnpm exec node docs/visual-review/task-a/capture.mjs after
```

The `before` command requires the exact recorded baseline; it is not intended to
run on current `main`. Keep any `TASK_A_CAPTURE_OUTPUT` and optional
`TASK_A_CAPTURE_COMPUTED_OUTPUT` overrides under ignored `artifacts/` too. See
[current test layers](../../testing.md) and the
[retained evidence index](../README.md) for ongoing maintenance.
