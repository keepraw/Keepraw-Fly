# Static deployment

Build the viewer with:

```bash
pnpm install --frozen-lockfile
pnpm build
```

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

