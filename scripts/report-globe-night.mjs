import { readFile, writeFile } from "node:fs/promises";
import { b2, b34 } from "./lib/globe-night-history.mjs";
const folder = "docs/visual-review/task-1b-5";
const audit = JSON.parse(
  await readFile(`${folder}/texture-audit.json`, "utf8"),
);
const lines = [
  "# Texture audit and pre-change diagnosis",
  "",
  "Recorded before modifying the Task 1B-4 emission implementation. Values are normalized historical grayscale visualization signals, **not calibrated luminance**.",
  "",
  "All three SHA-256 hashes match the recorded NASA provenance. RGB channels agree in every sampled pixel. Sampling uses longitude -180..180 left-to-right and latitude 90..-90 top-to-bottom; city-center core boxes are ±0.25° in each axis. The wider geographic neighborhoods and native pixel bounds are in [texture-audit.json](texture-audit.json). Periphery excludes core boxes and includes unlit land/water; positive quantiles condition on bytes ≥4, immediately above the existing noise floor. Airport positions are not used.",
  "",
  "| Region / resolution | Near zero % (0..3) | All p90 | Core positive p50 | Periphery positive p10 / p50 / p90 | B3/B4 periphery positive p50 |",
  "| --- | ---: | ---: | ---: | --- | ---: |",
];
for (const t of audit.textures)
  for (const r of t.regions) {
    const s = r.statistics,
      f = (x) => x?.toFixed(4) ?? "—";
    lines.push(
      `| ${r.id} / ${t.name} | ${f(s.all.input.nearZeroPercent)} | ${f(s.all.input.q90)} | ${f(s.core.input.litQ50)} | ${[s.periphery.input.litQ10, s.periphery.input.litQ50, s.periphery.input.litQ90].map(f).join(" / ")} | ${f(s.periphery.b34Response.litQ50)} |`,
    );
  }
lines.push(
  "",
  "## Diagnosis",
  "",
  "1. The source contains substantial urban information: source positive core medians are 0.71–0.99. The 4K core medians remain 0.70–0.96. Downsampling reduces the strongest peaks and spatial detail, especially at 2K, but does not erase the metropolitan clusters. Lanczos spreads sparse positive pixels into neighboring pixels, so lower near-zero percentages do not imply new physical lights.",
  "2. The dominant loss is the compounded shader toe and gamma: subtracting 0.012, then a 0.075-wide smoothstep, then power 1.25. At input 0.02 / 0.04 / 0.10, the old scalar response is " +
    [0.02, 0.04, 0.1].map((x) => b34(x).toFixed(6)).join(" / ") +
    ". Bright cores approach 0.104 instead. Consequently, weak peripheral signal is disproportionately suppressed; multiplying all output would also raise the already controlled cores.",
  "3. The bounded shoulder is useful and should remain. Dark controls have ≥99.8% near-zero source pixels; rare nonzero values cannot automatically be identified as cities. Keep the existing noise threshold, a smooth low-end roll-in, and check final dark-control pixels.",
  "4. There is no evidence of a night-texture color-space bug: the raw grayscale asset uses NoColorSpace and contributes linearly before the existing ACES Filmic + sRGB output. Surface SRGBColorSpace decodes once. Tone mapping and the illuminated blue surface further reduce the visibility of tiny additive signals; actual WebGL on/off comparisons are required.",
  "",
  "## Historical reconstruction",
  "",
  "| Version / source commit | Scalar curve and default intensity | Palette | Theme strength | Solar night mask |",
  "| --- | --- | --- | --- | --- |",
  "| B2 `b9d32b3be9b6791a5a2861846d220c96ca0d59f0` | `1.6 * max(r-.012,0)^.85`; no bounded shoulder | saturated orange to pale gold, sqrt interpolation | Light .28 / Dark 1 | `1-smoothstep(-width*.7,width*.35,solar)` |",
  "| B3 `38c61266915edc1252769c305623d56a1ffb563e` | `.13 * s^1.25/(.24+s^1.25) * smoothstep(0,.075,s)`; intensity 1 | restrained warm-neutral | Light 0 / Dark 1 | `1-smoothstep(-width,width*.15,solar)` |",
  "| B4 source `2a7e67f8267ed9fce306d1315d374dd02aa65ac2`, checkpoint `2720002ef01845aa1b04bb31fce6d619a54a30bf` | same B3 curve; intensity 1 | same B3 warm-neutral | Light .45 / Dark 1 | same B3 night mask, now shared solar model |",
  "",
  "![Historical transfer functions](transfer-curves.svg)",
  "",
  "The chart includes default intensity, excludes palette and solar mask, and uses logarithmic vertical scaling to expose the crushed low range. [B2 appearance](../task-1b-3/before-dark-earth-1440.png), [B3 appearance](../task-1b-3/a-dark-earth-1440.png), and [B4 appearance](../task-1b-4/dark-earth-1440.png) were inspected. Those historical images also differ in surface/atmosphere treatment; only the new fixed-camera B4 comparison isolates emission.",
  "",
  "Correction target: restore peripheral signals around 0.03–0.20 and urban middle values, retain the 0.012 noise floor, and keep the existing peak near 0.104. Separate toe width, midtone shoulder scale, and peak output controls. Preserve the palette, default intensity, theme strengths, and solar kernel.",
);
await writeFile(`${folder}/diagnosis.md`, lines.join("\n") + "\n");
const curves = [
  { name: "B2 (intensity 1.6)", color: "#b45309", fn: b2 },
  { name: "B3 / B4 (intensity 1)", color: "#2563eb", fn: b34 },
];
if (process.argv.includes("--new")) {
  const { nightResponse } =
    await import("../apps/web/src/globe/globe-night-response.ts");
  curves.push({
    name: "B5 (intensity 1)",
    color: "#dc2626",
    fn: nightResponse,
  });
}
const plot = (x, y) => [
  65 + x * 640,
  310 - ((Math.log10(Math.max(y, 1e-6)) + 6) / 6.3) * 245,
];
const paths = curves
  .map(
    (c) =>
      `<path fill="none" stroke="${c.color}" stroke-width="2" d="${Array.from(
        { length: 501 },
        (_, i) => {
          const [x, y] = plot(i / 500, c.fn(i / 500));
          return `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
        },
      ).join(" ")}"/>`,
  )
  .join("");
await writeFile(
  `${folder}/transfer-curves.svg`,
  `<svg xmlns="http://www.w3.org/2000/svg" width="780" height="390" viewBox="0 0 780 390"><rect width="780" height="390" fill="white"/><g font-family="sans-serif" font-size="12" fill="#172b4d"><text x="65" y="24" font-size="17">Historical night-light scalar response (log output)</text>${[
    -6, -5, -4, -3, -2, -1, 0,
  ]
    .map((e) => {
      const y = plot(0, 10 ** e)[1];
      return `<path d="M65 ${y}H705" stroke="#e2e8f0"/><text x="10" y="${y + 4}">10^${e}</text>`;
    })
    .join(
      "",
    )}${[0, 0.1, 0.2, 0.4, 0.6, 0.8, 1].map((v) => `<text x="${plot(v, 0)[0] - 6}" y="330">${v}</text>`).join("")}${paths}<text x="275" y="355">Normalized grayscale input (not physical radiance)</text>${curves.map((c, i) => `<text x="${65 + i * 220}" y="380" fill="${c.color}">${c.name}</text>`).join("")}</g></svg>`,
);
