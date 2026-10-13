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

The [CI workflow](../.github/workflows/ci.yml) runs documentation, formatting, CSS, type, unit and build checks in `checks`; the full Chromium regression runs across six shards, with separate Firefox and WebKit compatibility jobs. The aggregate `verify` job requires `checks`, every Chromium shard and both cross-browser jobs to succeed. Failed, cancelled or skipped validation prevents deployment.

For a `push` to `main`, `checks` uploads `apps/web/dist` as a GitHub Pages artifact. Only after `verify` succeeds does `deploy` publish that artifact **from the same CI workflow run**. Pull requests run the complete verification matrix but neither upload the Pages artifact nor deploy. There is no separate `pages.yml` workflow. Thus an Owner-approved merge to `main` triggers deployment automatically **only if that commit passes all Main CI checks**.

To use this workflow in your repository, enable GitHub Pages with **GitHub Actions** as its source and allow the `github-pages` environment to deploy from `main`. Configure any custom domain in your own repository's Pages settings. The developer's Demo address is not a deployment setting for forks.

Before broader public distribution, read the [current third-party notices](../THIRD_PARTY_NOTICES.md) and [license review](license-review-2026-10-10.md), particularly the open MiSans CDN and airline-logo permissions questions.

For another static host, publish the same output directory using the settings above and adjust the Pages deployment job to match your hosting choice.
