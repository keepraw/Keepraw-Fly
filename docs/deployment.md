# Static deployment

## Developer Demo

**[https://fly.keepraw.com](https://fly.keepraw.com) is a demo provided by the developer.** It is available for trying Keepraw Fly without building it yourself. The Demo stores flight archives in the current browser and does not provide accounts or cloud synchronization.

**[https://fly.keepraw.com](https://fly.keepraw.com) 是开发者提供的 Demo。** 航班档案保存在当前浏览器中，不提供账号或云端同步；也可按以下步骤自行部署。

## Build and preview

Use Node.js 20.19 or newer and pnpm 10.14.0. The repository CI uses Node.js 24.

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm preview
```

Open <http://127.0.0.1:4173> (the default preview address). This serves the exact production output in `apps/web/dist/` over HTTP. Opening `dist/index.html` directly is not supported.

## Static hosting

Publish `apps/web/dist/` as a static directory. Vite uses a relative asset base, so the same build can be hosted at a domain root or a project subpath. Hash-based navigation requires no rewrite rules, server runtime, environment secrets or database.

| Setting          | Value                            |
| ---------------- | -------------------------------- |
| Install command  | `pnpm install --frozen-lockfile` |
| Build command    | `pnpm build`                     |
| Output directory | `apps/web/dist`                  |

Flight archives remain in each browser's IndexedDB. Deploying a new static build does not migrate archives between origins. Export a Keepraw Fly JSON backup before changing domains, browsers or devices, then import it at the destination.

## GitHub Pages workflow

The [CI workflow](../.github/workflows/ci.yml) checks documentation, types, unit tests and browser journeys, then builds the static site. Pull requests run verification; pushes to `main` also upload the production output as a GitHub Pages artifact. **As of this review, automatic deployment is deliberately paused:** the `deploy` job has `if: ${{ false }}`. Successful PR or `main` CI checks do not update the published Pages site.

To use this workflow in your repository, enable GitHub Pages with **GitHub Actions** as its source and allow the `github-pages` environment to deploy from `main`. Configure any custom domain in your own repository's Pages settings. The developer's Demo address is not a deployment setting for forks.

Only after the Owner explicitly approves publishing should the paused deployment gate be changed. To resume **automatic** deploys after successful `main` CI, restore the `deploy` job condition to `if: github.event_name == 'push' && github.ref == 'refs/heads/main'` and commit the change to `main`; that push triggers a new verification/deploy cycle. To support **manual-only** publishing, implement and test a separate `workflow_dispatch` path covering **both** Pages artifact creation and the deploy job, instead of changing only `deploy.if`. Neither behavior is enabled by this documentation change.

Before broader public distribution, read the [current third-party notices](../THIRD_PARTY_NOTICES.md) and [license review](license-review-2026-10-10.md), particularly the open MiSans CDN and airline-logo permissions questions.

For another static host, publish the same output directory using the settings above and adjust the Pages deployment job to match your hosting choice.
