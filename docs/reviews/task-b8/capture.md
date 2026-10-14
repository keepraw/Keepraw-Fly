# Detail capture helper

The [capture helper](capture.mjs) resolves repository fixtures relative to its
current location. Its five Detail scenarios include mobile resource isolation,
viewport geometry and page errors. With `pnpm dev` running and Chromium installed,
write fresh output to ignored artifacts:

```sh
pnpm exec node docs/reviews/task-b8/capture.mjs artifacts/detail-visual-review
```

The superseded B.8 sky screenshots are available in
[Git history](https://github.com/keepraw/Keepraw-Fly/tree/8090372ac6d02d2c4c9dec4c09c78c2444f4641b/docs/reviews/task-b8).
Use [current testing guidance](../../testing.md) for regression assertions and
[Globe implementation](../../globe.md) for renderer behavior. Moving this helper
into `scripts/` requires updating its relative fixture resolution and belongs to
the [tooling boundary follow-up](../../visual-review/README.md).
