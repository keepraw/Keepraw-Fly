# Static deployment

Build the viewer with:

```bash
pnpm install --frozen-lockfile
pnpm build
```

To inspect that exact production output locally, run `pnpm preview` from the
repository root and open <http://127.0.0.1:4173>. This serves `apps/web/dist/`
over HTTP; opening `dist/index.html` directly is not supported.

Publish `apps/web/dist/` as a static directory. Vite uses a relative asset base,
so the same build can be hosted at a domain root or a project subpath.

No rewrite rules, server runtime, environment secrets or database are required.
The directory can be served by GitHub Pages, Cloudflare Pages, Vercel, Netlify,
Nginx, Caddy or an ordinary static file server.

Recommended settings on hosted build services:

- install command: `pnpm install --frozen-lockfile`
- build command: `pnpm build`
- output directory: `apps/web/dist`

The server receives normal asset requests only. Flight archives remain in each
browser's IndexedDB.

## GitHub Pages

The repository includes `.github/workflows/pages.yml`. After pushing it to
GitHub, open **Settings → Pages** and choose **GitHub Actions** as the source.
Each push to `main` then performs a frozen install, type check, unit tests and a
fresh build before uploading `apps/web/dist/` and deploying it to the protected
`github-pages` environment. The workflow can also be started manually.

The Vite base is relative and navigation uses URL hashes, so a repository site
such as `https://owner.github.io/Keepraw-Fly/` needs no hard-coded owner or
repository path and no SPA rewrite rule. This workflow does not configure a
custom domain. Add a domain only after deciding which host should own
`keepraw.com`; do not add a `CNAME` file speculatively.

## GitHub Pages（简体中文）

仓库已包含 `.github/workflows/pages.yml`。推送到 GitHub 后，进入
**Settings → Pages**，将来源选择为 **GitHub Actions**。之后每次推送到
`main`，工作流都会先使用冻结 lockfile 安装依赖、执行类型检查和单元测试、重新构建，
再上传 `apps/web/dist/` 并部署到受保护的 `github-pages` 环境；也可以手动触发。

Vite 使用相对 base，页面导航使用 URL hash，因此
`https://owner.github.io/Keepraw-Fly/` 这类项目站点不需要写死账号或仓库路径，
也不需要 SPA 重写规则。本工作流不会配置自定义域名；应先确定哪个站点使用
`keepraw.com`，再添加域名，不能提前猜测性加入 `CNAME`。
