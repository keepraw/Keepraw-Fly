# Detail capture helper

The [capture helper](capture.mjs) resolves repository fixtures relative to its
current location. Its five Detail scenarios include mobile resource isolation,
viewport geometry and page errors. With `pnpm dev` running and Chromium installed,
fresh output defaults to ignored `artifacts/detail-visual-review/`:

```sh
pnpm exec node docs/reviews/task-b8/capture.mjs
```

The superseded B.8 sky screenshots are available in
[Git history](https://github.com/keepraw/Keepraw-Fly/tree/8090372ac6d02d2c4c9dec4c09c78c2444f4641b/docs/reviews/task-b8).
Use [current testing guidance](../../testing.md) for regression assertions and
[Globe implementation](../../globe.md) for renderer behavior. The optional first
argument still selects a different output directory; choose an ignored path such
as `artifacts/detail-visual-review-local`. Repository fixture resolution is
independent of that output path. See the [evidence boundaries](../../visual-review/README.md)
for formal fixtures and retained references.
