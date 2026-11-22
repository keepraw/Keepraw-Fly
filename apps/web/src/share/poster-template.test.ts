import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listMapThemes } from "../map2d/theme-registry";
import { createNeonPassportLayout } from "./poster-neon";
import { posterPixelSize } from "./poster-export";
import { POSTER_TEMPLATES, resolvePosterTemplate } from "./poster-template";
import {
  DEFAULT_POSTER_TEMPLATE_ID,
  POSTER_TEMPLATE_IDS,
  isPosterTemplateId,
} from "./poster-template-ids";

const shareDir = path.dirname(new URL(import.meta.url).pathname);
const source = (file: string) =>
  readFileSync(path.join(shareDir, file), "utf8");
const imports = (file: string) =>
  [...source(file).matchAll(/from "(\.[^"]+)"/g)].map((match) => match[1]!);

describe("poster templates", () => {
  it("registers every id and falls back to Neon for unknown ones", () => {
    expect(Object.keys(POSTER_TEMPLATES).sort()).toEqual(
      [...POSTER_TEMPLATE_IDS].sort(),
    );
    for (const id of POSTER_TEMPLATE_IDS) {
      expect(isPosterTemplateId(id)).toBe(true);
      expect(resolvePosterTemplate(id).id).toBe(id);
    }
    expect(DEFAULT_POSTER_TEMPLATE_ID).toBe("neon");
    for (const stale of ["retired", "", 4, null, undefined, "constructor"])
      expect(resolvePosterTemplate(stale).id).toBe("neon");
  });

  it("exports Neon at twice its 4:5 artboard", () => {
    const template = resolvePosterTemplate("neon");
    const layout = template.createLayout();
    expect([layout.width, layout.height]).toEqual([1080, 1350]);
    expect(posterPixelSize({ template, layout })).toEqual({
      width: 2160,
      height: 2700,
    });
  });

  it("keeps the Neon grid inside the sheet with a full-width 44-cell MRZ", () => {
    const layout = createNeonPassportLayout();
    const { content, mrz, map, stats, fields, stamp } = layout;
    const bottom = content.y + content.height;
    for (const cell of [...stats, ...fields]) {
      expect(cell.x).toBeGreaterThanOrEqual(content.x);
      expect(cell.x + cell.width).toBeLessThanOrEqual(
        content.x + content.width + 1e-6,
      );
      expect(cell.baseline).toBeLessThan(bottom);
    }
    // Columns never touch, whatever the label length.
    const columns = stats.slice(0, 3);
    for (let index = 1; index < columns.length; index += 1)
      expect(columns[index]!.x).toBeGreaterThan(
        columns[index - 1]!.x + columns[index - 1]!.width,
      );
    expect(map.y + map.height).toBeLessThan(layout.separator);
    expect(stamp.y + stamp.height).toBeLessThanOrEqual(mrz.area.y);
    // Seven statistics plus the stamp fill the 3×3 grid.
    expect(stats).toHaveLength(9);
    expect(mrz.cellAdvance * 44).toBeCloseTo(layout.width - mrz.x * 2);
    expect(mrz.x).toBeLessThanOrEqual(content.x);
    expect(mrz.baseline + mrz.lineHeight).toBeLessThan(layout.height - 8);
  });

  it("keeps layout and map theme independent", () => {
    // The Neon layout takes whichever theme it is given...
    expect(listMapThemes().length).toBeGreaterThan(1);
    expect(source("poster-neon.ts")).not.toMatch(
      /themes\/|theme-registry|neon-aviation-tokens|#[0-9a-f]{6}\b/i,
    );
    // ...and no theme knows about a passport layout.
    const themeDir = path.join(shareDir, "../map2d");
    for (const file of readdirSync(themeDir, { recursive: true }) as string[])
      if (file.endsWith(".ts") && !file.endsWith(".test.ts"))
        expect(
          readFileSync(path.join(themeDir, file), "utf8"),
          file,
        ).not.toMatch(/\/share\//);
  });

  it("has no WebGL, globe or prototype-data dependency in the export path", () => {
    const seen = new Set<string>();
    const walk = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      for (const target of imports(file)) {
        const next = path.normalize(path.join(path.dirname(file), target));
        expect(next, `${file} -> ${target}`).not.toMatch(
          /globe|share-renderer|share-plan|sample-network|neon-passport-canvas/,
        );
        for (const candidate of [`${next}.ts`, `${next}.tsx`])
          try {
            source(candidate);
            walk(candidate);
            break;
          } catch {
            // Not a local source file with this extension.
          }
      }
    };
    walk("poster-export.ts");
    walk("poster-data.ts");
    walk("poster-copy.ts");
    expect(seen.size).toBeGreaterThan(8);
    for (const file of seen)
      expect(source(file), file).not.toMatch(
        /from "three|getContext\(\s*"(experimental-)?webgl/i,
      );
  });
});
