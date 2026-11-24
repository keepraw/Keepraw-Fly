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

/**
 * A production build has one stylesheet in the head, so its first paint has the
 * skin tokens. The dev server delivers styles with the entry module; link the
 * skins there too. They stay out of index.html so the build keeps them last.
 */
function skinFirstPaint(): Plugin {
  return {
    name: "keepraw-fly-skin-first-paint",
    apply: "serve",
    transformIndexHtml: () =>
      ["minimal", "aviation"].map((skin) => ({
        tag: "link",
        attrs: { rel: "stylesheet", href: `/src/styles/skin-${skin}.css` },
        injectTo: "head",
      })),
  };
}

export default defineConfig({
  base: "./",
  json: { stringify: "auto" },
  plugins: [react(), contentSecurityPolicy(), skinFirstPaint()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/core/data/airport-history/formal/"))
            return "airport-history-data";
          if (id.endsWith("/core/data/airport-names.json"))
            return "airport-names";
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
