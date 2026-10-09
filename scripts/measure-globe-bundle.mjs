// A separate cost audit; this never enables Globe Lab in the production app.
import { build } from "../apps/web/node_modules/vite/dist/node/index.js";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const root = resolve("artifacts");
await mkdir(resolve(root, "globe-lab"), { recursive: true });
await writeFile(
  resolve(root, "globe-audit.html"),
  '<script type="module">import {createGlobe} from "../apps/web/src/globe/globe-renderer.ts";window.globeAudit=createGlobe;</script>',
);
const result = await build({
  configFile: false,
  root,
  base: "./",
  build: {
    outDir: resolve(root, "globe-audit-build"),
    emptyOutDir: true,
    rollupOptions: { input: resolve(root, "globe-audit.html") },
  },
});
const outputs = (Array.isArray(result) ? result : [result])
  .flatMap((r) => r.output ?? [])
  .map((o) => {
    const content = Buffer.from(o.type === "chunk" ? o.code : o.source);
    return {
      file: o.fileName,
      bytes: content.length,
      gzipBytes: gzipSync(content).length,
    };
  });
await writeFile(
  resolve(root, "globe-lab/bundle-audit.json"),
  JSON.stringify(outputs, null, 2),
);
console.log(outputs);
