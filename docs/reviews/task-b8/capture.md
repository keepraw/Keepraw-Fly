# Detail capture helper

The [retained capture helper](capture.mjs) stays here because it resolves repository
fixtures relative to its own location. Its five Detail scenarios include mobile
resource isolation, viewport geometry and page errors. With `pnpm dev` running
and Chromium installed, write fresh output to ignored artifacts:

```sh
pnpm exec node docs/reviews/task-b8/capture.mjs artifacts/detail-visual-review
```

The [historical B.8 review and two sky references](../../archive/reviews/task-b8/README.md)
are archived. They predate the later Hero viewport fix and are not current layout
baselines. Use [current testing guidance](../../testing.md) for regression
assertions and [Globe implementation](../../globe.md) for renderer behavior.
