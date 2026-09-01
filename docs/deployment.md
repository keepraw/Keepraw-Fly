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
