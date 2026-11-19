import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { documentPolicy } from "./security-policy.mjs";

/**
 * Production builds carry a <meta> CSP (GitHub Pages cannot send headers).
 * The dev server is excluded: React Fast Refresh injects an inline preamble.
 */
function contentSecurityPolicy(): Plugin {
  return {
    name: "keepraw-fly-content-security-policy",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler: () => [
        {
          tag: "meta",
          attrs: {
            "http-equiv": "Content-Security-Policy",
            content: documentPolicy,
          },
          injectTo: "head-prepend",
        },
      ],
    },
  };
}

export default defineConfig({
  base: "./",
  json: { stringify: "auto" },
  plugins: [react(), contentSecurityPolicy()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/core/data/airport-history/formal/"))
            return "airport-history-data";
          if (id.endsWith("/core/data/airport-names.json"))
            return "airport-names";
        },
        // Rollup names the shared lazy Three.js/Globe chunk after a CSS
        // import ("globe-lab"), although the dev-only GlobeLab experiment is
        // not in production builds. Name it after the renderer it contains.
        chunkFileNames(chunk) {
          return chunk.moduleIds.some((id) =>
            id.endsWith("/globe/GlobeMap.tsx"),
          )
            ? "assets/globe-renderer-[hash].js"
            : "assets/[name]-[hash].js";
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
