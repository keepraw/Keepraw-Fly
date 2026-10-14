# Task A historical capture helper

The [unchanged capture script](capture.mjs) retains its original path and default
output directory for reconstruction. The [shared-theme review and source bundle](../../archive/visual-review/task-a/README.md)
are archived; follow that report for the required historical source revisions.
This helper is not part of routine CI or a current product baseline.

From the recorded source checkout, with its local development server and Chromium
available, choose ignored output explicitly:

```sh
TASK_A_CAPTURE_OUTPUT=artifacts/task-a pnpm exec node docs/visual-review/task-a/capture.mjs before
TASK_A_CAPTURE_OUTPUT=artifacts/task-a pnpm exec node docs/visual-review/task-a/capture.mjs after
```

The `before` command requires the exact recorded baseline; it is not intended to
run on current `main`. See [current test layers](../../testing.md) and the
[retained evidence index](../README.md) for ongoing maintenance.
