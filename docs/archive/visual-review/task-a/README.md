# Task A source provenance

Only reconstruction metadata is retained here. The original
[shared-theme report](https://github.com/keepraw/Keepraw-Fly/blob/b283ed42ef865b5c3c3b4dfa6028769087ede131/docs/archive/visual-review/task-a/README.md)
and [capture manifest](https://github.com/keepraw/Keepraw-Fly/blob/0412603fe518471c3816883cce8ff37680d60265/docs/visual-review/task-a/after/manifest.json)
remain at fixed Git revisions; their results are not current layout baselines.

The [source bundle](capture-source.bundle) contains the original local after-capture
revision `4ae21f88a2b317d1bea24b416995ee32f09246c2` and requires baseline
`802c5d510d1e4c96633a4259e58fccb0fb83522b`. Delivery used the Git Data API to
publish a task tree rather than those original local commits. GitHub cannot
currently retrieve the recorded capture revision. Equivalence to a remotely
available tree has not been established, so preserve the bundle pending that
verification; its long-term reconstruction value is uncertain.

After fetching the baseline commit, verify from the repository root:

```sh
git bundle verify docs/archive/visual-review/task-a/capture-source.bundle
```

The historical capture helper now lives at
[`scripts/capture-theme-history.mjs`](../../../../scripts/capture-theme-history.mjs).
It needs the recorded source checkout, dev server and Chromium; it is not a
current UI baseline. From that checkout, run the helper with `before` or `after`.
The `before` mode verifies the exact baseline SHA. Default output is ignored
`artifacts/task-a/before/` or `artifacts/task-a/after/`; keep `TASK_A_CAPTURE_OUTPUT`
and `TASK_A_CAPTURE_COMPUTED_OUTPUT` overrides under `artifacts/` as well.

Map the bundle's original revisions to recoverable published source before removing
this exception. Routine task reports or new capture bundles do not qualify for
retention on this basis alone.
